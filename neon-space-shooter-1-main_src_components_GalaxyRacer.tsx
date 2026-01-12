"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Galaxy Racer: Neon Drift - Canvas Game Component
// Fast, fluid, nostalgically futuristic neo-retro shooter

// Helpers
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

// Basic vector
type Vec = { x: number; y: number };

// Entity types
interface Bullet extends Vec { vx: number; vy: number; r: number; ttl: number; color: string }
interface Enemy extends Vec { vx: number; vy: number; r: number; hp: number; type: "drone" | "swoop" | "zig"; }
interface Asteroid extends Vec { vx: number; vy: number; r: number; spin: number; angle: number }
interface PowerUp extends Vec { vx: number; vy: number; r: number; kind: "shield" | "rapid" | "heal"; ttl: number }

// Simple WebAudio synth for 80s-inspired sfx
class Synth {
  private ctx: AudioContext | null = null;
  private ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  private burst(freq: number, decay = 0.15, type: OscillatorType = "square", gain = 0.05) {
    try {
      this.ensure();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.5), now + decay);
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      o.connect(g).connect(this.ctx.destination);
      o.start(now);
      o.stop(now + decay);
    } catch {}
  }
  shoot() { this.burst(900, 0.08, "square", 0.03) }
  hit() { this.burst(200, 0.12, "sawtooth", 0.05) }
  boom() { this.burst(120, 0.3, "triangle", 0.06) }
  power() { this.burst(620, 0.2, "sine", 0.04) }
}

export default function GalaxyRacer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [autofire, setAutofire] = useState(true);

  const synth = useMemo(() => new Synth(), []);

  // World state refs
  const ship = useRef({ x: 200, y: 300, r: 14, speed: 420, vx: 0, vy: 0, shieldT: 0, rapidT: 0 });
  const bullets = useRef<Bullet[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const asteroids = useRef<Asteroid[]>([]);
  const powerups = useRef<PowerUp[]>([]);
  const stars = useRef<Array<{ x: number; y: number; z: number }>>([]);
  
  // Difficulty scaling ref (increases with score)
  const difficulty = useRef(1);

  // Increase difficulty as score grows
  useEffect(() => {
    // Scale from 1.0 upward; cap to avoid impossible states
    difficulty.current = Math.min(6, 1 + score / 400);
  }, [score]);

  const input = useRef({ pointerDown: false, target: { x: 200, y: 300 } });
  const timers = useRef({ enemy: 0, asteroid: 0, power: 5, shoot: 0 });
  const lastTime = useRef<number | null>(null);

  // Resize canvas to parent size
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  // Init starfield
  useEffect(() => {
    const makeStars = () => {
      const arr: Array<{ x: number; y: number; z: number }> = [];
      const count = 320;
      for (let i = 0; i < count; i++) {
        arr.push({ x: rand(0, 1), y: rand(0, 1), z: rand(0.2, 1) });
      }
      stars.current = arr;
    };
    makeStars();
  }, []);

  // Pointer controls
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => { input.current.pointerDown = true; input.current.target = getPos(e); };
    const move = (e: PointerEvent) => { if (input.current.pointerDown) input.current.target = getPos(e); };
    const up = () => { input.current.pointerDown = false; };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { canvas.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  // Ensure keyboard focus on mount and when interacting
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const focusIt = () => el.focus();
    focusIt();
    const onPointerDown = () => el.focus();
    el.addEventListener("pointerdown", onPointerDown);
    return () => el.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Keyboard fallback
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      const lower = key.toLowerCase();
      const code = (e.code || "").toLowerCase();
      // prevent page scroll for gameplay keys
      const handled = ["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(lower) || key === " " || code === "space" || key === "Spacebar";
      if (handled) {
        e.preventDefault();
      }
      keys[lower] = e.type === "keydown";
      // guard against key repeat for toggle actions
      if (e.type === "keydown" && e.repeat) return;
      if ((key === " " || code === "space" || key === "Spacebar") && e.type === "keydown") setAutofire((a) => !a); // Space toggles autofire
      if ((lower === "p" || lower === "escape") && e.type === "keydown") setRunning((r) => !r);
      if ((lower === "r" || code === "enter") && e.type === "keydown" && gameOver) restart();
    };
    window.addEventListener("keydown", onKey, { passive: false } as any);
    window.addEventListener("keyup", onKey, { passive: false } as any);
    const id = setInterval(() => {
      const sp = ship.current.speed * 0.16;
      let dx = 0, dy = 0;
      if (keys["arrowleft"] || keys["a"]) dx -= sp;
      if (keys["arrowright"] || keys["d"]) dx += sp;
      if (keys["arrowup"] || keys["w"]) dy -= sp;
      if (keys["arrowdown"] || keys["s"]) dy += sp;
      if (dx !== 0 || dy !== 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Use CSS pixel target: convert current ship position to CSS px, then add CSS deltas
        input.current.target = { x: ship.current.x / dpr + dx, y: ship.current.y / dpr + dy };
      }
    }, 16);
    return () => { window.removeEventListener("keydown", onKey as any); window.removeEventListener("keyup", onKey as any); clearInterval(id); };
  }, [gameOver]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const loop = (t: number) => {
      if (!running) { lastTime.current = t; requestAnimationFrame(loop); return; }
      const prev = lastTime.current ?? t;
      const dt = Math.min(0.032, (t - prev) / 1000);
      lastTime.current = t;

      const W = canvas.width, H = canvas.height;
      const shipObj = ship.current;

      // Update background
      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, W, H, dpr, t);

      // Move ship toward target
      const target = input.current.target;
      const dx = target.x * dpr - shipObj.x;
      const dy = target.y * dpr - shipObj.y;
      const dist = Math.hypot(dx, dy) || 1;
      const maxMove = shipObj.speed * dt * dpr;
      const step = Math.min(1, maxMove / dist);
      shipObj.x += dx * step;
      shipObj.y += dy * step;
      shipObj.x = clamp(shipObj.x, 20 * dpr, W - 20 * dpr);
      shipObj.y = clamp(shipObj.y, 20 * dpr, H - 20 * dpr);

      // Timers
      timers.current.enemy -= dt;
      timers.current.asteroid -= dt;
      timers.current.power -= dt;
      timers.current.shoot -= dt;

      // Shooting
      const baseFireRate = shipObj.rapidT > 0 ? 0.08 : 0.18;
      if (autofire && timers.current.shoot <= 0) {
        spawnBullet(shipObj.x, shipObj.y - 14 * dpr, 0, -900 * dpr, "#00fff0");
        if (shipObj.rapidT > 0) {
          spawnBullet(shipObj.x - 8 * dpr, shipObj.y - 10 * dpr, -200 * dpr, -820 * dpr, "#ff00e6");
          spawnBullet(shipObj.x + 8 * dpr, shipObj.y - 10 * dpr, 200 * dpr, -820 * dpr, "#ff00e6");
        }
        timers.current.shoot = baseFireRate;
        synth.shoot();
      }

      // Spawn
      if (timers.current.enemy <= 0) { spawnEnemy(W, H, dpr); timers.current.enemy = rand(0.5, 1.2) / Math.max(1, difficulty.current); }
      if (timers.current.asteroid <= 0) { spawnAsteroid(W, H, dpr); timers.current.asteroid = rand(0.8, 1.6) / Math.max(1, difficulty.current); }
      if (timers.current.power <= 0) { spawnPowerUp(W, dpr); timers.current.power = rand(8, 14); }

      // Update bullets
      bullets.current = bullets.current.filter((b) => (b.ttl -= dt) > 0 && b.y + b.r > -20);
      for (const b of bullets.current) { b.x += b.vx * dt; b.y += b.vy * dt; }

      // Update enemies
      const toRemoveEnemies: Enemy[] = [];
      for (const e of enemies.current) {
        if (e.type === "swoop") e.vx += Math.sin(t * 0.005 + e.x * 0.01) * 3;
        if (e.type === "zig") e.vx = Math.sin((t * 0.004) + e.y * 0.02) * 80;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.y - e.r > H + 50) toRemoveEnemies.push(e);
      }
      enemies.current = enemies.current.filter((e) => !toRemoveEnemies.includes(e));

      // Update asteroids
      const toRemoveAst: Asteroid[] = [];
      for (const a of asteroids.current) {
        a.x += a.vx * dt; a.y += a.vy * dt; a.angle += a.spin * dt;
        if (a.y - a.r > H + 60) toRemoveAst.push(a);
      }
      asteroids.current = asteroids.current.filter((a) => !toRemoveAst.includes(a));

      // Update powerups
      const toRemovePow: PowerUp[] = [];
      for (const p of powerups.current) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
        if (p.ttl <= 0 || p.y - p.r > H + 40) toRemovePow.push(p);
      }
      powerups.current = powerups.current.filter((p) => !toRemovePow.includes(p));

      // Effects timers
      shipObj.shieldT = Math.max(0, shipObj.shieldT - dt);
      shipObj.rapidT = Math.max(0, shipObj.rapidT - dt);

      // Collisions: bullets vs enemies
      for (const b of bullets.current) {
        for (const e of enemies.current) {
          if (hit(b.x, b.y, b.r, e.x, e.y, e.r)) {
            b.ttl = 0;
            e.hp -= 1;
            if (e.hp <= 0) {
              setScore((s) => s + 50);
              if (Math.random() < 0.04) spawnPowerUp(canvas.width, dpr, { x: e.x, y: e.y });
              synth.boom();
              e.y = canvas.height + 100; // mark for removal
            } else synth.hit();
          }
        }
      }

      // Collisions: ship vs enemies/asteroids/powerups
      for (const e of enemies.current) {
        if (hit(shipObj.x, shipObj.y, shipObj.r, e.x, e.y, e.r)) {
          damage(20);
          e.y = H + 100;
        }
      }
      for (const a of asteroids.current) {
        if (hit(shipObj.x, shipObj.y, shipObj.r + 2, a.x, a.y, a.r)) {
          damage(15);
          a.y = H + 100;
        }
      }
      for (const p of powerups.current) {
        if (hit(shipObj.x, shipObj.y, shipObj.r + 4, p.x, p.y, p.r)) {
          applyPower(p.kind);
          p.ttl = 0;
        }
      }

      // Draw entities
      drawShip(ctx, shipObj, dpr);
      for (const b of bullets.current) drawBullet(ctx, b);
      for (const e of enemies.current) drawEnemy(ctx, e);
      for (const a of asteroids.current) drawAsteroid(ctx, a);
      for (const p of powerups.current) drawPower(ctx, p);

      if (health <= 0 && !gameOver) {
        setGameOver(true);
        setRunning(false);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);

    function spawnBullet(x: number, y: number, vx: number, vy: number, color: string) {
      const b: Bullet = { x, y, vx, vy, r: 4 * dpr, ttl: 2, color };
      bullets.current.push(b);
    }
    function spawnEnemy(W: number, H: number, dpr: number) {
      const typePick = Math.random();
      const type: Enemy["type"] = typePick < 0.5 ? "drone" : typePick < 0.8 ? "swoop" : "zig";
      const r = rand(12, 18) * dpr;
      const x = rand(r + 10, W - r - 10);
      const y = -r - 20;
      const speedScale = 0.8 + 0.6 * Math.max(1, difficulty.current);
      const vy = rand(80, 180) * dpr * speedScale;
      const vx = type === "drone" ? 0 : rand(-60, 60) * dpr * (0.8 + 0.4 * Math.max(1, difficulty.current));
      const baseHp = type === "drone" ? 1 : 2;
      const extraHp = Math.max(0, Math.floor((Math.max(1, difficulty.current) - 1.5)));
      enemies.current.push({ x, y, vx, vy, r, hp: baseHp + extraHp, type });
    }
    function spawnAsteroid(W: number, H: number, dpr: number) {
      const r = rand(16, 34) * dpr;
      const x = rand(r + 10, W - r - 10);
      const y = -r - 30;
      const speedScale = 0.7 + 0.5 * Math.max(1, difficulty.current);
      const vy = rand(60, 140) * dpr * speedScale;
      const vx = rand(-40, 40) * dpr * (0.8 + 0.3 * Math.max(1, difficulty.current));
      const spin = rand(-2, 2);
      asteroids.current.push({ x, y, vx, vy, r, spin, angle: rand(0, Math.PI * 2) });
    }
    function spawnPowerUp(W: number, dpr: number, pos?: { x: number; y: number }) {
      const kind: PowerUp["kind"] = Math.random() < 0.4 ? "shield" : Math.random() < 0.6 ? "heal" : "rapid";
      const r = 10 * dpr;
      const x = pos?.x ?? rand(r + 20, W - r - 20);
      const y = pos?.y ?? -r - 20;
      const vy = rand(70, 110) * dpr;
      powerups.current.push({ x, y, vx: 0, vy, r, kind, ttl: 8 });
    }
    function damage(dmg: number) {
      if (ship.current.shieldT > 0) { synth.hit(); return; }
      setHealth((h) => Math.max(0, h - dmg));
      synth.hit();
    }
    function applyPower(kind: PowerUp["kind"]) {
      if (kind === "shield") ship.current.shieldT = 4;
      if (kind === "rapid") ship.current.rapidT = 5;
      if (kind === "heal") setHealth((h) => Math.min(100, h + 20));
      setScore((s) => s + 25);
      synth.power();
    }
    function hit(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
      return (x1 - x2) ** 2 + (y1 - y2) ** 2 <= (r1 + r2) ** 2;
    }
    function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, t: number) {
      // Gradient space backdrop
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#07071a");
      g.addColorStop(1, "#12061f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Parallax stars
      ctx.save();
      for (const s of stars.current) {
        const speed = (1.2 - s.z) * 60 * dpr;
        s.y += speed * 0.016;
        if (s.y > 1) s.y = 0;
        const x = s.x * W;
        const y = s.y * H;
        const size = (1.8 - s.z) * 1.4 * dpr;
        ctx.fillStyle = s.z > 0.7 ? "#00fff0" : s.z > 0.45 ? "#ff00e6" : "#ffffff";
        ctx.globalAlpha = 0.7 * s.z + 0.2;
        ctx.fillRect(x, y, size, size);
      }
      ctx.restore();

      // Scanlines overlay for retro feel
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = "#000";
      for (let y = 0; y < H; y += 4 * dpr) ctx.fillRect(0, y, W, 1);
      ctx.restore();
    }
    function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
      ctx.shadowBlur = blur; ctx.shadowColor = color; ctx.strokeStyle = color; ctx.fillStyle = color;
    }
    function drawShip(ctx: CanvasRenderingContext2D, s: { x: number; y: number; r: number; shieldT: number }, dpr: number) {
      ctx.save();
      glow(ctx, "#00fff0", 12 * dpr);
      ctx.lineWidth = 2 * dpr;
      // Neon triangle ship
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.r);
      ctx.lineTo(s.x - s.r * 0.8, s.y + s.r);
      ctx.lineTo(s.x + s.r * 0.8, s.y + s.r);
      ctx.closePath();
      ctx.stroke();

      // Cockpit
      glow(ctx, "#ff00e6", 8 * dpr);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Thruster
      glow(ctx, "#ff6b00", 18 * dpr);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + s.r);
      ctx.lineTo(s.x - 4 * dpr, s.y + s.r + 10 * dpr);
      ctx.lineTo(s.x + 4 * dpr, s.y + s.r + 10 * dpr);
      ctx.closePath();
      ctx.fill();

      // Shield
      if (s.shieldT > 0) {
        glow(ctx, "#7cf9ff", 20 * dpr);
        ctx.globalAlpha = 0.4 + 0.2 * Math.sin(performance.now() * 0.01);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 6 * dpr, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
      ctx.save(); glow(ctx, b.color, 10); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
      ctx.save();
      const col = e.type === "drone" ? "#ff007a" : e.type === "swoop" ? "#00d1ff" : "#ffe600";
      glow(ctx, col, 12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.r);
      ctx.lineTo(e.x - e.r, e.y + e.r);
      ctx.lineTo(e.x + e.r, e.y + e.r);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid) {
      ctx.save(); glow(ctx, "#8b84ff", 8); ctx.translate(a.x, a.y); ctx.rotate(a.angle);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const rr = a.r * (0.75 + Math.sin(i * 2.1) * 0.12);
        const px = Math.cos(ang) * rr; const py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    function drawPower(ctx: CanvasRenderingContext2D, p: PowerUp) {
      ctx.save();
      const col = p.kind === "shield" ? "#7cf9ff" : p.kind === "heal" ? "#7cff87" : "#ff00e6";
      glow(ctx, col, 10);
      ctx.lineWidth = 2;
      if (p.kind === "heal") {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.r);
        ctx.lineTo(p.x, p.y + p.r);
        ctx.moveTo(p.x - p.r, p.y);
        ctx.lineTo(p.x + p.r, p.y);
        ctx.stroke();
      } else if (p.kind === "shield") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x - p.r, p.y + p.r);
        ctx.lineTo(p.x, p.y - p.r);
        ctx.lineTo(p.x + p.r, p.y + p.r);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [autofire, gameOver, health, running, synth]);

  function restart() {
    setScore(0);
    setHealth(100);
    setGameOver(false);
    bullets.current = [];
    enemies.current = [];
    asteroids.current = [];
    powerups.current = [];
    ship.current = { x: 200, y: 300, r: 14, speed: 420, vx: 0, vy: 0, shieldT: 0, rapidT: 0 };
    setRunning(true);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] overflow-hidden select-none focus:outline-none"
      tabIndex={0}
      role="application"
      aria-keyshortcuts="W A S D, ArrowUp ArrowDown ArrowLeft ArrowRight, Space, P, R, Esc"
      aria-label="Galaxy Racer game canvas and controls. Use WASD/ASDW or Arrow keys to move. Space toggles autofire. P or Esc to pause. R to restart."
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 p-4 flex flex-col">
        <div className="flex items-center justify-between text-xs sm:text-sm" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif', letterSpacing: 0.5 }}>
          <div className="flex items-center gap-4">
            <div className="text-cyan-300 drop-shadow-[0_0_6px_rgba(0,255,240,0.85)]">SCORE: {score}</div>
            <div className="text-fuchsia-300 drop-shadow-[0_0_6px_rgba(255,0,230,0.85)]">HEALTH: {health}</div>
            <div className="hidden xs:block text-emerald-300 drop-shadow-[0_0_6px_rgba(0,255,170,0.85)]">LEVEL: {Math.max(1, Math.min(6, 1 + Math.floor(score / 400)))}</div>
          </div>
          <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
            <Button variant="secondary" onClick={() => setRunning((r) => !r)} className="bg-zinc-900/60 backdrop-blur text-cyan-200 hover:text-cyan-100 border border-white/10">{running ? "Pause" : "Resume"}</Button>
            <Button variant="secondary" onClick={() => setAutofire((a) => !a)} className="bg-zinc-900/60 backdrop-blur text-fuchsia-200 hover:text-fuchsia-100 border border-white/10">{autofire ? "Autofire: ON" : "Autofire: OFF"}</Button>
            <Button variant="secondary" onClick={restart} className="bg-zinc-900/60 backdrop-blur text-emerald-200 hover:text-emerald-100 border border-white/10">Restart</Button>
          </div>
        </div>

        {/* Title top-center on large screens */}
        <div className="mt-2 text-center text-[10px] sm:text-sm md:text-base font-bold tracking-wide text-white/90" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif' }}>
          GALAXY RACER: <span className="text-fuchsia-400">NEON</span> <span className="text-cyan-300">DRIFT</span>
        </div>

        {/* Controls legend for accessibility */}
        <div className="mt-2 text-[9px] sm:text-xs text-white/60 text-center sm:text-right" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif' }}>
          Controls: WASD/Arrows = Move • Space = Autofire • P = Pause • R = Restart
        </div>

        {/* Bottom mobile controls */}
        <div className="mt-auto flex items-center justify-center gap-3 sm:hidden pointer-events-auto">
          <Button onClick={() => setRunning((r) => !r)} className="bg-zinc-900/60 backdrop-blur text-cyan-200 border border-white/10">{running ? "Pause" : "Resume"}</Button>
          <Button onClick={() => setAutofire((a) => !a)} className="bg-zinc-900/60 backdrop-blur text-fuchsia-200 border border-white/10">{autofire ? "Autofire ON" : "Autofire OFF"}</Button>
          <Button onClick={restart} className="bg-zinc-900/60 backdrop-blur text-emerald-200 border border-white/10">Restart</Button>
        </div>
      </div>

      {/* Paused Overlay */}
      {!running && !gameOver && (
        <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[2px]">
          <div className="text-center p-4 rounded-md border border-white/10 bg-zinc-900/60 shadow-xl">
            <div className="text-xl sm:text-2xl mb-1 text-white" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif' }}>PAUSED</div>
            <div className="text-[10px] sm:text-xs text-white/70" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif' }}>Press P or Esc to resume</div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="text-center p-6 rounded-lg border border-white/10 bg-zinc-900/60 shadow-2xl max-w-sm mx-auto">
            <div className="text-2xl sm:text-3xl mb-2 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif' }}>GAME OVER</div>
            <div className="text-fuchsia-300 text-sm sm:text-base mb-4" style={{ fontFamily: '"Press Start 2P", system-ui, sans-serif' }}>Final Score: {score}</div>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={restart} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white">Restart</Button>
              <Button onClick={() => { setGameOver(false); setRunning(false); }} variant="secondary" className="bg-zinc-800 text-zinc-200">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)" }} />
    </div>
  );
}