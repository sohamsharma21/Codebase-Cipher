import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for trying it out',
    features: ['5 repos per month', 'Basic dependency graph', 'File explorer', 'Community support'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    desc: 'For individual developers',
    features: ['Unlimited repos', 'AI-powered summaries', 'Health reports', 'Chat with codebase', 'Priority support'],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$39',
    period: '/month',
    desc: 'For teams and organizations',
    features: ['Everything in Pro', 'Team sharing', 'Private repos', 'SSO integration', 'Custom branding', 'API access'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative" id="pricing">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(212_100%_67%/0.06),transparent)]" />
      <div className="container mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">Pricing</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground mt-3">No hidden fees. Cancel anytime.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 border transition-all ${
                t.highlighted
                  ? 'border-primary/50 bg-gradient-to-b from-primary/10 to-card/60 shadow-[0_0_40px_hsl(212_100%_67%/0.1)]'
                  : 'border-border/50 bg-card/40'
              }`}
            >
              {t.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-foreground">{t.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-bold text-foreground">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  t.highlighted
                    ? 'bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(212_100%_67%/0.3)]'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {t.cta}
              </button>
              <ul className="mt-6 space-y-2.5">
                {t.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-green shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
