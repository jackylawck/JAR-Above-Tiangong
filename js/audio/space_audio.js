// js/audio/space_audio.js
export class SpaceAudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    // 將環境音保留為實例變數，以便動態調整
    this.droneOsc = null;
    this.droneGain = null;
  }

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.startAmbientHum();
    this.initialized = true;
  }

  // 1. 動態深空低頻嗡鳴 (Adaptive Drone)
  startAmbientHum() {
    if (!this.ctx) return;
    this.droneOsc = this.ctx.createOscillator();
    this.droneGain = this.ctx.createGain();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
    this.droneGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    this.droneOsc.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);
    this.droneOsc.start();
  }

  // --- GOTY 核心模組：根據距離動態改變音樂張力 ---
  updateAdaptiveMusic(distance) {
    if (!this.ctx || !this.droneOsc) return;
    // 距離 80m -> 55Hz (平靜), 距離 2m -> 115Hz (極度緊張)
    const freq = Math.max(55, 115 - distance * 0.75);
    // 越近越大聲，製造壓迫感
    const vol = Math.min(0.2, 0.05 + (80 - distance) * 0.002);
    
    // 使用 setTargetAtTime 平滑過渡，避免音爆
    this.droneOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.5);
    this.droneGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
  }

  // --- GOTY 核心模組：對接成功結算音效 (A Major和弦) ---
  playSuccessChime() {
    if (!this.ctx || this.isMuted) return;
    const freqs = [440, 554.37, 659.25]; // A大三和弦，帶來神聖與釋放感
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.1 + i * 0.1); // 琵音延遲效果
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 2.0);
    });
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

  // 4. 衝擊波低通濾波器崩潰 (Filter Collapse) + 次聲波重擊
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
