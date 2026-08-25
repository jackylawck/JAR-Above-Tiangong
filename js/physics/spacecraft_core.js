// js/physics/spacecraft_core.js
import * as THREE from 'three';

export class SpacecraftEngine {
  constructor() {
    this.massDry = 3000.0;
    this.fuel = 300.0;
    this.thrustMultiplier = 6.0; // 預設兒童模式 6 倍推力
    this.Isp = 220.0;
    this.g0 = 9.80665;
    this.meanMotion = 0.00113; // 400km 軌道角速度 n

    // 🚀 關鍵修復：底層直接預設 35 米開局 (Y = -35.0)
    this.state = new Float64Array([0, -35.0, 0, 0, 0.35, 0]);
    this.omega = new THREE.Vector3(0, 0, 0);
    this.quat = new THREE.Quaternion();
    this.moi = new THREE.Vector3(2500, 2500, 1800);
    this.accBody = new THREE.Vector3();
  }

  step(dt, thrustCmd, torqueCmd) {
    const totalMass = this.massDry + this.fuel;
    
    // 平移推力換算
    const appliedThrust = thrustCmd.clone().multiplyScalar(this.thrustMultiplier * 200.0);
    const thrustMag = appliedThrust.length();
    
    // 燃料消耗計算
    if (thrustMag > 0 && this.fuel > 0) {
      const mDot = thrustMag / (this.Isp * this.g0);
      this.fuel = Math.max(0, this.fuel - mDot * dt);
    }

    // 機體加速度
    this.accBody.copy(appliedThrust).divideScalar(totalMass);

    // CW 軌道動力學方程步進
    const n = this.meanMotion;
    const x = this.state[0], y = this.state[1], z = this.state[2];
    const vx = this.state[3], vy = this.state[4], vz = this.state[5];

    // 機體坐標系推力旋轉至軌道坐標系
    const thrustWorld = appliedThrust.clone().applyQuaternion(this.quat);
    const ax = thrustWorld.x / totalMass;
    const ay = thrustWorld.y / totalMass;
    const az = thrustWorld.z / totalMass;

    // CW 微分方程
    const xDotDot = 2 * n * vy + 3 * n * n * x + ax;
    const yDotDot = -2 * n * vx + ay;
    const zDotDot = -n * n * z + az;

    // 數值積分
    this.state[3] += xDotDot * dt;
    this.state[4] += yDotDot * dt;
    this.state[5] += zDotDot * dt;

    this.state[0] += this.state[3] * dt;
    this.state[1] += this.state[4] * dt;
    this.state[2] += this.state[5] * dt;

    // 姿態角速度與四元數步進
    const appliedTorque = torqueCmd.clone().multiplyScalar(this.thrustMultiplier * 80.0);
    this.omega.x += (appliedTorque.x / this.moi.x) * dt;
    this.omega.y += (appliedTorque.y / this.moi.y) * dt;
    this.omega.z += (appliedTorque.z / this.moi.z) * dt;
    this.omega.multiplyScalar(0.96); // 微重力阻尼

    const deltaQ = new THREE.Quaternion(
      this.omega.x * dt * 0.5,
      this.omega.y * dt * 0.5,
      this.omega.z * dt * 0.5,
      1.0
    ).normalize();
    this.quat.multiply(deltaQ).normalize();

    return {
      pos: new THREE.Vector3(this.state[0], this.state[1], this.state[2]),
      vel: new THREE.Vector3(this.state[3], this.state[4], this.state[5]),
      quat: this.quat,
      accBody: this.accBody,
      fuel: this.fuel
    };
  }
}
