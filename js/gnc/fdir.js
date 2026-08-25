// js/gnc/fdir.js
import * as THREE from 'three';

export class FDIRSystem {
  constructor(seed = 19841208) {
    this.channels = [true, true, true];
    this.seed = seed;

    // ==========================================
    // 預分配物件池 (Zero Allocation)
    // ==========================================
    this._sensorQuats = [
      new THREE.Quaternion(),
      new THREE.Quaternion(),
      new THREE.Quaternion()
    ];
    this._noiseQuat = new THREE.Quaternion();
    this.outQuat = new THREE.Quaternion();
    this._tempQ = new THREE.Quaternion();
    
    this._activeIndices = new Int8Array([-1, -1, -1]);
    this.divergenceThreshold = 0.08; // 容許的最大角偏差 (~4.5度)
  }

  // 確定性偽隨機生成器 (Mulberry32)
  nextRandom() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // 計算兩個四元數之間的角距離 (Radian)
  _angularDistance(q1, q2) {
    let dot = q1.dot(q2);
    dot = Math.abs(dot); // 消除雙重覆蓋符號影響
    if (dot > 1.0) dot = 1.0;
    return 2.0 * Math.acos(dot);
  }

  // 確保 q2 與 q1 處於同一個半球，防止 Slerp 沿長弧翻轉
  _ensureSameHemisphere(target, reference) {
    if (target.dot(reference) < 0) {
      target.x = -target.x;
      target.y = -target.y;
      target.z = -target.z;
      target.w = -target.w;
    }
  }

  voteStarSensors(trueQuat) {
    let activeCount = 0;

    // 1. 各感測器獨立白噪聲注入
    for (let i = 0; i < 3; i++) {
      if (!this.channels[i]) {
        // 故障通道產生漂移
        const rx = (this.nextRandom() - 0.5) * 2.0;
        const ry = (this.nextRandom() - 0.5) * 2.0;
        const rz = (this.nextRandom() - 0.5) * 2.0;
        this._sensorQuats[i].set(rx, ry, rz, 1.0).normalize();
      } else {
        // 🚀 優化：三軸獨立不相關高斯白噪聲
        const nx = (this.nextRandom() - 0.5) * 0.002;
        const ny = (this.nextRandom() - 0.5) * 0.002;
        const nz = (this.nextRandom() - 0.5) * 0.002;
        this._noiseQuat.set(nx, ny, nz, 1.0).normalize();
        this._sensorQuats[i].copy(trueQuat).multiply(this._noiseQuat);
        
        this._activeIndices[activeCount++] = i;
      }
    }

    // ==========================================
    // 2. 真正的 TMR 多數決與離群值剔除 (Outlier Detection)
    // ==========================================
    if (activeCount === 3) {
      const q0 = this._sensorQuats[this._activeIndices[0]];
      const q1 = this._sensorQuats[this._activeIndices[1]];
      const q2 = this._sensorQuats[this._activeIndices[2]];

      const d01 = this._angularDistance(q0, q1);
      const d12 = this._angularDistance(q1, q2);
      const d02 = this._angularDistance(q0, q2);

      // 剔除偏離最大的通道，選取一致性最高的兩組做融合
      if (d01 <= d12 && d01 <= d02) {
        this._ensureSameHemisphere(q1, q0);
        this.outQuat.copy(q0).slerp(q1, 0.5);
      } else if (d02 <= d01 && d02 <= d12) {
        this._ensureSameHemisphere(q2, q0);
        this.outQuat.copy(q0).slerp(q2, 0.5);
      } else {
        this._ensureSameHemisphere(q2, q1);
        this.outQuat.copy(q1).slerp(q2, 0.5);
      }
      return this.outQuat;
    } 
    
    // 雙通道降級模式
    else if (activeCount === 2) {
      const q0 = this._sensorQuats[this._activeIndices[0]];
      const q1 = this._sensorQuats[this._activeIndices[1]];

      // 檢查雙通道是否存在嚴重發散
      if (this._angularDistance(q0, q1) < this.divergenceThreshold) {
        this._ensureSameHemisphere(q1, q0);
        this.outQuat.copy(q0).slerp(q1, 0.5);
        return this.outQuat;
      }
      // 若兩者分歧過大，採信首個通道
      this.outQuat.copy(q0);
      return this.outQuat;
    } 
    
    // 單通道降級模式
    else if (activeCount === 1) {
      this.outQuat.copy(this._sensorQuats[this._activeIndices[0]]);
      return this.outQuat;
    }

    // 全系統失效
    return null;
  }
}
