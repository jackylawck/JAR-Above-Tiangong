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
    this.mode = MissionModes.AUTO;
    this.difficulty = Difficulty.PRO;
    this.dockingThreshold = 2.5;      // 對接判定半徑 (m)
    this.maxSafeApproachSpeed = 0.25;  // 安全對接速度 (m/s)
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 1.80; // 兒童版放寬速度
      this.dockingThreshold = 4.0;      // 對接捕捉範圍放大
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.35;
      this.dockingThreshold = 2.5;
      this.assistMagnet = true;
    } else if (level === Difficulty.SCIENTIST) {
      this.maxSafeApproachSpeed = 0.15;
      this.dockingThreshold = 1.5;
      this.assistMagnet = false;
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  evaluate(dist, speed, relZ = 0) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true, isSuccess: false };
    }

    // 1. 成功對接判定 (距離在捕捉範圍內且速度安全)
    if (dist <= this.dockingThreshold && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 2. 致命高速正面撞擊判定 (只有極限超速才會判定毀滅)
    const fatalSpeedLimit = this.difficulty === Difficulty.KID ? 4.5 : 1.5;
    if (dist <= 1.2 && speed > fatalSpeedLimit) {
      return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
    }

    // 3. 衝過頭判定 (relZ > 2.0 表示飛船已經穿過對接環，允許倒車調頭)
    if (relZ > 2.0) {
      return { statusKey: 'statusOvershoot', isAlert: true, isSuccess: false };
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
