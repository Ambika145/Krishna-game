'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Makhan Catch — Little Krishna in a magical Vrindavan garden.
 * Architecture: mutable engine in useRef + single rAF loop.
 * React state is reserved for MENU | PLAYING | GAMEOVER + HUD.
 */

const PHASE = { MENU: 'MENU', PLAYING: 'PLAYING', GAMEOVER: 'GAMEOVER' };

const POT_POINTS = { normal: 1, white: 3, golden: 10 };

function playerSize(w) {
  const size = Math.min(140, Math.max(96, w * 0.2));
  return { w: size, h: size };
}

const BUTTERFLY_HUES = [320, 40, 200, 280, 15, 170, 300, 55];

function createButterfly(w, h) {
  return {
    x: Math.random() * w,
    y: h * 0.28 + Math.random() * h * 0.32,
    vx: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 10),
    phase: Math.random() * Math.PI * 2,
    flap: 4.5 + Math.random() * 2.5, // slow gentle flap
    bob: 0.35 + Math.random() * 0.45,
    scale: 0.65 + Math.random() * 0.35,
    hue: BUTTERFLY_HUES[Math.floor(Math.random() * BUTTERFLY_HUES.length)],
  };
}

function createBee(w, h) {
  return {
    x: Math.random() * w,
    y: h * 0.4 + Math.random() * h * 0.28,
    homeX: 0,
    homeY: 0,
    phase: Math.random() * Math.PI * 2,
    speed: 0.9 + Math.random() * 0.7,
    scale: 0.75 + Math.random() * 0.4,
    orbit: 28 + Math.random() * 40,
  };
}

function createCalves(w, h) {
  const base = Math.min(120, Math.max(72, w * 0.14));
  return [
    // Grazing calf — stays put & eats grass
    {
      kind: 'graze',
      x: w * 0.18,
      y: h * 0.74,
      size: base * 1.05,
      facing: 1,
      phase: Math.random() * 10,
      pace: 2.2,
      settleTimer: 6 + Math.random() * 5,
      homeX: w * 0.18,
    },
    // Sitting calf on the right
    {
      kind: 'sit',
      x: w * 0.72,
      y: h * 0.78,
      size: base * 0.55,
      facing: -1,
      phase: 2.4,
    },
  ];
}

function createEngine(w, h) {
  const size = playerSize(w);
  return {
    w,
    h,
    running: false,
    time: 0,
    score: 0,
    caught: 0,
    // Game over only after 5 misses in a row (catching resets the streak)
    missStreak: 0,
    missLimit: 5,
    // Gentle start — speed & density ramp continuously with score
    fallSpeed: 85,
    spawnTimer: 1.8,
    shake: 0,
    catchStreak: 0,
    sinceGolden: 0,
    achievementUnlocked: false, // Krishna Paglu @ 50 pots
    consciousUnlocked: false, // Krishna Conscious @ 500 score
    hasLaddu: false,
    achievementFlash: 0,
    stars: [],
    pots: [],
    particles: [],
    floatText: [],
    // Putana boss encounter
    putana: null,
    chakras: [],
    putanaCooldown: 20,
    putanaKills: 0,
    butterflies: Array.from({ length: 4 }, () => createButterfly(w, h)),
    bees: Array.from({ length: 7 }, () => {
      const bee = createBee(w, h);
      bee.homeX = bee.x;
      bee.homeY = bee.y;
      return bee;
    }),
    fireflies: Array.from({ length: 36 }, () => ({
      x: Math.random() * w,
      y: h * 0.35 + Math.random() * h * 0.5,
      r: 1.5 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.2,
      drift: 12 + Math.random() * 28,
    })),
    trees: Array.from({ length: 7 }, (_, i) => ({
      x: (i / 6) * w + (Math.random() - 0.5) * 40,
      base: 0.72 + Math.random() * 0.08,
      scale: 0.75 + Math.random() * 0.45,
      lean: (Math.random() - 0.5) * 0.12,
    })),
    flowers: Array.from({ length: 28 }, () => ({
      x: Math.random() * w,
      y: h * (0.78 + Math.random() * 0.18),
      s: 0.5 + Math.random() * 0.9,
      hue: Math.random() > 0.5 ? 320 : 45,
    })),
    calves: createCalves(w, h),
    player: {
      x: w * 0.5,
      y: h * 0.8,
      baseY: h * 0.8,
      targetX: w * 0.5,
      w: size.w,
      h: size.h,
      facing: 1,
      jumpVy: 0,
      onGround: true,
    },
    input: { left: false, right: false, jump: false, chakra: false },
  };
}

function spawnPutana(e) {
  if (e.putana || e.caught < 10) return;
  const size = Math.min(88, Math.max(64, e.w * 0.12));
  const margin = size + 24;
  e.putana = {
    x: margin + Math.random() * (e.w - margin * 2),
    y: -size,
    size,
    facing: Math.random() < 0.5 ? 1 : -1,
    state: 'fall', // fall | dying
    // Fall like pots — a bit slower than current pot speed so player can react
    vy: Math.max(70, e.fallSpeed * 0.75),
    wobble: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * 10,
    hitFlash: 0,
  };
  // Faster game → Putana returns sooner
  const haste = Math.min(1, (e.fallSpeed - 85) / 220);
  e.putanaCooldown = Math.max(7, 20 - haste * 12) + Math.random() * (6 - haste * 3);
  e.floatText.push({
    x: e.w * 0.5,
    y: e.h * 0.22,
    text: 'PUTANA FALLING!',
    color: '#f472b6',
    life: 1.6,
  });
}

/** Continuous difficulty from score (and light time pressure). */
function difficulty(e) {
  const fromScore = e.score / 80;
  const fromCaught = e.caught / 40;
  const fromTime = e.time / 90;
  return Math.max(0, fromScore + fromCaught * 0.35 + fromTime * 0.25);
}

function maxPotsFor(e) {
  const d = difficulty(e);
  if (d < 0.8) return 1;
  if (d < 1.8) return 2;
  if (d < 3.2) return 3;
  if (d < 5) return 4;
  return 5;
}

function updateFallSpeed(e, dt) {
  // Continuous ramp toward a soft cap
  const target = Math.min(340, 85 + difficulty(e) * 42);
  if (e.fallSpeed < target) {
    e.fallSpeed = Math.min(target, e.fallSpeed + 22 * dt);
  }
}

function throwChakra(e) {
  if (!e.putana || e.putana.state !== 'fall') return;
  if (e.chakras.length > 0) return; // one at a time
  const p = e.player;
  const ang = Math.atan2(e.putana.y - (p.y - p.h * 0.15), e.putana.x - p.x);
  e.chakras.push({
    x: p.x,
    y: p.y - p.h * 0.15,
    vx: Math.cos(ang) * 560,
    vy: Math.sin(ang) * 560,
    rot: 0,
    life: 2.2,
  });
  e.input.chakra = false;
}

function spawnCelebrationStars(e, n = 36) {
  for (let i = 0; i < n; i++) {
    e.stars.push({
      x: e.w * (0.2 + Math.random() * 0.6),
      y: e.h * (0.15 + Math.random() * 0.45),
      vx: (Math.random() - 0.5) * 80,
      vy: -40 - Math.random() * 120,
      life: 1.2 + Math.random() * 1.4,
      max: 2.2,
      r: 3 + Math.random() * 5,
      spin: (Math.random() - 0.5) * 6,
      rot: Math.random() * Math.PI,
    });
  }
}

function pickPotType(e) {
  // Golden: when doing well (catch streak ≥ 5) and not spawned recently
  if (e.catchStreak >= 5 && e.sinceGolden > 8 && Math.random() < 0.28) {
    return 'golden';
  }
  // White pots mix in for variety
  if (Math.random() < 0.22) return 'white';
  return 'normal';
}

function spawnPot(e) {
  const type = pickPotType(e);
  if (type === 'golden') e.sinceGolden = 0;
  else e.sinceGolden += 1;

  const size = type === 'golden' ? 46 + Math.random() * 10 : 38 + Math.random() * 14;
  const variant = Math.random() < 0.5 ? 1 : 2; // which of the two main pots
  e.pots.push({
    x: size + 20 + Math.random() * (e.w - (size + 20) * 2),
    y: -size,
    size,
    r: size * 0.45,
    rot: (Math.random() - 0.5) * 0.35,
    spin: (Math.random() - 0.5) * 1.2,
    wobble: Math.random() * Math.PI * 2,
    type,
    variant,
  });
}

function burst(e, x, y, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.35;
    const sp = 70 + Math.random() * 160;
    e.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 50,
      life: 0.45 + Math.random() * 0.4,
      max: 0.85,
      r: 2 + Math.random() * 3.5,
      color,
    });
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ---------- Vrindavan garden scene ---------- */
function drawGarden(ctx, e, t, calfSprites) {
  const { w, h } = e;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1a0b2e');
  sky.addColorStop(0.28, '#4a1d6a');
  sky.addColorStop(0.52, '#b84a3a');
  sky.addColorStop(0.72, '#f0a060');
  sky.addColorStop(1, '#ffe0a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const haze = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, w * 0.7);
  haze.addColorStop(0, 'rgba(255, 180, 100, 0.22)');
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  // Soft drifting clouds
  for (let i = 0; i < 4; i++) {
    const cx = ((t * (8 + i * 3) + i * 180) % (w + 200)) - 100;
    const cy = h * (0.12 + i * 0.05);
    ctx.fillStyle = 'rgba(255, 230, 210, 0.12)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70 + i * 10, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 40, cy + 6, 40, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 45, cy + 4, 48, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon
  const mx = w * 0.78;
  const my = h * 0.14;
  const glow = ctx.createRadialGradient(mx, my, 8, mx, my, 90);
  glow.addColorStop(0, 'rgba(255, 248, 220, 0.55)');
  glow.addColorStop(0.4, 'rgba(255, 220, 160, 0.18)');
  glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, 90, 0, Math.PI * 2);
  ctx.fill();
  const moon = ctx.createRadialGradient(mx - 10, my - 10, 4, mx, my, 34);
  moon.addColorStop(0, '#fffaf0');
  moon.addColorStop(1, '#f0d9a0');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(74, 29, 106, 0.35)';
  ctx.beginPath();
  ctx.arc(mx + 12, my - 6, 24, 0, Math.PI * 2);
  ctx.fill();

  drawHill(ctx, w, h, 0.58, 48, '#2d5a3a', t * 0.15, 0.02);
  drawHill(ctx, w, h, 0.64, 62, '#3a7a48', t * 0.2, 0.028);
  drawHill(ctx, w, h, 0.72, 80, '#4a9a58', t * 0.1, 0.035);

  // Soft river shimmer
  const riverY = h * 0.74;
  const river = ctx.createLinearGradient(0, riverY - 20, 0, riverY + 40);
  river.addColorStop(0, 'rgba(100, 180, 220, 0)');
  river.addColorStop(0.4, 'rgba(90, 170, 210, 0.35)');
  river.addColorStop(1, 'rgba(60, 120, 160, 0.2)');
  ctx.fillStyle = river;
  ctx.beginPath();
  ctx.moveTo(0, riverY);
  for (let x = 0; x <= w; x += 16) {
    ctx.lineTo(x, riverY + Math.sin(x * 0.02 + t * 1.5) * 6);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // Sparkle on water
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 8; i++) {
    const sx = ((t * 30 + i * 97) % w);
    const sy = riverY + 8 + Math.sin(t * 2 + i) * 4;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 3 + i));
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const tree of e.trees) {
    drawTree(ctx, tree.x, h * tree.base, tree.scale, tree.lean, t);
  }

  // Foreground grass
  const grass = ctx.createLinearGradient(0, h * 0.78, 0, h);
  grass.addColorStop(0, 'rgba(50, 130, 70, 0)');
  grass.addColorStop(0.25, 'rgba(45, 120, 65, 0.75)');
  grass.addColorStop(1, '#1e5a32');
  ctx.fillStyle = grass;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  ctx.strokeStyle = 'rgba(80, 180, 90, 0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 60; i++) {
    const gx = ((i * 97) % w) + Math.sin(t + i) * 2;
    const gy = h * 0.82 + ((i * 53) % (h * 0.14));
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + Math.sin(t * 2 + i) * 4, gy - 10, gx + 2, gy - 16);
    ctx.stroke();
  }

  for (const f of e.flowers) {
    drawFlower(ctx, f.x, f.y + Math.sin(t * 2 + f.x) * 1.5, f.s, f.hue);
  }

  // Real calf sprites (animated) in the mid/foreground grass
  for (const calf of e.calves) {
    drawCalf(ctx, calf, t, calfSprites);
  }

  // Soft butterflies + honey bees
  for (const b of e.butterflies) {
    drawButterfly(ctx, b, t);
  }
  for (const bee of e.bees) {
    drawBee(ctx, bee, t);
  }

  // Fireflies
  for (const ff of e.fireflies) {
    const pulse = 0.45 + 0.55 * Math.sin(t * ff.speed + ff.phase);
    const fx = ff.x + Math.sin(t * 0.7 + ff.phase) * ff.drift;
    const fy = ff.y + Math.cos(t * 0.55 + ff.phase) * (ff.drift * 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, ff.r * 10);
    fg.addColorStop(0, `rgba(255, 240, 140, ${0.55 * pulse})`);
    fg.addColorStop(0.35, `rgba(255, 200, 80, ${0.22 * pulse})`);
    fg.addColorStop(1, 'rgba(255, 180, 40, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, ff.r * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 200, ${0.85 * pulse})`;
    ctx.beginPath();
    ctx.arc(fx, fy, ff.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHill(ctx, w, h, base, amp, color, phase, freq) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * base);
  for (let x = 0; x <= w; x += 12) {
    const y =
      h * base +
      Math.sin(x * freq + phase) * amp +
      Math.sin(x * freq * 2.1 + phase * 1.3) * (amp * 0.35);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, x, y, scale, lean, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean + Math.sin(t * 0.8) * 0.02);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(-6, -40, 12, 50);
  const canopy = [
    [0, -70, 38],
    [-22, -50, 30],
    [24, -52, 28],
    [0, -95, 26],
  ];
  for (const [cx, cy, r] of canopy) {
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, r);
    g.addColorStop(0, '#6ecf7a');
    g.addColorStop(1, '#2d7a40');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlower(ctx, x, y, s, hue) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = `hsla(${hue}, 70%, 65%, 0.9)`;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 4, 2.5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe566';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButterfly(ctx, b, t) {
  const flap = 0.72 + 0.28 * Math.sin(t * b.flap + b.phase);
  const bobY = Math.sin(t * b.bob * 1.4 + b.phase) * 5;
  const tilt = Math.sin(t * b.bob + b.phase) * 0.12;
  const facing = b.vx >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(b.x, b.y + bobY);
  ctx.rotate(tilt);
  ctx.scale(b.scale * facing, b.scale);

  // Soft matte wings — no bright glow/highlight flash
  ctx.fillStyle = `hsla(${b.hue}, 65%, 62%, 0.88)`;
  ctx.beginPath();
  ctx.ellipse(-6.5, -2.5, 7 * flap, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-5.5, 3.5, 5 * flap, 3.8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6.5, -2.5, 7 * flap, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5.5, 3.5, 5 * flap, 3.8, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Subtle wing spots (low contrast)
  ctx.fillStyle = `hsla(${b.hue}, 40%, 78%, 0.45)`;
  ctx.beginPath();
  ctx.arc(-6, -3, 1.2, 0, Math.PI * 2);
  ctx.arc(6, -3, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a3428';
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.8, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#4a3428';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(-2.5, -9, -4, -10);
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(2.5, -9, 4, -10);
  ctx.stroke();

  ctx.restore();
}

function drawBee(ctx, bee, t) {
  const buzz = Math.sin(t * 28 + bee.phase);
  const wing = 0.45 + 0.55 * Math.abs(buzz);
  const facing = Math.cos(t * bee.speed + bee.phase) >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(bee.x, bee.y);
  ctx.scale(bee.scale * facing, bee.scale);

  // Wings
  ctx.fillStyle = 'rgba(220, 235, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-2, -4, 4, 2.2 * wing, -0.5, 0, Math.PI * 2);
  ctx.ellipse(3, -4, 4, 2.2 * wing, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Body (yellow / brown stripes)
  ctx.fillStyle = '#f5c542';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a14';
  ctx.fillRect(-4, -3.2, 2.2, 6.4);
  ctx.fillRect(0.2, -3.2, 2.2, 6.4);
  ctx.fillRect(4, -2.2, 1.6, 4.4);

  // Head
  ctx.fillStyle = '#2a1c10';
  ctx.beginPath();
  ctx.arc(6.5, 0, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Tiny sting / antenna hint
  ctx.strokeStyle = '#2a1c10';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-9, 1);
  ctx.stroke();

  ctx.restore();
}

function updateButterflies(e, dt) {
  for (const b of e.butterflies) {
    b.x += b.vx * dt;
    b.y += Math.sin(e.time * b.bob + b.phase) * 5 * dt;

    const minY = e.h * 0.2;
    const maxY = e.h * 0.62;
    if (b.y < minY) b.y = minY;
    if (b.y > maxY) b.y = maxY;

    if (b.x > e.w + 40) {
      b.x = -40;
      b.y = e.h * 0.28 + Math.random() * e.h * 0.3;
    } else if (b.x < -40) {
      b.x = e.w + 40;
      b.y = e.h * 0.28 + Math.random() * e.h * 0.3;
    }

    if (Math.random() < 0.0015) b.vx *= -1;
  }
}

function updateBees(e, dt) {
  for (const bee of e.bees) {
    // Lazy figure-eight / flower-hop around a home spot
    const ang = e.time * bee.speed + bee.phase;
    bee.x = bee.homeX + Math.cos(ang) * bee.orbit + Math.sin(ang * 0.7) * 10;
    bee.y = bee.homeY + Math.sin(ang * 1.35) * (bee.orbit * 0.45);

    // Occasionally pick a new nearby flower patch
    if (Math.random() < 0.002) {
      bee.homeX = Math.max(40, Math.min(e.w - 40, bee.homeX + (Math.random() - 0.5) * 120));
      bee.homeY = Math.max(e.h * 0.35, Math.min(e.h * 0.72, bee.homeY + (Math.random() - 0.5) * 60));
    }
  }
}

/** Draw real calf sprites — mostly still, graze calf gently chews */
function drawCalf(ctx, calf, t, sprites) {
  const { x, y, size, facing, kind, phase } = calf;
  const sprite = sprites?.[kind];
  const bob = Math.sin(t * 1.4 + phase) * (kind === 'graze' ? 1.4 : 0.9);
  const sway = Math.sin(t * 0.9 + phase) * 0.02;
  const breath = 1 + Math.sin(t * 1.8 + phase) * 0.012;
  // Grazing calf slowly nods while eating grass
  const chewNod = kind === 'graze' ? Math.sin(t * 2.2 + phase) * 0.035 : 0;

  ctx.save();
  ctx.translate(x, y + bob);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.38, size * (kind === 'sit' ? 0.28 : 0.32), size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(sway + chewNod);
  ctx.scale(facing * breath, breath);

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -size * 0.5, -size * 0.55, size, size);
  } else {
    // Tiny fallback blob while loading
    ctx.fillStyle = '#f5e6d3';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.28, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPot(ctx, pot, t, potSprites) {
  const { x, y, size, rot, type, variant } = pot;
  const key =
    type === 'golden'
      ? `gold${variant}`
      : type === 'white'
        ? `white${variant}`
        : `normal${variant}`;
  const sprite = potSprites?.[key];

  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3.5 + pot.wobble) * 2);
  ctx.rotate(rot);

  // Soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(2, size * 0.42, size * 0.32, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Golden aura
  if (type === 'golden') {
    const aura = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.7);
    aura.addColorStop(0, 'rgba(255, 215, 80, 0.45)');
    aura.addColorStop(1, 'rgba(255, 180, 40, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -size * 0.5, -size * 0.55, size, size);
  } else {
    // Fallback drawn pot
    ctx.fillStyle = type === 'golden' ? '#e8b84a' : type === 'white' ? '#f5f0e8' : '#a86b3c';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStarShape(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const b = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(b) * (r * 0.45), Math.sin(b) * (r * 0.45));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSudarshan(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);

  // Glow
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
  glow.addColorStop(0, 'rgba(255, 220, 80, 0.85)');
  glow.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  // Disc
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Spikes
  ctx.fillStyle = '#fde68a';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    ctx.lineTo(Math.cos(a - 0.18) * 20, Math.sin(a - 0.18) * 20);
    ctx.lineTo(Math.cos(a + 0.18) * 20, Math.sin(a + 0.18) * 20);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#fff7d6';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPutana(ctx, putana, t, sprite) {
  const bob = Math.sin(t * 3 + putana.bobPhase) * 6;
  ctx.save();
  ctx.translate(putana.x, putana.y + bob);

  if (putana.hitFlash > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 40);

  // Menacing aura
  const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, putana.size * 0.7);
  aura.addColorStop(0, 'rgba(236, 72, 153, 0.25)');
  aura.addColorStop(1, 'rgba(120, 40, 160, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, putana.size * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(putana.facing, 1);
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -putana.size * 0.5, -putana.size * 0.55, putana.size, putana.size);
  } else {
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(0, 0, putana.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

}

function drawCelebrationStars(ctx, stars) {
  for (const s of stars) {
    ctx.globalAlpha = Math.max(0, s.life / s.max);
    ctx.fillStyle = s.life > 0.6 ? '#ffe566' : '#fff8dc';
    drawStarShape(ctx, s.x, s.y, s.r, s.rot);
  }
  ctx.globalAlpha = 1;
}

function drawKrishna(ctx, p, t, sprite) {
  const { x, y, w, h, facing = 1 } = p;
  const bob = Math.sin(t * 6) * 3;
  const sway = Math.sin(t * 3.2) * 0.04;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.42, w * 0.32, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(sway);
  ctx.scale(facing, 1);

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -w * 0.5, -h * 0.52, w, h);
  } else {
    ctx.fillStyle = '#fbbf24';
    roundRect(ctx, -w * 0.25, -h * 0.1, w * 0.5, h * 0.45, 12);
    ctx.fill();
    ctx.fillStyle = '#f5c4a8';
    ctx.beginPath();
    ctx.arc(0, -h * 0.28, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatText(ctx, items) {
  for (const f of items) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.font = '800 18px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function updateCalves(e, dt) {
  for (const calf of e.calves) {
    // Only the grazing calf ever shuffles — and very rarely / very slowly
    if (calf.kind !== 'graze') continue;

    calf.settleTimer -= dt;
    if (calf.settleTimer > 0) continue; // stay put & eat for a while

    // Tiny shuffle, then settle again for a long time
    calf.x += calf.pace * calf.facing * dt;
    const left = (calf.homeX || calf.x) - 28;
    const right = (calf.homeX || calf.x) + 28;
    if (calf.x > right) {
      calf.x = right;
      calf.facing = -1;
      calf.settleTimer = 8 + Math.random() * 7;
      calf.homeX = calf.x;
    } else if (calf.x < left) {
      calf.x = left;
      calf.facing = 1;
      calf.settleTimer = 8 + Math.random() * 7;
      calf.homeX = calf.x;
    } else if (Math.random() < 0.01) {
      // Stop early and chew again
      calf.settleTimer = 7 + Math.random() * 8;
      calf.homeX = calf.x;
    }
  }
}

export default function Page() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const phaseRef = useRef(PHASE.MENU);
  const spriteRef = useRef(null);
  const potSpritesRef = useRef({});
  const calfSpritesRef = useRef({});
  const putanaSpriteRef = useRef(null);
  const mantraRef = useRef(null);

  const [phase, setPhase] = useState(PHASE.MENU);
  const [score, setScore] = useState(0);
  const [missStreak, setMissStreak] = useState(0);
  const [caught, setCaught] = useState(0);
  const [best, setBest] = useState(0);
  const [showPaglu, setShowPaglu] = useState(false);
  const [pagluBurst, setPagluBurst] = useState(false);
  const [showConscious, setShowConscious] = useState(false);
  const [consciousBurst, setConsciousBurst] = useState(false);
  const [hasLaddu, setHasLaddu] = useState(false);
  const [putanaActive, setPutanaActive] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  phaseRef.current = phase;

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem('makhan-vrindavan-best') || 0));
    } catch {
      /* ignore */
    }

    let cancelled = false;
    (async () => {
      const [
        krishna,
        n1,
        n2,
        w1,
        w2,
        g1,
        g2,
        calfGraze,
        calfSit,
        calfDecorated,
        putanaImg,
      ] = await Promise.all([
        loadImage('/krishna-sprite.png?v=2'),
        loadImage('/pots/pot-1.png?v=2'),
        loadImage('/pots/pot-2.png?v=2'),
        loadImage('/pots/pot-1-white.png?v=2'),
        loadImage('/pots/pot-2-white.png?v=2'),
        loadImage('/pots/pot-1-gold.png?v=2'),
        loadImage('/pots/pot-2-gold.png?v=2'),
        loadImage('/calves/graze.png?v=1'),
        loadImage('/calves/sit.png?v=1'),
        loadImage('/calves/decorated.png?v=1'),
        loadImage('/boss/putana.png?v=1'),
      ]);
      if (cancelled) return;
      spriteRef.current = krishna;
      potSpritesRef.current = {
        normal1: n1,
        normal2: n2,
        white1: w1,
        white2: w2,
        gold1: g1,
        gold2: g2,
      };
      calfSpritesRef.current = {
        graze: calfGraze,
        sit: calfSit,
        decorated: calfDecorated,
      };
      putanaSpriteRef.current = putanaImg;
      setAssetsReady(true);
    })();

    const mantra = new Audio('/audio/hare-krishna.mp3');
    mantra.loop = true;
    mantra.preload = 'auto';
    mantra.volume = 0.55;
    mantraRef.current = mantra;

    return () => {
      cancelled = true;
      mantra.pause();
      mantra.src = '';
      mantraRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mantra = mantraRef.current;
    if (!mantra) return;
    if (phase === PHASE.PLAYING) {
      const play = () => mantra.play().catch(() => {});
      if (mantra.readyState >= 2) play();
      else mantra.addEventListener('canplaythrough', play, { once: true });
    } else {
      mantra.pause();
      try {
        mantra.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [phase]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!engineRef.current) {
      engineRef.current = createEngine(w, h);
    } else {
      const e = engineRef.current;
      const sx = w / Math.max(1, e.w);
      const sy = h / Math.max(1, e.h);
      e.player.x *= sx;
      e.player.targetX *= sx;
      e.player.baseY = h * 0.8;
      if (e.player.onGround) e.player.y = e.player.baseY;
      e.w = w;
      e.h = h;
      const size = playerSize(w);
      e.player.w = size.w;
      e.player.h = size.h;
      e.calves = createCalves(w, h);
      for (const f of e.flowers) {
        f.x *= sx;
        f.y *= sy;
      }
    }
  }, []);

  const startGame = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    engineRef.current = createEngine(w, h);
    engineRef.current.running = true;
    setScore(0);
    setMissStreak(0);
    setCaught(0);
    setShowPaglu(false);
    setPagluBurst(false);
    setShowConscious(false);
    setConsciousBurst(false);
    setHasLaddu(false);
    setPutanaActive(false);
    setPhase(PHASE.PLAYING);
    const mantra = mantraRef.current;
    if (mantra) {
      mantra.currentTime = 0;
      mantra.play().catch(() => {});
    }
  }, []);

  const endGame = useCallback((finalScore) => {
    setScore(finalScore);
    setBest((prev) => {
      const next = Math.max(prev, finalScore);
      try {
        localStorage.setItem('makhan-vrindavan-best', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setPhase(PHASE.GAMEOVER);
    if (engineRef.current) engineRef.current.running = false;
  }, []);

  useEffect(() => {
    const down = (ev) => {
      const e = engineRef.current;
      if (!e) return;
      if (ev.key === 'ArrowLeft') {
        e.input.left = true;
        ev.preventDefault();
      }
      if (ev.key === 'ArrowRight') {
        e.input.right = true;
        ev.preventDefault();
      }
      if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
        e.input.jump = true;
        ev.preventDefault();
      }
      if (ev.key === 'c' || ev.key === 'C' || ev.key === 'f' || ev.key === 'F') {
        e.input.chakra = true;
        ev.preventDefault();
      }
      if (ev.key === ' ') {
        ev.preventDefault();
        if (phaseRef.current === PHASE.PLAYING) {
          // Space throws chakra if Putana is active, else jumps
          if (e.putana && e.putana.state === 'fall') e.input.chakra = true;
          else e.input.jump = true;
        } else startGame();
      }
      if (ev.key === 'Enter' && phaseRef.current !== PHASE.PLAYING) {
        startGame();
      }
    };
    const up = (ev) => {
      const e = engineRef.current;
      if (!e) return;
      if (ev.key === 'ArrowLeft') e.input.left = false;
      if (ev.key === 'ArrowRight') e.input.right = false;
      if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W' || ev.key === ' ') {
        e.input.jump = false;
      }
      if (ev.key === 'c' || ev.key === 'C' || ev.key === 'f' || ev.key === 'F' || ev.key === ' ') {
        e.input.chakra = false;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [startGame]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);

    const tick = (ts) => {
      rafRef.current = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      const e = engineRef.current;
      if (!canvas || !e) return;
      const ctx = canvas.getContext('2d');

      const dt = Math.min(0.033, (ts - (lastTsRef.current || ts)) / 1000);
      lastTsRef.current = ts;
      e.time += dt;

      // Ambient life always animates (menu + play)
      updateCalves(e, dt);
      updateButterflies(e, dt);
      updateBees(e, dt);

      if (e.running && phaseRef.current === PHASE.PLAYING) {
        const moveSpeed = Math.min(e.w * 0.58, 460);
        if (e.input.left) {
          e.player.targetX -= moveSpeed * dt;
          e.player.facing = -1;
        }
        if (e.input.right) {
          e.player.targetX += moveSpeed * dt;
          e.player.facing = 1;
        }
        e.player.targetX = Math.max(
          e.player.w * 0.35,
          Math.min(e.w - e.player.w * 0.35, e.player.targetX)
        );
        const ease = 1 - Math.pow(0.0008, dt);
        e.player.x += (e.player.targetX - e.player.x) * Math.min(1, ease * 12);

        // Small jump to reach pots
        if (e.input.jump && e.player.onGround) {
          e.player.jumpVy = -Math.min(520, e.h * 0.55);
          e.player.onGround = false;
          e.input.jump = false; // one press = one jump
        }
        if (!e.player.onGround) {
          e.player.jumpVy += 1600 * dt; // gravity
          e.player.y += e.player.jumpVy * dt;
          if (e.player.y >= e.player.baseY) {
            e.player.y = e.player.baseY;
            e.player.jumpVy = 0;
            e.player.onGround = true;
          }
        } else {
          e.player.y = e.player.baseY;
        }

        // Continuous speed ramp every frame
        updateFallSpeed(e, dt);

        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0) {
          const cap = maxPotsFor(e);
          if (e.pots.length >= cap) {
            e.spawnTimer = 0.2;
          } else {
            spawnPot(e);
            // Sometimes spawn a second pot when difficulty is high
            if (cap >= 3 && e.pots.length < cap && Math.random() < 0.22 + difficulty(e) * 0.04) {
              spawnPot(e);
            }
            const d = difficulty(e);
            const baseGap = Math.max(0.32, 2.0 - d * 0.28);
            e.spawnTimer = baseGap * (0.85 + Math.random() * 0.3);
          }
        }

        for (let i = e.pots.length - 1; i >= 0; i--) {
          const pot = e.pots[i];
          const speedMul = pot.type === 'golden' ? 1.12 : pot.type === 'white' ? 1.04 : 1;
          pot.y += e.fallSpeed * speedMul * dt;
          pot.rot += pot.spin * dt;
          pot.x += Math.sin(e.time * 2 + pot.wobble) * 16 * dt;

          // Catch zone follows Krishna's jump — a bit taller while airborne
          const airBonus = e.player.onGround ? 0 : e.player.h * 0.12;
          const catchY = e.player.y - e.player.h * 0.18;
          const dx = pot.x - e.player.x;
          const dy = pot.y - catchY;
          const hitR = e.player.w * 0.45 + pot.r * 0.5;

          if (dy > -pot.r - airBonus && dy < e.player.h * 0.4 && Math.abs(dx) < hitR) {
            const pts = POT_POINTS[pot.type] || 1;
            e.score += pts;
            e.caught += 1;
            e.catchStreak += 1;
            e.missStreak = 0; // catching resets consecutive misses

            const burstColor =
              pot.type === 'golden' ? '#ffd54a' : pot.type === 'white' ? '#f5f5f5' : '#ffe566';
            burst(e, pot.x, pot.y, burstColor, pot.type === 'golden' ? 22 : 12);
            e.floatText.push({
              x: pot.x,
              y: pot.y - 16,
              text: `+${pts}`,
              color: pot.type === 'golden' ? '#ffd54a' : pot.type === 'white' ? '#e8eef8' : '#fbbf24',
              life: 0.85,
            });

            if (!e.achievementUnlocked && e.caught >= 50) {
              e.achievementUnlocked = true;
              e.achievementFlash = 5.5;
              spawnCelebrationStars(e, 48);
              setShowPaglu(true);
              setPagluBurst(true);
              setTimeout(() => setPagluBurst(false), 5200);
              e.floatText.push({
                x: e.w * 0.5,
                y: e.h * 0.35,
                text: 'KRISHNA PAGLU!',
                color: '#ffd54a',
                life: 2.2,
              });
            }

            // 500 score → Krishna Conscious + one sacred laddu
            if (!e.consciousUnlocked && e.score >= 500) {
              e.consciousUnlocked = true;
              e.hasLaddu = true;
              e.achievementFlash = 6;
              spawnCelebrationStars(e, 60);
              setShowConscious(true);
              setConsciousBurst(true);
              setHasLaddu(true);
              setTimeout(() => setConsciousBurst(false), 6000);
              e.floatText.push({
                x: e.w * 0.5,
                y: e.h * 0.32,
                text: 'KRISHNA CONSCIOUS!',
                color: '#a7f3d0',
                life: 2.4,
              });
              e.floatText.push({
                x: e.w * 0.5,
                y: e.h * 0.38,
                text: '+1 LADDU 🍡',
                color: '#fdba74',
                life: 2.2,
              });
            }

            e.pots.splice(i, 1);
            setScore(e.score);
            setCaught(e.caught);
            setMissStreak(0);
            continue;
          }

          if (pot.y - pot.r > e.h) {
            e.missStreak += 1;
            e.catchStreak = 0;
            e.shake = 0.28;
            burst(e, pot.x, e.h - 24, '#f87171', 14);
            e.pots.splice(i, 1);
            setMissStreak(e.missStreak);
            // 5 pots missed in a row → game over
            if (e.missStreak >= e.missLimit) {
              endGame(e.score);
              break;
            }
          }
        }

        // ---- Putana encounter ----
        e.putanaCooldown -= dt;
        // As speed rises, Putana appears more often
        {
          const haste = Math.min(1, (e.fallSpeed - 85) / 220);
          const chance = 0.01 + haste * 0.035;
          if (!e.putana && e.caught >= 8 && e.putanaCooldown <= 0 && Math.random() < chance) {
            spawnPutana(e);
            setPutanaActive(true);
          }
        }

        if (e.putana) {
          const boss = e.putana;
          if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);

          if (boss.state === 'fall') {
            // Fall from above like pots
            boss.y += boss.vy * dt;
            boss.x += Math.sin(e.time * 2 + boss.wobble) * 14 * dt;
            if (e.input.chakra) throwChakra(e);

            // Reached the ground without being hit → fail, lose 10 pots
            if (boss.y - boss.size * 0.35 > e.h) {
              const lost = 10;
              e.score = Math.max(0, e.score - lost);
              e.caught = Math.max(0, e.caught - lost);
              e.shake = 0.4;
              setScore(e.score);
              setCaught(e.caught);
              burst(e, boss.x, e.h - 30, '#f472b6', 16);
              e.floatText.push({
                x: e.w * 0.5,
                y: e.h * 0.3,
                text: '-10 POTS!',
                color: '#f87171',
                life: 1.8,
              });
              e.putana = null;
              e.chakras = [];
              setPutanaActive(false);
            }
          } else if (boss.state === 'dying') {
            boss.y -= 50 * dt;
            boss.size *= 1 - dt * 0.9;
            boss.hitFlash = 1;
            if (boss.size < 16) {
              e.putana = null;
              setPutanaActive(false);
            }
          }
        }

        // Chakras
        for (let i = e.chakras.length - 1; i >= 0; i--) {
          const c = e.chakras[i];
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rot += 18 * dt;
          c.life -= dt;
          const boss = e.putana;
          if (boss && boss.state === 'fall') {
            const dx = c.x - boss.x;
            const dy = c.y - boss.y;
            if (dx * dx + dy * dy < (boss.size * 0.4) ** 2) {
              boss.state = 'dying';
              e.putanaKills += 1;
              e.score += 15;
              e.caught += 5;
              setScore(e.score);
              setCaught(e.caught);
              burst(e, boss.x, boss.y, '#f472b6', 28);
              burst(e, boss.x, boss.y, '#fbbf24', 18);
              e.floatText.push({
                x: boss.x,
                y: boss.y - 30,
                text: 'SUDARSHAN!',
                color: '#fbbf24',
                life: 1.5,
              });
              e.chakras.splice(i, 1);
              continue;
            }
          }
          if (c.life <= 0 || c.x < -40 || c.x > e.w + 40 || c.y < -40 || c.y > e.h + 40) {
            e.chakras.splice(i, 1);
          }
        }

        for (let i = e.particles.length - 1; i >= 0; i--) {
          const p = e.particles[i];
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 260 * dt;
          if (p.life <= 0) e.particles.splice(i, 1);
        }
        for (let i = e.floatText.length - 1; i >= 0; i--) {
          const f = e.floatText[i];
          f.life -= dt;
          f.y -= 36 * dt;
          if (f.life <= 0) e.floatText.splice(i, 1);
        }
        for (let i = e.stars.length - 1; i >= 0; i--) {
          const s = e.stars[i];
          s.life -= dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vy += 60 * dt;
          s.rot += s.spin * dt;
          if (s.life <= 0) e.stars.splice(i, 1);
        }
        if (e.shake > 0) e.shake = Math.max(0, e.shake - dt);
        if (e.achievementFlash > 0) {
          e.achievementFlash = Math.max(0, e.achievementFlash - dt);
          if (e.achievementFlash > 3.5 && Math.random() < 0.25) {
            spawnCelebrationStars(e, 2);
          }
        }
      }

      ctx.save();
      if (e.shake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * 12 * e.shake,
          (Math.random() - 0.5) * 12 * e.shake
        );
      }
      drawGarden(ctx, e, e.time, calfSpritesRef.current);
      for (const pot of e.pots) drawPot(ctx, pot, e.time, potSpritesRef.current);
      if (e.putana) drawPutana(ctx, e.putana, e.time, putanaSpriteRef.current);
      for (const c of e.chakras) drawSudarshan(ctx, c);
      drawKrishna(ctx, e.player, e.time, spriteRef.current);
      drawParticles(ctx, e.particles);
      drawCelebrationStars(ctx, e.stars);
      drawFloatText(ctx, e.floatText);
      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [resize, endGame, assetsReady]);

  const setSide = (side, down) => {
    const e = engineRef.current;
    if (!e) return;
    if (side === 'left') {
      e.input.left = down;
      if (down) e.input.right = false;
    }
    if (side === 'right') {
      e.input.right = down;
      if (down) e.input.left = false;
    }
  };

  const clearMove = () => {
    const e = engineRef.current;
    if (!e) return;
    e.input.left = false;
    e.input.right = false;
  };

  /** Mouse / trackpad / touch: move toward pointer X while pressed */
  const aimFromPointer = (clientX, down) => {
    const e = engineRef.current;
    if (!e || phaseRef.current !== PHASE.PLAYING) return;
    if (!down) {
      clearMove();
      return;
    }
    const mid = window.innerWidth * 0.5;
    if (clientX < mid) {
      e.input.left = true;
      e.input.right = false;
    } else {
      e.input.right = true;
      e.input.left = false;
    }
  };

  const doJump = () => {
    const e = engineRef.current;
    if (!e || phaseRef.current !== PHASE.PLAYING) return;
    e.input.jump = true;
  };

  const doChakra = () => {
    const e = engineRef.current;
    if (!e || phaseRef.current !== PHASE.PLAYING) return;
    e.input.chakra = true;
  };

  // Release movement if pointer is released anywhere (mouse/trackpad safety)
  useEffect(() => {
    if (phase !== PHASE.PLAYING) return undefined;
    const release = () => clearMove();
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', release);
    };
  }, [phase]);

  const bindHold = (side) => ({
    onPointerDown: (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      setSide(side, true);
    },
    onPointerUp: (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setSide(side, false);
    },
    onPointerCancel: () => setSide(side, false),
  });

  const pagluBig = showPaglu && (pagluBurst || (caught >= 50 && caught < 56));
  const consciousBig = showConscious && (consciousBurst || (score >= 500 && score < 520));

  return (
    <main className="fixed inset-0 h-[100dvh] w-[100vw] overflow-hidden touch-none select-none bg-[#1a0b2e]">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        aria-label="Makhan Catch — Little Krishna in Vrindavan"
      />

      {phase === PHASE.PLAYING && (
        <>
          {/* Full-screen pointer zones — mouse, trackpad click, and finger */}
          <div
            className="absolute inset-x-0 top-0 z-10 touch-none"
            style={{ bottom: 'max(7.5rem, calc(env(safe-area-inset-bottom) + 6.5rem))' }}
            onPointerDown={(ev) => {
              if (ev.target !== ev.currentTarget) return;
              ev.preventDefault();
              try {
                ev.currentTarget.setPointerCapture(ev.pointerId);
              } catch {
                /* ignore */
              }
              aimFromPointer(ev.clientX, true);
            }}
            onPointerMove={(ev) => {
              if (ev.pointerType === 'mouse' && ev.buttons === 0) return;
              aimFromPointer(ev.clientX, true);
            }}
            onPointerUp={() => clearMove()}
            onPointerCancel={() => clearMove()}
            onLostPointerCapture={() => clearMove()}
          />

          {/* Mobile-first on-screen controls */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              aria-label="Move left"
              className="control-btn pointer-events-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/20 text-2xl font-black text-white shadow-lg backdrop-blur-md active:scale-90 sm:h-20 sm:w-20"
              {...bindHold('left')}
            >
              ←
            </button>

            <div className="pointer-events-auto mb-1 flex flex-col items-center gap-2">
              <button
                type="button"
                aria-label="Jump"
                className="control-btn min-w-[7.5rem] rounded-full border border-white/30 bg-white/20 px-6 py-3.5 text-sm font-extrabold uppercase tracking-[0.15em] text-white shadow-lg backdrop-blur-md active:scale-90"
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  doJump();
                }}
              >
                Jump
              </button>
              {putanaActive && (
                <button
                  type="button"
                  aria-label="Throw Sudarshan Chakra"
                  className="control-btn min-w-[7.5rem] animate-pulse rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-stone-900 shadow-[0_0_24px_rgba(251,191,36,0.55)] active:scale-90"
                  onPointerDown={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    doChakra();
                  }}
                >
                  ☉ Chakra
                </button>
              )}
            </div>

            <button
              type="button"
              aria-label="Move right"
              className="control-btn pointer-events-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/20 text-2xl font-black text-white shadow-lg backdrop-blur-md active:scale-90 sm:h-20 sm:w-20"
              {...bindHold('right')}
            >
              →
            </button>
          </div>
        </>
      )}

      {/* HUD */}
      {phase === PHASE.PLAYING && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-lg backdrop-blur-md sm:px-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200/80">
              Score
            </p>
            <p className="bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300 bg-clip-text text-3xl font-extrabold text-transparent">
              {score}
            </p>
            <p className="mt-0.5 text-[10px] text-white/55">{caught} pots</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {/* Consecutive misses — fills red as you miss in a row; clears on catch */}
            <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-lg backdrop-blur-md">
              <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">
                Miss streak
              </p>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src="/pots/pot-1.png?v=2"
                    alt=""
                    className={`h-7 w-7 object-contain transition ${
                      i < missStreak
                        ? 'opacity-100 brightness-110 drop-shadow-[0_0_8px_rgba(248,113,113,0.75)] saturate-150'
                        : 'opacity-30 grayscale'
                    }`}
                    draggable={false}
                  />
                ))}
              </div>
              <p className="mt-1 text-center text-[9px] text-white/45">
                {5 - missStreak} left in a row
              </p>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              {caught >= 50 && (
                <div
                  className={`rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-400/90 to-orange-500/90 px-3 py-1 text-center transition-all duration-500 ${
                    pagluBig
                      ? 'scale-125 px-4 py-2 shadow-[0_0_40px_rgba(251,191,36,0.85)] ring-2 ring-amber-200/80'
                      : 'scale-100 shadow-[0_0_24px_rgba(251,191,36,0.45)]'
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-900/70">
                    Badge
                  </p>
                  <p className="text-xs font-extrabold tracking-wide text-stone-900 sm:text-sm">
                    🦚 Krishna Paglu
                  </p>
                </div>
              )}
              {showConscious && (
                <div
                  className={`rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-300/95 to-teal-400/95 px-3 py-1 text-center transition-all duration-500 ${
                    consciousBig
                      ? 'scale-125 px-4 py-2 shadow-[0_0_40px_rgba(52,211,153,0.85)] ring-2 ring-emerald-100/80'
                      : 'scale-100 shadow-[0_0_24px_rgba(52,211,153,0.45)]'
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-900/70">
                    Badge
                  </p>
                  <p className="text-xs font-extrabold tracking-wide text-stone-900 sm:text-sm">
                    🌿 Krishna Conscious
                  </p>
                </div>
              )}
              {hasLaddu && (
                <div className="rounded-full border border-orange-200/40 bg-orange-400/25 px-3 py-1 text-xs font-extrabold text-orange-100 shadow-md backdrop-blur-sm">
                  🍡 Sacred Laddu ×1
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right shadow-lg backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Best</p>
            <p className="text-lg font-bold text-white/90">{best}</p>
          </div>
        </div>
      )}

      {/* Achievement toasts */}
      {phase === PHASE.PLAYING && pagluBig && (
        <div className="pointer-events-none absolute inset-0 z-25 overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-amber-300/10" />
          {[...Array(14)].map((_, i) => (
            <span
              key={`p-${i}`}
              className="absolute text-amber-300"
              style={{
                left: `${8 + ((i * 17) % 84)}%`,
                top: `${10 + ((i * 29) % 70)}%`,
                fontSize: `${12 + (i % 5) * 6}px`,
                animation: `starTwinkle ${1 + (i % 4) * 0.35}s ease-in-out infinite`,
                animationDelay: `${(i % 7) * 0.12}s`,
              }}
            >
              ✦
            </span>
          ))}
          <div className="animate-fade-up absolute inset-x-0 top-[22%] flex justify-center px-4">
            <div className="rounded-3xl border-2 border-amber-200/70 bg-black/45 px-6 py-5 text-center shadow-[0_0_50px_rgba(251,191,36,0.55)] backdrop-blur-md ring-4 ring-amber-400/30">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200">✨ Badge Unlocked</p>
              <p className="bg-gradient-to-r from-amber-100 via-yellow-300 to-orange-400 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
                Krishna Paglu
              </p>
              <p className="mt-2 text-sm text-white/80">50 makhan pots caught!</p>
            </div>
          </div>
        </div>
      )}

      {phase === PHASE.PLAYING && consciousBig && (
        <div className="pointer-events-none absolute inset-0 z-25 overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-emerald-300/15" />
          {[...Array(16)].map((_, i) => (
            <span
              key={`c-${i}`}
              className="absolute text-emerald-200"
              style={{
                left: `${6 + ((i * 19) % 88)}%`,
                top: `${8 + ((i * 23) % 72)}%`,
                fontSize: `${14 + (i % 4) * 5}px`,
                animation: `starTwinkle ${0.9 + (i % 3) * 0.4}s ease-in-out infinite`,
                animationDelay: `${(i % 6) * 0.1}s`,
              }}
            >
              ✦
            </span>
          ))}
          <div className="animate-fade-up absolute inset-x-0 top-[20%] flex justify-center px-4">
            <div className="rounded-3xl border-2 border-emerald-200/70 bg-black/50 px-6 py-5 text-center shadow-[0_0_50px_rgba(52,211,153,0.5)] backdrop-blur-md ring-4 ring-emerald-400/30">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-200">✨ Awakened</p>
              <p className="bg-gradient-to-r from-emerald-100 via-teal-200 to-cyan-300 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
                Krishna Conscious
              </p>
              <p className="mt-2 text-sm text-white/85">Score 500 reached — sacred laddu granted!</p>
              <p className="mt-3 text-3xl">🍡</p>
            </div>
          </div>
        </div>
      )}

      {/* MENU — game title card */}
      {phase === PHASE.MENU && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-[#1a0b2e]/30 via-[#1a0b2e]/55 to-[#1a0b2e]/80 px-4 backdrop-blur-[6px]">
          <div className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-[28px] border border-amber-200/25 bg-gradient-to-b from-white/18 via-white/8 to-amber-950/30 p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />

            <p className="relative mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200">
              Magical Vrindavan
            </p>

            <div className="relative mx-auto mb-2 flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-300/25 to-orange-500/10 blur-md" />
              <div className="absolute inset-2 rounded-full border border-white/20 bg-white/5" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/krishna-sprite.png?v=2"
                alt="Little Krishna"
                className="relative z-10 h-[88%] w-[88%] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
                draggable={false}
              />
            </div>

            <h1 className="relative mb-1 bg-gradient-to-r from-amber-100 via-yellow-300 to-orange-400 bg-clip-text text-5xl font-black tracking-wide text-transparent sm:text-6xl">
              Makhan Catch
            </h1>
            <p className="relative mb-5 text-sm text-white/70">
              Catch · Jump · Defeat Putana
            </p>

            <div className="relative mb-5 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
              {[
                { img: '/pots/pot-1.png?v=2', label: 'Clay', pts: '+1' },
                { img: '/pots/pot-1-white.png?v=2', label: 'White', pts: '+3' },
                { img: '/pots/pot-1-gold.png?v=2', label: 'Golden', pts: '+10' },
                { img: '/boss/putana.png?v=1', label: 'Putana', pts: 'Chakra' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/15 bg-black/25 p-2.5 text-center backdrop-blur-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.img} alt="" className="mx-auto mb-1 h-10 w-10 object-contain" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{card.label}</p>
                  <p className="text-xs font-extrabold text-amber-200">{card.pts}</p>
                </div>
              ))}
            </div>

            <div className="relative mb-5 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-left text-xs text-white/70 sm:text-sm">
              <p>⚡ Speed &amp; pot count rise as you score</p>
              <p>🦚 50 pots → <span className="font-bold text-amber-200">Krishna Paglu</span></p>
              <p>🌿 500 score → <span className="font-bold text-emerald-200">Krishna Conscious</span> + 🍡 laddu</p>
              <p>💀 Miss 5 in a row = game over</p>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="relative w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 px-6 py-4 text-base font-black uppercase tracking-[0.2em] text-stone-900 shadow-[0_14px_40px_rgba(251,191,36,0.45)] transition hover:scale-[1.03] active:scale-95"
            >
              ▶ Play Now
            </button>

            {best > 0 && (
              <p className="relative mt-4 text-xs uppercase tracking-[0.22em] text-white/50">
                Best · {best}
              </p>
            )}
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {phase === PHASE.GAMEOVER && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1a0b2e]/45 px-5 backdrop-blur-md">
          <div className="animate-fade-up w-full max-w-md rounded-3xl border border-white/25 bg-gradient-to-br from-white/20 to-white/5 p-8 text-center shadow-[0_25px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/krishna-sprite.png?v=2"
              alt=""
              className="mx-auto mb-3 h-24 w-24 object-contain opacity-90"
              draggable={false}
            />
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.35em] text-rose-300">
              Oh dear
            </p>
            <h2 className="mb-2 bg-gradient-to-r from-amber-100 via-yellow-300 to-orange-400 bg-clip-text text-3xl font-extrabold tracking-wide text-transparent sm:text-4xl">
              Makhan Spilled
            </h2>
            <p className="mb-1 bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-6xl font-extrabold text-transparent">
              {score}
            </p>
            <p className="mb-2 text-sm text-white/70">
              {caught} pots caught · 5 misses in a row
            </p>
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              {caught >= 50 && (
                <p className="inline-block rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
                  🦚 Krishna Paglu
                </p>
              )}
              {showConscious && (
                <p className="inline-block rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-200">
                  🌿 Krishna Conscious
                </p>
              )}
              {hasLaddu && (
                <p className="inline-block rounded-full border border-orange-300/40 bg-orange-400/20 px-3 py-1 text-xs font-bold text-orange-100">
                  🍡 Laddu ×1
                </p>
              )}
            </div>
            {best > 0 && (
              <p className="mb-5 text-xs uppercase tracking-[0.2em] text-white/50">
                Best · {best}
              </p>
            )}
            <button
              type="button"
              onClick={startGame}
              className="mb-3 w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 px-6 py-4 text-base font-black uppercase tracking-[0.18em] text-stone-900 shadow-[0_12px_30px_rgba(251,191,36,0.4)] transition hover:scale-[1.03] active:scale-95"
            >
              ▶ Play Again
            </button>
            <button
              type="button"
              onClick={() => setPhase(PHASE.MENU)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white/85 transition hover:scale-[1.02] hover:bg-white/15 active:scale-95"
            >
              Menu
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
