export class DualTouchControls {
  constructor() {
    this.transInput = { x: 0, y: 0 };
    this.rotInput = { x: 0, y: 0 };
    this.initJoysticks();
  }

  initJoysticks() {
    this.bindJoystick('zone-trans', 'knob-trans', v => { this.transInput = v; });
    this.bindJoystick('zone-rot', 'knob-rot', v => { this.rotInput = v; });
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
          if (dist > 35) { dx = (dx / dist) * 35; dy = (dy / dist) * 35; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          onMove({ x: dx / 35, y: -dy / 35 });
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
