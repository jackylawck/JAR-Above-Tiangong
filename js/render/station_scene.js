// js/render/station_scene.js
import * as THREE from 'three';

const getCloudTexture = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 512; y += 4) {
      for (let x = 0; x < 1024; x += 4) {
        const val = Math.sin(x * 0.02) * Math.cos(y * 0.02) + Math.sin((x + y) * 0.01);
        const alpha = Math.max(0, Math.min(1, (val * 0.5 + 0.5) * 1.5 - 0.5));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    cache = new THREE.CanvasTexture(c);
    cache.magFilter = THREE.LinearFilter;
    return cache;
  };
})();

export function setupStationScene() {
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3; // 調低曝光，還原色彩細節

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010103);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);

  // --- 1. 光照系統 (更真實的太陽強度) ---
  const sunDir = new THREE.Vector3(1.0, 0.5, 0.8).normalize();
  const sunLight = new THREE.DirectionalLight(0xffeedd, 3.5); // 將核爆級 6.0 降回 3.5
  sunLight.position.copy(sunDir).multiplyScalar(300);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x0a1525, 0.3));

  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffaa55 }));
  sunMesh.position.copy(sunDir).multiplyScalar(900);
  scene.add(sunMesh);

  const spriteMap = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 200, 100, 1)');
    grad.addColorStop(0.2, 'rgba(255, 150, 50, 0.8)');
    grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteMap, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunSprite.scale.set(280, 280, 1);
  sunSprite.position.copy(sunMesh.position);
  scene.add(sunSprite);

  // --- 2. 彩色星空 ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3500;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 1500 + Math.random() * 1500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);
    
    const colorVal = 0.6 + Math.random() * 0.4;
    const tint = Math.random();
    if (tint < 0.3) { starCol[i*3] = colorVal; starCol[i*3+1] = colorVal * 0.6; starCol[i*3+2] = colorVal * 0.4; } 
    else if (tint < 0.6) { starCol[i*3] = colorVal * 0.5; starCol[i*3+1] = colorVal * 0.7; starCol[i*3+2] = colorVal; } 
    else { starCol[i*3] = colorVal; starCol[i*3+1] = colorVal; starCol[i*3+2] = colorVal; } 
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.2, vertexColors: true, transparent: true, opacity: 0.95 })));

  // --- 3. 電影級著色器地球 (AAA Cinematic Earth) ---
  const earthRadius = 350;
  const earthShaderMat = new THREE.ShaderMaterial({
    uniforms: { uSunDirection: { value: sunDir }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;

      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0 );
        vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z.xxxx);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      float fbm(vec3 p) {
        float v = 0.0; float a = 0.5; vec3 shift = vec3(100);
        for (int i = 0; i < 4; ++i) { v += a * snoise(p); p = p * 2.0 + shift; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 normPos = normalize(vPosition);
        float n = fbm(normPos * 2.5); // 優化陸地分佈
        
        vec3 color;
        float isLand = step(0.02, n);
        
        // 海洋漸變 (深海 -> 淺灘)
        if (isLand < 0.5) {
          float depth = smoothstep(-0.4, 0.02, n);
          color = mix(vec3(0.01, 0.08, 0.25), vec3(0.0, 0.35, 0.55), depth);
        } else {
          // 陸地漸變 (平原 -> 高山 -> 雪頂)
          float elevation = smoothstep(0.02, 0.5, n);
          color = mix(vec3(0.02, 0.15, 0.05), vec3(0.3, 0.25, 0.15), elevation);
          color = mix(color, vec3(0.8, 0.85, 0.9), smoothstep(0.35, 0.6, n));
        }
        
        // 極地冰帽 (Polar Ice Caps)
        float poleMask = smoothstep(0.75, 0.98, abs(normPos.y));
        float iceNoise = fbm(normPos * 10.0);
        color = mix(color, vec3(0.9, 0.95, 1.0), poleMask * (0.5 + 0.5 * iceNoise));

        float NdotL = dot(vNormal, uSunDirection);
        
        // 柔和的漫反射 (Wrap Lighting 模擬大氣擴散)
        float diffuse = max(0.0, (NdotL + 0.15) / 1.15);
        
        // 日夜交界線的暮光散射 (Rayleigh Terminator Glow)
        float terminator = smoothstep(-0.25, 0.15, NdotL) * smoothstep(0.15, -0.25, NdotL);
        vec3 sunsetGlow = vec3(0.9, 0.3, 0.1) * terminator * 1.2;
        
        // 智能城市燈光 (避開海洋與極地)
        float cityGlow = 0.0;
        if (NdotL < 0.0 && isLand > 0.5 && poleMask < 0.1) {
            float cityNoise = snoise(normPos * 45.0);
            cityGlow = step(0.75, cityNoise) * smoothstep(0.0, -0.2, NdotL);
        }
        
        vec3 finalColor = color * (diffuse + 0.03);
        finalColor += sunsetGlow;
        finalColor += vec3(1.0, 0.8, 0.3) * cityGlow * 2.5;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 64, 64), earthShaderMat);
  earth.position.set(0, -420, -50);
  scene.add(earth);

  // ☁️ 修復 1：放棄自發光，改用具備真實物理陰影的 Lambert 材質
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.015, 64, 64),
    new THREE.MeshLambertMaterial({ 
      map: getCloudTexture(), 
      transparent: true, 
      blending: THREE.NormalBlending, // 拒絕核爆級發光
      side: THREE.FrontSide, 
      depthWrite: false, 
      opacity: 0.45 
    })
  );
  clouds.position.copy(earth.position);
  scene.add(clouds);

  // 🌍 修復 2：完美的大氣邊緣散射 (FrontSide Rim Lighting)
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.045, 64, 64),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewPosition = -mvPosition.xyz; // 獲取相機視角向量
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          // 只在邊緣產生光暈
          float rim = 1.0 - max(0.0, dot(normal, viewDir));
          float intensity = smoothstep(0.55, 1.0, rim);
          gl_FragColor = vec4(0.2, 0.5, 1.0, intensity * 0.85);
        }
      `,
      transparent: true, 
      blending: THREE.AdditiveBlending, 
      side: THREE.FrontSide, // 放棄 BackSide，避免全屏幕渲染成史萊姆
      depthWrite: false
    })
  );
  atmosphere.position.copy(earth.position);
  scene.add(atmosphere);

  // --- 4. 空間站與心跳燈 ---
  const station = new THREE.Group();
  function addGlowEdges(mesh) { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3 }))); return mesh; }
  
  const ccm = addGlowEdges(new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 14, 32), new THREE.MeshStandardMaterial({ color: 0xf0f4f8, metalness: 0.6, roughness: 0.25 })));
  ccm.rotation.x = Math.PI / 2;
  const node = addGlowEdges(new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 32), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 })));
  node.position.z = 8;
  const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  targetRing.position.z = 9.5;
  
  const beaconMatRed = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 1.5 });
  const beaconMatBlue = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0044ff, emissiveIntensity: 1.5 });
  const beacon1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), beaconMatRed); beacon1.position.set(-2.2, 1.2, -6);
  const beacon2 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), beaconMatBlue); beacon2.position.set(2.2, 1.2, -6);
  const beacon3 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), beaconMatRed); beacon3.position.set(0, -1.8, 7.5);
  const beacons = [beacon1, beacon2, beacon3];
  
  station.add(ccm, node, targetRing, beacon1, beacon2, beacon3);
  scene.add(station);

  // --- 5. RCS 推進器尾焰 ---
  const rcsGroup = new THREE.Group();
  const plumeGeo = new THREE.ConeGeometry(0.15, 1.2, 8);
  plumeGeo.translate(0, -0.6, 0); 
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  
  const plumeL = new THREE.Mesh(plumeGeo, plumeMat); 
  plumeL.position.set(-3.2, -0.8, -1.5); 
  plumeL.rotation.set(0, 0, Math.PI / 2); 
  
  const plumeR = new THREE.Mesh(plumeGeo, plumeMat); 
  plumeR.position.set(3.2, -0.8, -1.5);  
  plumeR.rotation.set(0, 0, -Math.PI / 2); 
  
  const plumeU = new THREE.Mesh(plumeGeo, plumeMat); 
  plumeU.position.set(0, 1.8, -1.5);     
  plumeU.rotation.set(Math.PI / 2, 0, 0); 
  
  const plumeD = new THREE.Mesh(plumeGeo, plumeMat); 
  plumeD.position.set(0, -2.2, -1.5);    
  plumeD.rotation.set(-Math.PI / 2, 0, 0); 
  
  rcsGroup.add(plumeL, plumeR, plumeU, plumeD);
  camera.add(rcsGroup);
  scene.add(camera);
  
  const rcsPlumes = { left: plumeL, right: plumeR, up: plumeU, down: plumeD };

  return { renderer, scene, camera, targetRingPos: new THREE.Vector3(0, 0, 9.5), earthShaderMat, clouds, beacons, rcsPlumes };
}
