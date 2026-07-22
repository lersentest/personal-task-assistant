'use client';

import { useEffect, useRef, useState } from 'react';

type Shot = { x: number; y: number };
type Enemy = { x: number; y: number; alive: boolean; dive?: boolean };
type Block = { x: number; y: number; hp: number };

const W = 720;
const H = 520;
const START_LIVES = 3;

function makeEnemies(): Enemy[] {
  return Array.from({ length: 28 }, (_, i) => ({
    x: 92 + (i % 7) * 78,
    y: 70 + Math.floor(i / 7) * 42,
    alive: true,
  }));
}

function makeBlocks(): Block[] {
  return [150, 300, 450, 600].map((x) => ({ x, y: H - 125, hp: 5 }));
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef(new Set<string>());
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [state, setState] = useState<'playing' | 'win' | 'lost'>('playing');

  useEffect(() => {
    let raf = 0;
    let player = W / 2;
    let cooldown = 0;
    let dir = 1;
    let tick = 0;
    let invulnerable = 0;
    const shots: Shot[] = [];
    const enemyShots: Shot[] = [];
    let enemies = makeEnemies();
    let blocks = makeBlocks();

    const reset = () => {
      player = W / 2;
      cooldown = 0;
      dir = 1;
      tick = 0;
      invulnerable = 0;
      shots.length = 0;
      enemyShots.length = 0;
      enemies = makeEnemies();
      blocks = makeBlocks();
      setScore(0);
      setLives(START_LIVES);
      setState('playing');
    };

    const hitPlayer = () => {
      if (invulnerable > 0) return;
      setLives((v) => {
        const next = v - 1;
        if (next <= 0) setState('lost');
        return Math.max(0, next);
      });
      invulnerable = 90;
      enemyShots.length = 0;
      player = W / 2;
    };

    const down = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'A', 'D', 'Enter'].includes(event.key)) event.preventDefault();
      if (event.key === 'Enter') reset();
      keys.current.add(event.key);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    const loop = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#070b1a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 80; i++) ctx.fillRect((i * 97) % W, (i * 53 + performance.now() / 30) % H, 2, 2);

      if (state === 'playing') {
        tick += 1;
        if (invulnerable > 0) invulnerable -= 1;
        if (keys.current.has('ArrowLeft') || keys.current.has('a') || keys.current.has('A')) player -= 6;
        if (keys.current.has('ArrowRight') || keys.current.has('d') || keys.current.has('D')) player += 6;
        player = Math.max(24, Math.min(W - 24, player));
        if (cooldown > 0) cooldown -= 1;
        if (keys.current.has(' ') && cooldown === 0) {
          shots.push({ x: player, y: H - 62 });
          cooldown = 10;
        }

        const living = enemies.filter((e) => e.alive);
        living.forEach((e) => {
          e.x += dir * 0.75;
          if (e.dive) e.y += 1.2;
        });
        if (living.some((e) => e.x < 35 || e.x > W - 35)) {
          dir *= -1;
          living.forEach((e) => (e.y += 12));
        }
        if (tick % 180 === 0 && living.length) living[Math.floor(Math.random() * living.length)].dive = true;
        if (tick % 42 === 0 && living.length) {
          const bottom = living.filter((e) => !living.some((o) => Math.abs(o.x - e.x) < 30 && o.y > e.y));
          const e = bottom[Math.floor(Math.random() * bottom.length)];
          enemyShots.push({ x: e.x, y: e.y + 18 });
        }

        shots.forEach((s) => (s.y -= 9));
        enemyShots.forEach((s) => (s.y += 4.2));

        for (const s of shots) {
          for (const e of enemies) {
            if (e.alive && Math.abs(s.x - e.x) < 22 && Math.abs(s.y - e.y) < 18) {
              e.alive = false;
              s.y = -99;
              setScore((v) => v + 10);
            }
          }
        }

        for (const s of [...shots, ...enemyShots]) {
          for (const b of blocks) {
            if (b.hp > 0 && Math.abs(s.x - b.x) < 32 && Math.abs(s.y - b.y) < 18) {
              b.hp -= 1;
              s.y = s.y < b.y ? -99 : H + 99;
            }
          }
        }
        blocks = blocks.filter((b) => b.hp > 0);

        if (enemyShots.some((s) => Math.abs(s.x - player) < 22 && Math.abs(s.y - (H - 42)) < 18)) hitPlayer();
        if (living.some((e) => e.y > H - 85)) hitPlayer();
        if (enemies.every((e) => !e.alive)) setState('win');
      }

      ctx.fillStyle = invulnerable % 12 < 6 ? '#60a5fa' : '#bfdbfe';
      ctx.beginPath();
      ctx.moveTo(player, H - 72);
      ctx.lineTo(player - 24, H - 32);
      ctx.lineTo(player + 24, H - 32);
      ctx.fill();

      blocks.forEach((b) => {
        ctx.fillStyle = `rgba(59,130,246,${0.25 + b.hp * 0.12})`;
        ctx.fillRect(b.x - 34, b.y - 18, 68, 28);
      });

      ctx.fillStyle = '#facc15';
      shots.forEach((s) => ctx.fillRect(s.x - 2, s.y - 12, 4, 14));
      ctx.fillStyle = '#fb7185';
      enemyShots.forEach((s) => ctx.fillRect(s.x - 2, s.y, 4, 12));
      enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = e.dive ? '#f97316' : '#22c55e';
        ctx.fillRect(e.x - 17, e.y - 10, 34, 20);
        ctx.fillStyle = '#a7f3d0';
        ctx.fillRect(e.x - 10, e.y - 16, 20, 6);
      });

      ctx.fillStyle = '#fff';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Жизни: ${lives}`, 18, 26);

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
  }, [state, lives]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--focus-text-muted)]">Arcade</p>
          <h1 className="text-3xl font-bold">Игра</h1>
          <p className="text-sm text-[var(--focus-text-muted)]">Стрелки/A-D — движение, пробел — огонь, Enter — рестарт. Теперь игра честнее: 3 жизни и укрытия.</p>
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
