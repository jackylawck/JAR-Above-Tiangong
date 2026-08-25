// js/controls/touch_controls.js
export class DualTouchControls {
  constructor() {
    this.transInput = { x: 0, y: 0 };
    this.rotInput = { x: 0, y: 0 };
    this.exponent = 1.8; // 指數敏感度係數 (Deadzone + Power Curve)
    this.initJoysticks();
  }

  // 非線性響應轉換
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
    
    let activePointerId = null;
    let startX = 0, startY = 0;
    const maxTravel = 38; // 搖桿最大物理位移半徑

    // 1. 按下：捕獲 Pointer
    zone.addEventListener('pointerdown', (e) => {
      if (activePointerId !== null) return;
      
      activePointerId = e.pointerId;
      zone.setPointerCapture(activePointerId); // 鎖定該根手指

      // 計算搖桿中心點作為錨點
      const r = zone.getBoundingClientRect();
      startX = r.left + r.width / 2;
      startY = r.top + r.height / 2;
    });

    // 2. 移動：精確計算與邊界限制
    zone.addEventListener('pointermove', (e) => {
      if (activePointerId !== e.pointerId) return;

      let dx = e.clientX - startX;
      let dy = e.clientY - startY;
      
      // 使用 Math.sqrt 替代 Math.hypot，在極高頻觸發下效能微幅提升
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > maxTravel) {
        dx = (dx / dist) * maxTravel;
        dy = (dy / dist) * maxTravel;
      }

      // 觸發硬體加速的 CSS 變換
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      onMove({ x: dx / maxTravel, y: -dy / maxTravel });
    });

    // 3. 鬆開/取消：精準重置
    const reset = (e) => {
      if (activePointerId !== e.pointerId) return; // 絕不干擾另一根手指
      
      zone.releasePointerCapture(activePointerId);
      activePointerId = null;
      knob.style.transform = 'translate(0px, 0px)';
      onMove({ x: 0, y: 0 });
    };

    zone.addEventListener('pointerup', reset);
    zone.addEventListener('pointercancel', reset);
    
    // 防止觸控時螢幕跟著滾動或縮放
    zone.addEventListener('contextmenu', e => e.preventDefault());
  }
}
