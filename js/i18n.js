export class I18nManager {
  constructor() {
    this.currentLang = 'zh-HK';
    this.dict = {
      'zh-HK': {
        appTitle: 'J.A.R. 天宮之上 3D',
        fsmLabel: '狀態機',
        rangeLabel: '距離',
        rateLabel: '相對速度',
        biasLabel: 'MEKF 零偏',
        fdirLabel: '星敏冗餘',
        fuelLabel: '燃料',
        massLabel: '總重',
        modeBtn: '模式: 自動',
        abortBtn: '緊急中止 (ABORT)',
        transLabel: 'RCS 平移 (X/Y)',
        rotLabel: '姿態 (P/Y)',
        statusApproach: '沿軌進近 (V-BAR)',
        statusDocked: '對接鎖定成功 (HARD DOCK)',
        statusOverSpeed: '警告：接近超速！',
        statusAbort: '緊急退避程序已啟動！'
      },
      'en': {
        appTitle: 'J.A.R. Above Tiangong 3D',
        fsmLabel: 'FSM',
        rangeLabel: 'Range',
        rateLabel: 'Rel Speed',
        biasLabel: 'MEKF Bias',
        fdirLabel: 'FDIR TMR',
        fuelLabel: 'Fuel',
        massLabel: 'Mass',
        modeBtn: 'MODE: AUTO',
        abortBtn: 'EMERGENCY ABORT',
        transLabel: 'RCS Trans (X/Y)',
        rotLabel: 'Attitude (P/Y)',
        statusApproach: 'V-BAR APPROACH',
        statusDocked: 'HARD DOCK SUCCESS',
        statusOverSpeed: 'APPROACH OVER-SPEED!',
        statusAbort: 'EMERGENCY ABORT RETREAT!'
      }
    };
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === 'zh-HK' ? 'en' : 'zh-HK';
    this.updateDOM();
    return this.currentLang;
  }

  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (this.dict[this.currentLang][key]) el.textContent = this.dict[this.currentLang][key];
    });
  }

  t(key) {
    return this.dict[this.currentLang][key] || key;
  }
}
