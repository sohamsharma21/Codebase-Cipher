import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,hsl(212_100%_67%/0.08),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(hsl(215_14%_21%/0.2)_1px,transparent_1px),linear-gradient(90deg,hsl(215_14%_21%/0.2)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />

      <div className="container mx-auto px-6 relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Stop Getting Lost in Codebases
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            Join thousands of developers who understand code faster with AI-powered visualization.
          </p>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/app')}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[0_0_40px_hsl(212_100%_67%/0.35)] hover:shadow-[0_0_60px_hsl(212_100%_67%/0.5)] transition-shadow"
          >
            Start Free Analysis
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>
          <p className="text-xs text-muted-foreground mt-4">No credit card required · Free forever tier</p>
        </motion.div>
      </div>
    </section>
  );
}
