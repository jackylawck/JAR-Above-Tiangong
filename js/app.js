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
const { renderer, scene, camera, targetRingPos, earthShaderMat, clouds, beacons, rcsPlumes } = setupStationScene();
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
const narrativeBox = document.getElementById('narrative-box');
const narrativeText = document.getElementById('narrative-text');
const missionReport = document.getElementById('mission-report');
const btnRestart = document.getElementById('btn-restart');

let displayRange = 80.0, displaySpeed = 0.15, displayFuel = 300.0;
let missionStartTime = 0;
let isMissionActive = false;

// 預先分配變數 (Zero Allocation)
const _rawThrust = new THREE.Vector3();
const _rawTorque = new THREE.Vector3();
const _deltaThrust = new THREE.Vector3();
const _deltaTorque = new THREE.Vector3();
const _screenPos = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _imuWrapper = { acc: null, gyro: null }; 
let currentActualThrust = new THREE.Vector3();
let currentActualTorque = new THREE.Vector3();

// ==========================================
// 🚀 修復：加入打字機狀態追蹤與動態翻譯
// ==========================================
let typeWriterTimeout = null;
let typeWriterTick = null;
let currentNarrativeKey = null;

function playNarrative(key, duration = 4000) {
  currentNarrativeKey = key; // 記住當前的對話 ID
  const text = i18n.t(key);
  
  clearTimeout(typeWriterTimeout);
  clearTimeout(typeWriterTick); // 停止可能正在印字的特效
  narrativeText.textContent = '';
  if(narrativeBox) narrativeBox.style.opacity = 1;
  
  let i = 0;
  function type() {
    if (i < text.length) {
      narrativeText.textContent += text.charAt(i);
      i++;
      typeWriterTick = setTimeout(type, 30);
    } else {
      typeWriterTimeout = setTimeout(() => {
        if(narrativeBox) narrativeBox.style.opacity = 0;
      }, duration);
    }
  }
  type();
}

function startNewMission() {
  const randX = (Math.random() - 0.5) * 20;
  const randZ = (Math.random() - 0.5) * 20;
  engine.state[0] = randX; engine.state[1] = -80; engine.state[2] = randZ;
  engine.state[3] = 0; engine.state[4] = 0.15; engine.state[5] = 0;
  engine.fuel = 300.0;
  currentActualThrust.set(0, 0, 0);
  currentActualTorque.set(0, 0, 0);
  engine.omega.set((Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02, 0);
  
  missionStartTime = performance.now();
  isMissionActive = true;
  if(missionReport) missionReport.classList.add('hidden');
  
  // 改為傳遞字典 Key
  if (fsm.difficulty === Difficulty.KID) {
    playNarrative('narrKid');
  } else if (fsm.difficulty === Difficulty.SCIENTIST) {
    playNarrative('narrSci');
  } else {
    playNarrative('narrPro');
  }
}

if(btnRestart) btnRestart.onclick = () => { audio.playRadioBeep(); startNewMission(); };
window.addEventListener('touchstart', () => { if(!isMissionActive) startNewMission(); }, {once: true});
window.addEventListener('click', () => { if(!isMissionActive) startNewMission(); }, {once: true});

// 難度仲裁系統 (CAS)
let diffIndex = 1;
const diffLevels = [Difficulty.KID, Difficulty.PRO, Difficulty.SCIENTIST];
const diffKeys = ['diffKid', 'diffPro', 'diffSci'];

btnDiff.textContent = i18n.t(diffKeys[diffIndex]);
btnMode.textContent = fsm.mode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');

btnDiff.onclick = () => {
  diffIndex = (diffIndex + 1) % diffLevels.length;
  const currentDiff = diffLevels[diffIndex];
  fsm.setDifficulty(currentDiff);
  btnDiff.textContent = i18n.t(diffKeys[diffIndex]);
  
  if (currentDiff === Difficulty.SCIENTIST) {
    btnDiff.style.borderColor = '#ff3344';
    btnDiff.style.color = '#ff3344';
    btnMode.textContent = i18n.t('modeLocked');
    engine.thrustMultiplier = 1.0;
  } else {
    btnDiff.style.borderColor = '#ffaa00';
    btnDiff.style.color = '#ffaa00';
    btnMode.textContent = fsm.mode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');
  }
  audio.playRadioBeep();
  if(isMissionActive) startNewMission();
};

btnMode.onclick = () => {
  if (fsm.difficulty === Difficulty.SCIENTIST) return;
  const newMode = fsm.mode === MissionModes.AUTO ? MissionModes.MANUAL : MissionModes.AUTO;
  fsm.setMode(newMode);
  btnMode.textContent = newMode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');
  audio.playRadioBeep();
};

btnAbort.onclick = () => {
  fsm.setMode(MissionModes.ABORT);
  uiFsm.textContent = i18n.t('statusAbort');
  uiFsm.className = 'alert';
  audio.playRadioBeep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

// ==========================================
// 🚀 修復：語言切換時即時中斷打字機並替換為全句
// ==========================================
document.getElementById('btn-lang').onclick = () => {
  i18n.toggleLanguage();
  
  btnDiff.textContent = i18n.t(diffKeys[diffIndex]);
  if (fsm.difficulty === Difficulty.SCIENTIST) {
    btnMode.textContent = i18n.t('modeLocked');
  } else {
    btnMode.textContent = fsm.mode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');
  }

  // 如果對話框目前正在顯示中，即時打斷並替換語言
  if (currentNarrativeKey && narrativeBox.style.opacity == 1) {
    clearTimeout(typeWriterTick);
    narrativeText.textContent = i18n.t(currentNarrativeKey);
  } else if (!isMissionActive) {
    // 處理剛載入網頁時的預設字眼
    narrativeText.textContent = i18n.currentLang === 'en' ? 'SYSTEM INITIALIZING...' : '系統初始化中...';
  }
};

let eggClicks = 0;
document.getElementById('title-tag').onclick = () => {
  if (fsm.difficulty === Difficulty.SCIENTIST) {
    alert(i18n.t('alertSci'));
    return;
  }
  eggClicks++;
  if (eggClicks === 3) {
    alert(i18n.t('alertBird'));
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

  _rawThrust.set(controls.transInput.x, 0, -controls.transInput.y);
  _rawTorque.set(controls.rotInput.y * 0.4, -controls.rotInput.x * 0.4, 0);

  const currentDist = engine.state[0]**2 + engine.state[1]**2 + engine.state[2]**2;
  if (fsm.assistMagnet && currentDist < 16.0 && fsm.mode !== MissionModes.ABORT) {
    _rawThrust.x -= engine.state[0] * 0.05;
    _rawThrust.y -= engine.state[2] * 0.05;
  }
  if (fsm.mode === MissionModes.ABORT) _rawThrust.set(0, 0, -1.0);

  const massRatio = 3300.0 / (engine.massDry + engine.fuel); 
  const maxThrustRate = 3.5 * massRatio; 
  const maxTorqueRate = 4.0 * massRatio; 

  _deltaThrust.subVectors(_rawThrust, currentActualThrust);
  if (_deltaThrust.lengthSq() > (maxThrustRate * dt) ** 2) {
    _deltaThrust.normalize().multiplyScalar(maxThrustRate * dt);
  }
  currentActualThrust.add(_deltaThrust);

  _deltaTorque.subVectors(_rawTorque, currentActualTorque);
  if (_deltaTorque.lengthSq() > (maxTorqueRate * dt) ** 2) {
    _deltaTorque.normalize().multiplyScalar(maxTorqueRate * dt);
  }
  currentActualTorque.add(_deltaTorque);

  const phys = engine.step(dt, currentActualThrust, currentActualTorque);
  const starQuat = fdir.voteStarSensors(phys.quat);
  
  _imuWrapper.acc = phys.accBody;
  _imuWrapper.gyro = engine.omega;
  sync.pushSample(now, _imuWrapper, phys.pos, starQuat);

  const syncdData = sync.getInterpolatedSample(now - 40);
  if (syncdData) {
    mekf.predict(dt, syncdData.gyro, syncdData.acc);
    mekf.update(syncdData.starQuat, syncdData.lidarPos, null, true, true);
  }

  camera.position.copy(phys.pos);
  camera.quaternion.copy(mekf.qNominal);

  _screenPos.copy(targetRingPos).project(camera);
  const cx = (_screenPos.x * window.innerWidth) / 2;
  const cy = (-_screenPos.y * window.innerHeight) / 2;
  reticle.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;

  const dist = phys.pos.length();
  const speed = phys.vel.length();
  _euler.setFromQuaternion(mekf.qNominal);

  const lerpUI = 0.12;
  displayRange += (dist - displayRange) * lerpUI;
  displaySpeed += (speed - displaySpeed) * lerpUI;
  displayFuel += (phys.fuel - displayFuel) * lerpUI;

  uiRange.textContent = displayRange.toFixed(2);
  uiRate.textContent = displaySpeed.toFixed(2);
  uiFuel.textContent = displayFuel.toFixed(1);
  uiAlt.textContent = (400 + (phys.pos.y + 80) / 1000).toFixed(1);
  uiRpy.textContent = `${THREE.MathUtils.radToDeg(_euler.x).toFixed(1)}/${THREE.MathUtils.radToDeg(_euler.y).toFixed(1)}/${THREE.MathUtils.radToDeg(_euler.z).toFixed(1)}`;
  uiOffset.textContent = Math.hypot(phys.pos.x, phys.pos.z).toFixed(2);
  uiCov.textContent = (mekf.P[0][0] + mekf.P[4][4]).toFixed(4);

  if (isMissionActive && typeof audio.updateAdaptiveMusic === 'function') audio.updateAdaptiveMusic(dist);

  const fsmResult = fsm.evaluate(dist, speed);
  
  if (!impactFX.isExploding && isMissionActive) {
    uiFsm.textContent = i18n.t(fsmResult.statusKey);
    uiFsm.className = fsmResult.isAlert ? 'alert' : (fsmResult.isSuccess ? 'highlight' : '');
  }

  if (fsmResult.statusKey === 'statusOverSpeed' && dist < fsm.dockingThreshold && !impactFX.isExploding && isMissionActive) {
    isMissionActive = false;
    audio.playExplosion();
    playNarrative('narrFail', 3000);
    
    uiFsm.textContent = i18n.t('statusFail');
    uiFsm.style.color = '#ff3355';
    uiFsm.style.fontSize = '16px';
    uiFsm.style.fontWeight = 'bold';
    uiFsm.className = ''; 

    impactFX.triggerCatastrophicFailure(phys.pos, () => {
      setTimeout(() => {
        uiFsm.style.color = ''; uiFsm.style.fontSize = ''; uiFsm.style.fontWeight = '';
        startNewMission();
      }, 2000);
    });
  }

  if (fsmResult.statusKey === 'statusDocked' && isMissionActive) {
    isMissionActive = false;
    if(typeof audio.playSuccessChime === 'function') audio.playSuccessChime();
    playNarrative('narrSuccess', 5000);
    
    setTimeout(() => {
      const timeTaken = ((performance.now() - missionStartTime) / 1000).toFixed(1);
      const fuelLeft = phys.fuel.toFixed(1);
      const errAngle = THREE.MathUtils.radToDeg(_euler.x**2 + _euler.y**2 + _euler.z**2).toFixed(2);
      
      let grade = 'C';
      if (fuelLeft > 250 && errAngle < 2.0) grade = 'S';
      else if (fuelLeft > 200 && errAngle < 5.0) grade = 'A';
      else if (fuelLeft > 100) grade = 'B';
      
      if(missionReport) {
        document.getElementById('score-grade').textContent = grade;
        document.getElementById('score-grade').style.color = grade === 'S' ? '#ffaa00' : (grade === 'A' ? '#00ffaa' : '#fff');
        document.getElementById('score-time').textContent = timeTaken;
        document.getElementById('score-fuel').textContent = fuelLeft;
        document.getElementById('score-error').textContent = errAngle;
        missionReport.classList.remove('hidden');
      }
    }, 2000);
  }

  if (earthShaderMat && earthShaderMat.uniforms.uTime) earthShaderMat.uniforms.uTime.value = now * 0.001;
  if (clouds) clouds.rotation.y += dt * 0.005;

  if (beacons) {
    const blinkPhase = Math.sin(now / 800) > 0;
    for (let i = 0; i < beacons.length; i++) {
      beacons[i].material.emissiveIntensity = (i % 2 === 0) ? (blinkPhase ? 2.5 : 0.1) : (blinkPhase ? 0.1 : 2.5);
    }
  }

  if (rcsPlumes) {
    rcsPlumes.left.material.opacity = Math.max(0, -controls.transInput.x * 0.8);
    rcsPlumes.right.material.opacity = Math.max(0, controls.transInput.x * 0.8);
    rcsPlumes.up.material.opacity = Math.max(0, -controls.transInput.y * 0.8);
    rcsPlumes.down.material.opacity = Math.max(0, controls.transInput.y * 0.8);
  }

  scene.children.forEach(child => {
    if (child.isGroup && child.children.length > 3) {
      const panelL = child.children[child.children.length - 2];
      const panelR = child.children[child.children.length - 1];
      if (panelL && panelR && panelL.geometry.type === 'BoxGeometry') {
        panelL.rotation.x = Math.sin(now * 0.0015) * 0.008;
        panelR.rotation.x = Math.sin(now * 0.0015 + 1.2) * 0.008;
      }
    }
  });

  impactFX.update(dt);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
