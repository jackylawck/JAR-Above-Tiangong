// js/render/station_scene.js
import * as THREE from 'three';

export function setupStationScene() {
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);

  // 主太陽光照 (銳利無散射硬陰影)
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  sunLight.position.set(200, 100, 150);
  scene.add(sunLight);

  // 地球大氣冷色反照 (Earthshine)
  const earthshine = new THREE.HemisphereLight(0x0a1020, 0x1d5599, 1.4);
  scene.add(earthshine);

  // 星空背景粒子
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    starPos[i] = (Math.random() - 0.5) * 3000;
    starPos[i+1] = (Math.random() - 0.5) * 3000;
    starPos[i+2] = (Math.random() - 0.5) * 3000;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(starGeo, starMat));

  // --- 地球本體與雲層 ---
  const earthGroup = new THREE.Group();
  const earthRadius = 320;
  const textureLoader = new THREE.TextureLoader();
  
  // NASA Blue Marble 地球貼圖 (使用 CDN 輕量圖源)
  const earthMap = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const earthMat = new THREE.MeshStandardMaterial({
    map: earthMap,
    roughness: 0.7,
    metalness: 0.1
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 64, 64), earthMat);
  earth.position.set(0, -410, 0);
  earthGroup.add(earth);

  // --- 大氣層 Fresnel 邊緣光 Glow Shader ---
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPositionEye;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPositionEye = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPositionEye;
      void main() {
        vec3 viewDir = normalize(-vPositionEye);
        float fresnel = dot(viewDir, vNormal);
        fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
        float intensity = pow(fresnel, 3.0) * 1.6;
        gl_FragColor = vec4(0.25, 0.65, 1.0, 1.0) * intensity;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.03, 64, 64), atmoMat);
  atmosphere.position.copy(earth.position);
  earthGroup.add(atmosphere);
  scene.add(earthGroup);

  // --- 天宮空間站細化模型 ---
  const station = new THREE.Group();
  const mliWhite = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.8, roughness: 0.25 });
  const mliGold = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.2 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x051a33, metalness: 0.95, roughness: 0.1 });

  // 天和核心艙
  const ccm = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 14, 32), mliWhite);
  ccm.rotation.x = Math.PI / 2;
  const node = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 32), mliGold);
  node.position.z = 8;
  const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  targetRing.position.z = 9.5;
  station.add(ccm, node, targetRing);

  // 問天 / 夢天 實驗艙
  const wentian = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 10, 32), mliWhite);
  wentian.rotation.z = Math.PI / 2;
  wentian.position.set(-6.5, 0, 5);
  const mengtian = wentian.clone();
  mengtian.position.set(6.5, 0, 5);
  station.add(wentian, mengtian);

  // 雙側大型柔性太陽翼
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 4), solarMat);
  panelL.position.set(-18, 0, 5);
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 4), solarMat);
  panelR.position.set(18, 0, 5);
  station.add(panelL, panelR);

  scene.add(station);

  return { renderer, scene, camera, targetRingPos: new THREE.Vector3(0, 0, 9.5) };
}
