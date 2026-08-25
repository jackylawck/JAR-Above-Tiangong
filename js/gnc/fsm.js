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
    this.dockingThreshold = 1.0;      // 對接鎖定半徑 (m)
    this.maxSafeApproachSpeed = 1.20; // 安全對接速度 (m/s)
    this.maxDockingRadialOffset = 0.55; // 允許的最大對心徑向偏差
    this.assistMagnet = true;

    // 🚀 零記憶體配置 (Zero-GC) 狀態快取物件
    this.result = {
      statusKey: 'statusApproach',
      isAlert: false,
      isSuccess: false
    };
  }

  setDifficulty(level) {
    this.difficulty = level;
    if (level === Difficulty.KID) {
      this.maxSafeApproachSpeed = 1.20;
      this.dockingThreshold = 1.0;
      this.maxDockingRadialOffset = 0.55;
      this.assistMagnet = true;
    } else if (level === Difficulty.PRO) {
      this.maxSafeApproachSpeed = 0.40;
      this.dockingThreshold = 0.65;
      this.maxDockingRadialOffset = 0.35;
      this.assistMagnet = true;
    } else if (level === Difficulty.SCIENTIST) {
      this.maxSafeApproachSpeed = 0.15;
      this.dockingThreshold = 0.40;
      this.maxDockingRadialOffset = 0.20;
      this.assistMagnet = false;
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  setResult(statusKey, isAlert, isSuccess) {
    this.result.statusKey = statusKey;
    this.result.isAlert = isAlert;
    this.result.isSuccess = isSuccess;
    return this.result;
  }

  evaluate(distToPort, speed, pos) {
    // 1. 中止程序
    if (this.mode === MissionModes.ABORT) {
      return this.setResult('statusAbort', true, false);
    }

    const x = pos.x;
    const y = pos.y;
    const z = pos.z;
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const radialOffsetSq = x * x + y * y;
    const maxOffsetSq = this.maxDockingRadialOffset * this.maxDockingRadialOffset;

    // 🚀 2. 成功硬對接判定 (距離小於閾值、在對接環正面且對心偏差在安全範圍內)
    if (z >= 0.15 && z <= this.dockingThreshold && radialOffsetSq <= maxOffsetSq) {
      if (speed <= this.maxSafeApproachSpeed) {
        return this.setResult('statusDocked', false, true);
      }
    }

    // 🚀 3. 空間站全機體實體幾何碰撞盒 (AABB Collision Hull)
    // 當飛船縱向進入空間站主體深處 (z <= 0.28m)
    if (z <= 0.28) {
      // 情況 A: 正面頂部對接口超速暴衝撞擊
      if (radialOffsetSq <= 0.45 && speed > this.maxSafeApproachSpeed) {
        return this.setResult('statusOverSpeed', true, false);
      }

      // 情況 B: 撞上核心艙外壁 / 金色節點艙 (直徑約 3.0m)
      if (z >= -10.0 && radialOffsetSq > 0.35 && radialOffsetSq <= 6.25) {
        return this.setResult('statusOverSpeed', true, false);
      }

      // 情況 C: 撞上左右問天/夢天實驗艙橫翼 (X: 1.2m ~ 12m, Y: 2.2m, Z: -1.0m ~ -7.0m)
      if (absX >= 1.2 && absX <= 12.0 && absY <= 2.2 && z <= -1.0 && z >= -7.0) {
        return this.setResult('statusOverSpeed', true, false);
      }

      // 情況 D: 撞上巨型柔性太陽翼 (X: 10m ~ 28m, Y: 2.5m, Z: -1.0m ~ -7.0m)
      if (absX > 10.0 && absX <= 28.0 && absY <= 2.5 && z <= -1.0 && z >= -7.0) {
        return this.setResult('statusOverSpeed', true, false);
      }

      // 情況 E: 飛掠衝過頭 (未發生實體碰撞但已飛越對接面)
      if (z < -0.3) {
        return this.setResult('statusOvershoot', true, false);
      }
    }

    // 正常進近中
    return this.setResult('statusApproach', false, false);
  }
}
