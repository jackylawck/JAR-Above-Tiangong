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

const i18n = new I18nManager();
const controls = new DualTouchControls();
const mekf = new FullStateMEKF();
const fdir = new FDIRSystem();
const sync = new TimeSynchronizer(0.5);
const fsm = new MissionFSM();
const engine = new SpacecraftEngine();
const { 
  renderer, scene, camera, targetRingPos, 
  earthShaderMat, clouds, clouds2, beacons, rcsPlumes, wings, corona 
} = setupStationScene();
const audio = new SpaceAudioManager();
const impactFX = new ImpactFXManager(scene, camera);
const clock = new THREE.Clock();

window.addEventListener('touchstart', () => audio.init(), { once: true });
window.addEventListener('click', () => audio.init(), { once: true });

const reticle = document.getElementById('crosshair-reticle');
const uiRange = document.getElementById('val-range');
const uiRate = document.getElementById('val-rate');
const uiFuel = document.getElementById('val-fuel');
const uiFsm = document.getElementById('val-fsm');
const uiAlt = document.getElementById('val-alt');
const uiRpy = document.getElementById('val-rpy');
const uiOffset = document.getElementById('val-offset');
const uiProgress = document.getElementById('val-progress');
const btnDiff = document.getElementById('btn-diff');
const btnMode = document.getElementById('btn-mode');
const btnAbort = document.getElementById('btn-abort');
const narrativeBox = document.getElementById('narrative-box');
const narrativeText = document.getElementById('narrative-text');
const missionReport = document.getElementById('mission-report');
const btnRestart = document.getElementById('btn-restart');

const telemetryPanel = document.getElementById('telemetry-panel');
const btnCollapse = document.getElementById('btn-collapse');
const panelToggleHeader = document.getElementById('panel-toggle-header');

let displayRange = 35.0, displaySpeed = 0.35, displayFuel = 300.0;
let missionStartTime = 0;
let isMissionActive = false;
let isPanelCollapsed = false;

function updateCollapseButtonText() {
  if (!btnCollapse) return;
  const isZh = i18n.currentLang === 'zh-HK';
  btnCollapse.textContent = isPanelCollapsed ? (isZh ? '🔽 展開' : '🔽 EXPAND') : (isZh ? '🔼 摺疊' : '🔼 MIN');
}

function toggleTelemetryPanel() {
  isPanelCollapsed = !isPanelCollapsed;
  if (telemetryPanel) {
    if (isPanelCollapsed) telemetryPanel.classList.add('collapsed');
    else telemetryPanel.classList.remove('collapsed');
  }
  updateCollapseButtonText();
  if (typeof audio.playRadioBeep === 'function') audio.playRadioBeep();
}

if (panelToggleHeader) panelToggleHeader.onclick = toggleTelemetryPanel;

// 煙火特效
const FIREWORK_COUNT = 600;
const fwGeo = new THREE.BufferGeometry();
const fwPos = new Float32Array(FIREWORK_COUNT * 3);
const fwVel = new Float32Array(FIREWORK_COUNT * 3);
const fwCol = new Float32Array(FIREWORK_COUNT * 3);
fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3));
fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3));
const fwMat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const fireworkParticles = new THREE.Points(fwGeo, fwMat);
scene.add(fireworkParticles);

let isFireworksActive = false;
let fireworkTimer = 0;
let screenShake = 0;

function triggerSuccessFireworks(dockPos) {
  isFireworksActive = true;
  fireworkTimer = 0;
  fwMat.opacity = 1.0;
  screenShake = 0.25;

  const posAttr = fwGeo.attributes.position.array;
  const colAttr = fwGeo.attributes.color.array;

  for (let i = 0; i < FIREWORK_COUNT; i++) {
    posAttr[i * 3] = dockPos.x;
    posAttr[i * 3 + 1] = dockPos.y;
    posAttr[i * 3 + 2] = dockPos.z;

    const speed = 4.0 + Math.random() * 12.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    fwVel[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
    fwVel[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
    fwVel[i * 3 + 2] = speed * Math.cos(phi);

    const pType = Math.random();
    if (pType < 0.33) {
      colAttr[i * 3] = 1.0; colAttr[i * 3 + 1] = 0.85; colAttr[i * 3 + 2] = 0.1;
    } else if (pType < 0.66) {
      colAttr[i * 3] = 0.0; colAttr[i * 3 + 1] = 1.0; colAttr[i * 3 + 2] = 0.55;
    } else {
      colAttr[i * 3] = 0.0; colAttr[i * 3 + 1] = 0.8; colAttr[i * 3 + 2] = 1.0;
    }
  }
  fwGeo.attributes.position.needsUpdate = true;
  fwGeo.attributes.color.needsUpdate = true;
}

const _rawThrust = new THREE.Vector3();
const _rawTorque = new THREE.Vector3();
const _deltaThrust = new THREE.Vector3();
const _deltaTorque = new THREE.Vector3();
const _screenPos = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _imuWrapper = { acc: null, gyro: null }; 
let currentActualThrust = new THREE.Vector3();
let currentActualTorque = new THREE.Vector3();

let typeWriterTimeout = null;
let typeWriterTick = null;
let currentNarrativeKey = null;

function playNarrative(key, duration = 4000) {
  currentNarrativeKey = key;
  const text = i18n.t(key);
  
  clearTimeout(typeWriterTimeout);
  clearTimeout(typeWriterTick);
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
  // 兒童模式距離縮短一半 (35m) 且更正對齊；其他模式維持 80m
  const isKid = fsm.difficulty === Difficulty.KID;
  const startDist = isKid ? -35.0 : -80.0;
  const randX = (Math.random() - 0.5) * (isKid ? 8 : 20);
  const randZ = (Math.random() - 0.5) * (isKid ? 8 : 20);
  
  engine.state[0] = randX;
  engine.state[1] = startDist;
  engine.state[2] = randZ;
  engine.state[3] = 0;
  engine.state[4] = isKid ? 0.35 : 0.15; // 兒童模式起步更快
  engine.state[5] = 0;
  
  engine.fuel = 300.0;
  currentActualThrust.set(0, 0, 0);
  currentActualTorque.set(0, 0, 0);
  engine.omega.set((Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01, 0);
  
  missionStartTime = performance.now();
  isMissionActive = true;
  isFireworksActive = false;
  fwMat.opacity = 0;
  if(missionReport) missionReport.classList.add('hidden');
  
  if (isKid) {
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

// 難度仲裁
let diffIndex = 0; // 預設直接開「🧒 兒童模式」
const diffLevels = [Difficulty.KID, Difficulty.PRO, Difficulty.SCIENTIST];
const diffKeys = ['diffKid', 'diffPro', 'diffSci'];

fsm.setDifficulty(Difficulty.KID);
engine.thrustMultiplier = 6.0; // 兒童版推力加到 6 倍
btnDiff.textContent = i18n.t(diffKeys[diffIndex]);
btnDiff.style.borderColor = '#00ffaa';
btnDiff.style.color = '#00ffaa';

btnDiff.onclick = () => {
  diffIndex = (diffIndex + 1) % diffLevels.length;
  const currentDiff = diffLevels[diffIndex];
  fsm.setDifficulty(currentDiff);
  btnDiff.textContent = i18n.t(diffKeys[diffIndex]);
  
  if (currentDiff === Difficulty.KID) {
    btnDiff.style.borderColor = '#00ffaa';
    btnDiff.style.color = '#00ffaa';
    btnMode.textContent = fsm.mode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');
    engine.thrustMultiplier = 6.0; // 6 倍平移推力
  } else if (currentDiff === Difficulty.SCIENTIST) {
    btnDiff.style.borderColor = '#ff3344';
    btnDiff.style.color = '#ff3344';
    btnMode.textContent = i18n.t('modeLocked');
    engine.thrustMultiplier = 1.0;
  } else {
    btnDiff.style.borderColor = '#ffaa00';
    btnDiff.style.color = '#ffaa00';
    btnMode.textContent = fsm.mode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');
    engine.thrustMultiplier = 1.8;
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

document.getElementById('btn-lang').onclick = () => {
  i18n.toggleLanguage();
  btnDiff.textContent = i18n.t(diffKeys[diffIndex]);
  if (fsm.difficulty === Difficulty.SCIENTIST) {
    btnMode.textContent = i18n.t('modeLocked');
  } else {
    btnMode.textContent = fsm.mode === MissionModes.AUTO ? i18n.t('modeAuto') : i18n.t('modeManual');
  }

  updateCollapseButtonText();

  if (currentNarrativeKey && narrativeBox.style.opacity == 1) {
    clearTimeout(typeWriterTick);
    narrativeText.textContent = i18n.t(currentNarrativeKey);
  }
};

let eggClicks = 0;
document.getElementById('title-tag').onclick = (e) => {
  e.stopPropagation();
  if (fsm.difficulty === Difficulty.SCIENTIST) {
    alert(i18n.t('alertSci'));
    return;
  }
  eggClicks++;
  if (eggClicks === 3) {
    alert(i18n.t('alertBird'));
    engine.thrustMultiplier = 8.0;
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
  _rawTorque.set(controls.rotInput.y * 0.5, -controls.rotInput.x * 0.5, 0);

  const currentDist = engine.state[0]**2 + engine.state[1]**2 + engine.state[2]**2;
  
  // 兒童模式磁吸引導更強
  if (fsm.assistMagnet && currentDist < 25.0 && fsm.mode !== MissionModes.ABORT) {
    const magnetPower = fsm.difficulty === Difficulty.KID ? 0.12 : 0.05;
    _rawThrust.x -= engine.state[0] * magnetPower;
    _rawThrust.y -= engine.state[2] * magnetPower;
  }
  if (fsm.mode === MissionModes.ABORT) _rawThrust.set(0, 0, -1.0);

  const massRatio = 3300.0 / (engine.massDry + engine.fuel); 
  const maxThrustRate = (fsm.difficulty === Difficulty.KID ? 8.0 : 3.5) * massRatio; 
  const maxTorqueRate = 5.0 * massRatio; 

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

  if (screenShake > 0.001) {
    camera.position.set(
      phys.pos.x + (Math.random() - 0.5) * screenShake,
      phys.pos.y + (Math.random() - 0.5) * screenShake,
      phys.pos.z + (Math.random() - 0.5) * screenShake
    );
    screenShake *= 0.92;
  } else {
    camera.position.copy(phys.pos);
  }
  camera.quaternion.copy(mekf.qNominal);

  _screenPos.copy(targetRingPos).project(camera);
  const cx = (_screenPos.x * window.innerWidth) / 2;
  const cy = (-_screenPos.y * window.innerHeight) / 2;
  reticle.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;

  const dist = phys.pos.length();
  const speed = phys.vel.length();
  _euler.setFromQuaternion(mekf.qNominal);

  const lerpUI = 0.15;
  displayRange += (dist - displayRange) * lerpUI;
  displaySpeed += (speed - displaySpeed) * lerpUI;
  displayFuel += (phys.fuel - displayFuel) * lerpUI;

  uiRange.textContent = displayRange.toFixed(2);
  uiRate.textContent = displaySpeed.toFixed(2);
  uiFuel.textContent = displayFuel.toFixed(1);
  uiAlt.textContent = (400 + (phys.pos.y + 80) / 1000).toFixed(1);
  uiRpy.textContent = `${THREE.MathUtils.radToDeg(_euler.x).toFixed(0)}/${THREE.MathUtils.radToDeg(_euler.y).toFixed(0)}/${THREE.MathUtils.radToDeg(_euler.z).toFixed(0)}`;
  uiOffset.textContent = Math.hypot(phys.pos.x, phys.pos.z).toFixed(2);

  const totalDist = fsm.difficulty === Difficulty.KID ? 35.0 : 80.0;
  const progressVal = Math.min(100, Math.max(0, (1.0 - (dist - 1.5) / totalDist) * 100));
  uiProgress.textContent = `${progressVal.toFixed(0)}%`;

  if (dist < 6.0) {
    uiRange.style.color = '#00ffaa';
    uiRange.style.textShadow = '0 0 12px #00ffaa';
  } else if (dist < 18.0) {
    uiRange.style.color = '#ffaa00';
    uiRange.style.textShadow = '0 0 8px #ffaa00';
  } else {
    uiRange.style.color = '#ffffff';
    uiRange.style.textShadow = 'none';
  }

  if (speed > fsm.maxSafeApproachSpeed && dist < 15.0) {
    uiRate.style.color = '#ff3355';
    const glow = 8 + Math.sin(now / 150) * 6;
    uiRate.style.textShadow = `0 0 ${glow}px #ff3355`;
  } else {
    uiRate.style.color = '#ffffff';
    uiRate.style.textShadow = 'none';
  }

  if (isMissionActive && typeof audio.updateAdaptiveMusic === 'function') audio.updateAdaptiveMusic(dist);

  // 傳入相對 Z 深度判定是否衝過頭
  const fsmResult = fsm.evaluate(dist, speed, phys.pos.y + 10.5);
  
  if (!impactFX.isExploding && isMissionActive) {
    uiFsm.textContent = i18n.t(fsmResult.statusKey);
    uiFsm.className = fsmResult.isAlert ? 'alert' : (fsmResult.isSuccess ? 'highlight' : '');
  }

  // 致命超速碰撞
  if (fsmResult.statusKey === 'statusOverSpeed' && !impactFX.isExploding && isMissionActive) {
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

  // 成功硬對接
  if (fsmResult.statusKey === 'statusDocked' && isMissionActive) {
    isMissionActive = false;
    if(typeof audio.playSuccessChime === 'function') audio.playSuccessChime();
    playNarrative('narrSuccess', 5000);
    
    triggerSuccessFireworks(phys.pos);

    setTimeout(() => {
      const timeTaken = ((performance.now() - missionStartTime) / 1000).toFixed(1);
      const fuelLeft = phys.fuel.toFixed(1);
      const errAngle = THREE.MathUtils.radToDeg(_euler.x**2 + _euler.y**2 + _euler.z**2).toFixed(1);
      
      let grade = 'C';
      if (fuelLeft > 250 && errAngle < 3.0) grade = 'S';
      else if (fuelLeft > 200 && errAngle < 6.0) grade = 'A';
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

  if (isFireworksActive) {
    fireworkTimer += dt;
    const pos = fwGeo.attributes.position.array;
    for (let i = 0; i < FIREWORK_COUNT; i++) {
      pos[i * 3] += fwVel[i * 3] * dt;
      pos[i * 3 + 1] += fwVel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += fwVel[i * 3 + 2] * dt;
      fwVel[i * 3] *= 0.96;
      fwVel[i * 3 + 1] *= 0.96;
      fwVel[i * 3 + 2] *= 0.96;
    }
    fwGeo.attributes.position.needsUpdate = true;
    fwMat.opacity = Math.max(0, 1.0 - fireworkTimer / 2.5);
    if (fireworkTimer > 2.5) isFireworksActive = false;
  }

  if (clouds) clouds.rotation.y += dt * 0.003;
  if (clouds2) clouds2.rotation.y += dt * 0.007;
  if (earthShaderMat && earthShaderMat.uniforms.uTime) {
    earthShaderMat.uniforms.uTime.value = now * 0.001;
  }
  if (corona) {
    const pulse = 180 + Math.sin(now / 1400) * 14;
    corona.scale.set(pulse, pulse, 1);
  }
  if (beacons) {
    const phase = Math.sin(now / 650) > 0;
    for (let i = 0; i < beacons.length; i++) {
      beacons[i].material.emissiveIntensity = (i % 2 === 0) ? (phase ? 2.8 : 0.05) : (phase ? 0.05 : 2.8);
    }
  }
  if (rcsPlumes) {
    const tx = controls.transInput.x;
    const ty = controls.transInput.y;
    if (rcsPlumes.left) rcsPlumes.left.material.opacity = Math.max(0, -tx * 0.9);
    if (rcsPlumes.right) rcsPlumes.right.material.opacity = Math.max(0, tx * 0.9);
    if (rcsPlumes.up) rcsPlumes.up.material.opacity = Math.max(0, -ty * 0.9);
    if (rcsPlumes.down) rcsPlumes.down.material.opacity = Math.max(0, ty * 0.9);
  }
  if (wings) {
    for (let i = 0; i < wings.length; i++) {
      wings[i].rotation.x = Math.sin(now * 0.0015 + i * 1.2) * 0.006;
    }
  }

  impactFX.update(dt);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
