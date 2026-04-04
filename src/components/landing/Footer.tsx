import { GitBranch } from 'lucide-react';

const links = {
  Product: ['Features', 'Pricing', 'Demo', 'Changelog'],
  Resources: ['Docs', 'API Reference', 'Blog', 'Community'],
  Company: ['About', 'Careers', 'Contact', 'Privacy Policy'],
};

export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/20 py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground">Codebase Cipher</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Illuminate every codebase with AI-powered visual analysis.
            </p>
          </div>
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border/30 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[11px] text-muted-foreground">© 2026 Codebase Cipher. All rights reserved.</p>
          <div className="flex gap-4">
            {['GitHub', 'Twitter', 'Discord'].map(s => (
              <a key={s} href="#" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{s}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
