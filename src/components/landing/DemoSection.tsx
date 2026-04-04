import { useState } from 'react';
import { motion } from 'framer-motion';

const fakeFiles = [
  { name: 'index.js', color: '#d29922', code: "const express = require('express');\nconst app = express();\n\napp.use('/api', router);\napp.listen(3000);" },
  { name: 'router.js', color: '#d29922', code: "const router = require('express').Router();\nrouter.get('/users', getUsers);\nrouter.post('/users', createUser);\n\nmodule.exports = router;" },
  { name: 'auth.ts', color: '#58a6ff', code: "export function verifyToken(token: string) {\n  return jwt.verify(token, SECRET);\n}\n\nexport function hashPassword(pw: string) {\n  return bcrypt.hash(pw, 10);\n}" },
];

export default function DemoSection() {
  const [activeFile, setActiveFile] = useState(0);

  return (
    <section className="py-24 relative" id="demo">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,hsl(212_100%_67%/0.05),transparent)]" />
      <div className="container mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">Interactive Demo</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">Click a Node, See the Code</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden shadow-2xl shadow-primary/5"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/50 bg-card/60">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-orange/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green/60" />
            <span className="ml-3 text-[10px] text-muted-foreground font-mono">codebase-cipher — live preview</span>
          </div>

          <div className="grid md:grid-cols-2 min-h-[320px]">
            {/* Left — graph nodes */}
            <div className="p-6 border-r border-border/30 flex flex-col items-center justify-center gap-3 bg-background/30">
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Click a node</p>
              {fakeFiles.map((f, i) => (
                <motion.button
                  key={f.name}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveFile(i)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-mono transition-all ${
                    activeFile === i
                      ? 'border-primary/50 bg-primary/10 text-foreground shadow-[0_0_15px_hsl(212_100%_67%/0.15)]'
                      : 'border-border/40 bg-card/30 text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                  {f.name}
                </motion.button>
              ))}
              {/* Fake edges */}
              <svg className="w-20 h-10 text-primary/20 mt-1" viewBox="0 0 80 40">
                <line x1="40" y1="0" x2="20" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="0" x2="60" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
              </svg>
            </div>

            {/* Right — code */}
            <div className="p-5 bg-[hsl(215_28%_6%)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: fakeFiles[activeFile].color }} />
                <span className="text-xs font-mono text-foreground">{fakeFiles[activeFile].name}</span>
              </div>
              <motion.pre
                key={activeFile}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap"
              >
                {fakeFiles[activeFile].code}
              </motion.pre>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
