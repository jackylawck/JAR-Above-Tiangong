// js/audio/space_audio.js
export class SpaceAudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.startAmbientHum();
    this.initialized = true;
  }

  // 1. 深空低頻引擎與生命維持系統共振 (55Hz Sub-Bass Hum)
  startAmbientHum() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
  }

  // 2. 經典航太 Quindar Beep + 無線電通話底噪
  playRadioBeep() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2525, this.ctx.currentTime); // 2525Hz
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);

    this.playBurstNoise(0.12);
  }

  playBurstNoise(duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  // 3. RCS 噴氣音效
  playRCSBurst() {
    if (!this.ctx || this.isMuted) return;
    this.playBurstNoise(0.06);
  }

  // 4. 升級版：衝擊波低通濾波器崩潰 (Filter Collapse) + 次聲波重擊
  playExplosion() {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;

    // 耳膜震聾/麥克風振膜崩潰濾波器
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(20000, now);
    lowpass.frequency.exponentialRampToValueAtTime(150, now + 0.05); // 瞬間被震聾
    lowpass.frequency.exponentialRampToValueAtTime(20000, now + 1.2); // 1.2秒內逐漸恢復

    // 次聲波重低音
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.9);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    osc.connect(gain);
    gain.connect(lowpass);
    lowpass.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);

    // 金屬破裂雜訊
    this.playBurstNoise(0.7);
  }
}
