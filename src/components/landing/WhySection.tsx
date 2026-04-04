import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const benefits = [
  'Saves hours of onboarding time',
  'Instantly understand large repos',
  'Perfect for new developers joining a team',
  'Built for real-world scale and complexity',
  'No setup required — just paste a URL',
  'AI-powered explanations in plain English',
];

export default function WhySection() {
  return (
    <section className="py-24 border-t border-border/40">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs text-primary font-semibold uppercase tracking-widest">Why Codebase Cipher</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-8">
              Stop Reading Code Line by Line
            </h2>
            <div className="space-y-4">
              {benefits.map((b, i) => (
                <motion.div
                  key={b}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-green/15 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-green" />
                  </div>
                  <span className="text-sm text-foreground/90">{b}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Stats card */}
            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-8">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { val: '10x', label: 'Faster Onboarding' },
                  { val: '500+', label: 'Files Analyzed' },
                  { val: '<30s', label: 'Analysis Time' },
                  { val: '98%', label: 'Accuracy Rate' },
                ].map(s => (
                  <div key={s.label} className="text-center p-4 rounded-xl bg-background/40">
                    <div className="text-2xl font-bold bg-gradient-to-r from-primary to-purple bg-clip-text text-transparent">{s.val}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
