// Tiny synthesized click/blip for the desk gadgets. Web Audio is created lazily
// and only ever fires inside a user gesture, so autoplay policy is satisfied.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

export function click(freq = 760, dur = 0.05, gain = 0.06) {
  const c = audio();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  } catch {
    /* ignore */
  }
}

export function blip(freq = 440, dur = 0.09) {
  click(freq, dur, 0.04);
}
