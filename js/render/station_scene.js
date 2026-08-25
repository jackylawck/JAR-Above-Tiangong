export function setupStationScene() {
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);

  const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
  sunLight.position.set(120, 70, 100);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x050505, 0x113366, 1.2));

  // 地球
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(300, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x143e75, roughness: 0.8, metalness: 0.1 })
  );
  earth.position.set(0, -380, 0);
  scene.add(earth);

  // 天宮空間站
  const station = new THREE.Group();
  const mliWhite = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.5, roughness: 0.3 });
  const mliGold = new THREE.MeshStandardMaterial({ color: 0xcc9933, metalness: 0.8, roughness: 0.2 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x051a33, metalness: 0.9, roughness: 0.1 });

  const ccm = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 12, 32), mliWhite);
  ccm.rotation.x = Math.PI / 2;
  const node = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 32), mliGold);
  node.position.z = 7;
  const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ff66 }));
  targetRing.position.z = 8.5;
  
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 3.5), solarMat);
  panelL.position.set(-10, 0, 0);
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 3.5), solarMat);
  panelR.position.set(10, 0, 0);

  station.add(ccm, node, targetRing, panelL, panelR);
  scene.add(station);

  return { renderer, scene, camera, targetRingPos: new THREE.Vector3(0, 0, 8.5) };
}
