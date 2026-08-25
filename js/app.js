// js/app.js
import * as THREE from 'three';
import { I18nManager } from './i18n.js';
import { DualTouchControls } from './controls/touch_controls.js';
import { FullStateMEKF } from './gnc/mekf.js';
import { FDIRSystem } from './gnc/fdir.js';
import { TimeSynchronizer } from './gnc/sensor_time_sync.js';
import { MissionFSM, MissionModes, Difficulty } from './gnc/fsm.js';
import { SpacecraftEngine } from './physics/spacecraft_core.js';
import { setupStationScene } from './render/station_scene.js';
import { SpaceAudioManager } from './audio/space_audio.js';
import { ImpactFXManager } from './render/impact_effects.js';

// 系統初始化
const i18n = new I18nManager();
const controls = new DualTouchControls();
const mekf = new FullStateMEKF();
const fdir = new FDIRSystem();
const sync = new TimeSynchronizer(0.5);
const fsm = new MissionFSM();
const engine = new SpacecraftEngine();
const { renderer, scene, camera, targetRingPos } = setupStationScene();
const audio = new SpaceAudioManager();
const impactFX = new ImpactFXManager(scene, camera);
const clock = new THREE.Clock();

// 解鎖 Web Audio (符合瀏覽器 Autoplay 規範)
window.addEventListener('touchstart', () => audio.init(), { once: true });
window.addEventListener('click', () => audio.init(), { once: true });

// UI 元素快取
const reticle = document.getElementById('crosshair-reticle');
const uiRange = document.getElementById('val-range');
const uiRate = document.getElementById('val-rate');
const uiFuel = document.getElementById('val-fuel');
const uiFsm = document.getElementById('val-fsm');
const uiAlt = document.getElementById('val-alt');
const uiRpy = document.getElementById('val-rpy');
const uiOffset = document.getElementById('val-offset');
const uiCov = document.getElementById('val-cov');
const btnDiff = document.getElementById('btn-diff');
const btnMode = document.getElementById('btn-mode');
const btnAbort = document.getElementById('btn-abort');
const hudOverlay = document.getElementById('hud-overlay');

// --- 難度切換 (CAS) ---
let diffIndex = 1; // 預設 PRO
const diffLevels = [Difficulty.KID, Difficulty.PRO, Difficulty.SCIENTIST];
const diffLabels = ['🧒 兒童模式', '🛠️ 進階模式', '🔬 科學模式'];

btnDiff.onclick = () => {
  diffIndex = (diffIndex + 1) % diffLevels.length;
  const currentDiff = diffLevels[diffIndex];
  fsm.setDifficulty(currentDiff);
  btnDiff.textContent = diffLabels[diffIndex];
  
  if (currentDiff === Difficulty.SCIENTIST) {
    btnDiff.style.borderColor = '#ff3344';
    btnDiff.style.color = '#ff3344';
    btnMode.textContent = i18n.currentLang === 'zh-HK' ? '模式: 手動 (鎖定)' : 'MODE: MANUAL (LOCKED)';
    engine.thrustMultiplier = 1.0; // 科學家模式嚴格禁止彩蛋過載
  } else {
    btnDiff.style.borderColor = '#ffaa00';
    btnDiff.style.color = '#ffaa00';
    btnMode.textContent = i18n.currentLang === 'zh-HK' ? `模式: ${fsm.mode}` : `MODE: ${fsm.mode}`;
  }
  audio.playRadioBeep();
};

// --- 操作模式切換 ---
btnMode.onclick = () => {
  if (fsm.difficulty === Difficulty.SCIENTIST) return;
  const newMode = fsm.mode === MissionModes.AUTO ? MissionModes.MANUAL : MissionModes.AUTO;
  fsm.setMode(newMode);
  btnMode.textContent = i18n.currentLang === 'zh-HK' ? `模式: ${newMode}` : `MODE: ${newMode}`;
  audio.playRadioBeep();
};

// --- 緊急中止 ---
btnAbort.onclick = () => {
  fsm.setMode(MissionModes.ABORT);
  uiFsm.textContent = i18n.t('statusAbort');
  uiFsm.className = 'alert';
  audio.playRadioBeep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

// --- 雙語切換 ---
document.getElementById('btn-lang').onclick = () => {
  i18n.toggleLanguage();
  btnMode.textContent = i18n.currentLang === 'zh-HK' ? `模式: ${fsm.mode}` : `MODE: ${fsm.mode}`;
};

// --- 暗號彩蛋：火鷹 (FIRE BIRD) ---
let eggClicks = 0;
document.getElementById('title-tag').onclick = () => {
  if (fsm.difficulty === Difficulty.SCIENTIST) {
    alert("🔬 [SCIENTIST MODE ACTIVE]\n科學模式已強制鎖定：禁止推力過載！");
    return;
  }
  eggClicks++;
  if (eggClicks === 3) {
    alert("🦅 [CALLSIGN: FIRE BIRD UNLOCKED]\n已啟動「火鷹」特技飛行模式：RCS 推力限制解除！");
    engine.thrustMultiplier = 2.5;
    uiFsm.textContent = "FIRE BIRD OVERRIDE";
    audio.playRadioBeep();
  }
};

// ==========================================
// 系統主迴圈 (Main Pipeline Loop)
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  let thrustCmd = new THREE.Vector3(controls.transInput.x, 0, -controls.transInput.y);
  let torqueCmd = new THREE.Vector3(controls.rotInput.y * 0.4, -controls.rotInput.x * 0.4, 0);

  // 磁力吸附輔助 (進階/兒童模式)
  const currentDist = engine.state[0]**2 + engine.state[1]**2 + engine.state[2]**2;
  if (fsm.assistMagnet && currentDist < 16.0 && fsm.mode !== MissionModes.ABORT) {
    thrustCmd.x -= engine.state[0] * 0.05;
    thrustCmd.y -= engine.state[2] * 0.05;
  }

  if (fsm.mode === MissionModes.ABORT) {
    thrustCmd.set(0, 0, -1.0);
  }

  // 1. 物理推進
  const phys = engine.step(dt, thrustCmd, torqueCmd);

  // 2. 感測器採樣並送入時間同步緩存 (80ms 延遲補償)
  const starQuat = fdir.voteStarSensors(phys.quat);
  sync.pushSample(now, { acc: phys.accBody, gyro: engine.omega }, phys.pos, starQuat);

  // 3. MEKF 狀態估計
  const syncdData = sync.getInterpolatedSample(now - 40);
  if (syncdData) {
    mekf.predict(dt, syncdData.gyro, syncdData.acc);
    mekf.update(syncdData.starQuat, syncdData.lidarPos, null, true, true);
  }

  // 4. 第一人稱視角更新
  camera.position.copy(phys.pos);
  camera.quaternion.copy(mekf.qNominal);

  // 5. CBARS 準心投影
  const screenPos = targetRingPos.clone().project(camera);
  const cx = (screenPos.x * window.innerWidth) / 2;
  const cy = (-screenPos.y * window.innerHeight) / 2;
  reticle.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;

  // 6. 遙測數據計算與更新
  const dist = phys.pos.length();
  const speed = phys.vel.length();
  const euler = new THREE.Euler().setFromQuaternion(mekf.qNominal, 'YXZ');

  uiRange.textContent = dist.toFixed(2);
  uiRate.textContent = speed.toFixed(2);
  uiFuel.textContent = phys.fuel.toFixed(1);
  uiAlt.textContent = (400 + (phys.pos.y + 80) / 1000).toFixed(1);
  uiRpy.textContent = `${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}/${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}/${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}`;
  uiOffset.textContent = Math.hypot(phys.pos.x, phys.pos.z).toFixed(2);
  uiCov.textContent = (mekf.P[0][0] + mekf.P[4][4]).toFixed(4);

  // 7. 任務狀態評估與碰撞判定
  const fsmResult = fsm.evaluate(dist, speed);
  uiFsm.textContent = i18n.t(fsmResult.statusKey);
  uiFsm.className = fsmResult.isAlert ? 'alert' : (fsmResult.isSuccess ? 'highlight' : '');

  // 碰撞解體與自動重啟
  if (fsmResult.statusKey === 'statusOverSpeed' && dist < fsm.dockingThreshold) {
    audio.playExplosion();
    impactFX.triggerCatastrophicFailure(phys.pos, () => {
      engine.state = [0, -80, 0, 0, 0.15, 0];
      engine.fuel = 300.0;
      fsm.setMode(MissionModes.AUTO);
      audio.playRadioBeep();
    });
  }

  // 特效與渲染器更新
  impactFX.update(dt);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
