// js/controls/touch_controls.js
import * as THREE from 'three';

export class DualTouchControls {
  constructor() {
    this.transInput = new THREE.Vector2(); // 平移輸入 (X/Y)
    this.rotInput = new THREE.Vector2();   // 姿態輸入 (P/Y)
    
    this.zoneTrans = document.getElementById('zone-trans');
    this.knobTrans = document.getElementById('knob-trans');
    this.zoneRot = document.getElementById('zone-rot');
    this.knobRot = document.getElementById('knob-rot');

    this.maxRadius = 38; // 搖桿半徑
    this.deadZone = 0.12; // 12% 物理死區，防止手指微顫造成漂移
    this.transTouchId = null;
    this.rotTouchId = null;

    this.initEvents();
  }

  initEvents() {
    // 平移搖桿
    if (this.zoneTrans) {
      this.zoneTrans.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.transTouchId = touch.identifier;
        this.updateJoystick(touch, this.zoneTrans, this.knobTrans, this.transInput, false);
      }, { passive: false });

      this.zoneTrans.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.transTouchId) {
            this.updateJoystick(e.changedTouches[i], this.zoneTrans, this.knobTrans, this.transInput, false);
          }
        }
      }, { passive: false });

      const resetTrans = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.transTouchId) {
            this.transTouchId = null;
            this.transInput.set(0, 0);
            this.knobTrans.style.transform = 'translate(-50%, -50%)';
          }
        }
      };
      this.zoneTrans.addEventListener('touchend', resetTrans);
      this.zoneTrans.addEventListener('touchcancel', resetTrans);
    }

    // 姿態搖桿 (高精度細膩控制)
    if (this.zoneRot) {
      this.zoneRot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.rotTouchId = touch.identifier;
        this.updateJoystick(touch, this.zoneRot, this.knobRot, this.rotInput, true);
      }, { passive: false });

      this.zoneRot.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.rotTouchId) {
            this.updateJoystick(e.changedTouches[i], this.zoneRot, this.knobRot, this.rotInput, true);
          }
        }
      }, { passive: false });

      const resetRot = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.rotTouchId) {
            this.rotTouchId = null;
            this.rotInput.set(0, 0);
            this.knobRot.style.transform = 'translate(-50%, -50%)';
          }
        }
      };
      this.zoneRot.addEventListener('touchend', resetRot);
      this.zoneRot.addEventListener('touchcancel', resetRot);
    }
  }

  updateJoystick(touch, zone, knob, outVector, isRotation) {
    const rect = zone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > this.maxRadius) {
      dx = (dx / dist) * this.maxRadius;
      dy = (dy / dist) * this.maxRadius;
    }

    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    let normX = dx / this.maxRadius;
    let normY = -dy / this.maxRadius;
    const normDist = Math.hypot(normX, normY);

    if (normDist < this.deadZone) {
      outVector.set(0, 0);
    } else {
      // 二次方平滑曲線 (Expo Curve)：輕推微調，推到底全推力
      const factor = (normDist - this.deadZone) / (1.0 - this.deadZone);
      const curvedSpeed = factor * factor; // 柔和響應
      outVector.set((normX / normDist) * curvedSpeed, (normY / normDist) * curvedSpeed);
    }
  }
}
