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

    // 初始位置與速度
    this.state = new Float64Array([0, 0, 35.0, 0, 0, -0.25]);
    this.omega = new THREE.Vector3(0, 0, 0); // 角速度 (rad/s)
    this.quat = new THREE.Quaternion(0, 0, 0, 1);
    this.moi = new THREE.Vector3(800, 800, 600); // 調低轉動慣量，提升靈敏度
    this.accBody = new THREE.Vector3();
  }

  step(dt, thrustCmd, torqueCmd) {
    const totalMass = this.massDry + this.fuel;
    
    // 平移推力
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

    // CW 軌道微分方程步進
    const xDotDot = 2 * n * vz + 3 * n * n * x + ax;
    const yDotDot = -n * n * y + ay;
    const zDotDot = -2 * n * vx + az;

    this.state[3] += xDotDot * dt;
    this.state[4] += yDotDot * dt;
    this.state[5] += zDotDot * dt;

    this.state[0] += this.state[3] * dt;
    this.state[1] += this.state[4] * dt;
    this.state[2] += this.state[5] * dt;

    // 姿態步進：提升 RCS 力矩響應
    const appliedTorque = torqueCmd.clone().multiplyScalar(280.0);
    this.omega.x += (appliedTorque.x / this.moi.x) * dt;
    this.omega.y += (appliedTorque.y / this.moi.y) * dt;
    this.omega.z += (appliedTorque.z / this.moi.z) * dt;

    // 阻尼回饋：無操作時平穩減速
    if (torqueCmd.lengthSq() === 0) {
      this.omega.multiplyScalar(0.92);
    }

    // 四元數運動學積分
    const halfDt = dt * 0.5;
    const dq = new THREE.Quaternion(
      this.omega.x * halfDt,
      this.omega.y * halfDt,
      this.omega.z * halfDt,
      1.0
    ).normalize();
    this.quat.multiply(dq).normalize();

    return {
      pos: new THREE.Vector3(this.state[0], this.state[1], this.state[2]),
      vel: new THREE.Vector3(this.state[3], this.state[4], this.state[5]),
      quat: this.quat,
      accBody: this.accBody,
      fuel: this.fuel
    };
  }
}
