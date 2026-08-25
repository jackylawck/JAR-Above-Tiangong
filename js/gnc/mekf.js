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

    // 9-DOF 協方差矩陣: [delta_theta(3), delta_bias(3), delta_vel(3)]
    this.P = Array.from({ length: 9 }, (_, i) => 
      Array.from({ length: 9 }, (_, j) => (i === j ? (i < 3 ? 0.01 : 0.001) : 0))
    );

    // 過程噪聲 (Q) 與測量噪聲 (R)
    this.qRot = 1e-4;
    this.qBias = 1e-6;
    this.qVel = 1e-3;
    this.rStar = 0.002; // 星敏角噪聲方差
    this.rLidar = 0.05; // LiDAR 測距方差
  }

  predict(dt, rawGyro, rawAccel) {
    const unbiasedOmega = new THREE.Vector3().subVectors(rawGyro, this.gyroBias);
    const omegaMag = unbiasedOmega.length();
    const angle = omegaMag * dt;

    // 軸角指數映射四元數外推
    let deltaQ = new THREE.Quaternion();
    if (angle > 1e-6) {
      const factor = Math.sin(0.5 * angle) / omegaMag;
      deltaQ.set(unbiasedOmega.x * factor, unbiasedOmega.y * factor, unbiasedOmega.z * factor, Math.cos(0.5 * angle));
    } else {
      deltaQ.set(0.5 * unbiasedOmega.x * dt, 0.5 * unbiasedOmega.y * dt, 0.5 * unbiasedOmega.z * dt, 1.0).normalize();
    }
    this.qNominal.multiply(deltaQ).normalize();

    // 軌道重力梯度力矩補償
    const gravityGrad = new THREE.Vector3(
      3 * this.n * this.n * this.posNominal.x,
      -this.n * this.n * this.posNominal.y,
      -this.n * this.n * this.posNominal.z
    );

    const totalAcc = rawAccel.clone().applyQuaternion(this.qNominal).add(gravityGrad);
    this.posNominal.addScaledVector(this.velNominal, dt);
    this.velNominal.addScaledVector(totalAcc, dt);

    // 協方差時間外推 P = Phi * P * Phi^T + Q
    for (let i = 0; i < 3; i++) {
      this.P[i][i] += (2 * this.P[i + 3][i] * dt + this.qRot * dt);
      this.P[i + 3][i + 3] += this.qBias * dt;
      this.P[i + 6][i + 6] += this.qVel * dt;
    }
  }

  update(starQuat, lidarPos, lidarVel, isStarValid, isLidarValid) {
    // A. 星敏姿態卡爾曼增益更新 (測量無效時自動增益歸零，不發散)
    if (isStarValid && starQuat) {
      const qErr = new THREE.Quaternion().multiplyQuaternions(this.qNominal.clone().invert(), starQuat);
      const factor = qErr.w >= 0 ? 2 : -2;
      const deltaTheta = new THREE.Vector3(factor * qErr.x, factor * qErr.y, factor * qErr.z);

      for (let i = 0; i < 3; i++) {
        // 正規動態卡爾曼增益 K = P / (P + R)
        const K_att = this.P[i][i] / (this.P[i][i] + this.rStar);
        const K_bias = this.P[i + 3][i] / (this.P[i][i] + this.rStar);

        const corrEuler = new THREE.Euler(
          (i === 0 ? 1 : 0) * K_att * deltaTheta.x * 0.5,
          (i === 1 ? 1 : 0) * K_att * deltaTheta.y * 0.5,
          (i === 2 ? 1 : 0) * K_att * deltaTheta.z * 0.5,
          'YXZ'
        );
        this.qNominal.multiply(new THREE.Quaternion().setFromEuler(corrEuler)).normalize();

        // 零偏估計與協方差更新
        this.gyroBias.setComponent(i, this.gyroBias.getComponent(i) + K_bias * deltaTheta.getComponent(i));
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
