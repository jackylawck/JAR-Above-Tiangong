// js/controls/touch_controls.js
export class DualTouchControls {
  constructor() {
    this.transInput = { x: 0, y: 0 };
    this.rotInput = { x: 0, y: 0 };
    this.exponent = 1.8; // 指數敏感度係數
    this.initJoysticks();
  }

  // 非線性響應轉換 (Deadzone + Power Curve)
  applyExpoCurve(val) {
    const deadzone = 0.05;
    if (Math.abs(val) < deadzone) return 0;
    const sign = Math.sign(val);
    const scaled = (Math.abs(val) - deadzone) / (1.0 - deadzone);
    return sign * Math.pow(scaled, this.exponent);
  }

  initJoysticks() {
    this.bindJoystick('zone-trans', 'knob-trans', v => {
      this.transInput = {
        x: this.applyExpoCurve(v.x),
        y: this.applyExpoCurve(v.y)
      };
    });

    this.bindJoystick('zone-rot', 'knob-rot', v => {
      this.rotInput = {
        x: this.applyExpoCurve(v.x),
        y: this.applyExpoCurve(v.y)
      };
    });
  }

  bindJoystick(zoneId, knobId, onMove) {
    const zone = document.getElementById(zoneId);
    const knob = document.getElementById(knobId);
    let touchId = null, startX = 0, startY = 0;

    zone.addEventListener('touchstart', e => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const r = zone.getBoundingClientRect();
      startX = r.left + r.width / 2;
      startY = r.top + r.height / 2;
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (touchId === null) return;
      for (let t of e.changedTouches) {
        if (t.identifier === touchId) {
          let dx = t.clientX - startX, dy = t.clientY - startY;
          const dist = Math.hypot(dx, dy);
          if (dist > 38) { dx = (dx / dist) * 38; dy = (dy / dist) * 38; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          onMove({ x: dx / 38, y: -dy / 38 });
          break;
        }
      }
    }, { passive: false });

    const reset = () => {
      touchId = null;
      knob.style.transform = 'translate(0px, 0px)';
      onMove({ x: 0, y: 0 });
    };
    window.addEventListener('touchend', reset);
    window.addEventListener('touchcancel', reset);
  }
}
