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
    this.dockingThreshold = 0.5;      // 🚀 對接鎖定半徑：距離對接口 0.5 米內
    this.maxSafeApproachSpeed = 0.60;
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 0.60;
      this.dockingThreshold = 0.5;
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.30;
      this.dockingThreshold = 0.35;
      this.assistMagnet = true;
    } else if (level === Difficulty.SCIENTIST) {
      this.maxSafeApproachSpeed = 0.15;
      this.dockingThreshold = 0.25;
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

    // 1. 成功對接判定 (距離對接口 <= 0.5m 且速度安全)
    if (distToPort <= this.dockingThreshold && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 2. 致命超速碰撞
    const fatalSpeed = this.difficulty === Difficulty.KID ? 2.0 : 0.8;
    if (distToPort <= 0.15 && speed > fatalSpeed) {
      return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
    }

    // 3. 衝過頭判定：當飛船位置穿過對接口後方 (posZ < -0.3)
    if (posZ < -0.3) {
      return { statusKey: 'statusOvershoot', isAlert: true, isSuccess: false };
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
