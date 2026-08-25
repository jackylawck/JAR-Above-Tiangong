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

// 系統核心模組初始化
const i18n = new I18nManager();
const controls = new DualTouchControls();
const mekf = new FullStateMEKF();
const fdir = new FDIRSystem();
const sync = new TimeSynchronizer(0.5);
const fsm = new MissionFSM();
const engine = new SpacecraftEngine();
const { renderer, scene, camera, targetRingPos, earthShaderMat, clouds } = setupStationScene();
const audio = new SpaceAudioManager();
const impactFX = new ImpactFXManager(scene, camera);
const clock = new THREE.Clock();

// 解鎖 Web Audio
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

// --- UI 動畫狀態變數 (Juice) ---
let displayRange = 80.0, displaySpeed = 0.15, displayFuel = 300.0;

// --- 難度仲裁系統 (CAS) ---
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
    engine.thrustMultiplier = 1.0;
  } else {
    btnDiff.style.borderColor = '#ffaa00';
    btnDiff.style.color = '#ffaa00';
    btnMode.textContent = i18n.currentLang === 'zh-HK' ? `模式: ${fsm.mode}` : `MODE: ${fsm.mode}`;
  }
  audio.playRadioBeep();
};

btnMode.onclick = () => {
  if (fsm.difficulty === Difficulty.SCIENTIST) return;
  const newMode = fsm.mode === MissionModes.AUTO ? MissionModes.MANUAL : MissionModes.AUTO;
  fsm.setMode(newMode);
  btnMode.textContent = i18n.currentLang === 'zh-HK' ? `模式: ${newMode}` : `MODE: ${newMode}`;
  audio.playRadioBeep();
};

btnAbort.onclick = () => {
  fsm.setMode(MissionModes.ABORT);
  uiFsm.textContent = i18n.t('statusAbort');
  uiFsm.className = 'alert';
  audio.playRadioBeep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

document.getElementById('btn-lang').onclick = () => {
  i18n.toggleLanguage();
  btnMode.textContent = i18n.currentLang === 'zh-HK' ? `模式: ${fsm.mode}` : `MODE: ${fsm.mode}`;
};

// 暗號彩蛋：火鷹 (FIRE BIRD)
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
// 物理執行機構變化率限幅器 (Rate Limiter)
// ==========================================
let currentActualThrust = new THREE.Vector3();
let currentActualTorque = new THREE.Vector3();

// ==========================================
// 系統主迴圈 (Main Pipeline Loop)
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  // 1. 取得玩家原始輸入
  const rawThrust = new THREE.Vector3(controls.transInput.x, 0, -controls.transInput.y);
  const rawTorque = new THREE.Vector3(controls.rotInput.y * 0.4, -controls.rotInput.x * 0.4, 0);

  // 磁力吸附輔助
  const currentDist = engine.state[0]**2 + engine.state[1]**2 + engine.state[2]**2;
  if (fsm.assistMagnet && currentDist < 16.0 && fsm.mode !== MissionModes.ABORT) {
    rawThrust.x -= engine.state[0] * 0.05;
    rawThrust.y -= engine.state[2] * 0.05;
  }

  if (fsm.mode === MissionModes.ABORT) {
    rawThrust.set(0, 0, -1.0);
  }

  // 2. RCS 閥門動態響應限制 (Rate Limiting)
  const totalMass = engine.massDry + engine.fuel;
  const massRatio = 3300.0 / totalMass; 
  
  const maxThrustRate = 3.5 * massRatio; 
  const maxTorqueRate = 4.0 * massRatio; 

  const deltaThrust = new THREE.Vector3().subVectors(rawThrust, currentActualThrust);
  if (deltaThrust.length() > maxThrustRate * dt) {
    deltaThrust.normalize().multiplyScalar(maxThrustRate * dt);
  }
  currentActualThrust.add(deltaThrust);

  const deltaTorque = new THREE.Vector3().subVectors(rawTorque, currentActualTorque);
  if (deltaTorque.length() > maxTorqueRate * dt) {
    deltaTorque.normalize().multiplyScalar(maxTorqueRate * dt);
  }
  currentActualTorque.add(deltaTorque);

  // 3. 推進物理引擎
  const phys = engine.step(dt, currentActualThrust, currentActualTorque);

  // 4. 感測器採樣並送入時間同步緩存
  const starQuat = fdir.voteStarSensors(phys.quat);
  sync.pushSample(now, { acc: phys.accBody, gyro: engine.omega }, phys.pos, starQuat);

  // 5. MEKF 狀態估計
  const syncdData = sync.getInterpolatedSample(now - 40);
  if (syncdData) {
    mekf.predict(dt, syncdData.gyro, syncdData.acc);
    mekf.update(syncdData.starQuat, syncdData.lidarPos, null, true, true);
  }

  // 6. 視角更新與投影
  camera.position.copy(phys.pos);
  camera.quaternion.copy(mekf.qNominal);

  const screenPos = targetRingPos.clone().project(camera);
  const cx = (screenPos.x * window.innerWidth) / 2;
  const cy = (-screenPos.y * window.innerHeight) / 2;
  reticle.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;

  // 7. 遙測數據計算
  const dist = phys.pos.length();
  const speed = phys.vel.length();
  const euler = new THREE.Euler().setFromQuaternion(mekf.qNominal, 'YXZ');

  // --- AAA 級包裝：HUD 數值滾動動畫 (Lerp UI) ---
  const lerpUI = 0.12;
  displayRange += (dist - displayRange) * lerpUI;
  displaySpeed += (speed - displaySpeed) * lerpUI;
  displayFuel += (phys.fuel - displayFuel) * lerpUI;

  uiRange.textContent = displayRange.toFixed(2);
  uiRate.textContent = displaySpeed.toFixed(2);
  uiFuel.textContent = displayFuel.toFixed(1);
  
  uiAlt.textContent = (400 + (phys.pos.y + 80) / 1000).toFixed(1);
  uiRpy.textContent = `${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}/${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}/${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}`;
  uiOffset.textContent = Math.hypot(phys.pos.x, phys.pos.z).toFixed(2);
  uiCov.textContent = (mekf.P[0][0] + mekf.P[4][4]).toFixed(4);

  // 8. 狀態機評估與碰撞處理
  const fsmResult = fsm.evaluate(dist, speed);
  
  // 當沒有在爆炸狀態時，才正常更新狀態字眼
  if (!impactFX.isExploding) {
    uiFsm.textContent = i18n.t(fsmResult.statusKey);
    uiFsm.className = fsmResult.isAlert ? 'alert' : (fsmResult.isSuccess ? 'highlight' : '');
  }

  // --- AAA 級包裝：碰撞失敗的情感過渡 (絕望凝視) ---
  if (fsmResult.statusKey === 'statusOverSpeed' && dist < fsm.dockingThreshold && !impactFX.isExploding) {
    audio.playExplosion();
    
    // 立即將狀態鎖定為血紅色的任務失敗
    uiFsm.textContent = '💀 任務失敗 (MISSION FAILED)';
    uiFsm.style.color = '#ff3355';
    uiFsm.style.fontSize = '16px';
    uiFsm.style.fontWeight = 'bold';
    uiFsm.className = ''; 

    impactFX.triggerCatastrophicFailure(phys.pos, () => {
      // 在 3.2 秒爆炸結束後，再追加 2 秒的「絕望真空期」，然後才重啟
      setTimeout(() => {
        engine.state = [0, -80, 0, 0, 0.15, 0];
        engine.fuel = 300.0;
        currentActualThrust.set(0, 0, 0);
        currentActualTorque.set(0, 0, 0);
        fsm.setMode(MissionModes.AUTO);
        
        // 還原 UI 樣式
        uiFsm.style.color = '';
        uiFsm.style.fontSize = '';
        uiFsm.style.fontWeight = '';
        
        audio.playRadioBeep();
      }, 2000);
    });
  }

  // 9. 更新地球 GPU Shader 與雲層動態
  if (earthShaderMat && earthShaderMat.uniforms.uTime) {
    earthShaderMat.uniforms.uTime.value = now * 0.001;
  }
  if (clouds) clouds.rotation.y += dt * 0.005;

  impactFX.update(dt);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
