// js/audio/space_audio.js
export class SpaceAudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneGain = null;
    this.droneGain2 = null;
    this.masterGain = null;
    this.lastRcsTime = 0;
  }

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    
    // 主音量總控 (Master Gain)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.startAmbientHum();
    this.initialized = true;
  }

  // --- 1. 雙層失諧立體聲機械無人機 (艙內機械低鳴) ---
  startAmbientHum() {
    if (!this.ctx) return;

    // 左聲道 (55Hz 鋸齒波機械底噪)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneGain = this.ctx.createGain();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);
    this.droneGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    // 右聲道 (57Hz 微失諧，製造深空空間感)
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneGain2 = this.ctx.createGain();
    this.droneOsc2.type = 'sawtooth';
    this.droneOsc2.frequency.setValueAtTime(57, this.ctx.currentTime);
    this.droneGain2.gain.setValueAtTime(0.035, this.ctx.currentTime);

    // 立體聲聲像平移 (Stereo Panning)
    if (this.ctx.createStereoPanner) {
      const pannerL = this.ctx.createStereoPanner();
      pannerL.pan.value = -0.8;
      const pannerR = this.ctx.createStereoPanner();
      pannerR.pan.value = 0.8;

      this.droneOsc1.connect(this.droneGain);
      this.droneGain.connect(pannerL);
      pannerL.connect(this.masterGain);

      this.droneOsc2.connect(this.droneGain2);
      this.droneGain2.connect(pannerR);
      pannerR.connect(this.masterGain);
    } else {
      this.droneOsc1.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
      this.droneOsc2.connect(this.droneGain2);
      this.droneGain2.connect(this.masterGain);
    }

    this.droneOsc1.start();
    this.droneOsc2.start();

    // 次聲波低頻結構共振脈動
    this.startSubPulse();
  }

  // --- 2. 次聲波低頻脈動 (18Hz Subsonic Pulse) ---
  startSubPulse() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 18; // 18Hz 艙體結構震盪
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    
    // 1.25Hz LFO 振幅顫動
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 1.25;
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    lfo.start();
  }

  // --- 3. 電影級距離張力 (隨進近自動提升低頻壓迫感) ---
  updateAdaptiveMusic(distance) {
    if (!this.ctx || !this.droneOsc1) return;
    
    const freq = Math.max(55, 130 - distance * 0.94);
    const vol = Math.min(0.15, 0.04 + (80 - distance) * 0.002);

    this.droneOsc1.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3);
    this.droneOsc2.frequency.setTargetAtTime(freq + 2, this.ctx.currentTime, 0.3);
    this.droneGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.3);
    this.droneGain2.gain.setTargetAtTime(vol * 0.9, this.ctx.currentTime, 0.3);

    // 距離小於 15 米時激發低頻重壓
    if (distance < 15) {
      const boost = 1 + (15 - distance) / 15 * 0.5;
      this.masterGain.gain.setTargetAtTime(0.8 * boost, this.ctx.currentTime, 0.2);
    } else {
      this.masterGain.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.2);
    }
  }

  // --- 4. 高品質立體聲 RCS 噴射聲 (帶音頭啁啾與成形氣流) ---
  playRCSBurst(power = 0.5, pan = 0) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastRcsTime < 0.08) return; // 節流避免重疊爆音
    this.lastRcsTime = now;

    const duration = 0.05 + power * 0.12;

    // 4.1 高頻啁啾 (高壓噴閥瞬間釋放)
    const osc = this.ctx.createOscillator();
    const gainOsc = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4000, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + duration);
    gainOsc.gain.setValueAtTime(0.04 * power, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gainOsc);

    // 4.2 帶通成形氣流噪聲
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200 + power * 800;
    filter.Q.value = 1.5;
    const gainNoise = this.ctx.createGain();
    gainNoise.gain.setValueAtTime(0.07 * power, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    noise.connect(filter);
    filter.connect(gainNoise);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gainOsc.connect(panner);
      gainNoise.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gainOsc.connect(this.masterGain);
      gainNoise.connect(this.masterGain);
    }

    osc.start(now);
    osc.stop(now + duration);
    noise.start(now);
    noise.stop(now + duration);
  }

  // --- 5. 對接成功「機械金屬卡扣」+ 和弦釋放 ---
  playSuccessChime() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 5.1 機械撞擊咔嗒聲 (Metal Catch Clunk)
    const clickBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
    const clickData = clickBuffer.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) {
      clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
    }
    const click = this.ctx.createBufferSource();
    click.buffer = clickBuffer;
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    click.connect(clickGain);
    clickGain.connect(this.masterGain);
    click.start(now);

    // 5.2 A Major 和弦延遲釋放 (勝利交響)
    setTimeout(() => {
      if (!this.ctx) return;
      const freqs = [440, 554.37, 659.25, 880];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        const startTime = this.ctx.currentTime + i * 0.06;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.08, startTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(startTime);
        osc.stop(startTime + 2.2);
      });
    }, 120);
  }

  // --- 6. 電影級爆炸 (三層立體堆疊：低音重擊 + 金屬撕裂 + 碎片噼啪) ---
  playExplosion() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 層 1：耳膜壓迫低音 (50Hz -> 18Hz)
    const oscLow = this.ctx.createOscillator();
    const gainLow = this.ctx.createGain();
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(55, now);
    oscLow.frequency.exponentialRampToValueAtTime(18, now + 1.2);
    gainLow.gain.setValueAtTime(0.7, now);
    gainLow.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    oscLow.connect(gainLow);
    gainLow.connect(this.masterGain);
    oscLow.start(now);
    oscLow.stop(now + 1.2);

    // 層 2：金屬撕裂爆破聲 (Bandpass Noise)
    const noiseDur = 0.9;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * noiseDur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.35));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + noiseDur);
    filter.Q.value = 1.3;
    const gainNoise = this.ctx.createGain();
    gainNoise.gain.setValueAtTime(0.45, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
    noise.connect(filter);
    filter.connect(gainNoise);
    gainNoise.connect(this.masterGain);
    noise.start(now);

    // 層 3：立體聲碎片撞擊高頻噼啪聲 (Debris Crackles)
    for (let i = 0; i < 6; i++) {
      const delay = 0.04 + i * 0.07 + Math.random() * 0.08;
      const dur = 0.02 + Math.random() * 0.03;
      const buf2 = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const d2 = buf2.getChannelData(0);
      for (let j = 0; j < d2.length; j++) {
        d2[j] = (Math.random() * 2 - 1) * Math.exp(-j / (this.ctx.sampleRate * 0.004));
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18 * (1 - i / 6), now + delay);
      
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = (Math.random() - 0.5) * 0.85;
        src.connect(g);
        g.connect(panner);
        panner.connect(this.masterGain);
      } else {
        src.connect(g);
        g.connect(this.masterGain);
      }
      src.start(now + delay);
    }
  }

  // --- 7. 無線電提示音 (Radio Beep - 完整保留) ---
  playRadioBeep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1800, now + 0.03);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // --- 8. 通訊背景雜音 (Burst Noise - 完整保留) ---
  playBurstNoise(duration = 0.15) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + duration);
  }

  // --- 9. 靜音控制 ---
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime, 0.1);
    }
    return this.isMuted;
  }
}
