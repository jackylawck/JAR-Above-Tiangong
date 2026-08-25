// js/gnc/sensor_time_sync.js
import * as THREE from 'three';

export class TimeSynchronizer {
  constructor(bufferDurationSec = 0.5) {
    // 假設最高 60 FPS，0.5秒約 30 幀。預留 64 幀的固定環形緩衝區絕對足夠
    this.capacity = 64; 
    
    // 1. 預先分配所有緩衝槽 (Object Pooling)
    this.buffer = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = {
        timestamp: -1,
        imu: { acc: new THREE.Vector3(), gyro: new THREE.Vector3() },
        lidar: new THREE.Vector3(),
        star: new THREE.Quaternion(),
        hasLidar: false,
        hasStar: false
      };
    }

    this.head = 0;   // 寫入指針
    this.count = 0;  // 當前有效樣本數

    // 2. 預先分配回傳物件 (Zero Allocation)
    this.outSample = {
      gyro: new THREE.Vector3(),
      acc: new THREE.Vector3(),
      lidarPos: null,
      starQuat: null
    };
  }

  pushSample(timestamp, imuData, lidarData, starData) {
    // 取得當前寫入槽，完全不需要 push 或 shift
    const slot = this.buffer[this.head];
    slot.timestamp = timestamp;
    
    // In-place 資料拷貝，取代 .clone()
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

    // 從最新的一筆資料開始往回找
    const newestIdx = (this.head - 1 + this.capacity) % this.capacity;
    
    // 防呆：如果要求的時間比最新的還新，直接回傳最新狀態
    if (targetTime >= this.buffer[newestIdx].timestamp) {
      const newest = this.buffer[newestIdx];
      this.outSample.gyro.copy(newest.imu.gyro);
      this.outSample.acc.copy(newest.imu.acc);
      this.outSample.lidarPos = newest.hasLidar ? newest.lidar : null;
      this.outSample.starQuat = newest.hasStar ? newest.star : null;
      return this.outSample;
    }

    let idx0 = newestIdx;
    let idx1 = newestIdx;
    let found = false;

    // 在環形緩衝區中逆向搜尋
    for (let i = 0; i < this.count; i++) {
      const currIdx = (newestIdx - i + this.capacity) % this.capacity;
      const sample = this.buffer[currIdx];
      
      if (sample.timestamp <= targetTime) {
        idx0 = currIdx;
        if (i > 0) {
          idx1 = (currIdx + 1) % this.capacity; // idx1 是時間上在 idx0 之後的一筆
        }
        found = true;
        break;
      }
    }

    const t0 = this.buffer[idx0];
    const t1 = this.buffer[idx1];

    // 如果目標時間比緩衝區最舊的還舊，直接 clamp 在最舊的一筆
    if (!found || idx0 === idx1) {
      this.outSample.gyro.copy(t0.imu.gyro);
      this.outSample.acc.copy(t0.imu.acc);
      this.outSample.lidarPos = t0.hasLidar ? t0.lidar : null;
      this.outSample.starQuat = t0.hasStar ? t0.star : null;
      return this.outSample;
    }

    // 線性插值計算
    const denom = t1.timestamp - t0.timestamp || 1;
    const alpha = THREE.MathUtils.clamp((targetTime - t0.timestamp) / denom, 0, 1);

    // In-place 插值，取代 .clone().lerp()
    this.outSample.gyro.lerpVectors(t0.imu.gyro, t1.imu.gyro, alpha);
    this.outSample.acc.lerpVectors(t0.imu.acc, t1.imu.acc, alpha);
    
    this.outSample.lidarPos = t1.hasLidar ? t1.lidar : null;
    this.outSample.starQuat = t1.hasStar ? t1.star : null;

    return this.outSample;
  }
}
