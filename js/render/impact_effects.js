// js/render/impact_effects.js
import * as THREE from 'three';

export class ImpactFXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isExploding = false;
    this.shakeIntensity = 0;

    // 120 條高溫金屬拉絲線段 (共 240 個頂點)
    this.particleCount = 120;
    this.positions = new Float32Array(this.particleCount * 6);
    
    // ==========================================
    // 極致優化：預先分配所有速度向量 (Zero Allocation)
    // ==========================================
    this.velocities = new Array(this.particleCount);
    for (let i = 0; i < this.particleCount; i++) {
      this.velocities[i] = new THREE.Vector3();
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    
    this.mat = new THREE.LineBasicMaterial({
      color: 0xff4411,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    
    this.debrisMesh = new THREE.LineSegments(this.geo, this.mat);
    this.scene.add(this.debrisMesh);
  }

  // 觸發結構解體與衝擊
  triggerCatastrophicFailure(contactPos, onRebootCallback) {
    if (this.isExploding) return;
    this.isExploding = true;
    this.shakeIntensity = 0.9;
    this.mat.opacity = 1.0;

    const pos = this.geo.attributes.position.array;

    for (let i = 0; i < this.particleCount; i++) {
      // 球形隨機散射速度 (10 ~ 25 m/s)
      const speed = 10 + Math.random() * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      // 優化 1：In-place 更新，絕不使用 new THREE.Vector3
      this.velocities[i].set(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi)
      );

      // 起點與終點重合於撞擊點
      const idx = i * 6;
      pos[idx]     = contactPos.x; pos[idx + 1] = contactPos.y; pos[idx + 2] = contactPos.z;
      pos[idx + 3] = contactPos.x; pos[idx + 4] = contactPos.y; pos[idx + 5] = contactPos.z;
    }
    this.geo.attributes.position.needsUpdate = true;

    // 3.2 秒後淡出並觸發重啟
    setTimeout(() => {
      this.isExploding = false;
      this.mat.opacity = 0;
      if (onRebootCallback) onRebootCallback();
    }, 3200);
  }

  update(dt) {
    // 多軸向劇烈鏡頭晃動 + 輕微 Roll 滾轉
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.rotation.z += (Math.random() - 0.5) * this.shakeIntensity * 0.05;
      this.shakeIntensity *= 0.90; // 指數衰減
    }

    // 拉絲破片飛行與長度動態延展
    if (this.isExploding) {
      const pos = this.geo.attributes.position.array;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 6;
        const v = this.velocities[i];

        // 終點前衝
        pos[idx + 3] += v.x * dt;
        pos[idx + 4] += v.y * dt;
        pos[idx + 5] += v.z * dt;

        // 起點以 0.72 倍速追隨，形成高速拉絲拖尾
        pos[idx]     += v.x * dt * 0.72;
        pos[idx + 1] += v.y * dt * 0.72;
        pos[idx + 2] += v.z * dt * 0.72;

        // 微小空間阻尼
        v.multiplyScalar(0.985);
      }
      this.geo.attributes.position.needsUpdate = true;
      this.mat.opacity = Math.max(0, this.mat.opacity - 0.30 * dt);
    }
  }
}
