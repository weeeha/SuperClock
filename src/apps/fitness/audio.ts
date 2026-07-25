// Beeps are synthesised so there are no tone assets to ship; exercise names
// are pre-recorded clips (see scripts/gen-voice.sh) because Pi TTS quality
// is unreliable.
//
// The kiosk already launches Chromium with
// --autoplay-policy=no-user-gesture-required, so nothing needs unlocking.

import type { Cue } from './circuit';

/** Derived from Cue rather than restated so a new beep tone in the reducer
 *  can't silently fall through TONE_HZ/TONE_MS's `?? default` here. */
type BeepTone = Extract<Cue, { kind: 'beep' }>['tone'];

const TONE_HZ: Record<BeepTone, number> = {
  tick: 660,
  work: 880,
  rest: 440,
  finish: 1320,
};

const TONE_MS: Record<BeepTone, number> = {
  tick: 90,
  work: 180,
  rest: 180,
  finish: 420,
};

export class WorkoutAudio {
  private ctx: AudioContext | null = null;
  private clips = new Map<string, HTMLAudioElement>();
  private readonly opts: { beeps: boolean; voice: boolean };

  constructor(opts: { beeps: boolean; voice: boolean }) {
    this.opts = opts;
  }

  /** Fetch every clip up front — a name announced 200ms late is worse than
   *  silence, so nothing may be loaded at the phase boundary. */
  preload(exerciseIds: string[]): void {
    if (!this.opts.voice) return;
    for (const id of exerciseIds) {
      if (this.clips.has(id)) continue;
      const el = new Audio(`/fitness/voice/${id}.m4a`);
      el.preload = 'auto';
      el.load();
      this.clips.set(id, el);
    }
  }

  play(cue: Cue): void {
    if (cue.kind === 'beep') this.beep(cue.tone);
    else this.speak(cue.id);
  }

  private beep(tone: BeepTone): void {
    if (!this.opts.beeps) return;
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = TONE_HZ[tone];
    const seconds = TONE_MS[tone] / 1000;
    // Ramp rather than a hard stop; a square cut-off clicks audibly.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.02);
  }

  private speak(id: string): void {
    if (!this.opts.voice) return;
    const el = this.clips.get(id);
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {
      // Autoplay refusal or a missing clip must not break the circuit.
    });
  }

  private context(): AudioContext | null {
    if (this.ctx === null) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  // Browsers do not stop an HTMLAudioElement just because the JS reference
  // to it is dropped — an in-flight voice clip would keep announcing over
  // whatever app the user swiped to next. Pause every clip before clearing.
  //
  // this.ctx is nulled out immediately (not after close() resolves), so a
  // beep() right after dispose() lazily builds a fresh AudioContext rather
  // than reusing a closing one. That's safe rather than a leak: each
  // instance holds at most one AudioContext at a time (context() only
  // constructs when this.ctx is null), close() is invoked synchronously
  // here so the browser starts releasing the audio device immediately, and
  // dispose()/construct cycles from swiping apps happen on human timescales
  // — nowhere near fast enough to stack up toward Chromium's ~6-context cap
  // even over a kiosk session that runs for weeks.
  dispose(): void {
    for (const el of this.clips.values()) el.pause();
    void this.ctx?.close();
    this.ctx = null;
    this.clips.clear();
  }
}
