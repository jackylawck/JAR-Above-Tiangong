// js/render/impact_effects.js
import * as THREE from 'three';

export class ImpactFXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isExploding = false;
    this.shakeIntensity = 0;
    this.origCamPos = new THREE.Vector3();

    // 碎片爆炸粒子系統
    this.particleCount = 200;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = [];

    for (let i = 0; i < this.particleCount; i++) {
      this.velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      ));
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.PointsMaterial({
      color: 0xff4422,
      size: 0.8,
      transparent: true,
      opacity: 0
    });
    this.debrisMesh = new THREE.Points(this.geo, this.mat);
    this.scene.add(this.debrisMesh);
  }

  // 觸發解體碰撞
  triggerCatastrophicFailure(contactPos, onRebootCallback) {
    if (this.isExploding) return;
    this.isExploding = true;
    this.shakeIntensity = 0.6;
    this.mat.opacity = 1.0;

    // 將所有碎片集中在接觸點
    const posArr = this.geo.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      posArr[i * 3] = contactPos.x;
      posArr[i * 3 + 1] = contactPos.y;
      posArr[i * 3 + 2] = contactPos.z;
    }
    this.geo.attributes.position.needsUpdate = true;

    // 3 秒後自動執行系統重啟
    setTimeout(() => {
      this.isExploding = false;
      this.mat.opacity = 0;
      if (onRebootCallback) onRebootCallback();
    }, 3200);
  }

  // 在主迴圈中每幀更新
  update(dt) {
    // 鏡頭劇烈震顫 (Screen Shake)
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.92;
    }

    // 碎片擴散運動
    if (this.isExploding) {
      const posArr = this.geo.attributes.position.array;
      for (let i = 0; i < this.particleCount; i++) {
        posArr[i * 3] += this.velocities[i].x * dt;
        posArr[i * 3 + 1] += this.velocities[i].y * dt;
        posArr[i * 3 + 2] += this.velocities[i].z * dt;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.mat.opacity = Math.max(0, this.mat.opacity - 0.3 * dt);
    }
  }
}
