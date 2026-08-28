/** Procedural intelligence-console SFX. Armed only from a user gesture. */

export type IntelAudio = {
  unlock: () => Promise<void>;
  drone: (on: boolean) => void;
  ping: () => void;
  tick: () => void;
  sweep: () => void;
  confirm: () => void;
  stop: () => void;
  setMuted: (m: boolean) => void;
};

export function createIntelAudio(): IntelAudio {
  let ctx: AudioContext | null = null;
  let muted = false;
  let master: GainNode | null = null;
  let droneOsc: OscillatorNode | null = null;
  let droneGain: GainNode | null = null;
  let droneLfo: OscillatorNode | null = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.28;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function kick() {
    const c = ensure();
    if (!master) return c;
    try {
      const buf = c.createBuffer(1, 1, c.sampleRate);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.start(0);
    } catch {
      /* ignore */
    }
    if (c.state === "suspended") void c.resume();
    return c;
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0) {
    const c = kick();
    if (!master || muted) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur: number, gain: number, hp: number) {
    const c = kick();
    if (!master || muted) return;
    const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = n;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    async unlock() {
      kick();
    },
    drone(on) {
      const c = kick();
      if (!master) return;
      if (on) {
        if (droneOsc) return;
        droneOsc = c.createOscillator();
        droneGain = c.createGain();
        droneLfo = c.createOscillator();
        const lfoGain = c.createGain();
        droneOsc.type = "sine";
        droneOsc.frequency.value = 46;
        droneGain.gain.value = muted ? 0 : 0.08;
        droneLfo.type = "sine";
        droneLfo.frequency.value = 0.18;
        lfoGain.gain.value = 4;
        droneLfo.connect(lfoGain);
        lfoGain.connect(droneOsc.frequency);
        droneOsc.connect(droneGain);
        droneGain.connect(master);
        droneOsc.start();
        droneLfo.start();
      } else if (droneOsc) {
        try {
          droneOsc.stop();
          droneLfo?.stop();
        } catch {
          /* already stopped */
        }
        droneOsc = null;
        droneLfo = null;
        droneGain = null;
      }
    },
    ping() {
      tone(920, 0.35, "sine", 0.22);
      tone(1840, 0.18, "sine", 0.08, 0.02);
    },
    tick() {
      noiseBurst(0.05, 0.14, 1800);
      tone(1400, 0.06, "square", 0.05);
    },
    sweep() {
      const c = kick();
      if (!master || muted) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sawtooth";
      const t0 = c.currentTime;
      o.frequency.setValueAtTime(180, t0);
      o.frequency.exponentialRampToValueAtTime(1400, t0 + 0.55);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.65);
      noiseBurst(0.3, 0.07, 600);
    },
    confirm() {
      tone(523.25, 0.22, "triangle", 0.2);
      tone(783.99, 0.38, "triangle", 0.22, 0.12);
      tone(1046.5, 0.5, "sine", 0.12, 0.22);
    },
    stop() {
      this.drone(false);
      if (ctx && ctx.state !== "closed") void ctx.suspend();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.28;
      if (droneGain) droneGain.gain.value = m ? 0 : 0.08;
    },
  };
}
