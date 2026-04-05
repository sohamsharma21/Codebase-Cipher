import { motion } from 'framer-motion';
import { GitBranch, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Demo', href: '#demo' },
  { label: 'Pricing', href: '#pricing' },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/60 backdrop-blur-xl"
    >
      <div className="container mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm text-foreground">Codebase Cipher</span>
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:shadow-[0_0_15px_hsl(212_100%_67%/0.3)] transition-shadow"
          >
            Launch App
          </button>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl"
        >
          <div className="container mx-auto px-6 py-4 space-y-3">
            {navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
                {l.label}
              </a>
            ))}
            <button onClick={() => { setOpen(false); navigate('/dashboard'); }}
              className="w-full mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
            >
              Launch App
            </button>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
