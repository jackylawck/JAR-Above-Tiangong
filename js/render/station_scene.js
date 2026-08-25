// js/render/station_scene.js
import * as THREE from 'three';

// ==========================================
// 1. 程序化紋理生成器 (Zero-Asset)
// ==========================================
const getMoonTexture = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, 1024, 512);
    
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 40;
      const brightness = 80 + Math.random() * 80;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      ctx.fill();
      if (r > 10) {
        ctx.beginPath();
        ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,0.08)`;
        ctx.fill();
      }
    }
    cache = new THREE.CanvasTexture(c);
    return cache;
  };
})();

const getSunGlowTexture = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 240, 200, 1)');
    grad.addColorStop(0.05, 'rgba(255, 200, 120, 1)');
    grad.addColorStop(0.3, 'rgba(255, 160, 60, 0.6)');
    grad.addColorStop(0.7, 'rgba(255, 100, 20, 0.2)');
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    cache = new THREE.CanvasTexture(c);
    return cache;
  };
})();

function createMLITexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 128; y += 4) {
    const bright = (y % 16 < 8) ? 180 : 220;
    const gold = (y % 24 < 12) ? 0.15 : 0.0;
    ctx.fillStyle = `rgb(${bright}, ${bright - 20 + gold * 60}, ${bright - 40 + gold * 80})`;
    ctx.fillRect(0, y, 256, 4);
  }
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const len = 4 + Math.random() * 20;
    ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.5, y + len * 0.3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

const mliTexture = createMLITexture();

// ==========================================
// 2. 輔助函數：邊緣發光與加強肋
// ==========================================
function addEdgeGlow(mesh, color = 0x00ccff, opacity = 0.3, thresholdAngle = 15) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  mesh.add(new THREE.LineSegments(edges, mat));
  return mesh;
}

function createRib(radius, thickness, width, color = 0xc8d0d8) {
  const geo = new THREE.TorusGeometry(radius, thickness, 16, 32);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(1, 1, width / (radius * 0.2));
  return addEdgeGlow(mesh, 0x4488ff, 0.2);
}

// ==========================================
// 3. 主場景設置
// ==========================================
export function setupStationScene() {
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010103);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);

  // --- 3.1 光照系統 ---
  const sunDir = new THREE.Vector3(1.0, 0.4, 0.8).normalize();
  const sunLight = new THREE.DirectionalLight(0xffeedd, 4.0);
  sunLight.position.copy(sunDir).multiplyScalar(300);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x0a1525, 0.4));

  // --- 3.2 太陽與脈動日冕 ---
  const sunGroup = new THREE.Group();
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(14, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffeedd })
  );
  sunMesh.position.copy(sunDir).multiplyScalar(900);
  sunGroup.add(sunMesh);
  
  const coronaMat = new THREE.SpriteMaterial({
    map: getSunGlowTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85
  });
  const corona = new THREE.Sprite(coronaMat);
  corona.scale.set(180, 180, 1);
  corona.position.copy(sunMesh.position);
  sunGroup.add(corona);
  scene.add(sunGroup);

  // --- 3.3 彩色星空 ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3500;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 1400 + Math.random() * 1600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);
    
    const temp = Math.random();
    if (temp < 0.3) { starCol[i*3] = 0.8; starCol[i*3+1] = 0.85; starCol[i*3+2] = 1.0; } 
    else if (temp < 0.6) { starCol[i*3] = 1.0; starCol[i*3+1] = 0.95; starCol[i*3+2] = 0.8; } 
    else { starCol[i*3] = 1.0; starCol[i*3+1] = 0.5; starCol[i*3+2] = 0.3; } 
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.2, vertexColors: true, transparent: true, opacity: 0.95 })));

  // --- 3.4 電影級著色器地球 ---
  const earthRadius = 350;
  const earthShaderMat = new THREE.ShaderMaterial({
    uniforms: { uSunDirection: { value: sunDir }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection; uniform float uTime;
      varying vec3 vNormal; varying vec3 vPosition;
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z.xxxx);
        vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      float fbm(vec3 p) {
        float v = 0.0; float a = 0.5; vec3 shift = vec3(100);
        for (int i = 0; i < 4; ++i) { v += a * snoise(p); p = p * 2.0 + shift; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 normPos = normalize(vPosition);
        float n = fbm(normPos * 2.6);
        vec3 color;
        float isLand = step(0.02, n);
        if (isLand < 0.5) {
          float depth = smoothstep(-0.4, 0.02, n);
          color = mix(vec3(0.005, 0.03, 0.15), vec3(0.0, 0.28, 0.48), depth);
        } else {
          float elevation = smoothstep(0.02, 0.5, n);
          color = mix(vec3(0.02, 0.14, 0.04), vec3(0.28, 0.22, 0.12), elevation);
          color = mix(color, vec3(0.75, 0.8, 0.85), smoothstep(0.35, 0.6, n));
        }
        float poleMask = smoothstep(0.7, 0.95, abs(normPos.y));
        float iceNoise = fbm(normPos * 12.0);
        color = mix(color, vec3(0.88, 0.92, 0.96), poleMask * (0.5 + 0.5 * iceNoise));
        float NdotL = dot(vNormal, uSunDirection);
        float diffuse = max(0.0, (NdotL + 0.15) / 1.15);
        float terminator = smoothstep(-0.25, 0.15, NdotL) * smoothstep(0.15, -0.25, NdotL);
        vec3 sunsetGlow = vec3(0.9, 0.28, 0.08) * terminator * 1.3;
        float cityGlow = 0.0;
        if (NdotL < 0.0 && isLand > 0.5 && poleMask < 0.1) {
          float cityNoise = snoise(normPos * 45.0 + vec3(0, uTime * 0.001, 0));
          cityGlow = step(0.72, cityNoise) * smoothstep(0.0, -0.25, NdotL) * 2.2;
        }
        vec3 finalColor = color * (diffuse + 0.03);
        finalColor += sunsetGlow;
        finalColor += vec3(1.0, 0.78, 0.28) * cityGlow * 2.5;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 64, 64), earthShaderMat);
  earth.position.set(0, -420, -50);
  scene.add(earth);

  // --- 3.5 月球 ---
  const moonMat = new THREE.MeshStandardMaterial({
    map: getMoonTexture(),
    roughness: 0.95,
    metalness: 0.02,
    emissive: 0x111115
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 36, 36), moonMat);
  moon.position.set(-650, 380, -1100);
  scene.add(moon);

  // --- 3.6 雙層雲 ---
  const cloudTex = (() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 512; y += 2) {
      for (let x = 0; x < 1024; x += 2) {
        const val = Math.sin(x * 0.02 + y * 0.01) * Math.cos(y * 0.02 - x * 0.01);
        const alpha = Math.max(0, Math.min(1, (val * 0.5 + 0.5) * 1.6 - 0.5));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.75})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    return new THREE.CanvasTexture(c);
  })();

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.012, 64, 64),
    new THREE.MeshLambertMaterial({ map: cloudTex, transparent: true, blending: THREE.NormalBlending, side: THREE.FrontSide, depthWrite: false, opacity: 0.4 })
  );
  clouds.position.copy(earth.position);
  scene.add(clouds);

  const clouds2 = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.022, 64, 64),
    new THREE.MeshLambertMaterial({ map: cloudTex, transparent: true, blending: THREE.NormalBlending, side: THREE.FrontSide, depthWrite: false, opacity: 0.18 })
  );
  clouds2.position.copy(earth.position);
  scene.add(clouds2);

  // --- 3.7 大氣層 ---
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.04, 64, 64),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal; varying vec3 vViewPosition;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal; varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float rim = 1.0 - max(0.0, dot(normal, viewDir));
          float intensity = smoothstep(0.5, 1.0, rim);
          gl_FragColor = vec4(0.18, 0.52, 1.0, intensity * 0.85);
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false
    })
  );
  atmosphere.position.copy(earth.position);
  scene.add(atmosphere);

  // ==========================================
  // 4. 🛰️ 天宮空間站 — Bandai PG 級旗艦細節重構
  // ==========================================
  const station = new THREE.Group();

  // ---------- 材質 ----------
  const matMLI = new THREE.MeshStandardMaterial({
    map: mliTexture,
    metalness: 0.3,
    roughness: 0.5,
    color: 0xe8ecf0
  });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, metalness: 0.4, roughness: 0.3 });
  const matGrey = new THREE.MeshStandardMaterial({ color: 0x7a8b9c, metalness: 0.6, roughness: 0.3 });
  const matSolar = new THREE.MeshStandardMaterial({
    color: 0x031a3a,
    metalness: 0.95,
    roughness: 0.05,
    emissive: 0x001133,
    emissiveIntensity: 0.15
  });
  const matSolarFrame = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, metalness: 0.8, roughness: 0.2 });

  // ---------- 核心艙（天和） ----------
  const coreGroup = new THREE.Group();

  // 大柱段（後端）
  const mainBody = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 5.5, 32), matMLI);
  mainBody.rotation.x = Math.PI / 2;
  mainBody.position.z = 3.0;
  addEdgeGlow(mainBody, 0x4488ff, 0.2);
  coreGroup.add(mainBody);

  const rib1 = createRib(2.5, 0.06, 0.3, 0xaabbcc);
  rib1.position.z = 4.5;
  coreGroup.add(rib1);
  const rib2 = createRib(2.5, 0.06, 0.3, 0xaabbcc);
  rib2.position.z = 1.5;
  coreGroup.add(rib2);

  // 小柱段（前端）
  const smallBody = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4.0, 32), matWhite);
  smallBody.rotation.x = Math.PI / 2;
  smallBody.position.z = -2.5;
  addEdgeGlow(smallBody, 0x44aaff, 0.25);
  coreGroup.add(smallBody);

  const rib3 = createRib(1.8, 0.05, 0.25, 0x8899aa);
  rib3.position.z = -1.0;
  coreGroup.add(rib3);
  const rib4 = createRib(1.8, 0.05, 0.25, 0x8899aa);
  rib4.position.z = -4.0;
  coreGroup.add(rib4);

  // 過渡錐段
  const coneGeo = new THREE.CylinderGeometry(1.8, 2.4, 1.2, 32);
  const cone = new THREE.Mesh(coneGeo, matGrey);
  cone.rotation.x = Math.PI / 2;
  cone.position.z = 0.6;
  addEdgeGlow(cone, 0x6688aa, 0.15);
  coreGroup.add(cone);

  // ---------- 節點艙（金色多面體） ----------
  const nodeGroup = new THREE.Group();
  const nodeSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 })
  );
  addEdgeGlow(nodeSphere, 0xffaa00, 0.4);
  nodeGroup.add(nodeSphere);

  // 4 個對接口環
  const portPositions = [
    [0, 0, -2.8, 0, 0, 0],
    [0, 0, 2.8, 0, 0, Math.PI],
    [-2.8, 0, 0, 0, Math.PI/2, 0],
    [2.8, 0, 0, 0, -Math.PI/2, 0]
  ];
  portPositions.forEach(([x, y, z, rx, ry, rz]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.06, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.7, roughness: 0.3 })
    );
    ring.position.set(x, y, z);
    ring.rotation.set(rx, ry, rz);
    addEdgeGlow(ring, 0x66ccff, 0.3);
    nodeGroup.add(ring);

    const coneSmall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.7, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: 0x667788, metalness: 0.8, roughness: 0.2 })
    );
    coneSmall.position.set(x * 1.1, y * 1.1, z * 1.1);
    coneSmall.rotation.set(rx, ry, rz);
    nodeGroup.add(coneSmall);
  });

  nodeGroup.position.z = -7.5;
  coreGroup.add(nodeGroup);

  // ---------- 綠色對接環與十字標記 ----------
  const targetRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.06, 16, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  targetRing.position.set(0, 0, -10.8);
  coreGroup.add(targetRing);

  const crossMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 });
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.03), crossMat);
  crossH.position.set(0, 0, -10.6);
  coreGroup.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), crossMat);
  crossV.position.set(0, 0, -10.6);
  coreGroup.add(crossV);

  // ---------- 問天與夢天實驗艙 ----------
  function createLabModule(xPos) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 11, 32), matMLI);
    body.rotation.z = Math.PI / 2;
    addEdgeGlow(body, 0x44aaff, 0.2);
    group.add(body);

    for (let i = -4; i <= 4; i += 4) {
      const rib = createRib(2.2, 0.05, 0.25, 0x99aabb);
      rib.position.x = i;
      rib.rotation.y = Math.PI / 2;
      group.add(rib);
    }

    const endCap = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 0.3, roughness: 0.4 })
    );
    endCap.position.x = xPos > 0 ? 6.5 : -6.5;
    addEdgeGlow(endCap, 0x66ccff, 0.25);
    group.add(endCap);

    const payloadMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.5, roughness: 0.4 });
    for (let i = -2; i <= 2; i += 2) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 1.0), payloadMat);
      const side = (xPos > 0) ? 1 : -1;
      box.position.set(side * 2.6, i * 1.2, -1.5);
      addEdgeGlow(box, 0x88ccff, 0.15);
      group.add(box);
    }

    const radiatorMat = new THREE.MeshStandardMaterial({
      color: 0xccbbaa,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x332211,
      emissiveIntensity: 0.1
    });
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.0, 3.5), radiatorMat);
    rad.position.set(xPos > 0 ? 2.8 : -2.8, 0, 0);
    group.add(rad);

    group.position.set(xPos, 0, -5.5);
    return group;
  }

  coreGroup.add(createLabModule(-7.0));
  coreGroup.add(createLabModule(7.0));
  station.add(coreGroup);

  // ---------- 柔性太陽翼（分段式結構） ----------
  const wings = [];
  function createSolarWing(xPos, yRot) {
    const group = new THREE.Group();
    const segments = 3;
    const segLen = 8.0;
    const totalLen = segments * segLen;

    for (let i = 0; i < segments; i++) {
      const offset = (i - (segments-1)/2) * segLen;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.95, 0.04, 5.2), matSolar);
      panel.position.x = offset;
      addEdgeGlow(panel, 0x0088ff, 0.15);
      group.add(panel);

      if (i < segments - 1) {
        const gap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 5.0), matSolarFrame);
        gap.position.x = offset + segLen/2 + 0.15;
        group.add(gap);
      }

      const stiff = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.9, 0.06, 0.06), matSolarFrame);
      stiff.position.set(offset, 0, 2.6);
      group.add(stiff);
      const stiff2 = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.9, 0.06, 0.06), matSolarFrame);
      stiff2.position.set(offset, 0, -2.6);
      group.add(stiff2);
    }

    const frameMat = new THREE.LineBasicMaterial({ color: 0x4a6a8a, transparent: true, opacity: 0.4 });
    const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(totalLen, 0.06, 5.4));
    group.add(new THREE.LineSegments(frameGeo, frameMat));

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.5, 8), matGrey);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = xPos > 0 ? -1.2 : 1.2;
    group.add(arm);

    group.position.set(xPos, 0, -5.5);
    group.rotation.y = yRot;
    wings.push(group);
    return group;
  }

  station.add(createSolarWing(-20.0, 0.08));
  station.add(createSolarWing(20.0, -0.08));

  // ---------- 高增益拋物面天線 ----------
  function createAntenna(xPos, zPos) {
    const group = new THREE.Group();
    const dishGeo = new THREE.SphereGeometry(1.2, 16, 16, 0, Math.PI*2, 0, Math.PI/2.5);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 0.9, roughness: 0.1, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 2;
    addEdgeGlow(dish, 0x88aaff, 0.2);
    group.add(dish);

    const feed = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.2 }));
    feed.position.set(0, 0, 1.0);
    feed.rotation.x = Math.PI / 2;
    group.add(feed);

    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), matGrey);
    support.position.set(0, -1.5, 0);
    group.add(support);

    group.position.set(xPos, 2.0, zPos);
    group.rotation.y = -0.3;
    return group;
  }

  station.add(createAntenna(-3.5, 3.5));
  station.add(createAntenna(3.5, 3.5));

  // ---------- 鞭狀全向天線 ----------
  function createWhipAntenna(xPos, zPos) {
    const group = new THREE.Group();
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 2.0, 6), new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.5, roughness: 0.3 }));
    whip.position.y = 1.0;
    group.add(whip);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xccddee, metalness: 0.6, roughness: 0.2 }));
    tip.position.y = 2.0;
    group.add(tip);
    group.position.set(xPos, 0, zPos);
    return group;
  }

  station.add(createWhipAntenna(-2.0, 4.5));
  station.add(createWhipAntenna(2.0, 4.5));

  // ---------- 信標燈（呼吸燈） ----------
  const matRed = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 1.5 });
  const matBlue = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0044ff, emissiveIntensity: 1.5 });
  const beaconPositions = [
    [-24, 1.2, -5.5, matRed],
    [24, 1.2, -5.5, matBlue],
    [0, 3.6, -8.0, matRed],
    [-26, -0.8, -5.5, matBlue],
    [26, -0.8, -5.5, matRed]
  ];
  const beacons = beaconPositions.map(([x, y, z, mat]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat);
    m.position.set(x, y, z);
    station.add(m);
    return m;
  });

  scene.add(station);

  // ==========================================
  // 5. RCS 推進噴焰
  // ==========================================
  const rcsGroup = new THREE.Group();
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const plumes = {};
  const plumeConfigs = [
    { name: 'left', pos: [-3.2, -0.8, -1.5], rot: [0, 0, Math.PI/2] },
    { name: 'right', pos: [3.2, -0.8, -1.5], rot: [0, 0, -Math.PI/2] },
    { name: 'up', pos: [0, 1.8, -1.5], rot: [Math.PI/2, 0, 0] },
    { name: 'down', pos: [0, -2.2, -1.5], rot: [-Math.PI/2, 0, 0] }
  ];
  plumeConfigs.forEach(cfg => {
    const geo = new THREE.ConeGeometry(0.15, 1.2, 8);
    geo.translate(0, -0.6, 0);
    const m = new THREE.Mesh(geo, plumeMat.clone());
    m.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    m.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
    rcsGroup.add(m);
    plumes[cfg.name] = m;
  });
  camera.add(rcsGroup);
  scene.add(camera);

  // ==========================================
  // 6. 完整輸出所有系統物件（保留全部動態特效）
  // ==========================================
  return {
    renderer,
    scene,
    camera,
    targetRingPos: new THREE.Vector3(0, 0, -10.8),
    earthShaderMat,
    clouds,
    clouds2,
    beacons,
    rcsPlumes: plumes,
    wings,
    corona,
    station
  };
}
