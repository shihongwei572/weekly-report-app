const CONFIG = {
  depts: ['珠三角', '粤西', '广西', '福建', '海南'],

  regions: ['沿海大区', '珠三角', '粤西', '广西', '福建', '海南'],

  intentVarieties: ['国产玉米', '进口大麦', '进口高粱', '进口木薯片', '饲用小麦', 'DDGS', '食用小麦', '食用稻谷', '饲用稻谷', '国产大豆', '进口玉米', '葵花籽粕'],

  chartColorMap: {
    '国产玉米': '#2563eb',
    '进口玉米': '#1d4ed8',
    'DDGS': '#0891b2',
    '食用小麦': '#ca8a04',
    '饲用小麦': '#16a34a',
    '国产大豆': '#dc2626',
    '葵花籽粕': '#9333ea',
    '进口大麦': '#c2410c',
    '进口木薯片': '#0d9488',
    '进口高粱': '#be123c',
    '食用稻谷': '#4d7c0f',
    '饲用稻谷': '#65a30d',
  },

  contractVarieties: [
    { key: '国产玉米', match: ['国产玉米', '内贸玉米'] },
    { key: '进口玉米', match: ['进口玉米'] },
    { key: '进口大麦', match: ['进口大麦'] },
    { key: '进口高粱', match: ['进口高粱'] },
    { key: '进口木薯片', match: ['进口木薯片'] },
    { key: '进口葵花籽粕', match: ['进口葵花籽粕'] },
    { key: 'DDGS', match: ['进口DDGS（蛋白）', 'DDGS'] },
    { key: '小麦', match: ['小麦', '食用小麦', '饲用小麦'] },
    { key: '稻谷', match: ['稻谷', '食用稻谷', '饲用稻谷'] },
    { key: '国产大豆', match: ['国产大豆', '大豆', '进口大豆'] },
  ],

  contractTextOrder: ['内贸玉米', '进口玉米', '进口大麦', '进口高粱', '进口木薯片', '进口葵花籽粕', '进口DDGS（蛋白）', '小麦', '稻谷', '国产大豆'],

  contractPlan: {
    '珠三角': { '国产玉米': 320, '进口高粱组': 115, '小麦': 48, '稻谷': 6.5, '进口大豆': 7.9, '合计': 497.4 },
    '粤西': { '国产玉米': 146, '进口高粱组': 40, '小麦': 6, '稻谷': 0.5, '进口大豆': 1.3, '合计': 193.8 },
    '广西': { '国产玉米': 111, '进口高粱组': 35, '小麦': 8, '稻谷': 6, '进口大豆': 1.8, '合计': 161.8 },
    '福建': { '国产玉米': 117, '进口高粱组': 16, '小麦': 32, '稻谷': 6.5, '进口大豆': 1.8, '合计': 173.3 },
    '海南': { '国产玉米': 76, '进口高粱组': 20, '小麦': 6, '稻谷': 0.5, '进口大豆': 0.2, '合计': 102.7 },
    '沿海大区': { '国产玉米': 770, '进口高粱组': 226, '小麦': 100, '稻谷': 20, '进口大豆': 13, '合计': 1129 },
  },

  contractGroups: [
    { key: '国产玉米', label: '国产玉米', category: '饲用', products: ['国产玉米', '内贸玉米'] },
    { key: '进口高粱组', label: '进口替代', category: '饲用', products: ['进口高粱', '进口玉米', '进口大麦', '进口木薯片', '进口葵花籽粕', '进口DDGS（蛋白）', 'DDGS'] },
    { key: '小麦', label: '小麦', category: '食用', products: ['小麦', '食用小麦', '饲用小麦'] },
    { key: '稻谷', label: '稻谷', category: '食用', products: ['稻谷'] },
    { key: '进口大豆', label: '大豆', category: '食用', products: ['进口大豆', '大豆', '国产大豆', '塔豆'] },
  ],

  contractCategories: [
    { key: '饲用', label: '饲用', groups: ['国产玉米', '进口高粱组'] },
    { key: '食用', label: '食用', groups: ['小麦', '稻谷', '进口大豆'] },
  ],

  settleVarietyMap: [
    { key: '国产玉米', match: ['国产玉米'] },
    { key: '进口高粱组', match: ['进口高粱', '进口大麦', '进口木薯干', '进口木薯片', '进口葵花籽粕', '进口玉米', 'DDGS', '进口DDGS'] },
    { key: '小麦', match: ['麦'] },
    { key: '稻谷', match: ['稻谷', '籼', '粳'] },
    { key: '进口大豆', match: ['大豆', '塔豆'] },
  ],

  lastmileDeptPlan: {
    '珠三角': 30, '粤西': 30, '广西': 30, '福建': 35, '海南': 35, '沿海大区': 28,
  },

  lastmileVarietyPlan: {
    '国产玉米': 30, '小麦': 35, '稻谷': 35, '大豆': 95,
  },

  containerPlan: {
    '珠三角': 41, '粤西': 11, '广西': 21, '福建': 16, '海南': 16,
  },

  groupToVarietyKeys: {
    '国产玉米': ['国产玉米'],
    '进口高粱组': ['进口玉米', '进口大麦', '进口高粱', '进口木薯片', '进口葵花籽粕', 'DDGS'],
    '小麦': ['小麦'],
    '稻谷': ['稻谷'],
    '进口大豆': ['国产大豆'],
  },
};

(function () {
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadUserConfig() {
    try {
      const saved = localStorage.getItem('weekly_report_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch (e) {
      console.warn('读取用户配置失败，使用默认配置', e);
    }
    return null;
  }

  function getConfig(key) {
    const userCfg = loadUserConfig();
    if (userCfg && userCfg[key] !== undefined) {
      return userCfg[key];
    }
    return CONFIG[key];
  }

  function getAllConfig() {
    const userCfg = loadUserConfig();
    if (userCfg) {
      return Object.assign({}, CONFIG, userCfg);
    }
    return deepClone(CONFIG);
  }

  window.CONFIG = CONFIG;
  window.getConfig = getConfig;
  window.getAllConfig = getAllConfig;
})();