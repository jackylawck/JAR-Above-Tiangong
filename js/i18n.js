// js/i18n.js

// 優化 1：修正為小寫 export
export class I18nManager {
  constructor() {
    this.currentLang = 'zh-HK';
    
    // 優化 2：補齊所有最新的 GOTY 級遙測與狀態詞彙
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
        statusDocked: '對接鎖定成功 (HARD DOCK)',
        statusOverSpeed: '警告：接近超速！',
        statusAbort: '緊急退避程序已啟動！',
        
        // 補齊 HTML 中新增的詞彙
        altLabel: '高度',
        rpyLabel: '姿態(R/P/Y)',
        offsetLabel: '對接軸偏差',
        covLabel: 'MEKF方差'
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
        statusDocked: 'HARD DOCK SUCCESS',
        statusOverSpeed: 'APPROACH OVER-SPEED!',
        statusAbort: 'EMERGENCY ABORT RETREAT!',
        
        // 補齊 HTML 中新增的詞彙
        altLabel: 'ALT',
        rpyLabel: 'ATT(R/P/Y)',
        offsetLabel: 'OFFSET',
        covLabel: 'MEKF COV'
      }
    };

    // 優化 3：預先快取 DOM 節點，避免反覆查詢
    this.domCache = [];
    this.initDOMCache();
  }

  // 初始化時遍歷一次 DOM，並把指標存起來
  initDOMCache() {
    // ES Module 執行時 DOM 已準備就緒，可直接抓取
    const els = document.querySelectorAll('[data-i18n]');
    for (let i = 0; i < els.length; i++) {
      this.domCache.push({
        node: els[i],
        key: els[i].getAttribute('data-i18n')
      });
    }
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === 'zh-HK' ? 'en' : 'zh-HK';
    this.updateDOM();
    return this.currentLang;
  }

  updateDOM() {
    // 極致效能：直接遍歷快取陣列，0 次 DOM Tree 查詢，0 個回呼函數閉包
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
