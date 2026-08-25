// js/gnc/fsm.js
export const MissionModes = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL',
  ABORT: 'ABORT'
};

export const Difficulty = {
  KID: 'KID',
  PRO: 'PRO',
  SCIENTIST: 'SCIENTIST'
};

export class MissionFSM {
  constructor() {
    this.mode = MissionModes.MANUAL;
    this.difficulty = Difficulty.KID;
    this.dockingThreshold = 1.0;      // 對接鎖定半徑
    this.maxSafeApproachSpeed = 1.20; // 安全對接速度
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 1.20;
      this.dockingThreshold = 1.0;
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.40;
      this.dockingThreshold = 0.6;
      this.assistMagnet = true;
    } else if (level === Difficulty.SCIENTIST) {
      this.maxSafeApproachSpeed = 0.15;
      this.dockingThreshold = 0.4;
      this.assistMagnet = false;
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  evaluate(distToPort, speed, pos) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true, isSuccess: false };
    }

    const x = pos.x, y = pos.y, z = pos.z;
    const radialOffset = Math.hypot(x, y);

    // 🚀 1. 成功對接判定 (對準對接口且速度安全)
    if (distToPort <= this.dockingThreshold && radialOffset <= 0.45 && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 🚀 2. 全站實體碰撞箱檢測 (正面撞上實驗艙、核心艙或太陽翼)
    // 當進入空間站縱向深度 (z <= 0.2m)
    if (z <= 0.2) {
      // 情況 A: 對準對接口但超速暴衝撞毀
      if (radialOffset <= 0.6 && speed > this.maxSafeApproachSpeed) {
        return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
      }

      // 情況 B: 撞上核心艙外壁或金色節點艙
      if (z >= -10.0 && radialOffset > 0.45 && radialOffset < 2.5) {
        return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
      }

      // 情況 C: 撞上左右問天/夢天實驗艙 (X 軸伸展 1.2m 到 11m)
      if (Math.abs(x) >= 1.2 && Math.abs(x) <= 12.0 && Math.abs(y) <= 2.2 && z <= -1.0 && z >= -7.0) {
        return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
      }

      // 情況 D: 撞上超長太陽能板
      if (Math.abs(x) > 10.0 && Math.abs(x) <= 28.0 && Math.abs(y) <= 3.0 && z <= -1.0 && z >= -7.0) {
        return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
      }

      // 情況 E: 完全穿透飛越
      if (z < -0.8) {
        return { statusKey: 'statusOvershoot', isAlert: true, isSuccess: false };
      }
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
