// js/gnc/sensor_time_sync.js
import * as THREE from 'three';

export class TimeSynchronizer {
  constructor(capacity = 64) {
    this.capacity = capacity; 
    
    // 1. 預先分配所有緩衝槽 (Object Pooling)
    this.buffer = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = {
        timestamp: -1,
        imu: { 
          acc: new THREE.Vector3(), 
          gyro: new THREE.Vector3() 
        },
        lidar: new THREE.Vector3(),
        star: new THREE.Quaternion(),
        hasLidar: false,
        hasStar: false
      };
    }

    this.head = 0;   // 寫入指針
    this.count = 0;  // 當前有效樣本數

    // 2. 預先分配回傳物件 (Zero-Allocation Singleton)
    this.outSample = {
      gyro: new THREE.Vector3(),
      acc: new THREE.Vector3(),
      lidarPos: new THREE.Vector3(),
      starQuat: new THREE.Quaternion(),
      hasLidar: false,
      hasStar: false
    };
  }

  pushSample(timestamp, imuData, lidarData, starData) {
    const slot = this.buffer[this.head];
    slot.timestamp = timestamp;
    
    // In-place 數據拷貝，避免 GC 記憶體分配
    slot.imu.acc.copy(imuData.acc);
    slot.imu.gyro.copy(imuData.gyro);
    
    if (lidarData) {
      slot.lidar.copy(lidarData);
      slot.hasLidar = true;
    } else {
      slot.hasLidar = false;
    }

    if (starData) {
      slot.star.copy(starData);
      slot.hasStar = true;
    } else {
      slot.hasStar = false;
    }

    // 推進環形指針
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getInterpolatedSample(targetTime) {
    if (this.count === 0) return null;

    const newestIdx = (this.head - 1 + this.capacity) % this.capacity;
    const newest = this.buffer[newestIdx];
    
    // 邊界情況 1: 目標時間大於或等於最新樣本，直接回傳最新狀態
    if (targetTime >= newest.timestamp) {
      this.outSample.gyro.copy(newest.imu.gyro);
      this.outSample.acc.copy(newest.imu.acc);
      this.outSample.hasLidar = newest.hasLidar;
      if (newest.hasLidar) this.outSample.lidarPos.copy(newest.lidar);
      this.outSample.hasStar = newest.hasStar;
      if (newest.hasStar) this.outSample.starQuat.copy(newest.star);
      return this.outSample;
    }

    let idx0 = newestIdx;
    let idx1 = newestIdx;
    let found = false;

    // 環形緩衝區逆向搜尋臨近插值區間 [t0, t1]
    for (let i = 0; i < this.count; i++) {
      const currIdx = (newestIdx - i + this.capacity) % this.capacity;
      const sample = this.buffer[currIdx];
      
      if (sample.timestamp <= targetTime) {
        idx0 = currIdx;
        if (i > 0) {
          idx1 = (currIdx + 1) % this.capacity;
        }
        found = true;
        break;
      }
    }

    const t0 = this.buffer[idx0];
    const t1 = this.buffer[idx1];

    // 邊界情況 2: 目標時間早於最舊樣本或時間重合
    if (!found || idx0 === idx1) {
      this.outSample.gyro.copy(t0.imu.gyro);
      this.outSample.acc.copy(t0.imu.acc);
      this.outSample.hasLidar = t0.hasLidar;
      if (t0.hasLidar) this.outSample.lidarPos.copy(t0.lidar);
      this.outSample.hasStar = t0.hasStar;
      if (t0.hasStar) this.outSample.starQuat.copy(t0.star);
      return this.outSample;
    }

    // 3. 計算歸一化插值權重 alpha
    const denom = t1.timestamp - t0.timestamp;
    if (denom < 1e-6) {
      this.outSample.gyro.copy(t0.imu.gyro);
      this.outSample.acc.copy(t0.imu.acc);
      this.outSample.hasLidar = t0.hasLidar;
      if (t0.hasLidar) this.outSample.lidarPos.copy(t0.lidar);
      this.outSample.hasStar = t0.hasStar;
      if (t0.hasStar) this.outSample.starQuat.copy(t0.star);
      return this.outSample;
    }

    const alpha = THREE.MathUtils.clamp((targetTime - t0.timestamp) / denom, 0.0, 1.0);

    // 4. 高精度插值運算 (IMU 線性插值 + LiDAR 位置線性插值 + 星敏四元數球面插值)
    this.outSample.gyro.lerpVectors(t0.imu.gyro, t1.imu.gyro, alpha);
    this.outSample.acc.lerpVectors(t0.imu.acc, t1.imu.acc, alpha);
    
    // LiDAR 空間位置插值
    if (t0.hasLidar && t1.hasLidar) {
      this.outSample.lidarPos.lerpVectors(t0.lidar, t1.lidar, alpha);
      this.outSample.hasLidar = true;
    } else {
      this.outSample.hasLidar = t1.hasLidar;
      if (t1.hasLidar) this.outSample.lidarPos.copy(t1.lidar);
    }

    // 星敏四元數 Slerp 球面插值 (保證旋轉平滑無畸變)
    if (t0.hasStar && t1.hasStar) {
      this.outSample.starQuat.copy(t0.star).slerp(t1.star, alpha);
      this.outSample.hasStar = true;
    } else {
      this.outSample.hasStar = t1.hasStar;
      if (t1.hasStar) this.outSample.starQuat.copy(t1.star);
    }

    return this.outSample;
  }
}
