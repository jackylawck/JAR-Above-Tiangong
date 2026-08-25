// js/gnc/fdir.js
import * as THREE from 'three';

export class FDIRSystem {
  constructor(seed = 19841208) {
    this.channels = [true, true, true];
    this.seed = seed;
  }

  // 確定性偽隨機生成器 (Mulberry32)，保證 CI/CD 與回歸測試可重現
  nextRandom() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  voteStarSensors(trueQuat) {
    const raw = this.channels.map(healthy => {
      if (!healthy) {
        return new THREE.Quaternion(this.nextRandom(), this.nextRandom(), 0, 1).normalize();
      }
      const n = (this.nextRandom() - 0.5) * 0.002;
      return trueQuat.clone().multiply(new THREE.Quaternion(n, n, n, 1).normalize());
    });

    const active = raw.filter((_, i) => this.channels[i]);
    if (active.length >= 2) return active[0].clone().slerp(active[1], 0.5);
    return active[0] || null;
  }
}
