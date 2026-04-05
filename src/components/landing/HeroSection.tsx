import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnimatedGraph from './AnimatedGraph';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(212_100%_67%/0.12),transparent)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple/5 rounded-full blur-3xl" />

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(215_14%_21%/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(215_14%_21%/0.3)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]" />

      <div className="relative container mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-6"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-primary font-medium">AI-Powered Codebase Analysis</span>
            </motion.div>

            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.05] tracking-tight text-foreground mb-6 transition-all duration-500">
              AI GitHub <br/>
              <span className="bg-gradient-to-r from-primary via-purple to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient_3s_linear_infinite]">
                Repository Analyzer
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg transition-all duration-300">
              Instantly understand any GitHub repository with AI — explore architecture, tech stack, and codebase structure in seconds.
            </p>

            <div className="flex flex-wrap gap-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/dashboard')}
                className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-[0_0_30px_hsl(212_100%_67%/0.3)] hover:shadow-[0_0_40px_hsl(212_100%_67%/0.5)] transition-shadow"
              >
                Analyze Repository
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/dashboard?demo=true')}
                className="px-6 py-3 rounded-xl border border-border bg-card/50 backdrop-blur-sm text-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors"
              >
                View Demo
              </motion.button>
            </div>

            <div className="flex items-center gap-6 mt-10">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-gradient-to-br from-primary/60 to-purple/60" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">2,000+</span> repos analyzed this week
              </p>
            </div>
          </motion.div>

          {/* Right — animated graph */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <AnimatedGraph />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
