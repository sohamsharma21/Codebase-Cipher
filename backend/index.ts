import fastify from 'fastify';
import { analysisQueue } from './worker';
import { z } from 'zod';
import { ContextBuilder } from './context';
import { LLMOrchestrator } from './orchestrator';

const server = fastify({ logger: true });
const orchestrator = new LLMOrchestrator();
const contexts: Record<string, ContextBuilder> = {};

const AnalyzeSchema = z.object({
  url: z.string().url().startsWith('https://github.com/'),
});

server.post('/analyze', async (request, reply) => {
  const parse = AnalyzeSchema.safeParse(request.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid GitHub URL' });
  }

  const { url } = parse.data;

  // Check queue status/presence if needed
  const job = await analysisQueue.add('analyze', { githubUrl: url }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });

  return { 
    id: job.id, 
    status: 'queued',
    message: 'Analysis job added to worker queue'
  };
});

server.post('/analyze-node', async (request, reply) => {
  const Schema = z.object({
    repoId: z.string(),
    nodeId: z.string(),
    repoPath: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  });

  const parse = Schema.safeParse(request.body);
  if (!parse.success) return reply.status(400).send({ error: 'Invalid payload' });

  const { repoId, nodeId, repoPath, nodes, edges } = parse.data;
  
  if (!contexts[repoId]) contexts[repoId] = new ContextBuilder(repoPath);
  
  const ctx = await contexts[repoId].buildContext(nodeId, nodes, edges);
  const analysis = await orchestrator.analyze(ctx);

  return analysis;
});

server.get('/job/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const job = await analysisQueue.getJob(id);

  if (!job) {
    return reply.status(404).send({ error: 'Job not found' });
  }

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;

  return { id, state, progress, result };
});

const start = async () => {
  try {
    await server.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
    console.log('Scalable Analyzer API listening on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
