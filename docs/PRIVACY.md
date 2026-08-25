# 🔒 數據隱私與零資料收集政策 (Privacy & Zero-Data Collection Policy)

---

### 繁體中文

本專案恪守歐盟《一般資料保護規則》（GDPR）、中華人民共和國《個人信息保護法》（PIPL）以及香港《個人資料（私隱）條例》（PDPO）之最高隱私與資料安全標準。

#### 1. 邊緣計算與零數據收集 (Client-Side Computing & Zero Collection)
* **無伺服器架構**：本模擬器為 100% 純前端（Client-Side WebGL）應用程式。所有物理運算、卡爾曼濾波解算與圖形渲染均在使用者本機瀏覽器端執行。
* **零個人身分識別資料（PII）**：本專案不設後端伺服器（No Backend Server），不設資料庫，完全不收集、不儲存、不處理且不向任何第三方跨境傳輸任何個人姓名、IP 位址、裝置指紋或地理位置資料。

#### 2. 無 Cookies 與追蹤器聲明 (No Cookies & No Trackers)
本專案嚴格拒絕使用任何商業追蹤 Cookies、廣告 SDK 或第三方行為分析工具（例如 Google Analytics、Facebook Pixel 等）。

#### 3. 本機快取說明 (Local Storage & Cache Transparency)
本專案之 `manifest.json` 僅用於支援漸進式 Web 應用程式（PWA）之「加入主畫面」功能及靜態資源離線載入，絕不進行任何隱私追蹤資料之持久化儲存。

---

### English

This Project adheres to the highest privacy and data minimization standards, including the EU General Data Protection Regulation (GDPR), the PRC Personal Information Protection Law (PIPL), and the Hong Kong Personal Data (Privacy) Ordinance (PDPO).

#### 1. Edge/Client-Side Computing & Zero Data Collection
* **No-Backend Architecture**: This simulator is a 100% client-side WebGL application. All physics integration, state filtering, and visual rendering execute entirely within the user's local browser runtime.
* **Zero Personally Identifiable Information (PII)**: The Project operates without backend servers or databases. It does NOT collect, store, process, or transmit any user PII, IP addresses, device telemetry, or behavioral fingerprints to any server.

#### 2. Cookie-Free & Tracker-Free Policy
The Project contains no tracking cookies, commercial SDKs, advertising beacons, or third-party behavioral analytics platforms (e.g., Google Analytics).

#### 3. Local Cache & Offline Manifest
The `manifest.json` and client-side browser caching mechanisms are used strictly to enable Progressive Web App (PWA) "Add to Home Screen" capabilities and static asset offline execution. No tracking data is persisted.
