// js/gnc/mekf.js
import * as THREE from 'three';

export class FullStateMEKF {
  constructor(orbitAlt = 400000) {
    const GM = 3.986004418e14;
    const a = 6371000 + orbitAlt;
    this.n = Math.sqrt(GM / Math.pow(a, 3)); // 軌道平均角速度 (~0.00113 rad/s)

    this.qNominal = new THREE.Quaternion();
    this.gyroBias = new THREE.Vector3(0.001, -0.002, 0.0005);
    this.posNominal = new THREE.Vector3(0, 0, -80);
    this.velNominal = new THREE.Vector3(0, 0, 0.15);

    // 優化：9-DOF 協方差矩陣使用 Float64Array，加速 V8 引擎底層運算
    this.P = Array.from({ length: 9 }, (_, i) => {
      const row = new Float64Array(9);
      row[i] = i < 3 ? 0.01 : 0.001;
      return row;
    });

    this.qRot = 1e-4;
    this.qBias = 1e-6;
    this.qVel = 1e-3;
    this.rStar = 0.002;
    this.rLidar = 0.05;

    // ==========================================
    // 極致優化：預先配置所有暫存數學物件 (Zero Allocation)
    // ==========================================
    this._unbiasedOmega = new THREE.Vector3();
    this._deltaQ = new THREE.Quaternion();
    this._gravityGrad = new THREE.Vector3();
    this._totalAcc = new THREE.Vector3();
    
    this._qNominalInv = new THREE.Quaternion();
    this._qErr = new THREE.Quaternion();
    this._deltaTheta = new THREE.Vector3();
    this._corrEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._corrQuat = new THREE.Quaternion();
  }

  predict(dt, rawGyro, rawAccel) {
    // 1. In-place 計算無偏角速度
    this._unbiasedOmega.subVectors(rawGyro, this.gyroBias);
    const omegaMag = this._unbiasedOmega.length();
    const angle = omegaMag * dt;

    // 2. 軸角指數映射四元數外推 (In-place)
    if (angle > 1e-6) {
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

    // 3. 軌道重力梯度力矩補償 (In-place)
    const nSq = this.n * this.n;
    this._gravityGrad.set(
      3 * nSq * this.posNominal.x,
      -nSq * this.posNominal.y,
      -nSq * this.posNominal.z
    );

    // 避免使用 clone()，直接用 copy()
    this._totalAcc.copy(rawAccel).applyQuaternion(this.qNominal).add(this._gravityGrad);
    
    this.posNominal.addScaledVector(this.velNominal, dt);
    this.velNominal.addScaledVector(this._totalAcc, dt);

    // 4. 協方差時間外推
    for (let i = 0; i < 3; i++) {
      this.P[i][i] += (2 * this.P[i + 3][i] * dt + this.qRot * dt);
      this.P[i + 3][i + 3] += this.qBias * dt;
      this.P[i + 6][i + 6] += this.qVel * dt;
    }
  }

  update(starQuat, lidarPos, lidarVel, isStarValid, isLidarValid) {
    // A. 星敏姿態卡爾曼增益更新 (In-place)
    if (isStarValid && starQuat) {
      // 取代 this.qNominal.clone().invert()
      this._qNominalInv.copy(this.qNominal).invert();
      this._qErr.multiplyQuaternions(this._qNominalInv, starQuat);
      
      const factor = this._qErr.w >= 0 ? 2 : -2;
      this._deltaTheta.set(factor * this._qErr.x, factor * this._qErr.y, factor * this._qErr.z);

      for (let i = 0; i < 3; i++) {
        const K_att = this.P[i][i] / (this.P[i][i] + this.rStar);
        const K_bias = this.P[i + 3][i] / (this.P[i][i] + this.rStar);

        // In-place 尤拉角與四元數更新
        this._corrEuler.set(
          (i === 0 ? 1 : 0) * K_att * this._deltaTheta.x * 0.5,
          (i === 1 ? 1 : 0) * K_att * this._deltaTheta.y * 0.5,
          (i === 2 ? 1 : 0) * K_att * this._deltaTheta.z * 0.5,
          'YXZ'
        );
        
        this._corrQuat.setFromEuler(this._corrEuler);
        this.qNominal.multiply(this._corrQuat).normalize();

        // 零偏估計與協方差更新
        this.gyroBias.setComponent(i, this.gyroBias.getComponent(i) + K_bias * this._deltaTheta.getComponent(i));
        this.P[i][i] *= (1.0 - K_att);
      }
    }

    // B. LiDAR 位置與速度動態增益更新
    if (isLidarValid && lidarPos) {
      for (let i = 0; i < 3; i++) {
        const K_pos = this.P[i + 6][i + 6] / (this.P[i + 6][i + 6] + this.rLidar);
        const errPos = lidarPos.getComponent(i) - this.posNominal.getComponent(i);
        this.posNominal.setComponent(i, this.posNominal.getComponent(i) + K_pos * errPos);
        this.P[i + 6][i + 6] *= (1.0 - K_pos);
      }
    }
  }
}
