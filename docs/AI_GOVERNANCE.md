# 🤖 演算法定性與 AI 治理架構聲明 (Algorithm Taxonomy & AI Governance Statement)

---

### 繁體中文

依據 **歐盟《人工智能法案》（EU AI Act）** 以及 **ISO/IEC 42001（人工智慧管理系統）** 標準，本文件對本專案所採用之控制與導航演算法進行合規性定性說明。

#### 1. 演算法本質：確定性經典數學模型 (Deterministic Classical Algorithms)
本專案名為「J.A.R.」，其內部導航、制導與控制（GNC）模組本質上為**確定性經典物理方程與數值方法**，不包含自我學習、深度神經網絡（DNN）或黑箱式自適應演算法：
* **姿態估計**：基於高斯噪聲假設之乘性擴展卡爾曼濾波器（MEKF）。
* **相對運動**：基於線性微擾引力理論之 Clohessy-Wiltshire (Hill) 解析步進解。
* **任務控制**：基於明確閾值規則之有限狀態機（Finite State Machine, FSM）。

#### 2. 歐盟 AI 法案（EU AI Act）風險分類
* **分類定性**：本專案自我評估為 **「最低風險 / 排除適用範疇（Minimal Risk / Out of Scope）」**。
* **合規依據**：本系統非關鍵基礎設施實體控制系統，非醫療、非軍事武器，亦不構成通用人工智能（GPAI）基礎模型。

#### 3. 透明度、可解釋性與可審計性 (Transparency & Explainability)
* **100% 原始碼開源**：所有矩陣運算常數、觀測方程與物理參數完全透明、可逐行白箱審計。
* **零偏差歧視風險**：演算法僅計算牛頓引力、歐拉運動學與克卜勒軌道幾何，不涉及任何生物識別、人類行為預測或信用評級。

---

### English

In reference to the **EU Artificial Intelligence Act (EU AI Act)** and **ISO/IEC 42001 (Artificial Intelligence Management System)** standards, this document defines the mathematical and algorithmic boundaries of the Project.

#### 1. Algorithmic Taxonomy: Deterministic Classical Physics
Although designated with the callsign "J.A.R.", the software’s Guidance, Navigation, and Control (GNC) pipeline is strictly comprised of **deterministic mathematical algorithms and analytical solvers**, rather than non-deterministic black-box Machine Learning (ML) models:
* **Attitude State Estimation**: Multiplicative Extended Kalman Filter (MEKF) based on linear Gaussian assumptions.
* **Relative Orbit Propagator**: Analytical closed-form solutions of Clohessy-Wiltshire (Hill's) linear equations.
* **Decision System**: Rule-based deterministic Finite State Machines (FSM).

#### 2. EU AI Act Risk Classification
* **Classification**: Assessed as **Minimal Risk / Out of Scope**.
* **Rationale**: The software is an educational demonstration running client-side. It does not govern physical safety-critical hardware, does not process biometric data, and does not qualify as a General Purpose AI (GPAI) model.

#### 3. Transparency, Explainability & Auditability
* **100% Open-Box Auditability**: All state matrices, sensor covariance values, and dynamical equations are fully open-source and auditable.
* **Absence of Algorithmic Bias**: The computation relies purely on invariant physical laws (Newtonian/Keplerian mechanics and Euclidean/Riemannian geometry) without sociological or biometric training inputs.
