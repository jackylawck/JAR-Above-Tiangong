// js/render/impact_effects.js
import * as THREE from 'three';

export class ImpactFXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isExploding = false;
    this.explosionTimer = 0;
    
    // 800 枚高能金屬碎片與火光粒子
    this.particleCount = 800;
    this.geo = new THREE.BufferGeometry();
    this.posArray = new Float32Array(this.particleCount * 3);
    this.velArray = new Float32Array(this.particleCount * 3);
    this.colArray = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      this.posArray[i*3] = 0; this.posArray[i*3+1] = 0; this.posArray[i*3+2] = 0;
      this.velArray[i*3] = 0; this.velArray[i*3+1] = 0; this.velArray[i*3+2] = 0;
      this.colArray[i*3] = 1.0; this.colArray[i*3+1] = 0.3; this.colArray[i*3+2] = 0.05;
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colArray, 3));

    this.mat = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(this.geo, this.mat);
    this.scene.add(this.particles);

    // 爆炸全螢幕閃紅光層
    this.flashLight = new THREE.PointLight(0xff3300, 0, 80);
    this.scene.add(this.flashLight);
  }

  triggerCatastrophicFailure(pos, callback) {
    this.isExploding = true;
    this.explosionTimer = 0;
    this.mat.opacity = 1.0;
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 15.0;

    const p = this.geo.attributes.position.array;
    const c = this.geo.attributes.color.array;

    for (let i = 0; i < this.particleCount; i++) {
      p[i*3] = pos.x;
      p[i*3+1] = pos.y;
      p[i*3+2] = pos.z;

      const speed = 5.0 + Math.random() * 25.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      this.velArray[i*3] = speed * Math.sin(phi) * Math.cos(theta);
      this.velArray[i*3+1] = speed * Math.sin(phi) * Math.sin(theta);
      this.velArray[i*3+2] = speed * Math.cos(phi);

      const r = Math.random();
      if (r < 0.5) {
        c[i*3] = 1.0; c[i*3+1] = 0.2; c[i*3+2] = 0.0; // 烈焰紅
      } else if (r < 0.8) {
        c[i*3] = 1.0; c[i*3+1] = 0.8; c[i*3+2] = 0.1; // 熾熱金
      } else {
        c[i*3] = 0.8; c[i*3+1] = 0.9; c[i*3+2] = 1.0; // 金屬白熾碎片
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;

    if (navigator.vibrate) navigator.vibrate([300, 100, 400, 150, 500]);
    if (callback) setTimeout(callback, 2200);
  }

  update(dt) {
    if (!this.isExploding) return;
    this.explosionTimer += dt;

    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      p[i*3] += this.velArray[i*3] * dt;
      p[i*3+1] += this.velArray[i*3+1] * dt;
      p[i*3+2] += this.velArray[i*3+2] * dt;
      this.velArray[i*3] *= 0.96;
      this.velArray[i*3+1] *= 0.96;
      this.velArray[i*3+2] *= 0.96;
    }
    this.geo.attributes.position.needsUpdate = true;

    this.mat.opacity = Math.max(0, 1.0 - this.explosionTimer / 2.0);
    this.flashLight.intensity = Math.max(0, (1.0 - this.explosionTimer / 0.8) * 15.0);

    if (this.explosionTimer > 2.2) {
      this.isExploding = false;
      this.mat.opacity = 0;
    }
  }
}
