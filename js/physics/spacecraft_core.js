// js/physics/spacecraft_core.js
import * as THREE from 'three';

export class SpacecraftEngine {
  constructor() {
    this.massDry = 3000.0;
    this.fuel = 300.0;
    this.thrustMultiplier = 2.0;
    this.Isp = 220.0;
    this.g0 = 9.80665;
    this.meanMotion = 0.00113;

    // 🚀 標準視線座標：飛船在 Z = 35 米處，朝向 -Z 軸進近
    this.state = new Float64Array([0, 0, 35.0, 0, 0, -0.25]);
    this.omega = new THREE.Vector3(0, 0, 0);
    this.quat = new THREE.Quaternion();
    this.moi = new THREE.Vector3(2500, 2500, 1800);
    this.accBody = new THREE.Vector3();
  }

  step(dt, thrustCmd, torqueCmd) {
    const totalMass = this.massDry + this.fuel;
    
    const appliedThrust = thrustCmd.clone().multiplyScalar(this.thrustMultiplier * 200.0);
    const thrustMag = appliedThrust.length();
    
    if (thrustMag > 0 && this.fuel > 0) {
      const mDot = thrustMag / (this.Isp * this.g0);
      this.fuel = Math.max(0, this.fuel - mDot * dt);
    }

    this.accBody.copy(appliedThrust).divideScalar(totalMass);

    const n = this.meanMotion;
    const x = this.state[0], y = this.state[1], z = this.state[2];
    const vx = this.state[3], vy = this.state[4], vz = this.state[5];

    const thrustWorld = appliedThrust.clone().applyQuaternion(this.quat);
    const ax = thrustWorld.x / totalMass;
    const ay = thrustWorld.y / totalMass;
    const az = thrustWorld.z / totalMass;

    // 經典相對運動微分方程 (Z 軸為視線方向)
    const xDotDot = 2 * n * vz + 3 * n * n * x + ax;
    const yDotDot = -n * n * y + ay;
    const zDotDot = -2 * n * vx + az;

    this.state[3] += xDotDot * dt;
    this.state[4] += yDotDot * dt;
    this.state[5] += zDotDot * dt;

    this.state[0] += this.state[3] * dt;
    this.state[1] += this.state[4] * dt;
    this.state[2] += this.state[5] * dt;

    // 姿態阻尼
    const appliedTorque = torqueCmd.clone().multiplyScalar(80.0);
    this.omega.x += (appliedTorque.x / this.moi.x) * dt;
    this.omega.y += (appliedTorque.y / this.moi.y) * dt;
    this.omega.z += (appliedTorque.z / this.moi.z) * dt;
    this.omega.multiplyScalar(0.95);

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
