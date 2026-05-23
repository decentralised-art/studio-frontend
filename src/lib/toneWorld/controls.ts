import type { ToneAddress } from "./types";

export type ToneControlInterpolation = "step" | "linear";

export const getToneControlValueAtTime = (
  address: Pick<ToneAddress, "controlTimes" | "controlValues">,
  time: number,
  fallback = 0,
  interpolation: ToneControlInterpolation = "step",
): number => {
  const values = address.controlValues.filter((value) => Number.isFinite(value));
  if (values.length === 0) return fallback;
  const times = address.controlTimes.filter((value) => Number.isFinite(value) && value >= 0);
  if (times.length === 0) return values[0] ?? fallback;

  const count = Math.min(values.length, times.length);
  if (count === 0) return fallback;
  if (time <= (times[0] ?? 0)) return values[0] ?? fallback;

  for (let index = 1; index < count; index += 1) {
    const previousTime = times[index - 1] ?? 0;
    const nextTime = times[index] ?? previousTime;
    if (time > nextTime) continue;
    const previousValue = values[index - 1] ?? fallback;
    const nextValue = values[index] ?? previousValue;
    if (interpolation === "step" || nextTime <= previousTime) return previousValue;
    const amount = Math.max(0, Math.min(1, (time - previousTime) / (nextTime - previousTime)));
    return previousValue + (nextValue - previousValue) * amount;
  }

  return values[count - 1] ?? fallback;
};
