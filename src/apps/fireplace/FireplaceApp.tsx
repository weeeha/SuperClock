import { useRef, useEffect } from 'react';
import type { AppProps } from '../../core/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/** Fireplace ambient screen — Canvas particle fire simulation */
export default function FireplaceApp({ isActive }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1000;
    const H = 1000;
    canvas.width = W;
    canvas.height = H;

    const particles = particlesRef.current;

    function spawn() {
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: W / 2 + (Math.random() - 0.5) * 300,
          y: H - 50,
          vx: (Math.random() - 0.5) * 2,
          vy: -(Math.random() * 3 + 2),
          life: 0,
          maxLife: 60 + Math.random() * 40,
          size: 20 + Math.random() * 30,
        });
      }
    }

    let frame = 0;
    function render() {
      frame++;
      // 30fps throttle
      if (frame % 2 === 0) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      ctx!.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx!.fillRect(0, 0, W, H);

      spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx + (Math.random() - 0.5) * 1.5;
        p.y += p.vy;
        p.vy *= 0.99;
        p.size *= 0.98;

        const t = p.life / p.maxLife;

        if (t > 1 || p.size < 1) {
          particles.splice(i, 1);
          continue;
        }

        // Color gradient: yellow → orange → red → dark
        let r: number, g: number, b: number;
        if (t < 0.2) {
          r = 255; g = 255; b = 100;
        } else if (t < 0.5) {
          r = 255; g = Math.floor(180 - t * 200); b = 0;
        } else {
          r = Math.floor(255 - (t - 0.5) * 400); g = 0; b = 0;
        }

        const alpha = Math.max(0, 1 - t);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${Math.max(0, r)}, ${Math.max(0, g)}, ${b}, ${alpha})`;
        ctx!.fill();
      }

      // Glowing embers at base
      const gradient = ctx!.createRadialGradient(W / 2, H, 0, W / 2, H, 200);
      gradient.addColorStop(0, 'rgba(255, 100, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, H - 200, W, 200);

      animRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animRef.current);
      particles.length = 0;
    };
  }, [isActive]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
