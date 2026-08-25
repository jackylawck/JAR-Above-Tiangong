// js/controls/touch_controls.js
import * as THREE from 'three';

export class DualTouchControls {
  constructor() {
    this.transInput = new THREE.Vector2(0, 0); // 平移 (X, Y)
    this.rotInput = new THREE.Vector2(0, 0);   // 姿態 (Pitch, Yaw)
    
    this.zoneTrans = document.getElementById('zone-trans');
    this.knobTrans = document.getElementById('knob-trans');
    this.zoneRot = document.getElementById('zone-rot');
    this.knobRot = document.getElementById('knob-rot');

    this.maxRadius = 38;
    this.deadzone = 0.08; // 8% 中心死區，過濾手指抖動

    this.setupJoystick(this.zoneTrans, this.knobTrans, this.transInput, false);
    this.setupJoystick(this.zoneRot, this.knobRot, this.rotInput, true);
  }

  setupJoystick(zone, knob, outputVector, isAttitude) {
    if (!zone || !knob) return;

    let activePointerId = null;
    let centerX = 0;
    let centerY = 0;

    const handlePointer = (e) => {
      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > this.maxRadius) {
        dx = (dx / dist) * this.maxRadius;
        dy = (dy / dist) * this.maxRadius;
      }

      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      const normDist = dist / this.maxRadius;
      if (normDist < this.deadzone) {
        outputVector.set(0, 0);
        return;
      }

      // 二次方平滑曲線：(normDist - deadzone) / (1 - deadzone)
      const factor = (normDist - this.deadzone) / (1.0 - this.deadzone);
      const curvedIntensity = factor * factor;

      const dirX = dx / (dist || 1);
      const dirY = -dy / (dist || 1); // 向上推為正 Y

      outputVector.x = dirX * curvedIntensity;
      outputVector.y = dirY * curvedIntensity;
    };

    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activePointerId = e.pointerId;
      
      // 按下時快取中心點，消除 move 時的 getBoundingClientRect 重排開銷
      const rect = zone.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;

      zone.setPointerCapture(e.pointerId);
      handlePointer(e);
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        e.stopPropagation();
        handlePointer(e);
      }
    });

    const resetJoystick = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        e.stopPropagation();
        activePointerId = null;
        outputVector.set(0, 0);
        knob.style.transform = 'translate(-50%, -50%)';
        try { zone.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    zone.addEventListener('pointerup', resetJoystick);
    zone.addEventListener('pointercancel', resetJoystick);
  }
}
