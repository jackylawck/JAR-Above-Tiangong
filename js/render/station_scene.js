// js/render/station_scene.js
import * as THREE from 'three';

export function setupStationScene() {
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);

  // 1. 光照系統 (增強太空高對比度)
  const sunDir = new THREE.Vector3(1.0, 0.6, 0.8).normalize();
  const sunLight = new THREE.DirectionalLight(0xffeedd, 3.5);
  sunLight.position.copy(sunDir).multiplyScalar(200);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x0a1525, 0.4)); // 壓低環境光，增加戲劇性

  // 2. 星空球殼 (球殼分佈 + 大小變化)
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 1800 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.95 });
  scene.add(new THREE.Points(starGeo, starMat));

  // 3. GPU 著色器地球 (GLSL 3D Simplex 噪聲 + 暮光散射)
  const earthRadius = 350;
  const earthShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: { value: sunDir },
      uTime: { value: 0 }
    },
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

      // GLSL 3D Simplex Noise
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
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
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
        float v = 0.0;
        float a = 0.5;
        vec3 shift = vec3(100);
        for (int i = 0; i < 4; ++i) {
          v += a * snoise(p);
          p = p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 normPos = normalize(vPosition);
        float n = fbm(normPos * 3.5);
        
        vec3 oceanDeep = vec3(0.01, 0.05, 0.18);
        vec3 oceanCoast = vec3(0.03, 0.18, 0.35);
        vec3 landGrass = vec3(0.12, 0.32, 0.15);
        vec3 landMtn = vec3(0.38, 0.32, 0.22);
        
        vec3 surfaceColor;
        float isLand = step(0.08, n);
        
        if (isLand < 0.5) {
          float depth = smoothstep(-0.4, 0.08, n);
          surfaceColor = mix(oceanDeep, oceanCoast, depth);
        } else {
          float height = smoothstep(0.08, 0.45, n);
          surfaceColor = mix(landGrass, landMtn, height);
        }

        // 光照與晝夜終結線
        float NdotL = dot(vNormal, uSunDirection);
        float light = clamp(NdotL, 0.0, 1.0);
        
        // Rayleigh 暮光散射 (邊緣橙藍光)
        vec3 sunsetGlow = vec3(0.8, 0.35, 0.1) * clamp(1.0 - abs(NdotL) * 3.0, 0.0, 1.0);
        vec3 dayColor = surfaceColor * (light + 0.06) + sunsetGlow * (1.0 - isLand * 0.5);

        gl_FragColor = vec4(dayColor, 1.0);
      }
    `
  });

  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 64, 64), earthShaderMat);
  earth.position.set(0, -420, -50);
  scene.add(earth);

  // 4. 動態雲層 (使用 2D Canvas 生成基礎噪聲，交由 app.js 驅動自轉)
  function generateCloudTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 512; y+=4) {
      for (let x = 0; x < 1024; x+=4) {
        const val = Math.sin(x*0.02) * Math.cos(y*0.02) + Math.sin((x+y)*0.01);
        const alpha = Math.max(0, Math.min(1, (val * 0.5 + 0.5) * 1.5 - 0.5));
        ctx.fillStyle = \`rgba(255, 255, 255, \${alpha * 0.8})\`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
  
  const cloudMat = new THREE.MeshStandardMaterial({
    map: generateCloudTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    opacity: 0.6
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.015, 64, 64), cloudMat);
  clouds.position.copy(earth.position);
  scene.add(clouds);

  // 5. 大氣層外圍輝光薄膜
  const atmoShaderMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - max(0.0, dot(vNormal, vViewDir));
        float intensity = pow(rim, 3.2) * 1.8;
        gl_FragColor = vec4(0.15, 0.65, 1.0, intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.035, 48, 48), atmoShaderMat);
  atmosphere.position.copy(earth.position);
  scene.add(atmosphere);

  // 6. 天宮空間站主體 (加入高科技發光線框)
  const station = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, metalness: 0.6, roughness: 0.25 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x051a33, metalness: 0.98, roughness: 0.05 });

  // 輔助函數：為幾何體加上螢光藍線框
  function addGlowEdges(mesh) {
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    mesh.add(wireframe);
    return mesh;
  }

  const ccm = addGlowEdges(new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 14, 32), whiteMat));
  ccm.rotation.x = Math.PI / 2;
  const node = addGlowEdges(new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 32), goldMat));
  node.position.z = 8;
  const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  targetRing.position.z = 9.5;
  station.add(ccm, node, targetRing);

  const wentian = addGlowEdges(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 10, 32), whiteMat));
  wentian.rotation.z = Math.PI / 2;
  wentian.position.set(-6.5, 0, 5);
  const mengtian = addGlowEdges(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 10, 32), whiteMat));
  mengtian.rotation.z = Math.PI / 2;
  mengtian.position.set(6.5, 0, 5);
  station.add(wentian, mengtian);

  const panelL = addGlowEdges(new THREE.Mesh(new THREE.BoxGeometry(22, 0.08, 4), solarMat));
  panelL.position.set(-19, 0, 5);
  const panelR = addGlowEdges(new THREE.Mesh(new THREE.BoxGeometry(22, 0.08, 4), solarMat));
  panelR.position.set(19, 0, 5);
  station.add(panelL, panelR);

  scene.add(station);

  // 核心修復：正確回傳所有 app.js 依賴的物件
  return { renderer, scene, camera, targetRingPos: new THREE.Vector3(0, 0, 9.5), earthShaderMat, clouds };
}
