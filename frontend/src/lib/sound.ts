/** Big-screen sound effects, synthesised with Web Audio: nothing to download or cache.
 *  Browsers keep audio locked until a click, so the screen shows an "Enable sound" button. */
const KEY = "sportsaxle.sound";
let ctx: AudioContext | null = null;

export const soundOn = () => localStorage.getItem(KEY) === "1" && ctx?.state === "running";

/** Call from a click. Returns whether sound is now on. */
export async function enableSound(on: boolean): Promise<boolean> {
  localStorage.setItem(KEY, on ? "1" : "0");
  if (!on) return false;
  ctx ??= new AudioContext();
  await ctx.resume();
  tone(660, 0.12, 0.05); // confirms it works
  return true;
}

function tone(freq: number, seconds: number, gain = 0.15, delay = 0, type: OscillatorType = "sine") {
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds);
}

export const sounds = {
  bid: () => (tone(880, 0.15), tone(1320, 0.2, 0.12, 0.08)),
  tick: () => tone(1000, 0.06, 0.1, 0, "square"),
  sold: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 0.18, i * 0.12, "triangle")),
  unsold: () => (tone(220, 0.4, 0.15, 0, "sawtooth"), tone(165, 0.5, 0.15, 0.25, "sawtooth")),
};
