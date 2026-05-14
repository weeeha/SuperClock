import { useEffect, useRef } from 'react';
import type { Sprite } from './sprites';

const GRID = 20;
const PANEL_BG = '#0a0a09';
const GRID_STROKE = '#1c1c1a';

interface Props {
  sprite: Sprite;
  size: number;
  isActive: boolean;
}

// Renders the current sprite's frames into a canvas, scaled to `size`,
// with a visible cell grid behind the pixel art (matches the Figma
// "pixel display" panel look — every cell shows even when transparent).
export default function ClawdSprite({ sprite, size, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    frameIdx.current = 0;
  }, [sprite.id]);

  useEffect(() => {
    if (!isActive) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = size / GRID;
    // Crisp 1px lines on a canvas: offset by 0.5 so strokes land on pixel boundaries.
    const lineW = Math.max(1, Math.floor(cell / 12));
    ctx.imageSmoothingEnabled = false;

    function paint() {
      const frame = sprite.frames[frameIdx.current];
      if (!ctx || !frame) return;

      // Panel background fill (uniform — sets the "off" cell colour).
      ctx.fillStyle = PANEL_BG;
      ctx.fillRect(0, 0, size, size);

      // Fill lit cells.
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const code = frame.cells[gy * GRID + gx];
          if (code === 0) continue;
          const color = sprite.palette[code];
          if (!color || color === 'transparent') continue;
          ctx.fillStyle = color;
          ctx.fillRect(gx * cell, gy * cell, cell, cell);
        }
      }

      // Grid lines drawn on top so they cross both lit and unlit cells,
      // giving the "etched into the panel" pixel-display feel.
      ctx.strokeStyle = GRID_STROKE;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      for (let i = 0; i <= GRID; i++) {
        const v = i * cell;
        ctx.moveTo(v, 0);
        ctx.lineTo(v, size);
        ctx.moveTo(0, v);
        ctx.lineTo(size, v);
      }
      ctx.stroke();

      const next = (frameIdx.current + 1) % sprite.frames.length;
      frameIdx.current = next;
      timer.current = setTimeout(paint, Math.max(40, frame.hold));
    }

    paint();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sprite, size, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
}
