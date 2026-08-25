// js/app.js
import * as THREE from 'three';
import { I18nManager } from './i18n.js';
import { DualTouchControls } from './controls/touch_controls.js';
import { FullStateMEKF } from './gnc/mekf.js';
import { FDIRSystem } from './gnc/fdir.js';
import { TimeSynchronizer } from './gnc/sensor_time_sync.js';
import { MissionFSM, MissionModes } from './gnc/fsm.js';
import { SpacecraftEngine } from './physics/spacecraft_core.js';
import { setupStationScene } from './render/station_scene.js';

const i18n = new I18nManager();
const controls = new DualTouchControls();
const mekf = new FullStateMEKF();
const fdir = new FDIRSystem();
const sync = new TimeSynchronizer(0.5);
const fsm = new MissionFSM();
const engine = new SpacecraftEngine();
const { renderer, scene, camera, targetRingPos } = setupStationScene();
const clock = new THREE.Clock();

const reticle = document.getElementById('crosshair-reticle');
const uiRange = document.getElementById('val-range');
const uiRate = document.getElementById('val-rate');
const uiBias = document.getElementById('val-bias');
const uiFuel = document.getElementById('val-fuel');
const uiMass = document.getElementById('val-mass');
const uiFsm = document.getElementById('val-fsm');

document.getElementById('btn-mode').onclick = () => {
  const newMode = fsm.mode === MissionModes.AUTO ? MissionModes.MANUAL : MissionModes.AUTO;
  fsm.setMode(newMode);
  document.getElementById('btn-mode').textContent = i18n.currentLang === 'zh-HK' ? `模式: ${newMode}` : `MODE: ${newMode}`;
};

document.getElementById('btn-abort').onclick = () => {
  fsm.setMode(MissionModes.ABORT);
  uiFsm.textContent = i18n.t('statusAbort');
  uiFsm.className = 'alert';
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

// 暗號彩蛋：火鷹（FIRE BIRD）
let eggClicks = 0;
document.getElementById('title-tag').onclick = () => {
  eggClicks++;
  if (eggClicks === 3) {
    alert("🦅 [CALLSIGN: FIRE BIRD UNLOCKED]\n已啟動「火鷹」特技飛行模式：RCS 推力限制解除！");
    engine.thrustMultiplier = 2.5;
    uiFsm.textContent = "FIRE BIRD OVERRIDE";
  }
};

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  let thrustCmd = new THREE.Vector3(controls.transInput.x, 0, -controls.transInput.y);
  let torqueCmd = new THREE.Vector3(controls.rotInput.y * 0.4, -controls.rotInput.x * 0.4, 0);

  if (fsm.mode === MissionModes.ABORT) {
    thrustCmd.set(0, 0, -1.0);
  }

  // 1. 物理推進步進
  const phys = engine.step(dt, thrustCmd, torqueCmd);

  // 2. 感測器採樣並注入時間同步緩存 (80ms LiDAR 延遲補償)
  const starQuat = fdir.voteStarSensors(phys.quat);
  sync.pushSample(now, { acc: phys.accBody, gyro: engine.omega }, phys.pos, starQuat);

  // 3. 取出延遲對齊後的觀測量並進行 MEKF 估計
  const syncdData = sync.getInterpolatedSample(now - 40);
  if (syncdData) {
    mekf.predict(dt, syncdData.gyro, syncdData.acc);
    mekf.update(syncdData.starQuat, syncdData.lidarPos, null, true, true);
  }

  // 4. 第一人稱渲染視角更新
  camera.position.copy(phys.pos);
  camera.quaternion.copy(mekf.qNominal);

  // 5. CBARS 準心投影
  const screenPos = targetRingPos.clone().project(camera);
  const cx = (screenPos.x * window.innerWidth) / 2;
  const cy = (-screenPos.y * window.innerHeight) / 2;
  reticle.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;

  // 6. 遙測顯示更新
  const dist = phys.pos.length();
  const speed = phys.vel.length();
  uiRange.textContent = dist.toFixed(2);
  uiRate.textContent = speed.toFixed(2);
  uiBias.textContent = `${mekf.gyroBias.x.toFixed(4)}, ${mekf.gyroBias.y.toFixed(4)}`;
  uiFuel.textContent = phys.fuel.toFixed(1);
  uiMass.textContent = phys.mass.toFixed(1);

  const fsmResult = fsm.evaluate(dist, speed);
  uiFsm.textContent = i18n.t(fsmResult.statusKey);
  uiFsm.className = fsmResult.isAlert ? 'alert' : (fsmResult.isSuccess ? 'highlight' : '');

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
