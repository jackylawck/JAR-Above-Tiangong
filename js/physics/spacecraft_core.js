// js/physics/spacecraft_core.js
import * as THREE from 'three';

export class SpacecraftEngine {
  constructor() {
    this.GM = 3.986e14;
    this.n = Math.sqrt(this.GM / Math.pow(6371000 + 400000, 3));
    
    // 將陣列替換為 Float64Array，加速底層記憶體存取
    this.state = new Float64Array([0, -80, 0, 0, 0.15, 0]);
    this.qActual = new THREE.Quaternion();
    this.omega = new THREE.Vector3();
    this.fuel = 300.0;
    this.massDry = 3000.0;
    this.thrustMultiplier = 1.0;
    
    // 優化：預先計算平方值，避免每幀開根號
    this.maxOmega = 1.2; 
    this.maxOmegaSq = this.maxOmega * this.maxOmega;
    this.maxSingleNozzleThrust = 50.0;

    // ==========================================
    // 極致優化：預先分配所有暫存變數 (Zero Allocation)
    // ==========================================
    this._tempThrust = new THREE.Vector3();
    this._tempTorque = new THREE.Vector3();
    this._tempAxis = new THREE.Vector3();
    this._deltaQ = new THREE.Quaternion();
    this._orbitThrust = new THREE.Vector3();
    
    // 預先分配回傳物件，避免每幀 return {} 產生垃圾
    this.outState = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      quat: this.qActual, // 傳遞參照，外部只讀不寫
      fuel: this.fuel,
      mass: this.massDry + this.fuel,
      accBody: this._orbitThrust
    };
  }

  step(dt, thrustCmd, torqueCmd) {
    const totalMass = this.massDry + this.fuel;
    const invMass = 1.0 / totalMass; // 優化：除法轉乘法

    // --- 推力向量限幅 (In-place) ---
    this._tempThrust.copy(thrustCmd);
    const thrustSq = this._tempThrust.lengthSq(); // 避免開根號
    if (thrustSq > 1.0) {
      this._tempThrust.normalize();
    }
    // 只有在真的需要 Magnitude 時才開根號
    const thrustMagRaw = thrustSq > 1.0 ? 1.0 : Math.sqrt(thrustSq);
    const actualThrustMag = thrustMagRaw * this.maxSingleNozzleThrust * this.thrustMultiplier;

    if (actualThrustMag > 0.01 && this.fuel > 0) {
      // 300.0 * 9.80665 = 2941.995 (可提早算好為常數，但 V8 引擎會自動優化)
      this.fuel = Math.max(0, this.fuel - (actualThrustMag / 2941.995) * dt);
    }

    // --- 姿態動力學更新 (In-place) ---
    this._tempTorque.copy(torqueCmd).multiplyScalar(this.thrustMultiplier * dt);
    this.omega.add(this._tempTorque).multiplyScalar(0.96);

    const omegaSq = this.omega.lengthSq(); // 避免開根號
    if (omegaSq > this.maxOmegaSq) {
      this.omega.normalize().multiplyScalar(this.maxOmega);
    }

    // --- 軸角指數映射四元數積分 (In-place) ---
    const omegaMag = this.omega.length(); // 這裡必須開根號算角度
    const rotAngle = omegaMag * dt;

    if (rotAngle > 1e-6) {
      this._tempAxis.copy(this.omega).divideScalar(omegaMag); // 避免再次 normalize()
      this._deltaQ.setFromAxisAngle(this._tempAxis, rotAngle);
    } else {
      this._deltaQ.set(0.5 * this.omega.x * dt, 0.5 * this.omega.y * dt, 0.5 * this.omega.z * dt, 1.0).normalize();
    }
    this.qActual.multiply(this._deltaQ).normalize();

    // --- 軌道動力學 (CW 解析解步進) ---
    // 在本體座標系計算軌道推力加速度 (In-place)
    this._orbitThrust.copy(this._tempThrust)
      .applyQuaternion(this.qActual)
      .multiplyScalar(actualThrustMag * invMass); // 乘法替代除法

    const [x0, y0, z0, vx0, vy0, vz0] = this.state;
    const nt = this.n * dt;
    const s = Math.sin(nt), c = Math.cos(nt);
    const invN = 1.0 / this.n; // 除法轉乘法

    // 解析解計算 (降維優化)
    const x = (4 - 3*c)*x0 + (s * invN)*vx0 + (2 * invN)*(1-c)*vy0;
    const y = 6*(s - nt)*x0 + y0 - (2 * invN)*(1-c)*vx0 + ((4*s - 3*nt) * invN)*vy0;
    const z = z0*c + (vz0 * invN)*s;

    const vx = 3*this.n*s*x0 + c*vx0 + 2*s*vy0 + this._orbitThrust.x * dt;
    const vy = 6*this.n*(c - 1)*x0 - 2*s*vx0 + (4*c - 3)*vy0 + this._orbitThrust.y * dt;
    const vz = -z0*this.n*s + vz0*c + this._orbitThrust.z * dt;

    // 將結果存回 Float64Array
    this.state[0] = x; this.state[1] = y; this.state[2] = z;
    this.state[3] = vx; this.state[4] = vy; this.state[5] = vz;

    // --- 更新快取回傳物件 (Zero Allocation) ---
    this.outState.pos.set(x, z, y);
    this.outState.vel.set(vx, vz, vy);
    this.outState.fuel = this.fuel;
    this.outState.mass = totalMass;

    return this.outState;
  }
}
