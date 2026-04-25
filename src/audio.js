// Tiny synthesized-audio system. All SFX are generated with Web Audio primitives
// so the repo ships zero audio assets.

export class Audio {
  constructor() {
    this.ctx = null;
    this._initOnGesture = () => {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    };
    // Wait for a user gesture; browsers block audio otherwise.
    window.addEventListener('click', this._initOnGesture, { once: true });
    window.addEventListener('keydown', this._initOnGesture, { once: true });
  }

  _noise(duration, filterHz = 1500, gainCurve = [1, 0]) {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainCurve[0], this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainCurve[1]), this.ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  _tone(freq, duration, type = 'sine', startGain = 0.6) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(startGain, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  gunshot(kind = 'pistol', suppressed = false) {
    if (!this.ctx) return;
    const dur = kind === 'shotgun' ? 0.28 : kind === 'rifle' ? 0.18 : 0.14;
    const filter = suppressed ? 700 : 2800;
    const gain = suppressed ? 0.3 : 0.9;
    this._noise(dur, filter, [gain, 0.002]);
    if (!suppressed) this._tone(kind === 'shotgun' ? 80 : 120, 0.1, 'square', 0.25);
  }

  reload() {
    this._tone(900, 0.03, 'square', 0.2);
    setTimeout(() => this._tone(700, 0.04, 'square', 0.15), 140);
    setTimeout(() => this._tone(1100, 0.02, 'square', 0.12), 260);
  }

  roar() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.7);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.7);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.7);
  }

  step() {
    this._noise(0.06, 600, [0.12, 0.0001]);
  }

  pickup() {
    this._tone(800, 0.1, 'triangle', 0.25);
    setTimeout(() => this._tone(1200, 0.12, 'triangle', 0.22), 60);
  }

  hurt() {
    this._noise(0.2, 400, [0.4, 0.001]);
  }

  empty() {
    this._tone(1400, 0.04, 'square', 0.1);
  }
}
