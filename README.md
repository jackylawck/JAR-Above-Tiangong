# 🛰️ J.A.R. 天宮之上 3D | JAR Above Tiangong 3D

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL](https://img.shields.io/badge/WebGL-Three.js-cyan.svg)](https://threejs.org/)
[![GNC](https://img.shields.io/badge/GNC-CW_Relative_Motion-orange.svg)](#-航太級導控物理模型--aerospace-grade-physics--gnc)
[![Optimization](https://img.shields.io/badge/Performance-Zero_Allocation_60FPS-brightgreen.svg)](#)
[![Status](https://img.shields.io/badge/Status-Gold_Master_V4.5-gold.svg)](#)

---

## 📖 關於本專案 (About This Project)

### 繁體中文
這是為了我和兒子共渡美好時光而打造的個人非商業航太科普專案！我們希望重建一座高精度的天宮空間站（CSS），讓孩子能感受太空探索的純粹樂趣。誠邀所有朋友一同化身神舟飛船指揮官，體驗精準對接天宮核心艙的挑戰與成就感！

### English
This project is a personal, non-commercial aerospace education endeavor created to share meaningful time with my son. We aim to recreate a high-fidelity model of the Tiangong Space Station (CSS), allowing children to experience the pure joy of space exploration. We warmly invite everyone to step into the role of a Shenzhou spacecraft commander, take on the challenge of precisely docking with the Tiangong core module, and experience the satisfaction of a successful manual docking.

---

## 🌟 核心特色 (Key Features)

### 繁體中文
* **🎬 電影級純代碼著色器與地月光學系統 (Cinematic Procedural Shaders & Celestial Optics)**：
  * 基於 Three.js 的 ACES Filmic 色調映射管線，還原深空極致黑白高對比光學環境。
  * **GPU 3D Simplex 噪聲地球**：純數學演算生成深海淺灘漸變、大陸板塊、極地冰帽及暗面動態城市夜光。
  * **Rayleigh 大氣散射與日冕脈動**：動態晝夜終結線（Terminator）暮光暈染，搭配呼吸脈動的太陽日冕與程序化月球隕石坑。
  * **雙層動態視差雲層**：以不同角速度飄移的物理陰影雲層，營造逼真大氣立體感。

* **🔬 航太級導控物理模型 (Aerospace-Grade Physics & GNC Engine)**：
  * **Clohessy-Wiltshire (C-W / Hill) 方程解析解**：精確模擬微重力環境下空間站附近的橢圓相對軌道運動與漂移。
  * **MEKF 乘性擴展卡爾曼濾波器**：實時估算飛船姿態四元數與陀螺儀零偏，對抗星敏冗餘量測噪聲。
  * **執行機構限幅與平移慣性**：嚴格依據載人飛船質量比模擬 RCS 推進器變化率與慣性煞車滑行。
  * **CAS 自適應難度狀態機**：
    * 🧒 **兒童模式（KID）**：4 倍推力響應、自動微磁吸輔助、放寬超速碰撞閾值至 $1.2\text{ m/s}$。
    * 🛠️ **進階模式（PRO）**：平衡手感，具備標準接近限制與動態聲景反饋。
    * 🔬 **科學模式（SCIENTIST）**：全手動無輔助，真實 $0.12\text{ m/s}$ 嚴格對接安全閾值。

* **🛰️ 天宮空間站完整 T 字構型還原 (Authentic Tiangong Architecture)**：
  * **完整模組建模**：天和核心艙（大柱段/小柱段/節點艙）、問天實驗艙（氣閘艙）、夢天實驗艙（載荷艙）。
  * **停泊與貨運組合體**：節點艙下方停泊神舟飛船，核心艙尾部對接天舟貨運飛船與艙外機械臂。
  * **柔性太陽翼微顫動**：雙翼超大光伏陣列具備微重力結構彈性動態。
  * **信標燈與 RCS 尾焰**：航太紅藍防撞閃爍 Beacon 燈組，以及四角外側響應搖桿輸入的離子噴焰。

* **⚡ 60FPS 零記憶體分配主迴圈 (Zero-Allocation Architecture)**：
  * 徹底消滅主迴圈（`animate`）內的動態物件分配、閉包回呼與解構賦值，完全消除 JavaScript 垃圾回收（GC）引起的卡頓。
  * 底層採用 `Float64Array` 進行連續記憶體物理狀態步進，確保在行動裝置長時間穩定運行。

* **🎆 沉浸式 HUD、多語言與 3A 結算體驗 (Immersive HUD, i18n & Fireworks FX)**：
  * **CBARS 光學瞄準具**：實時投影空間站對接口至第一人稱 HUD。
  * **動態數據可視化**：接近進度百分比、距離變色階梯與超速呼吸警報提示。
  * **對接成功煙火與鏡頭震顫**：硬對接完成時激發 600 枚彩色物理粒子煙火與鏡頭衝擊波。
  * **雙語即時熱切換**：繁體中文與英文全介面支援，打字機敘事對話即時翻譯。

---

### English
* **🎬 Cinematic Procedural Shaders & Celestial Optics**:
  * ACES Filmic tone mapping in Three.js for high-contrast deep space illumination.
  * **Procedural 3D Simplex Earth**: Procedurally rendered ocean depth gradients, continental terrain, polar ice caps, and night-side city glow.
  * **Rayleigh Atmospheric Scattering & Solar Corona**: Dynamic terminator twilight glow paired with a pulsating solar corona and cratered procedural Moon.
  * **Dual-Layer Parallax Clouds**: Realistic multi-altitude cloud dynamics rendered with physical shading.

* **🔬 Aerospace-Grade Physics & GNC Engine**:
  * **Clohessy-Wiltshire (C-W) Analytical Solver**: Accurate relative motion kinematics in the Local-Vertical/Local-Horizontal (LVLH) frame.
  * **Multiplicative Extended Kalman Filter (MEKF)**: Real-time attitude quaternion and gyro bias estimation robust against sensor noise.
  * **RCS Rate Limiting & Inertial Dynamics**: Authentic mass-ratio-dependent thruster response curves.
  * **Adaptive Difficulty State Machine (CAS)**:
    * 🧒 **KID Mode**: $4\times$ translational thrust, magnetic docking assist, and relaxed collision tolerance up to $1.2\text{ m/s}$.
    * 🛠️ **PRO Mode**: Balanced flight controls with standard orbital safety envelopes.
    * 🔬 **SCIENTIST Mode**: Pure manual control with strict $0.12\text{ m/s}$ hard docking constraints.

* **🛰️ Authentic Tiangong T-Shape Architecture**:
  * **Complete Structural Hierarchy**: Tianhe Core Module, Wentian Lab Module (Airlock), and Mengtian Lab Module (Cargo Airlock).
  * **Visiting Vehicles**: Docked Shenzhou crew spacecraft, aft-docked Tianzhou cargo vessel, and robotic arm elements.
  * **Flexible Solar Array Aero-Dynamics**: Subtle microgravity structural oscillations on main solar arrays.
  * **Active Beacons & RCS Plumes**: Dynamic anti-collision strobes and quad-thruster ion plumes reacting to joystick inputs.

* **⚡ 60FPS Zero-Allocation Runtime**:
  * Complete elimination of runtime heap allocations, closure callbacks, and array destructuring inside the main loop to prevent GC stuttering.
  * Native `Float64Array` state vectors ensure sustained 60FPS performance on mobile devices.

* **🎆 Immersive HUD, Dynamic i18n & Docking Fireworks FX**:
  * **CBARS Optical Reticle**: Real-time HUD projection aligning with the target docking port.
  * **Dynamic Telemetry Feedback**: Progress indicator, adaptive distance color gradients, and over-speed warning pulses.
  * **Victory Fireworks & Camera Shake**: 600 procedural particle fireworks and physical camera vibration upon hard dock.
  * **Live Dual-Language Hot-Swapping**: Full UI and narrative localization across Traditional Chinese (繁中) and English.

---

## 🗂️ 模組架構 (Architecture)

```text
JAR-Above-Tiangong-3D/
├── index.html               # 應用程式入口、PWA 標籤、全息 HUD 與搖桿佈局 / App Entry & HUD
├── manifest.json            # PWA 安裝配置與圖示設定 / PWA Manifest
├── css/
│   └── mobile-style.css     # 賽博風 HUD 樣式、雙搖桿佈局與安全區適配 / Styles & RWD
└── js/
    ├── app.js               # 主迴圈、零分配變數池、煙火系統與任務管理 / Main Loop & Manager
    ├── i18n.js              # 繁中 / 英文雙語國際化字典與 DOM 快取 / Localization System
    ├── controls/
    │   └── touch_controls.js# 虛擬平移與旋轉雙搖桿觸控模組 / Virtual Touch Joysticks
    ├── gnc/
    │   ├── mekf.js          # 乘性擴展卡爾曼濾波器姿態解算 / MEKF Attitude Estimator
    │   ├── fsm.js           # 任務有限狀態機與難度仲裁 / Mission FSM & Difficulty Arbiter
    │   ├── fdir.js          # 星敏冗餘容錯與故障診斷 / Sensor FDIR Voting System
    │   └── sensor_time_sync.js # 感測器時延補償與插值同步 / Sensor Time Synchronizer
    ├── physics/
    │   └── spacecraft_core.js  # C-W 相對軌道動力學與四元數積分引擎 / C-W Dynamics Engine
    ├── render/
    │   ├── station_scene.js # 電影級地球、月球、太陽日冕與天宮空間站構型 / 3D Celestial Scene
    │   └── impact_effects.js# 碰撞解體、粒子碎片與視覺衝擊特效 / Failure FX Pipeline
    └── audio/
        └── space_audio.js   # Web Audio API 空間推進音效與任務警報 / Procedural Soundscape

```

---

## 📜 授權條款 (License)

本專案採用 MIT License 授權開源。歡迎教育工作者、航太愛好者自由使用、修改與二次開發！

This project is open-source software licensed under the MIT License.
