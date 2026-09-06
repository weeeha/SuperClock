import { useRef, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { fireplaceAppSchema } from '../../shared/schemas/app.fireplace';
import { emberColor, flameColor, spawnPerFrame } from './fire-params';

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
export default function FireplaceApp({ isActive, config }: AppProps) {
  // Calendar pattern: the admin's config validated against app.fireplace, defaults otherwise.
  const parsed = fireplaceAppSchema.safeParse(config ?? {});
  const { intensity, hue } = parsed.success ? parsed.data : fireplaceAppSchema.parse({});
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
    const perFrame = spawnPerFrame(intensity);

    function spawn() {
      for (let i = 0; i < perFrame; i++) {
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

        // Colour by life phase for the configured hue (classic = yellow → orange → red → dark)
        const { r, g, b } = flameColor(hue, t);

        const alpha = Math.max(0, 1 - t);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx!.fill();
      }

      // Glowing embers at base
      const gradient = ctx!.createRadialGradient(W / 2, H, 0, W / 2, H, 200);
      gradient.addColorStop(0, emberColor(hue, 0.3));
      gradient.addColorStop(1, emberColor(hue, 0));
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, H - 200, W, 200);

      animRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animRef.current);
      particles.length = 0;
    };
    // A config push mid-session restarts the simulation with the new numbers.
  }, [isActive, intensity, hue]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
