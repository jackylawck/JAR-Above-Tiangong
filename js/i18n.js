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
        modeBtn: '模式: 自動',
        abortBtn: '緊急中止',
        transLabel: 'RCS 平移 (X/Y)',
        rotLabel: '姿態 (P/Y)',
        statusApproach: '沿軌進近 (V-BAR)',
        statusDocked: '🎉 HARD DOCK 對接成功！',
        statusOverSpeed: '警告：接近超速！',
        statusAbort: '緊急退避程序已啟動！',
        altLabel: '高度',
        rpyLabel: '姿態(R/P/Y)',
        offsetLabel: '偏差',
        progressLabel: '接近進度',
        
        diffKid: '🧒 兒童模式',
        diffPro: '🛠️ 進階模式',
        diffSci: '🔬 科學模式',
        modeAuto: '模式: 自動',
        modeManual: '模式: 手動',
        modeLocked: '模式: 手動 (鎖定)',
        narrKid: 'Jarvis，準備好對接了嗎？交給你了！大膽推搖桿吧！',
        narrSci: '警告：輔助系統已離線。請全手動精確對接。',
        narrPro: '指揮官，我是 J.A.R.，CW 導航已啟動，請控制接近率。',
        narrFail: '結構應力過載... 任務失敗！',
        statusFail: '💀 任務失敗 (MISSION FAILED)',
        narrSuccess: '對接機構鎖定！J.A.R. 祝賀您，任務圓滿成功！',
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
        modeBtn: 'MODE: AUTO',
        abortBtn: 'EMERGENCY ABORT',
        transLabel: 'RCS Trans (X/Y)',
        rotLabel: 'Attitude (P/Y)',
        statusApproach: 'V-BAR APPROACH',
        statusDocked: '🎉 HARD DOCK SUCCESS!',
        statusOverSpeed: 'APPROACH OVER-SPEED!',
        statusAbort: 'EMERGENCY ABORT RETREAT!',
        altLabel: 'ALT',
        rpyLabel: 'ATT(R/P/Y)',
        offsetLabel: 'OFFSET',
        progressLabel: 'PROGRESS',
        
        diffKid: '🧒 KID MODE',
        diffPro: '🛠️ PRO MODE',
        diffSci: '🔬 SCI MODE',
        modeAuto: 'MODE: AUTO',
        modeManual: 'MODE: MANUAL',
        modeLocked: 'MODE: MANUAL (LOCKED)',
        narrKid: 'Jarvis, ready to dock? You have control. Push the stick!',
        narrSci: 'WARNING: Assists offline. Manual precision docking required.',
        narrPro: 'Commander, this is J.A.R. CW Nav active. Control approach rate.',
        narrFail: 'Structural stress critical... Mission Failed!',
        statusFail: '💀 MISSION FAILED',
        narrSuccess: 'Docking mechanism locked! J.A.R. congratulates you on success!',
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
