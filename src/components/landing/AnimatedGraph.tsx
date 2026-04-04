import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface Edge {
  from: number;
  to: number;
}

export default function AnimatedGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 520;
    const h = 400;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const colors = ['#58a6ff', '#bc8cff', '#3fb950', '#d29922', '#f778ba', '#79c0ff'];

    const nodes: Node[] = Array.from({ length: 18 }, () => ({
      x: Math.random() * (w - 40) + 20,
      y: Math.random() * (h - 40) + 20,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 4 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const count = Math.floor(Math.random() * 2) + 1;
      for (let j = 0; j < count; j++) {
        const to = Math.floor(Math.random() * nodes.length);
        if (to !== i) edges.push({ from: i, to });
      }
    }

    let animId: number;
    function draw() {
      ctx!.clearRect(0, 0, w, h);

      // edges
      for (const e of edges) {
        const a = nodes[e.from], b = nodes[e.to];
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = 'rgba(88, 166, 255, 0.12)';
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 10 || n.x > w - 10) n.vx *= -1;
        if (n.y < 10 || n.y > h - 10) n.vy *= -1;

        // glow
        const grad = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 4);
        grad.addColorStop(0, n.color + '40');
        grad.addColorStop(1, 'transparent');
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius * 4, 0, Math.PI * 2);
        ctx!.fill();

        // node
        ctx!.fillStyle = n.color;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-purple/10 blur-xl" />
      <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/50">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-orange/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green/70" />
          <span className="ml-2 text-[10px] text-muted-foreground font-mono">dependency-graph.viz</span>
        </div>
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
