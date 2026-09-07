import { useRef, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { fireplaceAppSchema } from '../../shared/schemas/app.fireplace';
import { bucketOf, buildFlameSprites, emberColor, spawnPerFrame } from './fire-params';

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
    // Half-width of the hearth bed. Sized so the bed's ends stay inside the
    // round glass: at 250 out and 150 up from centre-bottom the corner sits
    // 477 from the middle of a 500-radius disc.
    const SPREAD = 250;
    canvas.width = W;
    canvas.height = H;

    const particles = particlesRef.current;
    const perFrame = spawnPerFrame(intensity);

    // Pre-rendered once per hue: the render loop only ever calls drawImage.
    const sprites = buildFlameSprites(hue, (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    });

    function spawn() {
      for (let i = 0; i < perFrame; i++) {
        // The hearth follows the bottom of the disc rather than lying flat
        // across the square canvas: on a round panel a straight bed puts its
        // ends outside the glass, so the fire appeared to start mid-air.
        const dx = (Math.random() - 0.5) * 2 * SPREAD;
        // How far out on the bed this particle starts, 0 at the centre and 1
        // at the edge. Outer particles rise slower, drift outward and die
        // sooner, so the fire mounds and tapers. Giving every particle the
        // same rise made a slab-sided column, which is the shape nothing in
        // nature burns in.
        const e = Math.abs(dx) / SPREAD;
        particles.push({
          x: W / 2 + dx,
          y: H - 80 - (dx / SPREAD) ** 2 * 70,
          vx: (Math.random() - 0.5) * 2 + dx * 0.004,
          vy: -(Math.random() * 4 + 3.5) * (1 - 0.45 * e * e),
          life: 0,
          maxLife: (95 + Math.random() * 55) * (1 - 0.35 * e * e),
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

      // The trail smear, and the one part of this that must not change: the
      // fill never hard-clears, so flames leave an upward smear. That smear is
      // the look. It has to run in source-over — additive compositing with
      // black is a no-op.
      ctx!.globalCompositeOperation = 'source-over';
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx!.fillRect(0, 0, W, H);

      spawn();

      // Fire is emissive: overlapping flame gets brighter, it does not occlude.
      // Without this every particle painted over its neighbour and the result
      // read as drifting confetti rather than a body of flame.
      ctx!.globalCompositeOperation = 'lighter';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx + (Math.random() - 0.5) * 1.5;
        p.y += p.vy;
        p.vy *= 0.99;
        p.size *= 0.985;

        const t = p.life / p.maxLife;

        if (t > 1 || p.size < 1) {
          particles.splice(i, 1);
          continue;
        }

        // Colour by life phase, from the sprite built for this hue. Alpha
        // stays on the fade so a dying particle still leaves the frame.
        const sprite = sprites[bucketOf(t)];
        const d = p.size * 2.6;
        ctx!.globalAlpha = Math.max(0, 1 - t) * 0.4;
        ctx!.drawImage(sprite, p.x - d / 2, p.y - d / 2, d, d);
      }
      ctx!.globalAlpha = 1;

      // Ember bed. Drawn as a disc centred on the hearth rather than a
      // full-width rect: the rect's corners fell outside the round glass, so
      // two thirds of it was never visible on the device it ships to.
      const gradient = ctx!.createRadialGradient(W / 2, H - 40, 0, W / 2, H - 40, 320);
      gradient.addColorStop(0, emberColor(hue, 0.2));
      gradient.addColorStop(1, emberColor(hue, 0));
      ctx!.fillStyle = gradient;
      ctx!.beginPath();
      ctx!.arc(W / 2, H - 40, 320, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = 'source-over';

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
