// Days-since-trained helper — injected `now` everywhere, no hidden clocks (docs/02 §8).

export function daysSince(from: string, now: string): number {
  const ms = new Date(now).getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
