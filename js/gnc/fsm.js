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
    this.difficulty = Difficulty.KID; // 預設兒童模式
    this.dockingThreshold = 4.0;      // 兒童模式捕捉半徑
    this.maxSafeApproachSpeed = 1.80; // 兒童模式安全速度
    this.assistMagnet = true;
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 1.80;
      this.dockingThreshold = 4.0;
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

  evaluate(dist, speed, posY) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true, isSuccess: false };
    }

    // 1. 成功對接判定 (距離在捕捉範圍且速度在寬容限度內)
    if (dist <= this.dockingThreshold && speed <= this.maxSafeApproachSpeed) {
      return { statusKey: 'statusDocked', isAlert: false, isSuccess: true };
    }

    // 2. 致命高速正面撞毀 (只有極限超速才會判定爆炸)
    const fatalSpeed = this.difficulty === Difficulty.KID ? 4.5 : 1.5;
    if (dist <= 1.2 && speed > fatalSpeed) {
      return { statusKey: 'statusOverSpeed', isAlert: true, isSuccess: false };
    }

    // 3. 衝過頭判定：對接端口位於 Y = 0 附近。當 posY > 2.0 代表飛船已飛越對接口
    if (posY > 2.0) {
      return { statusKey: 'statusOvershoot', isAlert: true, isSuccess: false };
    }

    return { statusKey: 'statusApproach', isAlert: false, isSuccess: false };
  }
}
