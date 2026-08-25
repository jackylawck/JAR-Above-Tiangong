// js/physics/spacecraft_core.js
import * as THREE from 'three';

export class SpacecraftEngine {
  constructor() {
    this.GM = 3.986e14;
    this.n = Math.sqrt(this.GM / Math.pow(6371000 + 400000, 3));
    this.state = [0, -80, 0, 0, 0.15, 0];
    this.qActual = new THREE.Quaternion();
    this.omega = new THREE.Vector3();
    this.fuel = 300.0;
    this.massDry = 3000.0;
    this.thrustMultiplier = 1.0;
    this.maxOmega = 1.2; // 姿態角速率限幅 (1.2 rad/s)
    this.maxSingleNozzleThrust = 50.0; // N
  }

  step(dt, thrustCmd, torqueCmd) {
    const totalMass = this.massDry + this.fuel;

    // --- 缺陷 4 修復：指令推力向量限幅（歸一化防護）---
    const clampedThrust = thrustCmd.clone();
    if (clampedThrust.length() > 1.0) {
      clampedThrust.normalize();
    }
    const actualThrustMag = clampedThrust.length() * this.maxSingleNozzleThrust * this.thrustMultiplier;

    // 齊奧爾科夫斯基質量動態消耗 (Isp = 300s)
    if (actualThrustMag > 0.01 && this.fuel > 0) {
      const mDot = actualThrustMag / (300.0 * 9.80665);
      this.fuel = Math.max(0, this.fuel - mDot * dt);
    }

    // --- 姿態動力學更新 ---
    this.omega.addScaledVector(torqueCmd.clone().multiplyScalar(this.thrustMultiplier), dt);
    this.omega.multiplyScalar(0.96); // 阻尼
    if (this.omega.length() > this.maxOmega) {
      this.omega.normalize().multiplyScalar(this.maxOmega);
    }

    // --- 缺陷 3 修復：徹底採用軸角指數映射（Exponential Map）積分四元數 ---
    const omegaMag = this.omega.length();
    const rotAngle = omegaMag * dt;
    const deltaQ = new THREE.Quaternion();

    if (rotAngle > 1e-6) {
      const axis = this.omega.clone().normalize();
      deltaQ.setFromAxisAngle(axis, rotAngle);
    } else {
      deltaQ.set(0.5 * this.omega.x * dt, 0.5 * this.omega.y * dt, 0.5 * this.omega.z * dt, 1.0).normalize();
    }
    this.qActual.multiply(deltaQ).normalize();

    // --- 軌道動力學 (CW 解析解步進) ---
    const [x0, y0, z0, vx0, vy0, vz0] = this.state;
    const orbitThrust = clampedThrust.applyQuaternion(this.qActual).multiplyScalar(actualThrustMag / totalMass);

    const nt = this.n * dt;
    const s = Math.sin(nt), c = Math.cos(nt);
    const x = (4 - 3*c)*x0 + (s/this.n)*vx0 + (2/this.n)*(1-c)*vy0;
    const y = 6*(s - nt)*x0 + y0 - (2/this.n)*(1-c)*vx0 + ((4*s - 3*nt)/this.n)*vy0;
    const z = z0*c + (vz0/this.n)*s;

    const vx = 3*this.n*s*x0 + c*vx0 + 2*s*vy0 + orbitThrust.x * dt;
    const vy = 6*this.n*(c - 1)*x0 - 2*s*vx0 + (4*c - 3)*vy0 + orbitThrust.y * dt;
    const vz = -z0*this.n*s + vz0*c + orbitThrust.z * dt;

    this.state = [x, y, z, vx, vy, vz];

    return {
      pos: new THREE.Vector3(x, z, y),
      vel: new THREE.Vector3(vx, vz, vy),
      quat: this.qActual,
      fuel: this.fuel,
      mass: totalMass,
      accBody: orbitThrust
    };
  }
}
