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

    this.maxRadius = 36;
    this.transTouchId = null;
    this.rotTouchId = null;

    this.initEvents();
  }

  initEvents() {
    // 監聽平移區域 (左側)
    if (this.zoneTrans) {
      const onTransStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (this.transTouchId === null) {
            this.transTouchId = t.identifier;
            this.processTouch(t, this.zoneTrans, this.knobTrans, this.transInput);
            break;
          }
        }
      };

      const onTransMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.transTouchId) {
            this.processTouch(t, this.zoneTrans, this.knobTrans, this.transInput);
            break;
          }
        }
      };

      const onTransEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.transTouchId) {
            this.transTouchId = null;
            this.transInput.set(0, 0);
            this.knobTrans.style.transform = 'translate(-50%, -50%)';
            break;
          }
        }
      };

      this.zoneTrans.addEventListener('touchstart', onTransStart, { passive: false });
      this.zoneTrans.addEventListener('touchmove', onTransMove, { passive: false });
      this.zoneTrans.addEventListener('touchend', onTransEnd, { passive: false });
      this.zoneTrans.addEventListener('touchcancel', onTransEnd, { passive: false });
    }

    // 監聽姿態區域 (右側)
    if (this.zoneRot) {
      const onRotStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (this.rotTouchId === null) {
            this.rotTouchId = t.identifier;
            this.processTouch(t, this.zoneRot, this.knobRot, this.rotInput);
            break;
          }
        }
      };

      const onRotMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.rotTouchId) {
            this.processTouch(t, this.zoneRot, this.knobRot, this.rotInput);
            break;
          }
        }
      };

      const onRotEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.rotTouchId) {
            this.rotTouchId = null;
            this.rotInput.set(0, 0);
            this.knobRot.style.transform = 'translate(-50%, -50%)';
            break;
          }
        }
      };

      this.zoneRot.addEventListener('touchstart', onRotStart, { passive: false });
      this.zoneRot.addEventListener('touchmove', onRotMove, { passive: false });
      this.zoneRot.addEventListener('touchend', onRotEnd, { passive: false });
      this.zoneRot.addEventListener('touchcancel', onRotEnd, { passive: false });
    }
  }

  processTouch(touch, zone, knob, outVector) {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > this.maxRadius) {
      dx = (dx / dist) * this.maxRadius;
      dy = (dy / dist) * this.maxRadius;
    }

    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // 向量輸出：X 軸 [-1, 1], Y 軸 [-1, 1] (推前為正 Y)
    outVector.x = dx / this.maxRadius;
    outVector.y = -dy / this.maxRadius;
  }
}