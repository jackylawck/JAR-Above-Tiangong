// js/gnc/mekf.js
import * as THREE from 'three';

export class FullStateMEKF {
  constructor(orbitAlt = 400000) {
    const GM = 3.986004418e14;
    const a = 6371000 + orbitAlt;
    this.n = Math.sqrt(GM / Math.pow(a, 3)); // 軌道平均角速度 (~0.00113 rad/s)

    this.qNominal = new THREE.Quaternion(0, 0, 0, 1);
    this.gyroBias = new THREE.Vector3(0.0005, -0.0008, 0.0002);
    this.posNominal = new THREE.Vector3(0, 0, 35.0);
    this.velNominal = new THREE.Vector3(0, 0, -0.25);

    // 🚀 1. 使用一維連續 Float64Array(81) 儲存 9x9 協方差矩陣 (最佳快取局部性)
    this.P = new Float64Array(81);
    for (let i = 0; i < 9; i++) {
      this.P[i * 9 + i] = i < 3 ? 0.01 : (i < 6 ? 0.001 : 0.05);
    }

    // 雜訊協方差參數 (Process & Measurement Noise)
    this.qRot = 1e-4;
    this.qBias = 1e-6;
    this.qVel = 1e-3;
    this.rStar = 0.002;
    this.rLidar = 0.05;

    // ==========================================
    // 預分配所有數學暫存物件 (Zero Allocation)
    // ==========================================
    this._unbiasedOmega = new THREE.Vector3();
    this._deltaQ = new THREE.Quaternion();
    this._gravityGrad = new THREE.Vector3();
    this._accWorld = new THREE.Vector3();
    
    this._qNominalInv = new THREE.Quaternion();
    this._qErr = new THREE.Quaternion();
    this._deltaTheta = new THREE.Vector3();
    this._corrAngle = new THREE.Vector3();
  }

  predict(dt, rawGyro, rawAccel) {
    // 1. 無偏角速度計算 (Body Frame)
    this._unbiasedOmega.subVectors(rawGyro, this.gyroBias);
    const omegaMag = this._unbiasedOmega.length();
    const angle = omegaMag * dt;

    // 2. 指數映射姿態四元數傳播 (Exponential Map)
    if (angle > 1e-7) {
      const factor = Math.sin(0.5 * angle) / omegaMag;
      this._deltaQ.set(
        this._unbiasedOmega.x * factor, 
        this._unbiasedOmega.y * factor, 
        this._unbiasedOmega.z * factor, 
        Math.cos(0.5 * angle)
      );
    } else {
      this._deltaQ.set(
        0.5 * this._unbiasedOmega.x * dt, 
        0.5 * this._unbiasedOmega.y * dt, 
        0.5 * this._unbiasedOmega.z * dt, 
        1.0
      ).normalize();
    }
    this.qNominal.multiply(this._deltaQ).normalize();

    // 3. 軌道相對運動加速度與重力梯度 (Hill-Clohessy-Wiltshire)
    const n = this.n;
    const nSq = n * n;
    
    // 空間站局部軌道座標系 (LVLH) 的潮汐力與重力梯度
    this._gravityGrad.set(
      3 * nSq * this.posNominal.x,
      -nSq * this.posNominal.y,
      0
    );

    // 機體推力加速度轉入軌道坐標系
    this._accWorld.copy(rawAccel).applyQuaternion(this.qNominal).add(this._gravityGrad);
    
    // 位置與速度數值積分
    this.posNominal.addScaledVector(this.velNominal, dt);
    this.velNominal.addScaledVector(this._accWorld, dt);

    // 4. 協方差矩陣時間外推 (對角線主要元素外推)
    for (let i = 0; i < 3; i++) {
      const attIdx = i * 9 + i;
      const biasIdx = (i + 3) * 9 + (i + 3);
      const velIdx = (i + 6) * 9 + (i + 6);
      
      this.P[attIdx] += (2 * this.P[biasIdx] * dt + this.qRot * dt);
      this.P[biasIdx] += this.qBias * dt;
      this.P[velIdx] += this.qVel * dt;
    }
  }

  update(starQuat, lidarPos, lidarVel, isStarValid, isLidarValid) {
    // ==========================================
    // A. 星敏姿態乘性卡爾曼更新 (MEKF Multiplicative Step)
    // ==========================================
    if (isStarValid && starQuat) {
      this._qNominalInv.copy(this.qNominal).invert();
      this._qErr.multiplyQuaternions(this._qNominalInv, starQuat);
      
      const factor = this._qErr.w >= 0 ? 2.0 : -2.0;
      this._deltaTheta.set(
        factor * this._qErr.x, 
        factor * this._qErr.y, 
        factor * this._qErr.z
      );

      // 1. 計算 3 軸卡爾曼增益並儲存修正量
      for (let i = 0; i < 3; i++) {
        const attIdx = i * 9 + i;
        const biasIdx = (i + 3) * 9 + (i + 3);

        const K_att = this.P[attIdx] / (this.P[attIdx] + this.rStar);
        const K_bias = this.P[biasIdx] / (this.P[attIdx] + this.rStar);

        // 姿態修正角 (Half angle)
        this._corrAngle.setComponent(i, K_att * this._deltaTheta.getComponent(i) * 0.5);

        // 陀螺儀零偏估計在線更新
        this.gyroBias.setComponent(i, this.gyroBias.getComponent(i) + K_bias * this._deltaTheta.getComponent(i));
        
        // 協方差矩陣更新 (Joseph form approximation)
        this.P[attIdx] *= (1.0 - K_att);
      }

      // 🚀 2. 關鍵修復：迴圈外執行單次四元數乘性修正 (避免重複乘 3 次導致發散)
      const halfAngleSq = this._corrAngle.lengthSq();
      if (halfAngleSq > 1e-12) {
        this._deltaQ.set(
          this._corrAngle.x,
          this._corrAngle.y,
          this._corrAngle.z,
          Math.sqrt(Math.max(0, 1.0 - halfAngleSq))
        );
        this.qNominal.multiply(this._deltaQ).normalize();
      }
    }

    // ==========================================
    // B. LiDAR 位置卡爾曼量測更新
    // ==========================================
    if (isLidarValid && lidarPos) {
      for (let i = 0; i < 3; i++) {
        const posIdx = (i + 6) * 9 + (i + 6);
        const K_pos = this.P[posIdx] / (this.P[posIdx] + this.rLidar);
        const errPos = lidarPos.getComponent(i) - this.posNominal.getComponent(i);
        
        this.posNominal.setComponent(i, this.posNominal.getComponent(i) + K_pos * errPos);
        this.P[posIdx] *= (1.0 - K_pos);
      }
    }
  }
}
