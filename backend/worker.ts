import { Worker, Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { CodebaseAnalyzer } from './analyzer';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const analyzer = new CodebaseAnalyzer();

export const analysisQueue = new Queue('analysis-jobs', { connection });

interface AnalysisJobData {
  githubUrl: string;
  repoId: string;
}

// In-process cache (Redis is better for true prod)
const resultCache = new Map<string, any>();

export const startWorker = async () => {
  await analyzer.init();
  console.log('Worker initialized with AST engine');

  const worker = new Worker<AnalysisJobData>('analysis-jobs', async (job: Job) => {
    const { githubUrl, repoId } = job.data;
    
    // Hash URL for cache key
    const cacheKey = crypto.createHash('md5').update(githubUrl).digest('hex');
    if (resultCache.has(cacheKey)) {
      console.log(`Cache hit for ${githubUrl}`);
      return resultCache.get(cacheKey);
    }

    const tempDir = path.join(__dirname, 'temp', `repo-${job.id}`);
    await fs.ensureDir(tempDir);

    try {
      job.updateProgress(10);
      console.log(`Cloning ${githubUrl} into ${tempDir}...`);
      
      const git = simpleGit();
      await git.clone(githubUrl, tempDir, ['--depth', '1']);
      
      job.updateProgress(30);
      console.log(`Analyzing ${githubUrl}...`);
      const result = await analyzer.analyzeRepo(tempDir);
      
      job.updateProgress(90);
      
      // Store result in cache and persistent DB
      resultCache.set(cacheKey, result);
      
      console.log(`Analysis complete for ${githubUrl}: ${result.nodes.length} nodes found`);
      return result;
    } catch (err) {
      console.error(`Analysis failed for ${githubUrl}:`, err);
      throw err;
    } finally {
      // Securely cleanup temporary folder
      await fs.remove(tempDir);
    }
  }, { 
    connection,
    concurrency: 5, // Limit simultaneous analyzes
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
};

if (require.main === module) {
  startWorker();
}
