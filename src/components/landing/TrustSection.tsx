import { motion } from 'framer-motion';
import { GitBranch, Code2, Terminal, Database, Layers, Cpu } from 'lucide-react';

const logos = [
  { icon: GitBranch, label: 'GitHub' },
  { icon: Code2, label: 'VS Code' },
  { icon: Terminal, label: 'CLI Tools' },
  { icon: Database, label: 'Databases' },
  { icon: Layers, label: 'Frameworks' },
  { icon: Cpu, label: 'AI/ML' },
];

export default function TrustSection() {
  return (
    <section className="py-20 border-y border-border/40 bg-card/20">
      <div className="container mx-auto px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mb-10 tracking-wide uppercase"
        >
          Built for Developers, Teams, and Startups
        </motion.p>
        <div className="flex flex-wrap justify-center gap-10 md:gap-16">
          {logos.map((l, i) => (
            <motion.div
              key={l.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <l.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{l.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
