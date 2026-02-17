let audioCtx: AudioContext | null = null;
let warmedUp = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Warm up the AudioContext from a user-gesture context (keypress, click).
 * Chromium requires this before any programmatic audio can play.
 * Call this once from a user interaction handler — subsequent plays
 * will work even from timers, IPC callbacks, or when minimized.
 */
export function warmUpAudio(): void {
  if (warmedUp) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  // Play a silent buffer to fully unlock the context
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  warmedUp = true;
}

export function playNotificationSound(volume = 0.5): void {
  const ctx = getAudioContext();

  // Belt-and-suspenders: try to resume if suspended (e.g. after long idle)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  // Three-tone ascending chime like Claude Code: C6 → E6 → G6
  const tones = [1046.5, 1318.5, 1568.0];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const onset = now + i * 0.08;
    gain.gain.setValueAtTime(0, onset);
    gain.gain.linearRampToValueAtTime(volume * 0.4, onset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, onset + 0.25);
    osc.start(onset);
    osc.stop(onset + 0.25);
  });
}
