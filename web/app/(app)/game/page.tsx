'use client';

import { useEffect, useRef, useState } from 'react';

type Shot = { x: number; y: number };
type Enemy = { x: number; y: number; alive: boolean };

const W = 720;
const H = 520;

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef(new Set<string>());
  const [score, setScore] = useState(0);
  const [state, setState] = useState<'playing' | 'win' | 'lost'>('playing');

  useEffect(() => {
    let raf = 0;
    let player = W / 2;
    let cooldown = 0;
    let dir = 1;
    let enemyStep = 0;
    const shots: Shot[] = [];
    const enemyShots: Shot[] = [];
    let enemies: Enemy[] = Array.from({ length: 30 }, (_, i) => ({
      x: 90 + (i % 10) * 58,
      y: 70 + Math.floor(i / 10) * 48,
      alive: true,
    }));

    const reset = () => {
      player = W / 2;
      cooldown = 0;
      dir = 1;
      enemyStep = 0;
      shots.length = 0;
      enemyShots.length = 0;
      enemies = Array.from({ length: 30 }, (_, i) => ({
        x: 90 + (i % 10) * 58,
        y: 70 + Math.floor(i / 10) * 48,
        alive: true,
      }));
      setScore(0);
      setState('playing');
    };

    const down = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'A', 'D', 'Enter'].includes(event.key)) {
        event.preventDefault();
      }
      if (event.key === 'Enter') reset();
      keys.current.add(event.key);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    const loop = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#070b1a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 80; i++) ctx.fillRect((i * 97) % W, (i * 53 + performance.now() / 30) % H, 2, 2);

      if (state === 'playing') {
        if (keys.current.has('ArrowLeft') || keys.current.has('a') || keys.current.has('A')) player -= 6;
        if (keys.current.has('ArrowRight') || keys.current.has('d') || keys.current.has('D')) player += 6;
        player = Math.max(24, Math.min(W - 24, player));
        if (cooldown > 0) cooldown -= 1;
        if (keys.current.has(' ') && cooldown === 0) {
          shots.push({ x: player, y: H - 62 });
          cooldown = 12;
        }

        enemyStep += 1;
        if (enemyStep % 2 === 0) enemies.forEach((e) => (e.x += dir * 1.2));
        const living = enemies.filter((e) => e.alive);
        if (living.some((e) => e.x < 35 || e.x > W - 35)) {
          dir *= -1;
          living.forEach((e) => (e.y += 18));
        }
        if (Math.random() < 0.025 && living.length) {
          const e = living[Math.floor(Math.random() * living.length)];
          enemyShots.push({ x: e.x, y: e.y + 18 });
        }

        shots.forEach((s) => (s.y -= 9));
        enemyShots.forEach((s) => (s.y += 5));
        shots.forEach((s) => {
          enemies.forEach((e) => {
            if (e.alive && Math.abs(s.x - e.x) < 20 && Math.abs(s.y - e.y) < 16) {
              e.alive = false;
              s.y = -99;
              setScore((v) => v + 10);
            }
          });
        });
        if (enemyShots.some((s) => Math.abs(s.x - player) < 22 && Math.abs(s.y - (H - 42)) < 18) || living.some((e) => e.y > H - 95)) setState('lost');
        if (living.length === 0) setState('win');
      }

      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(player, H - 72);
      ctx.lineTo(player - 24, H - 32);
      ctx.lineTo(player + 24, H - 32);
      ctx.fill();

      ctx.fillStyle = '#facc15';
      shots.forEach((s) => ctx.fillRect(s.x - 2, s.y - 12, 4, 14));
      ctx.fillStyle = '#fb7185';
      enemyShots.forEach((s) => ctx.fillRect(s.x - 2, s.y, 4, 12));
      enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(e.x - 17, e.y - 10, 34, 20);
        ctx.fillStyle = '#a7f3d0';
        ctx.fillRect(e.x - 10, e.y - 16, 20, 6);
      });

      if (state !== 'playing') {
        ctx.fillStyle = 'rgba(0,0,0,.62)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(state === 'win' ? 'Победа!' : 'Корабль сбит', W / 2, H / 2);
        ctx.font = '18px system-ui';
        ctx.fillText('Enter — начать заново', W / 2, H / 2 + 38);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [state]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--focus-text-muted)]">Arcade</p>
          <h1 className="text-3xl font-bold">Игра</h1>
          <p className="text-sm text-[var(--focus-text-muted)]">Стрелки/A-D — движение, пробел — огонь, Enter — рестарт.</p>
        </div>
        <div className="rounded-2xl border border-[var(--focus-border)] bg-[var(--focus-surface)] px-4 py-3 text-right">
          <p className="text-xs text-[var(--focus-text-muted)]">Счёт</p>
          <p className="text-2xl font-bold">{score}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[2rem] border border-[var(--focus-border)] bg-slate-950 p-3 shadow-[var(--focus-shadow)]">
        <canvas ref={canvasRef} width={W} height={H} className="h-auto w-full rounded-[1.4rem]" />
      </div>
    </main>
  );
}
