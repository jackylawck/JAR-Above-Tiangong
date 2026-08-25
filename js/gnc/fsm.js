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
    this.dockingThreshold = 2.5;     // 對接成功距離 (m)
    this.maxSafeApproachSpeed = 0.25; // 安全對接速度 (m/s)
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 1.20; // 兒童版大幅放寬超速限制，不易撞毀
      this.dockingThreshold = 3.5;      // 判定範圍放寬
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.25;
      this.dockingThreshold = 2.0;
      this.assistMagnet = true;
    } else if (level === Difficulty.SCIENTIST) {
      this.maxSafeApproachSpeed = 0.12; // 硬核真實限制
      this.dockingThreshold = 1.2;
      this.assistMagnet = false;        // 無自動磁吸輔助
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  evaluate(dist, speed) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true, isSuccess: false };
    }

    // 成功硬對接判定
    if (dist <= this.dockingThreshold && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 超速碰撞判定
    if (dist <= this.dockingThreshold && speed > this.maxSafeApproachSpeed) {
      return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
