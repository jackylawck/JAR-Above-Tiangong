// js/controls/touch_controls.js
import * as THREE from 'three';

export class DualTouchControls {
  constructor() {
    this.transInput = new THREE.Vector2(0, 0); // 平移 (X, Y)
    this.rotInput = new THREE.Vector2(0, 0);   // 姿態 (P, Y)
    
    this.zoneTrans = document.getElementById('zone-trans');
    this.knobTrans = document.getElementById('knob-trans');
    this.zoneRot = document.getElementById('zone-rot');
    this.knobRot = document.getElementById('knob-rot');

    this.maxRadius = 38;
    this.setupPointerControls();
  }

  setupPointerControls() {
    // 1. 左側平移搖桿
    if (this.zoneTrans && this.knobTrans) {
      let activePointerId = null;

      const handlePointer = (e) => {
        const rect = this.zoneTrans.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist > this.maxRadius) {
          dx = (dx / dist) * this.maxRadius;
          dy = (dy / dist) * this.maxRadius;
        }

        this.knobTrans.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        // 輸出向量 (-1 到 1)，推前 (dy < 0) 為 +Y
        this.transInput.x = dx / this.maxRadius;
        this.transInput.y = -dy / this.maxRadius;
      };

      this.zoneTrans.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activePointerId = e.pointerId;
        this.zoneTrans.setPointerCapture(e.pointerId);
        handlePointer(e);
      });

      this.zoneTrans.addEventListener('pointermove', (e) => {
        if (e.pointerId === activePointerId) {
          e.preventDefault();
          e.stopPropagation();
          handlePointer(e);
        }
      });

      const resetTrans = (e) => {
        if (e.pointerId === activePointerId) {
          e.preventDefault();
          e.stopPropagation();
          activePointerId = null;
          this.transInput.set(0, 0);
          this.knobTrans.style.transform = 'translate(-50%, -50%)';
          try { this.zoneTrans.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };

      this.zoneTrans.addEventListener('pointerup', resetTrans);
      this.zoneTrans.addEventListener('pointercancel', resetTrans);
    }

    // 2. 右側姿態搖桿
    if (this.zoneRot && this.knobRot) {
      let activePointerId = null;

      const handlePointer = (e) => {
        const rect = this.zoneRot.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist > this.maxRadius) {
          dx = (dx / dist) * this.maxRadius;
          dy = (dy / dist) * this.maxRadius;
        }

        this.knobRot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        this.rotInput.x = dx / this.maxRadius;
        this.rotInput.y = -dy / this.maxRadius;
      };

      this.zoneRot.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activePointerId = e.pointerId;
        this.zoneRot.setPointerCapture(e.pointerId);
        handlePointer(e);
      });

      this.zoneRot.addEventListener('pointermove', (e) => {
        if (e.pointerId === activePointerId) {
          e.preventDefault();
          e.stopPropagation();
          handlePointer(e);
        }
      });

      const resetRot = (e) => {
        if (e.pointerId === activePointerId) {
          e.preventDefault();
          e.stopPropagation();
          activePointerId = null;
          this.rotInput.set(0, 0);
          this.knobRot.style.transform = 'translate(-50%, -50%)';
          try { this.zoneRot.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };

      this.zoneRot.addEventListener('pointerup', resetRot);
      this.zoneRot.addEventListener('pointercancel', resetRot);
    }
  }
}
