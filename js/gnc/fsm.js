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
    this.dockingThreshold = 0.8;      // 🚀 對接鎖定半徑：距離對接口 0.8 米內
    this.maxSafeApproachSpeed = 0.80;  // 兒童模式寬容安全速度
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 0.80;
      this.dockingThreshold = 0.8;
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.35;
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

  evaluate(distToPort, speed, posZ) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true, isSuccess: false };
    }

    // 1. 成功對接判定 (距離對接口 < 0.8m 且未撞穿)
    if (distToPort <= this.dockingThreshold && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 2. 致命高速撞擊
    const fatalSpeed = this.difficulty === Difficulty.KID ? 2.5 : 1.2;
    if (distToPort <= 0.2 && speed > fatalSpeed) {
      return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
    }

    // 3. 衝過頭判定 (posZ 小於 -4.8 代表已經穿過對接面)
    if (posZ < -4.8) {
      return { statusKey: 'statusOvershoot', isAlert: true, isSuccess: false };
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
