// Canvas rendering of composition as narrowing: one connector's transformations generate a 3D
// space of possibilities, a connected connector narrows it to a folded surface, and a further
// connected connector narrows it to a single curve. Purely illustrative.

export const VHS = {
  cyan: "#67d6ff",
  magenta: "#ff5fd2",
  yellow: "#f7c86a",
  coral: "#ff9b7a",
  green: "#8de58f",
} as const;

export const SPACE_LOOP_SECONDS = 13;

/** How many connectors are connected in the current frame: 0 one, 1 two, 2 three. */
export type SpaceStep = 0 | 1 | 2;

export type SpaceState = {
  step: SpaceStep;
  /** Twelve values in [0, 1] read along the narrowest result; Worlds interpret these. */
  outputs: number[];
};

const SIDE = 10;
const OUTPUT_COUNT = 12;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (from: number, to: number, value: number) => {
  const x = clamp01((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

// The second connector keeps a folded surface; the third keeps one curve on that surface.
const surface = (x: number, z: number, time: number) =>
  0.45 * Math.sin(1.7 * x + 0.5 + 0.25 * Math.sin(time * 0.3)) * Math.cos(1.25 * z);
const curveZ = (x: number) => 0.5 * Math.sin(2.1 * x + 0.3);

type Timeline = { reveal: number; first: number; second: number; fade: number };

const timeline = (loopTime: number): Timeline => ({
  reveal: smooth(0, 1.4, loopTime),
  first: smooth(3.6, 5.8, loopTime),
  second: smooth(8.2, 10.2, loopTime),
  fade: smooth(12.3, 13, loopTime),
});

const stepFor = (loopTime: number): SpaceStep => (loopTime < 3.6 ? 0 : loopTime < 8.2 ? 1 : 2);

type Projected = { x: number; y: number; scale: number };

const projector = (width: number, height: number, time: number) => {
  const yaw = time * 0.22;
  const tilt = 0.42;
  const radius = Math.min(width * 0.25, height * 0.27);
  return (x: number, y: number, z: number): Projected => {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    const scale = 5 / (5 + z2);
    return { x: width / 2 + x1 * scale * radius, y: height * 0.52 - y2 * scale * radius, scale };
  };
};

export const drawPossibilitySpace = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
): SpaceState => {
  const loopTime = time % SPACE_LOOP_SECONDS;
  const t = timeline(loopTime);
  const visible = t.reveal * (1 - t.fade);
  const project = projector(width, height, time);

  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // The bounds of the space.
  ctx.strokeStyle = VHS.cyan;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.22 * visible;
  const corners = [-1, 1];
  for (const a of corners) {
    for (const b of corners) {
      for (const [from, to] of [
        [project(-1, a, b), project(1, a, b)],
        [project(a, -1, b), project(a, 1, b)],
        [project(a, b, -1), project(a, b, 1)],
      ]) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
  }

  // Every possibility the first connector generates, fading where later connectors exclude it.
  for (let i = 0; i < SIDE; i += 1) {
    for (let j = 0; j < SIDE; j += 1) {
      for (let k = 0; k < SIDE; k += 1) {
        const x = (i / (SIDE - 1)) * 2 - 1;
        const y = (j / (SIDE - 1)) * 2 - 1;
        const z = (k / (SIDE - 1)) * 2 - 1;
        const onSurface = 1 - smooth(0.12, 0.3, Math.abs(y - surface(x, z, time)));
        const onCurve = onSurface * (1 - smooth(0.1, 0.28, Math.abs(z - curveZ(x))));
        const kept = lerp(1, onSurface, t.first) * lerp(1, onCurve, t.second);
        const settledY = lerp(y, surface(x, z, time), t.first * onSurface * 0.7);
        const point = project(x, settledY, z);
        const alpha = visible * lerp(0.07, 0.85, kept);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = kept > 0.5 && t.first > 0.5 ? VHS.magenta : VHS.cyan;
        ctx.beginPath();
        ctx.arc(point.x, point.y, (1.1 + kept * 1.2) * point.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // The folded surface the second connector keeps.
  const surfaceAlpha = visible * t.first * (1 - 0.65 * t.second);
  if (surfaceAlpha > 0.01) {
    ctx.strokeStyle = VHS.magenta;
    ctx.lineWidth = 1;
    ctx.globalAlpha = surfaceAlpha * 0.55;
    const lines = 14;
    for (let line = 0; line <= lines; line += 1) {
      const fixed = (line / lines) * 2 - 1;
      for (const alongX of [true, false]) {
        ctx.beginPath();
        for (let s = 0; s <= 32; s += 1) {
          const moving = (s / 32) * 2 - 1;
          const x = alongX ? moving : fixed;
          const z = alongX ? fixed : moving;
          const point = project(x, surface(x, z, time), z);
          if (s === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }
    }
  }

  // The single curve left after the third connector, and its output flowing on.
  const curve: (Projected & { value: number })[] = [];
  for (let s = 0; s <= 60; s += 1) {
    const x = (s / 60) * 2 - 1;
    const z = curveZ(x);
    const y = surface(x, z, time);
    curve.push({ ...project(x, y, z), value: y });
  }
  const curveAlpha = visible * t.second;
  if (curveAlpha > 0.01) {
    for (const [color, lineWidth, alpha] of [
      [VHS.coral, 8, 0.2],
      [VHS.yellow, 2.6, 1],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = alpha * curveAlpha;
      ctx.beginPath();
      curve.forEach((point, index) =>
        index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
      );
      ctx.stroke();
    }
    ctx.fillStyle = VHS.yellow;
    for (let n = 0; n < 22; n += 1) {
      const progress = (time * 0.4 + n / 22) % 1;
      const source = curve[(n * 11) % 61];
      ctx.globalAlpha = curveAlpha * (1 - progress) * smooth(10.2, 11, loopTime);
      ctx.beginPath();
      ctx.arc(
        lerp(source.x, width + 10, progress * progress),
        lerp(source.y, height * 0.5, progress),
        1.6 + (n % 3) * 0.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const outputs = Array.from({ length: OUTPUT_COUNT }, (_, index) => {
    const point = curve[Math.round((index / (OUTPUT_COUNT - 1)) * 60)];
    return clamp01(0.5 + point.value * 0.8 + 0.12 * Math.sin(time * 0.7 + index));
  });

  return { step: stepFor(loopTime), outputs };
};
