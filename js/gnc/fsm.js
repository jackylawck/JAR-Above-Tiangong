export const MissionModes = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL',
  ABORT: 'ABORT'
};

export class MissionFSM {
  constructor() {
    this.mode = MissionModes.AUTO;
  }

  setMode(newMode) {
    this.mode = newMode;
  }

  evaluate(dist, speed) {
    if (this.mode === MissionModes.ABORT) {
      return { statusKey: 'statusAbort', isAlert: true };
    }
    if (dist < 2.0) {
      if (speed < 0.15) {
        return { statusKey: 'statusDocked', isSuccess: true };
      } else {
        return { statusKey: 'statusOverSpeed', isAlert: true };
      }
    }
    return { statusKey: 'statusApproach', isNominal: true };
  }
}
