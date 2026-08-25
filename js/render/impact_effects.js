// js/render/impact_effects.js
import * as THREE from 'three';

export class ImpactFXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isExploding = false;
    this.shakeIntensity = 0;

    // 使用 LineSegments 模擬帶有拖尾與拉伸的高速金屬破片
    this.particleCount = 120;
    this.positions = new Float32Array(this.particleCount * 6); // 每條線 2 個頂點 (6 個 float)
    this.velocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      this.velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22
      ));
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.LineBasicMaterial({
      color: 0xff5522,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    this.debrisMesh = new THREE.LineSegments(this.geo, this.mat);
    this.scene.add(this.debrisMesh);
  }

  triggerCatastrophicFailure(contactPos, onRebootCallback) {
    if (this.isExploding) return;
    this.isExploding = true;
    this.shakeIntensity = 0.8;
    this.mat.opacity = 1.0;

    const pos = this.geo.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 6;
      pos[idx] = contactPos.x;     pos[idx + 1] = contactPos.y;     pos[idx + 2] = contactPos.z;
      pos[idx + 3] = contactPos.x; pos[idx + 4] = contactPos.y; pos[idx + 5] = contactPos.z;
    }
    this.geo.attributes.position.needsUpdate = true;

    setTimeout(() => {
      this.isExploding = false;
      this.mat.opacity = 0;
      if (onRebootCallback) onRebootCallback();
    }, 3200);
  }

  update(dt) {
    // 鏡頭劇烈震顫
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.90;
    }

    // 更新高速拉絲線段
    if (this.isExploding) {
      const pos = this.geo.attributes.position.array;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 6;
        const v = this.velocities[i];

        // 終點向前衝
        pos[idx + 3] += v.x * dt;
        pos[idx + 4] += v.y * dt;
        pos[idx + 5] += v.z * dt;

        // 起點以 0.7 倍速度延遲跟隨形成高速拖尾
        pos[idx] += v.x * dt * 0.7;
        pos[idx + 1] += v.y * dt * 0.7;
        pos[idx + 2] += v.z * dt * 0.7;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.mat.opacity = Math.max(0, this.mat.opacity - 0.32 * dt);
    }
  }
}
