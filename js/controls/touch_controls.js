// js/controls/touch_controls.js
import * as THREE from 'three';

export class DualTouchControls {
  constructor() {
    this.transInput = new THREE.Vector2(0, 0); // 平移 (X, Y)
    this.rotInput = new THREE.Vector2(0, 0);   // 姿態 (Pitch, Yaw)
    
    this.isTransActive = false;
    this.isRotActive = false;

    this.zoneTrans = document.getElementById('zone-trans');
    this.knobTrans = document.getElementById('knob-trans');
    this.zoneRot = document.getElementById('zone-rot');
    this.knobRot = document.getElementById('knob-rot');

    this.maxRadius = 38;
    this.deadzone = 0.05; // 微縮死區，提升靈敏度

    this.setupTransJoystick();
    this.setupRotJoystick();
  }

  setupTransJoystick() {
    if (!this.zoneTrans || !this.knobTrans) return;
    let activePointerId = null;
    let centerX = 0, centerY = 0;

    const handlePointer = (e) => {
      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > this.maxRadius) {
        dx = (dx / dist) * this.maxRadius;
        dy = (dy / dist) * this.maxRadius;
      }

      this.knobTrans.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      const normDist = dist / this.maxRadius;
      if (normDist < this.deadzone) {
        this.transInput.set(0, 0);
        return;
      }

      const factor = (normDist - this.deadzone) / (1.0 - this.deadzone);
      const dirX = dx / (dist || 1);
      const dirY = -dy / (dist || 1);

      this.transInput.x = dirX * factor;
      this.transInput.y = dirY * factor;
    };

    this.zoneTrans.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activePointerId = e.pointerId;
      this.isTransActive = true;
      const rect = this.zoneTrans.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      this.zoneTrans.setPointerCapture(e.pointerId);
      handlePointer(e);
    });

    this.zoneTrans.addEventListener('pointermove', (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        handlePointer(e);
      }
    });

    const reset = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        activePointerId = null;
        this.isTransActive = false;
        this.transInput.set(0, 0);
        this.knobTrans.style.transform = 'translate(-50%, -50%)';
        try { this.zoneTrans.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    this.zoneTrans.addEventListener('pointerup', reset);
    this.zoneTrans.addEventListener('pointercancel', reset);
  }

  setupRotJoystick() {
    if (!this.zoneRot || !this.knobRot) return;
    let activePointerId = null;
    let centerX = 0, centerY = 0;

    const handlePointer = (e) => {
      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > this.maxRadius) {
        dx = (dx / dist) * this.maxRadius;
        dy = (dy / dist) * this.maxRadius;
      }

      this.knobRot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      const normDist = dist / this.maxRadius;
      if (normDist < this.deadzone) {
        this.rotInput.set(0, 0);
        return;
      }

      const factor = (normDist - this.deadzone) / (1.0 - this.deadzone);
      const dirX = dx / (dist || 1);
      const dirY = -dy / (dist || 1);

      // 🚀 線性靈敏輸出
      this.rotInput.x = dirX * factor;
      this.rotInput.y = dirY * factor;
    };

    this.zoneRot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activePointerId = e.pointerId;
      this.isRotActive = true; // 標記正在觸控姿態
      const rect = this.zoneRot.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      this.zoneRot.setPointerCapture(e.pointerId);
      handlePointer(e);
    });

    this.zoneRot.addEventListener('pointermove', (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        handlePointer(e);
      }
    });

    const reset = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        activePointerId = null;
        this.isRotActive = false; // 標記已放手
        this.rotInput.set(0, 0);
        this.knobRot.style.transform = 'translate(-50%, -50%)';
        try { this.zoneRot.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    this.zoneRot.addEventListener('pointerup', reset);
    this.zoneRot.addEventListener('pointercancel', reset);
  }
}
