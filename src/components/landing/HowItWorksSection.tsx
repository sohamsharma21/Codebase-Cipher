import { motion } from 'framer-motion';
import { Link2, Cpu, BarChart3 } from 'lucide-react';

const steps = [
  { icon: Link2, num: '01', title: 'Paste GitHub URL', desc: 'Drop any public repository link into the search bar.' },
  { icon: Cpu, num: '02', title: 'AI Analyzes Codebase', desc: 'Our engine parses every file, import, and export.' },
  { icon: BarChart3, num: '03', title: 'Explore Visual Graph', desc: 'Navigate an interactive map with AI explanations.' },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24 border-t border-border/40">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">How it works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">Three Steps to Clarity</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-14 left-[18%] right-[18%] h-px bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />

          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center relative"
            >
              <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
                <s.icon className="w-7 h-7 text-primary" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {s.num}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
