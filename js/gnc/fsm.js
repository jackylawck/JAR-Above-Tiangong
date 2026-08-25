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
    this.dockingThreshold = 1.2;      // 🚀 對接捕捉範圍擴大至 1.2 米
    this.maxSafeApproachSpeed = 1.20; // 兒童模式放寬速度至 1.2 m/s
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 1.20;
      this.dockingThreshold = 1.2;
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.45;
      this.dockingThreshold = 0.8;
      this.assistMagnet = true;
    } else if (level === Difficulty.SCIENTIST) {
      this.maxSafeApproachSpeed = 0.18;
      this.dockingThreshold = 0.5;
      this.assistMagnet = false;
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  evaluate(distToPort, speed, posZ) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true, isSuccess: false };
    }

    // 1. 成功對接判定 (距離 <= 1.2m 即刻成功鎖定)
    if (distToPort <= this.dockingThreshold && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 2. 致命極限撞擊
    const fatalSpeed = this.difficulty === Difficulty.KID ? 3.0 : 1.2;
    if (distToPort <= 0.2 && speed > fatalSpeed) {
      return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
    }

    // 3. 衝過頭判定 (只有完全穿過對接口後方 0.5m 才判定)
    if (posZ < -0.5) {
      return { statusKey: 'statusOvershoot', isAlert: true, isSuccess: false };
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
