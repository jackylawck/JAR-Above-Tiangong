// js/gnc/fdir.js
import * as THREE from 'three';

export class FDIRSystem {
  constructor(seed = 19841208) {
    this.channels = [true, true, true];
    this.seed = seed;

    // ==========================================
    // 極致優化：預先分配記憶體 (Zero Allocation)
    // ==========================================
    this._sensorQuats = [
      new THREE.Quaternion(),
      new THREE.Quaternion(),
      new THREE.Quaternion()
    ];
    this._noiseQuat = new THREE.Quaternion();
    this.outQuat = new THREE.Quaternion();
    
    // 用靜態陣列取代 .filter()，避免每幀產生新 Array
    this._activeIndices = new Int8Array([-1, -1, -1]); 
  }

  // 確定性偽隨機生成器 (Mulberry32)，保證 CI/CD 與回歸測試可重現
  nextRandom() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  voteStarSensors(trueQuat) {
    let activeCount = 0;

    // 捨棄 .map() 與 .filter()，改用原生 for 迴圈與 In-place 更新
    for (let i = 0; i < 3; i++) {
      if (!this.channels[i]) {
        // 故障星敏：產生漂移噪聲 (In-place)
        this._sensorQuats[i].set(this.nextRandom(), this.nextRandom(), 0, 1).normalize();
      } else {
        // 正常星敏：注入高斯白噪聲近似 (In-place)
        const n = (this.nextRandom() - 0.5) * 0.002;
        this._noiseQuat.set(n, n, n, 1).normalize();
        this._sensorQuats[i].copy(trueQuat).multiply(this._noiseQuat);
        
        // 記錄健康的通道索引，取代 .filter()
        this._activeIndices[activeCount++] = i;
      }
    }

    // TMR 三餘度表決邏輯
    if (activeCount >= 2) {
      const idx0 = this._activeIndices[0];
      const idx1 = this._activeIndices[1];
      // 融合前兩個健康數據
      this.outQuat.copy(this._sensorQuats[idx0]).slerp(this._sensorQuats[idx1], 0.5);
      return this.outQuat;
    } else if (activeCount === 1) {
      // 降級模式：單餘度
      this.outQuat.copy(this._sensorQuats[this._activeIndices[0]]);
      return this.outQuat;
    }

    // 全系統失效
    return null;
  }
}
