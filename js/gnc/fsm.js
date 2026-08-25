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

// ==========================================
// 極致優化：預先配置所有可能的狀態回傳物件 (Zero Allocation)
// ==========================================
const FSM_RESULTS = {
  ABORT:      { statusKey: 'statusAbort',     isAlert: true,  isSuccess: false, isNominal: false },
  DOCKED:     { statusKey: 'statusDocked',    isAlert: false, isSuccess: true,  isNominal: false },
  OVER_SPEED: { statusKey: 'statusOverSpeed', isAlert: true,  isSuccess: false, isNominal: false },
  APPROACH:   { statusKey: 'statusApproach',  isAlert: false, isSuccess: false, isNominal: true  }
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
    // 直接回傳靜態物件參照，不產生任何記憶體垃圾
    if (this.mode === MissionModes.ABORT) {
      return FSM_RESULTS.ABORT;
    }

    if (dist < this.dockingThreshold) {
      if (speed <= this.rateLimit) {
        return FSM_RESULTS.DOCKED;
      } else {
        return FSM_RESULTS.OVER_SPEED;
      }
    }
    return FSM_RESULTS.APPROACH;
  }
}
