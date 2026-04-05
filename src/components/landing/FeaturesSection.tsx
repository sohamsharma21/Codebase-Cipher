import { motion } from 'framer-motion';
import { Network, Code, Globe, GitFork, Brain, MousePointerClick } from 'lucide-react';

const features = [
  { icon: Network, title: 'Instant Summaries', desc: 'Repo overview and visual map in seconds' },
  { icon: Globe, title: 'API Discovery', desc: 'Automatically finds REST APIs and routes' },
  { icon: Brain, title: 'AI Codebase Analysis', desc: 'GitHub project structure · Open source repository understanding' },
  { icon: Code, title: 'AI Chat', desc: 'Ask questions about the code and get answers with sources' },
  { icon: GitFork, title: 'Dependency Map', desc: 'Visual map of file relationships and imports' },
  { icon: MousePointerClick, title: 'Pro Navigation', desc: 'Click any node to jump to source code' },
];

export default function FeaturesSection() {
  return (
    <section className="py-24 relative" id="features">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,hsl(261_73%_77%/0.04),transparent)]" />
      <div className="container mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">Features</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">
            Everything You Need to Decode a Repo
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            Six powerful tools to make any codebase transparent in minutes.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative p-6 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/30 hover:bg-card/70 transition-all duration-300"
            >
              {/* Glow on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
