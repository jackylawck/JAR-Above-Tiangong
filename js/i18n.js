// js/i18n.js
export class I18nManager {
  constructor() {
    this.currentLang = 'zh-HK';
    
    this.dict = {
      'zh-HK': {
        appTitle: 'J.A.R. 天宮之上 3D',
        fsmLabel: '狀態',
        rangeLabel: '距離',
        rateLabel: '速度',
        biasLabel: 'MEKF 零偏',
        fdirLabel: '星敏冗餘',
        fuelLabel: '燃料',
        massLabel: '總重',
        modeBtn: '手動',
        abortBtn: '中止',
        transLabel: '平移 (X/Y)',
        rotLabel: '姿態 (P/Y)',
        statusApproach: '沿軌進近 (V-BAR)',
        statusOvershoot: '⚠️ 已越過對接口！請向後推搖桿倒車',
        statusDocked: '🎉 HARD DOCK 對接成功！',
        statusOverSpeed: '警告：嚴重撞擊！任務失敗！',
        statusAbort: '緊急退避程序已啟動！',
        altLabel: '高度',
        rpyLabel: '姿態(R/P/Y)',
        offsetLabel: '偏差',
        progressLabel: '接近進度',
        
        diffKid: '🧒 兒童模式',
        diffPro: '🛠️ 進階模式',
        diffSci: '🔬 科學模式',
        modeAuto: '自動',
        modeManual: '手動',
        modeLocked: '手動 (鎖定)',
        // 🚀 移除 Jarvis 稱謂
        narrKid: '天宮就喺眼前！大膽推前推進，衝過頭可以向後拉倒車！',
        narrSci: '警告：輔助系統已離線。請全手動精確對接。',
        narrPro: '指揮官，CW 導航已啟動，請控制接近率。',
        narrFail: '結構應力過載... 任務失敗！',
        statusFail: '💀 任務失敗 (MISSION FAILED)',
        narrSuccess: '對接機構鎖定！任務圓滿成功！',
        alertSci: '🔬 [SCIENTIST MODE ACTIVE]\n科學模式已強制鎖定：禁止推力過載！',
        alertBird: '🦅 [CALLSIGN: FIRE BIRD UNLOCKED]\n已啟動「火鷹」特技飛行模式：RCS 推力限制解除！'
      },
      'en': {
        appTitle: 'J.A.R. Above Tiangong 3D',
        fsmLabel: 'STATE',
        rangeLabel: 'RNG',
        rateLabel: 'RATE',
        biasLabel: 'BIAS',
        fdirLabel: 'FDIR',
        fuelLabel: 'FUEL',
        massLabel: 'MASS',
        modeBtn: 'MANUAL',
        abortBtn: 'ABORT',
        transLabel: 'Trans (X/Y)',
        rotLabel: 'Attitude (P/Y)',
        statusApproach: 'V-BAR APPROACH',
        statusOvershoot: '⚠️ OVERSHOOT! Pull back stick to reverse',
        statusDocked: '🎉 HARD DOCK SUCCESS!',
        statusOverSpeed: 'CRITICAL IMPACT! MISSION FAILED!',
        statusAbort: 'EMERGENCY RETREAT ACTIVE!',
        altLabel: 'ALT',
        rpyLabel: 'ATT(R/P/Y)',
        offsetLabel: 'OFFSET',
        progressLabel: 'PROGRESS',
        
        diffKid: '🧒 KID MODE',
        diffPro: '🛠️ PRO MODE',
        diffSci: '🔬 SCI MODE',
        modeAuto: 'AUTO',
        modeManual: 'MANUAL',
        modeLocked: 'MANUAL (LOCKED)',
        // 🚀 移除 Jarvis 稱謂
        narrKid: 'Tiangong is right ahead! Push forward to thrust, pull back to reverse if overshot!',
        narrSci: 'WARNING: Assists offline. Manual precision docking required.',
        narrPro: 'Commander, CW Nav active. Control approach rate.',
        narrFail: 'Structural stress critical... Mission Failed!',
        statusFail: '💀 MISSION FAILED',
        narrSuccess: 'Hard Dock Confirmed! Mission accomplished!',
        alertSci: '🔬 [SCIENTIST MODE ACTIVE]\nLocked in Scientist Mode: Overdrive prohibited!',
        alertBird: '🦅 [CALLSIGN: FIRE BIRD UNLOCKED]\nAcrobatic mode engaged: RCS thrust limits removed!'
      }
    };

    this.domCache = [];
    this.initDOMCache();
  }

  initDOMCache() {
    const els = document.querySelectorAll('[data-i18n]');
    for (let i = 0; i < els.length; i++) {
      this.domCache.push({ node: els[i], key: els[i].getAttribute('data-i18n') });
    }
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === 'zh-HK' ? 'en' : 'zh-HK';
    this.updateDOM();
    return this.currentLang;
  }

  updateDOM() {
    for (let i = 0; i < this.domCache.length; i++) {
      const item = this.domCache[i];
      const text = this.dict[this.currentLang][item.key];
      if (text) {
        item.node.textContent = text;
      }
    }
  }

  t(key) {
    return this.dict[this.currentLang][key] || key;
  }
}
