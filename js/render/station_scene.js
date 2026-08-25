// js/render/station_scene.js
import * as THREE from 'three';

export function setupStationScene() {
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);

  // 1. 光照系統
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
  sunLight.position.set(200, 100, 150);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x223344, 1.2);
  scene.add(ambientLight);

  // 2. 星空背景 (純 Canvas 生成星點)
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1200;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    starPos[i] = (Math.random() - 0.5) * 3000;
    starPos[i + 1] = (Math.random() - 0.5) * 3000;
    starPos[i + 2] = (Math.random() - 0.5) * 3000;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.9 });
  scene.add(new THREE.Points(starGeo, starMat));

  // 3. 純代碼程序化生成地球貼圖 (零外鏈，絕不當機)
  function createProceduralEarthTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d');

    // 海洋底色
    ctx.fillStyle = '#0d2b45';
    ctx.fillRect(0, 0, 1024, 512);

    // 陸地板塊
    ctx.fillStyle = '#206a5d';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = 40 + Math.random() * 90;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 雲層
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const rx = 60 + Math.random() * 120;
      const ry = 15 + Math.random() * 30;
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    return new THREE.CanvasTexture(c);
  }

  // 地球本體
  const earthRadius = 350;
  const earthMat = new THREE.MeshStandardMaterial({
    map: createProceduralEarthTexture(),
    roughness: 0.8,
    metalness: 0.1
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 48, 48), earthMat);
  earth.position.set(0, -420, -50);
  scene.add(earth);

  // 大氣層發光外圈
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.25,
    side: THREE.BackSide
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.04, 48, 48), atmoMat);
  atmosphere.position.copy(earth.position);
  scene.add(atmosphere);

  // 4. 天宮空間站組合體 (T 字型高亮實體)
  const station = new THREE.Group();
  const mliWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.2 });
  const mliGold = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9, roughness: 0.1 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x0a3d62, metalness: 0.95, roughness: 0.1 });

  // 天和核心艙
  const ccm = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 14, 32), mliWhite);
  ccm.rotation.x = Math.PI / 2;
  const node = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 32), mliGold);
  node.position.z = 8;
  const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  targetRing.position.z = 9.5;
  station.add(ccm, node, targetRing);

  // 問天 / 夢天 實驗艙
  const wentian = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 10, 32), mliWhite);
  wentian.rotation.z = Math.PI / 2;
  wentian.position.set(-6.5, 0, 5);
  const mengtian = wentian.clone();
  mengtian.position.set(6.5, 0, 5);
  station.add(wentian, mengtian);

  // 雙側大型太陽翼
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 4), solarMat);
  panelL.position.set(-19, 0, 5);
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 4), solarMat);
  panelR.position.set(19, 0, 5);
  station.add(panelL, panelR);

  scene.add(station);

  return { renderer, scene, camera, targetRingPos: new THREE.Vector3(0, 0, 9.5) };
}
