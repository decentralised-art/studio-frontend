// Small generative scenes standing in for Worlds. Each one interprets the same output values
// from the folded space in a different medium. Illustrative only, not real Worlds.
import { VHS } from "./possibilitySpace";

export type WorldScene = {
  id: string;
  title: string;
  medium: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, values: number[]) => void;
};

const TAU = Math.PI * 2;
const at = (values: number[], index: number) =>
  values[((index % values.length) + values.length) % values.length] ?? 0.5;

const backdrop = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: string,
  bottom: string,
) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
};

const score: WorldScene = {
  id: "score",
  title: "Score",
  medium: "music notation",
  draw(ctx, w, h, t, values) {
    backdrop(ctx, w, h, "#1b1430", "#0b0a16");
    const gap = h * 0.085;
    const top = h * 0.3;
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 1;
    for (let line = 0; line < 5; line += 1) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, top + line * gap);
      ctx.lineTo(w * 0.94, top + line * gap);
      ctx.stroke();
    }
    const step = w * 0.13;
    const scroll = (t * 26) % step;
    for (let k = -1; k < 9; k += 1) {
      const index = k + Math.floor((t * 26) / step);
      const x = w * 0.1 + k * step - scroll;
      if (x < w * 0.04 || x > w * 0.96) continue;
      const y = top + 4 * gap - at(values, index) * 5 * gap;
      const lit = Math.abs(x - w * 0.5) < step * 0.5;
      ctx.fillStyle = lit ? VHS.yellow : "#f4ead2";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, gap * 0.62, gap * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + gap * 0.55, y);
      ctx.lineTo(x + gap * 0.55, y - gap * 3);
      ctx.stroke();
    }
    ctx.strokeStyle = VHS.cyan;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.16);
    ctx.lineTo(w * 0.5, h * 0.84);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

const tone: WorldScene = {
  id: "tone",
  title: "Tone",
  medium: "sound",
  draw(ctx, w, h, t, values) {
    backdrop(ctx, w, h, "#04140f", "#020806");
    const a = 1 + Math.round(at(values, 0) * 4);
    const b = 2 + Math.round(at(values, 3) * 3);
    ctx.globalCompositeOperation = "lighter";
    for (let echo = 3; echo >= 0; echo -= 1) {
      const phase = t * 0.9 - echo * 0.06;
      ctx.strokeStyle = VHS.green;
      ctx.globalAlpha = echo === 0 ? 0.95 : 0.22 / echo;
      ctx.lineWidth = echo === 0 ? 1.6 : 3;
      ctx.beginPath();
      for (let k = 0; k <= 240; k += 1) {
        const s = (k / 240) * TAU;
        const x = w / 2 + Math.sin(a * s + phase) * w * 0.36;
        const y = h / 2 + Math.sin(b * s) * h * 0.34;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  },
};

const horizon: WorldScene = {
  id: "horizon",
  title: "Horizon",
  medium: "game world",
  draw(ctx, w, h, t, values) {
    backdrop(ctx, w, h, "#2a0b3d", "#ff5fd2");
    const horizonY = h * 0.6;
    const sunR = h * 0.24;
    const sun = ctx.createLinearGradient(0, horizonY - sunR * 2, 0, horizonY);
    sun.addColorStop(0, VHS.yellow);
    sun.addColorStop(1, VHS.coral);
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(w / 2, horizonY - sunR * 0.35, sunR, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#2a0b3d";
    for (let k = 0; k < 4; k += 1) {
      ctx.fillRect(w / 2 - sunR, horizonY - sunR * 0.35 + k * sunR * 0.22, sunR * 2, 1.5 + k);
    }
    ctx.fillStyle = "#12051f";
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let k = 0; k <= 12; k += 1) {
      ctx.lineTo((k / 12) * w, horizonY - at(values, k) * h * 0.26 * (k % 2 ? 0.55 : 1));
    }
    ctx.lineTo(w, horizonY);
    ctx.fill();
    ctx.fillStyle = "#0a0214";
    ctx.fillRect(0, horizonY, w, h - horizonY);
    ctx.strokeStyle = VHS.cyan;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75;
    for (let k = -8; k <= 8; k += 1) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + k * w * 0.04, horizonY);
      ctx.lineTo(w / 2 + k * w * 0.32, h);
      ctx.stroke();
    }
    for (let k = 0; k < 6; k += 1) {
      const p = ((k + ((t * 0.8) % 1)) / 6) ** 2;
      const y = horizonY + p * (h - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

const bloom: WorldScene = {
  id: "bloom",
  title: "Bloom",
  medium: "generative image",
  draw(ctx, w, h, t, values) {
    backdrop(ctx, w, h, "#10061c", "#05030b");
    const petals = 5 + Math.round(at(values, 1) * 5);
    const colors = [VHS.magenta, VHS.cyan, VHS.yellow];
    ctx.globalCompositeOperation = "lighter";
    ctx.save();
    ctx.translate(w / 2, h / 2);
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = Math.min(w, h) * (0.42 - ring * 0.1) * (0.8 + 0.25 * at(values, ring + 4));
      ctx.rotate(t * (ring % 2 ? -0.18 : 0.12) + ring * 0.4);
      ctx.fillStyle = colors[ring];
      ctx.globalAlpha = 0.34;
      for (let k = 0; k < petals; k += 1) {
        ctx.save();
        ctx.rotate((k / petals) * TAU);
        ctx.beginPath();
        ctx.ellipse(radius * 0.5, 0, radius * 0.5, radius * 0.16, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  },
};

const loom: WorldScene = {
  id: "loom",
  title: "Loom",
  medium: "textile pattern",
  draw(ctx, w, h, t, values) {
    backdrop(ctx, w, h, "#1a1208", "#0d0904");
    const palette = [VHS.coral, VHS.yellow, VHS.cyan, "#3b2a4f"];
    const cols = 14;
    const cell = w / cols;
    const rows = Math.ceil(h / cell) + 1;
    const shift = (t * 8) % cell;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const row = j + Math.floor((t * 8) / cell);
        const over = (i + row) % 2 === 0;
        const weft = Math.floor(at(values, row) * 3.99);
        const warp = Math.floor(at(values, i) * 3.99);
        ctx.fillStyle = palette[over ? weft : (warp + 1) % 4];
        const x = i * cell;
        const y = j * cell - shift;
        if (over) ctx.fillRect(x + 1, y + cell * 0.18, cell - 2, cell * 0.64);
        else ctx.fillRect(x + cell * 0.18, y + 1, cell * 0.64, cell - 2);
      }
    }
  },
};

const swarm: WorldScene = {
  id: "swarm",
  title: "Swarm",
  medium: "living simulation",
  draw(ctx, w, h, t, values) {
    backdrop(ctx, w, h, "#06121c", "#02070c");
    const attractors = [0, 1, 2].map((k) => ({
      x: w * (0.2 + 0.6 * at(values, k * 4)),
      y: h * (0.25 + 0.5 * at(values, k * 4 + 2)),
    }));
    ctx.globalCompositeOperation = "lighter";
    for (let n = 0; n < 54; n += 1) {
      const target = attractors[n % 3];
      const speed = 0.6 + (n % 7) * 0.12;
      const radius = 6 + ((n * 37) % 23);
      const position = (time: number) => ({
        x: target.x + Math.cos(time * speed + n) * radius * 1.4,
        y: target.y + Math.sin(time * speed * 1.3 + n * 2) * radius,
      });
      const now = position(t);
      const before = position(t - 0.12);
      ctx.strokeStyle = n % 3 === 0 ? VHS.cyan : n % 3 === 1 ? VHS.green : VHS.magenta;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(before.x, before.y);
      ctx.lineTo(now.x, now.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  },
};

export const WORLD_SCENES: WorldScene[] = [score, tone, horizon, bloom, loom, swarm];
