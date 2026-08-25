// js/render/impact_effects.js
import * as THREE from 'three';

// 1. 純代碼發光粒子紋理 (Zero-Asset)
const createGlowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.6, 'rgba(255,200,150,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
};

// 2. 純代碼震波光環紋理 (Shockwave Ring)
const createShockwaveTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 40, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,120,50,0)');
  gradient.addColorStop(0.7, 'rgba(255,220,180,0.9)');
  gradient.addColorStop(1, 'rgba(255,50,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
};

const glowTexture = createGlowTexture();
const shockwaveTexture = createShockwaveTexture();

export class ImpactFXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isExploding = false;
    this.explosionTimer = 0;
    
    // 600 枚物理碎片粒子
    this.particleCount = 600;
    this.geo = new THREE.BufferGeometry();
    this.posArray = new Float32Array(this.particleCount * 3);
    this.velArray = new Float32Array(this.particleCount * 3);
    this.colArray = new Float32Array(this.particleCount * 3);
    this.sizeArray = new Float32Array(this.particleCount);
    this.lifeArray = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      this.posArray[i*3] = 0; this.posArray[i*3+1] = 0; this.posArray[i*3+2] = 0;
      this.velArray[i*3] = 0; this.velArray[i*3+1] = 0; this.velArray[i*3+2] = 0;
      this.colArray[i*3] = 1.0; this.colArray[i*3+1] = 0.3; this.colArray[i*3+2] = 0.05;
      this.sizeArray[i] = 0.5 + Math.random() * 3.0;
      this.lifeArray[i] = 0.5 + Math.random() * 1.0;
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colArray, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.sizeArray, 1));

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: glowTexture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (120.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        void main() {
          vec4 texColor = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor, texColor.a * 0.95);
          if (gl_FragColor.a < 0.01) discard;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(this.geo, this.mat);
    this.scene.add(this.particles);

    // 核心閃光 Sprite
    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = 256; flashCanvas.height = 256;
    const ctx = flashCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 230, 200, 1)');
    grad.addColorStop(0.3, 'rgba(255, 120, 30, 0.8)');
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const flashTex = new THREE.CanvasTexture(flashCanvas);
    
    this.flashSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ 
        map: flashTex, 
        blending: THREE.AdditiveBlending, 
        depthWrite: false,
        transparent: true,
        opacity: 0
      })
    );
    this.flashSprite.scale.set(120, 120, 1);
    this.scene.add(this.flashSprite);

    // 🚀 二次衝擊波環 (Shockwave Ring Sprite)
    this.shockwaveSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: shockwaveTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0
      })
    );
    this.shockwaveSprite.scale.set(10, 10, 1);
    this.scene.add(this.shockwaveSprite);
  }

  triggerCatastrophicFailure(pos, callback) {
    this.isExploding = true;
    this.explosionTimer = 0;
    
    this.flashSprite.position.copy(pos);
    this.flashSprite.material.opacity = 1.0;

    this.shockwaveSprite.position.copy(pos);
    this.shockwaveSprite.material.opacity = 0.95;
    this.shockwaveSprite.scale.set(8, 8, 1);

    const p = this.geo.attributes.position.array;
    const c = this.geo.attributes.color.array;
    const s = this.geo.attributes.size.array;

    for (let i = 0; i < this.particleCount; i++) {
      p[i*3] = pos.x + (Math.random() - 0.5) * 1.5;
      p[i*3+1] = pos.y + (Math.random() - 0.5) * 1.5;
      p[i*3+2] = pos.z + (Math.random() - 0.5) * 1.5;

      const speed = 8.0 + Math.random() * 32.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      this.velArray[i*3] = speed * Math.sin(phi) * Math.cos(theta);
      this.velArray[i*3+1] = speed * Math.sin(phi) * Math.sin(theta);
      this.velArray[i*3+2] = speed * Math.cos(phi);

      const temp = Math.random();
      if (temp < 0.4) {
        c[i*3] = 1.0; c[i*3+1] = 0.95; c[i*3+2] = 0.7; // 熾熱核心白
      } else if (temp < 0.7) {
        c[i*3] = 1.0; c[i*3+1] = 0.75; c[i*3+2] = 0.2; // 高溫亮金
      } else {
        c[i*3] = 0.9; c[i*3+1] = 0.95; c[i*3+2] = 1.0; // 金屬白熾碎片
      }
      
      s[i] = 0.8 + Math.random() * 4.5;
      this.lifeArray[i] = 0.4 + Math.random() * 1.6;
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;

    if (navigator.vibrate) navigator.vibrate([300, 100, 400, 150, 500]);
    if (callback) setTimeout(callback, 2500);
  }

  update(dt) {
    if (!this.isExploding) return;
    this.explosionTimer += dt;

    const p = this.geo.attributes.position.array;
    const c = this.geo.attributes.color.array;
    const s = this.geo.attributes.size.array;
    const life = this.lifeArray;
    const totalLife = 2.4;

    // 1. 核心閃光快速擴散並衰減
    this.flashSprite.material.opacity = Math.max(0, 1.0 - this.explosionTimer / 0.35);
    this.flashSprite.scale.setScalar(120 * (1 + this.explosionTimer * 2.2));

    // 2. 🚀 衝擊波環快速膨脹衰減
    const shockProgress = Math.min(1.0, this.explosionTimer / 0.6);
    this.shockwaveSprite.material.opacity = Math.max(0, (1.0 - shockProgress) * 0.95);
    this.shockwaveSprite.scale.setScalar(8.0 + shockProgress * 45.0);

    // 3. 粒子冷卻與物理阻尼
    let allDead = true;
    for (let i = 0; i < this.particleCount; i++) {
      p[i*3] += this.velArray[i*3] * dt;
      p[i*3+1] += this.velArray[i*3+1] * dt;
      p[i*3+2] += this.velArray[i*3+2] * dt;
      this.velArray[i*3] *= 0.97;
      this.velArray[i*3+1] *= 0.97;
      this.velArray[i*3+2] *= 0.97;

      const age = this.explosionTimer / life[i];
      if (age < 1.0) {
        allDead = false;
        // 黑體輻射冷卻：白(1,1,1) -> 黃(1,0.8,0.2) -> 橙紅(1,0.3,0.0) -> 暗灰(0.2,0.2,0.2)
        const tempCurve = 1.0 - age;
        const r = 0.2 + 0.8 * tempCurve;
        const g = 0.1 + 0.9 * Math.pow(tempCurve, 1.5);
        const b = 0.1 + 0.9 * Math.pow(tempCurve, 3.0);
        c[i*3] = Math.min(1, r);
        c[i*3+1] = Math.min(1, g * 0.8);
        c[i*3+2] = Math.min(1, b * 0.4);
      } else {
        c[i*3] *= 0.95;
        c[i*3+1] *= 0.95;
        c[i*3+2] *= 0.95;
        s[i] *= 0.98;
      }
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;

    if (allDead || this.explosionTimer > totalLife) {
      this.isExploding = false;
      this.mat.opacity = 0;
      this.flashSprite.material.opacity = 0;
      this.shockwaveSprite.material.opacity = 0;
    }
  }
}
