// Generative ambience. Everything is synthesised with Web Audio, so there are
// no files to download: wind that rises with travel speed, a soft drone, a
// bell for each project, and small interface sounds.

const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

function pinkNoise(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

export class Ambience {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.lastTick = 0;
    this.lastSpeed = -1;
  }

  async enable() {
    if (!this.ctx) this.#build();
    this.enabled = true;
    clearTimeout(this.suspendTimer);
    if (this.ctx.state !== 'running') await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.9, now, 0.6);
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.15);
    clearTimeout(this.suspendTimer);
    this.suspendTimer = setTimeout(() => !this.enabled && this.ctx.suspend(), 800);
  }

  // Silence while the tab is hidden, without changing the user's choice.
  setHidden(hidden) {
    if (!this.ctx || !this.enabled) return;
    if (hidden) this.ctx.suspend();
    else this.ctx.resume();
  }

  #build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 4;
    this.master.connect(limiter).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet).connect(this.master);

    // Wind: looping pink noise through a slowly wandering band-pass, in gusts.
    this.noise = pinkNoise(ctx, 6);
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.#lfo(0.06, 180, this.windFilter.frequency);
    this.#lfo(0.11, 0.022, this.windGain.gain);
    wind.start();

    // Drone: a quiet open fifth that breathes.
    const pad = ctx.createGain();
    pad.gain.value = 0.016;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 650;
    pad.connect(padFilter);
    padFilter.connect(this.master);
    padFilter.connect(this.reverb);
    for (const [freq, detune] of [[110, -5], [164.81, 4], [220, 7]]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(pad);
      osc.start();
    }
    this.#lfo(0.05, 0.007, pad.gain);
  }

  #lfo(rate, depth, param) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = rate;
    gain.gain.value = depth;
    osc.connect(gain).connect(param);
    osc.start();
  }

  setSpeed(speed) {
    if (!this.enabled || !this.ctx) return;
    const s = Math.min(1, speed * 4);
    if (Math.abs(s - this.lastSpeed) < 0.02) return;
    this.lastSpeed = s;
    const now = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.05 + s * 0.13, now, 0.35);
    this.windFilter.frequency.setTargetAtTime(420 + s * 900, now, 0.35);
  }

  chime(index) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const base = BELLS[index % BELLS.length];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(0.08, now + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    out.connect(this.master);
    out.connect(this.reverb);
    for (const [ratio, amp] of [[1, 1], [2.01, 0.32], [3.97, 0.1], [0.5, 0.2]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = base * ratio;
      gain.gain.value = amp;
      osc.connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + 3.5);
    }
  }

  tick() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTick < 0.06) return;
    this.lastTick = now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
    gain.gain.setValueAtTime(0.012, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  whoosh(opening = true) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(opening ? 280 : 1900, now);
    filter.frequency.exponentialRampToValueAtTime(opening ? 1900 : 280, now + 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    src.connect(filter).connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverb);
    src.start(now, Math.random() * 4);
    src.stop(now + 0.9);
  }
}
