// js/gnc/sensor_time_sync.js
import * as THREE from 'three';

export class TimeSynchronizer {
  constructor(bufferDurationSec = 0.5) {
    this.buffer = [];
    this.maxDuration = bufferDurationSec;
  }

  pushSample(timestamp, imuData, lidarData, starData) {
    this.buffer.push({ 
      timestamp, 
      imu: { acc: imuData.acc.clone(), gyro: imuData.gyro.clone() },
      lidar: lidarData ? lidarData.clone() : null, 
      star: starData ? starData.clone() : null 
    });

    while (this.buffer.length > 2 && (timestamp - this.buffer[0].timestamp) > this.maxDuration * 1000) {
      this.buffer.shift();
    }
  }

  // 取得目標時間（含延遲補償）的插值狀態
  getInterpolatedSample(targetTime) {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) return this.buffer[0];

    let idx = this.buffer.findIndex(s => s.timestamp >= targetTime);
    if (idx <= 0) idx = 1;

    const t0 = this.buffer[idx - 1];
    const t1 = this.buffer[idx];
    const denom = t1.timestamp - t0.timestamp || 1;
    const alpha = THREE.MathUtils.clamp((targetTime - t0.timestamp) / denom, 0, 1);

    return {
      gyro: t0.imu.gyro.clone().lerp(t1.imu.gyro, alpha),
      acc: t0.imu.acc.clone().lerp(t1.imu.acc, alpha),
      lidarPos: t1.lidar, // 離散觀測量取最新幀
      starQuat: t1.star
    };
  }
}
