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
    this.dockingThreshold = 2.0; // 對接容許距離 (m)
    this.rateLimit = 0.15;       // 最大允許接近速度 (m/s)
    this.assistMagnet = true;    // 磁力吸附輔助
  }

  setDifficulty(level) {
    this.difficulty = level;
    switch(level) {
      case Difficulty.KID:
        this.dockingThreshold = 6.0; // 寬容度極高
        this.rateLimit = 0.50;
        this.assistMagnet = true;
        break;
      case Difficulty.PRO:
        this.dockingThreshold = 2.0; // 標準航太規範
        this.rateLimit = 0.15;
        this.assistMagnet = true;
        break;
      case Difficulty.SCIENTIST:
        this.dockingThreshold = 0.8; // 公分級嚴格判定
        this.rateLimit = 0.05;       // 超過 0.05 m/s 即視為撞毀
        this.assistMagnet = false;   // 完全無輔助
        this.mode = MissionModes.MANUAL; // 強制全手動
        break;
    }
  }

  setMode(newMode) {
    if (this.difficulty === Difficulty.SCIENTIST && newMode === MissionModes.AUTO) {
      return false; // 科學家模式下禁止切換回 AUTO
    }
    this.mode = newMode;
    return true;
  }

  evaluate(dist, speed) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true };
    }

    if (dist < this.dockingThreshold) {
      if (speed <= this.rateLimit) {
        return { statusKey: 'statusDocked', isSuccess: true };
      } else {
        return { statusKey: 'statusOverSpeed', isAlert: true };
      }
    }
    return { statusKey: 'statusApproach', isNominal: true };
  }
}
