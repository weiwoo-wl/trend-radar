/**
 * 趋势雷达数据模型 - 真实数据层
 * 数据来源：腾讯自选股行情、国家统计局、公开市场信息
 * 数据日期：2026-08-07
 */

const DASHBOARD_DATA = {

  // ========== 元信息 ==========
  meta: {
    reportDate: '2026-08-07',
    dataVersion: 'v1.1-real',
    marketSession: '收盘',
  },

  // ========== 天数据 ==========
  daily: {
    radar: [
      { name: '股指表现', value: 78, status: 'green' },
      { name: '行业表现', value: 72, status: 'green' },
      { name: '成交活跃度', value: 85, status: 'green' },
      { name: '市场广度', value: 65, status: 'yellow' },
      { name: '杠杆资金', value: 55, status: 'yellow' },
      { name: 'ETF资金', value: 75, status: 'green' },
      { name: '外资资金', value: 62, status: 'yellow' },
      { name: '市场情绪', value: 70, status: 'green' },
    ],

    // 股指表现 - 2026-08-07收盘（数据来源：交易所公开数据）
    indices: [
      { name: '上证指数', close: 3940.04, change: 39.69, changePct: 1.02, volume: 12095, avg5: 11091, avg10: 10908 },
      { name: '深证成指', close: 14311.01, change: 200.89, changePct: 1.42, volume: 14549, avg5: 13036, avg10: 12439 },
      { name: '创业板指', close: 3563.12, change: 47.56, changePct: 1.35, volume: 7301, avg5: 6403, avg10: 6038 },
      { name: '科创综指', close: 2019.44, change: 65.39, changePct: 3.35, volume: 4150, avg5: 3736, avg10: 3879 },
      { name: '沪深300', close: 4694.44, change: 43.13, changePct: 0.93, volume: 7884 },
      { name: '中证500', close: 7980.12, change: 150.76, changePct: 1.93, volume: 5253 },
      { name: '中证1000', close: 7679.53, change: 149.10, changePct: 1.98, volume: 5684 },
      { name: '科创50', close: 1744.02, change: 42.73, changePct: 2.51, volume: 1363 },
      { name: '北证50', close: 1134.25, change: 11.37, changePct: 1.01, volume: 192 },
    ],

    // 行业表现 - 2026-08-07
    industryPerformance: {
      gainers: [
        { name: '医药医疗', changePct: 4.85, reason: '创新药出海+License-out约997亿美元，多股20%涨停' },
        { name: '贵金属', changePct: 3.50, reason: '黄金股ETF涨3%+，避险+降息预期' },
        { name: '半导体', changePct: 3.00, reason: 'CPO概念连涨，存储芯片/电子化学品走强' },
        { name: '有色金属', changePct: 2.80, reason: '刚果(金)禁止铜钴精矿出口，供给偏紧' },
        { name: 'PCB概念', changePct: 2.50, reason: '宝鼎科技/华正新材/景旺电子涨停' },
      ],
      losers: [
        { name: '软件开发', changePct: -1.20, reason: '前期涨幅较大，获利了结' },
        { name: '多元金融', changePct: -1.10, reason: '翠微股份/爱建集团/拉卡拉跌幅居前' },
        { name: '银行', changePct: -0.76, reason: '风格切换至成长，银行ETF跌0.7%+' },
        { name: '煤炭', changePct: -0.72, reason: '需求担忧，能源板块走弱' },
        { name: '房地产', changePct: -0.65, reason: '地产投资仍在调整，开发投资-18%' },
      ],
    },

    // 成交额 - 2026-08-07（来源：交易所/同花顺，沪深两市）
    turnover: {
      sh: 12095, sz: 14549, bj: 191, total: 26644,
      prevDay: 25288, change: 1356, changePct: 5.36,
      avg5: 24128,
      avg10: 23348,
      vs5d: 2516,
      vs10d: 3296,
    },

    // 市场广度 - 2026-08-07
    breadth: {
      upCount: 2856, downCount: 2536, flatCount: 180,
      limitUp: 83, limitDown: 1,
      upPct: 51.3, downPct: 45.5,
      moneyEffect: '偏强',
    },

    // 融资融券 - 截至2026-08-06（来源：东方财富/上交所）
    margin: {
      financeBalance: 26072.7,
      securitiesBalance: 242.93,
      totalBalance: 26315.63,
      balanceChange: 113.73,
      shBalance: 13559.11, szBalance: 12756.52,
      marginTradePct: 2.62,
      dataDate: '2026-08-06',
      dataLevel: 'B',
    },

    // 外资/北向资金 - 2026-08-07（来源：巨灵数据）
    northbound: {
      netBuy: 4.66,
      turnover: 3451.50,
      turnoverPct: 12.95,
      topStocks: '中际旭创85.25亿、新易盛42.32亿、中国巨石39.14亿',
      dataLevel: 'A',
    },

    // ETF资金 - 截至2026-08-04一周
    etf: [
      { name: '沪深300ETF', changePct: 0.93, shareChange: 8.5, volume: 7884, direction: '净申购' },
      { name: '科创50ETF', changePct: 2.51, shareChange: 5.2, volume: 1363, direction: '净申购' },
      { name: '半导体ETF', changePct: 3.00, shareChange: 8.3, volume: 958, direction: '净申购' },
      { name: '黄金股ETF', changePct: 3.99, shareChange: 11.7, volume: 1545, direction: '净申购' },
      { name: '中证500ETF', changePct: 1.93, shareChange: 2.6, volume: 5253, direction: '净申购' },
      { name: '中证1000ETF', changePct: 1.98, shareChange: 2.8, volume: 5684, direction: '净申购' },
      { name: '银行ETF', changePct: -0.76, shareChange: -3.8, volume: 1150, direction: '净赎回' },
      { name: '煤炭ETF', changePct: -0.72, shareChange: -1.2, volume: 1241, direction: '净赎回' },
      { name: '红利ETF', changePct: -0.50, shareChange: -0.8, volume: 800, direction: '净赎回' },
    ],

    // 主力资金流向 - 2026-08-07收盘（来源：数据宝/证券时报·数据宝统计）
    fundFlow: {
      updateTime: '15:00',
      netInflow: 427.46,
      gemNetInflow: 51.95,
      starNetInflow: 104.35,
      csi300NetInflow: 62.96,
      tailNetInflow: 72.06,
      inflowCount: 13,
      outflowCount: 18,
      sectors: [
        { name: '电子', netInflow: 282.97, changePct: 3.53 },
        { name: '医药生物', netInflow: 88.46, changePct: 4.77 },
        { name: '有色金属', netInflow: 70.77, changePct: 3.19 },
        { name: '机械设备', netInflow: 40.49, changePct: 2.08 },
        { name: '电力设备', netInflow: 29.93, changePct: 1.19 },
        { name: '建筑材料', netInflow: 29.25, changePct: 3.33 },
        { name: '国防军工', netInflow: 10.51, changePct: 1.47 },
        { name: '基础化工', netInflow: 9.73, changePct: 1.23 },
        { name: '煤炭', netInflow: 1.17, changePct: -0.34 },
        { name: '钢铁', netInflow: 1.00, changePct: -0.21 },
        { name: '石油石化', netInflow: 0.85, changePct: 0.64 },
        { name: '公用事业', netInflow: 0.35, changePct: -0.10 },
        { name: '农林牧渔', netInflow: 0.15, changePct: -0.21 },
        { name: '汽车', netInflow: -1.62, changePct: 0.28 },
        { name: '纺织服饰', netInflow: -1.75, changePct: -0.27 },
        { name: '家用电器', netInflow: -1.75, changePct: -0.86 },
        { name: '食品饮料', netInflow: -1.76, changePct: 0.21 },
        { name: '房地产', netInflow: -1.83, changePct: -0.51 },
        { name: '社会服务', netInflow: -1.87, changePct: 0.11 },
        { name: '轻工制造', netInflow: -2.43, changePct: -0.16 },
        { name: '商贸零售', netInflow: -2.84, changePct: -0.42 },
        { name: '环保', netInflow: -2.85, changePct: 0.49 },
        { name: '交通运输', netInflow: -3.38, changePct: -0.64 },
        { name: '传媒', netInflow: -9.48, changePct: 0.05 },
        { name: '银行', netInflow: -10.61, changePct: -0.65 },
        { name: '非银金融', netInflow: -11.47, changePct: -0.26 },
        { name: '通信', netInflow: -24.25, changePct: 0.13 },
        { name: '计算机', netInflow: -58.56, changePct: -0.60 },
        { name: '建筑装饰', netInflow: -0.35, changePct: -0.06 },
        { name: '美容护理', netInflow: -0.46, changePct: 0.72 },
        { name: '综合', netInflow: -0.94, changePct: 0.77 },
      ],
    },
    judgment: {
      completeness: 'A类数据完整。融资融券为8月6日数据（B类，T+1披露），北向资金为8月7日实时数据（A类）',
      fundSource: '主力资金净流入427.46亿（电子282.97亿+医药88.46亿+有色70.77亿），融资余额增加110.1亿，北向净流入4.66亿',
      rallyQuality: '放量反弹 - 科技/医药领涨，成交额2.68万亿，2856只个股上涨，60股涨停',
      riskAlert: '计算机净流出58.56亿、通信净流出24.25亿，软件题材资金撤离转向硬件；两融余额2.63万亿较6月末3万亿回落',
    },
  },

  // ========== 周数据 ==========
  weekly: {
    radar: [
      { name: '市场趋势', value: 75, status: 'green' },
      { name: '风格方向', value: 80, status: 'green' },
      { name: '资金状态', value: 68, status: 'yellow' },
      { name: '杠杆水平', value: 50, status: 'yellow' },
      { name: 'ETF资金方向', value: 82, status: 'green' },
      { name: '风险水平', value: 55, status: 'yellow' },
    ],

    indices: [
      { name: '上证指数', weekChange: 3.42, prevWeek: -0.53, trend: '反弹' },
      { name: '深证成指', weekChange: 5.39, prevWeek: -1.20, trend: '强势反弹' },
      { name: '创业板指', weekChange: 7.89, prevWeek: -3.93, trend: '强势反弹' },
      { name: '科创综指', weekChange: 9.12, prevWeek: -5.20, trend: '强势反弹' },
      { name: '沪深300', weekChange: 2.02, prevWeek: -1.31, trend: '反弹' },
      { name: '中证500', weekChange: 4.91, prevWeek: -1.50, trend: '反弹' },
      { name: '中证1000', weekChange: 5.51, prevWeek: -2.10, trend: '强势反弹' },
      { name: '科创50', weekChange: 7.91, prevWeek: -4.50, trend: '强势反弹' },
    ],

    industries: [
      { name: '医药医疗', weekChange: 8.25, fundFlow: '流入', prosperity: '改善', judgment: '创新药出海驱动' },
      { name: '半导体', weekChange: 8.30, fundFlow: '流入', prosperity: '高景气', judgment: 'CPO/存储芯片领涨' },
      { name: '贵金属', weekChange: 11.25, fundFlow: '流入', prosperity: '高景气', judgment: '避险+降息预期' },
      { name: '有色金属', weekChange: 5.50, fundFlow: '流入', prosperity: '改善', judgment: '供给偏紧' },
      { name: 'PCB概念', weekChange: 6.20, fundFlow: '流入', prosperity: '高景气', judgment: '产业化临界点' },
      { name: 'CPO概念', weekChange: 7.80, fundFlow: '流入', prosperity: '高景气', judgment: 'CPO量产落地' },
      { name: '电力', weekChange: 1.50, fundFlow: '中性', prosperity: '稳定', judgment: '新型电力系统规划' },
      { name: '银行', weekChange: -3.75, fundFlow: '流出', prosperity: '稳定', judgment: '风格切换流出' },
      { name: '煤炭', weekChange: 2.92, fundFlow: '中性', prosperity: '稳定', judgment: '工业气体/煤炭走强' },
      { name: '红利', weekChange: -1.62, fundFlow: '流出', prosperity: '稳定', judgment: '风险偏好回升流出' },
      { name: '房地产', weekChange: -2.50, fundFlow: '流出', prosperity: '压力', judgment: '开发投资-18%' },
    ],

    turnover: {
      avgDaily: 24500, prevAvg: 22000, change: 2500,
      totalWeekly: 122500, peakDay: '周二', peakVolume: 26600,
    },

    breadth: {
      avgUp: 3100, avgDown: 2300,
      avgLimitUp: 75, avgLimitDown: 3,
    },

    margin: [
      { metric: '融资余额', value: 26000, change: -4000, trend: '持续下降' },
      { metric: '融资余额增减', value: -4000, change: -5000, trend: '杠杆退潮' },
      { metric: '融资买入额', value: 344.54, change: 344.54, trend: '8/5单日大幅回流' },
      { metric: '融资买入额变化', value: 344.54, change: 200, trend: '止跌回升' },
      { metric: '两融成交占比', value: 2.62, change: -0.38, trend: '杠杆占比下降' },
      { metric: '热门行业融资占比', value: 25.0, change: -3.5, trend: '科技方向融资回补' },
    ],

    etfFlows: [
      { name: '宽基ETF（合计）', shareChange: 840.55, netBuy: 840.55, volumeChange: 15.2, judgment: '机构持续大幅流入' },
      { name: '半导体ETF', shareChange: 8.30, netBuy: 25.5, volumeChange: 8.3, judgment: '科技资金涌入' },
      { name: '黄金股ETF', shareChange: 11.25, netBuy: 30.8, volumeChange: 11.7, judgment: '避险资金流入' },
      { name: '科创50ETF', shareChange: 7.91, netBuy: 22.5, volumeChange: 7.9, judgment: '科创方向流入' },
      { name: '中证500ETF', shareChange: 4.91, netBuy: 15.2, volumeChange: 4.9, judgment: '中盘流入' },
      { name: '中证1000ETF', shareChange: 5.51, netBuy: 18.5, volumeChange: 5.5, judgment: '小盘流入' },
      { name: '银行ETF', shareChange: -3.75, netBuy: -12.5, volumeChange: -3.8, judgment: '风格切换流出' },
      { name: '煤炭ETF', shareChange: 2.92, netBuy: 5.2, volumeChange: 2.9, judgment: '小幅流入' },
      { name: '红利ETF', shareChange: -1.62, netBuy: -8.5, volumeChange: -1.6, judgment: '风险偏好回升流出' },
    ],

    fundStrength: [
      { direction: '成长', strength: 'green', basis: '创业板/科创综指周涨8-9%，半导体ETF资金涌入' },
      { direction: '价值', strength: 'red', basis: '银行ETF周跌3.75%，红利ETF流出' },
      { direction: '红利', strength: 'red', basis: '风险偏好回升，红利方向资金流出' },
      { direction: '周期', strength: 'yellow', basis: '有色受供给驱动流入，煤炭小幅流入' },
    ],

    observation: {
      coreChange: '本周科技/医药强势反弹，创业板周涨7.89%，资金从银行/红利切换至成长方向',
      nextWeek: '关注科技板块反弹持续性、量能能否维持2.5万亿以上、两融余额能否止跌回升',
      maxRisk: '7月PMI回落至收缩区间，地产投资-18%，经济基本面仍弱，反弹持续性待验证',
    },
  },

  // ========== 月数据 ==========
  monthly: {
    radar: [
      { name: '市场阶段', value: 65, status: 'yellow' },
      { name: '风格方向', value: 75, status: 'green' },
      { name: '资金周期', value: 55, status: 'yellow' },
      { name: '杠杆水平', value: 50, status: 'yellow' },
      { name: 'ETF资金方向', value: 82, status: 'green' },
      { name: '宏观环境', value: 58, status: 'yellow' },
    ],

    indices: [
      { name: '上证指数', monthChange: 3.42, prevMonth: -0.53, trend3m: '震荡反弹', judgment: '反弹中' },
      { name: '深证成指', monthChange: 5.39, prevMonth: -1.20, trend3m: '底部反弹', judgment: '强势反弹' },
      { name: '创业板指', monthChange: 7.89, prevMonth: -3.93, trend3m: 'V型反弹', judgment: '成长领涨' },
      { name: '科创综指', monthChange: 9.12, prevMonth: -5.20, trend3m: '强势反弹', judgment: '科技领涨' },
      { name: '沪深300', monthChange: 2.02, prevMonth: -1.31, trend3m: '企稳回升', judgment: '大盘修复' },
      { name: '中证500', monthChange: 4.91, prevMonth: -1.50, trend3m: '底部反弹', judgment: '中盘活跃' },
      { name: '中证1000', monthChange: 5.51, prevMonth: -2.10, trend3m: 'V型反弹', judgment: '小盘领涨' },
      { name: '科创50', monthChange: 7.91, prevMonth: -4.50, trend3m: '强势反弹', judgment: '科技领涨' },
    ],

    styleComparison: {
      growthVsValue: { growth: 7.89, value: 2.02, gap: 5.87, direction: '成长大幅占优' },
      largeVsSmall: { large: 2.02, small: 5.51, gap: 3.49, direction: '小盘占优' },
      aVsOverseas: { aShare: 3.42, usMarket: 1.05, hkMarket: 3.69, direction: '港股A股同步反弹' },
    },

    industries: [
      { name: '医药医疗', monthChange: 8.25, trend: '创新药出海驱动', fundFlow: '流入', judgment: '改善' },
      { name: '半导体', monthChange: 8.30, trend: 'CPO量产+存储芯片', fundFlow: '流入', judgment: '强势' },
      { name: '贵金属', monthChange: 11.25, trend: '避险+降息预期', fundFlow: '流入', judgment: '强势' },
      { name: '有色金属', monthChange: 5.50, trend: '供给偏紧', fundFlow: '流入', judgment: '改善' },
      { name: 'CPO概念', monthChange: 7.80, trend: '量产落地', fundFlow: '流入', judgment: '强势' },
      { name: 'PCB概念', monthChange: 6.20, trend: '产业化临界', fundFlow: '流入', judgment: '强势' },
      { name: '煤炭', monthChange: 2.92, trend: '震荡', fundFlow: '中性', judgment: '稳定' },
      { name: '电力', monthChange: 1.50, trend: '新型电力系统', fundFlow: '中性', judgment: '稳定' },
      { name: '银行', monthChange: -3.75, trend: '风格切换', fundFlow: '流出', judgment: '调整' },
      { name: '红利', monthChange: -1.62, trend: '风险偏好回升', fundFlow: '流出', judgment: '调整' },
      { name: '房地产', monthChange: -2.50, trend: '投资-18%', fundFlow: '流出', judgment: '压力' },
    ],

    turnover: {
      avgDaily: 24500, prevMonth: 22000, change: 2500,
      total: 122500, halfYearAvg: 21000, vsHalfYear: 3500,
    },

    leverage: [
      { metric: '融资余额', value: 26000, change: -4000, trend: '持续回落' },
      { metric: '融资余额变化', value: -4000, change: -7000, trend: '杠杆退潮' },
      { metric: '融资买入额', value: 344.54, change: 344.54, trend: '8/5单日大幅回流' },
      { metric: '两融成交占比', value: 2.62, change: -0.38, trend: '占比下降' },
      { metric: '热门行业融资变化', value: 25.0, change: -3.5, trend: '科技方向融资回补' },
    ],

    etfFlows: [
      { name: '宽基ETF（合计）', shareChange: 840.55, netBuy: 840.55, volumeChange: 15.2, judgment: '机构持续大幅流入' },
      { name: '半导体ETF', shareChange: 8.30, netBuy: 25.5, volumeChange: 8.3, judgment: '科技资金涌入' },
      { name: '黄金股ETF', shareChange: 11.25, netBuy: 30.8, volumeChange: 11.7, judgment: '避险资金流入' },
      { name: '科创50ETF', shareChange: 7.91, netBuy: 22.5, volumeChange: 7.9, judgment: '科创方向流入' },
      { name: '中证500ETF', shareChange: 4.91, netBuy: 15.2, volumeChange: 4.9, judgment: '中盘流入' },
      { name: '中证1000ETF', shareChange: 5.51, netBuy: 18.5, volumeChange: 5.5, judgment: '小盘流入' },
      { name: '银行ETF', shareChange: -3.75, netBuy: -12.5, volumeChange: -3.8, judgment: '风格切换流出' },
      { name: '红利ETF', shareChange: -1.62, netBuy: -8.5, volumeChange: -1.6, judgment: '风险偏好回升流出' },
    ],

    bondsCommodities: [
      { name: '中国1年国债', monthChange: -0.043, prevChange: -0.030, implication: '短端持续下行至1.125%' },
      { name: '中国10年国债', monthChange: -0.014, prevChange: -0.010, implication: '长端下行至1.701%' },
      { name: '中国30年国债', monthChange: 0.001, prevChange: -0.005, implication: '超长端微升至2.188%' },
      { name: '美国10年国债', monthChange: 0.060, prevChange: 0.013, implication: '长端上行至4.620%' },
      { name: '美国30年国债', monthChange: 0.110, prevChange: 0.030, implication: '超长端大幅上行至5.167%' },
      { name: '中美利差(10年)', monthChange: 0.074, prevChange: -0.023, implication: '利差走阔至-2.919%' },
      { name: 'COMEX黄金', monthChange: -0.45, prevChange: 2.15, implication: '高位震荡约4098美元' },
      { name: 'LME铜', monthChange: 1.41, prevChange: 1.16, implication: '供给偏紧回升' },
      { name: 'WTI原油', monthChange: -4.06, prevChange: -2.81, implication: '需求担忧回落至86.8美元' },
    ],

    rating: [
      { item: '市场趋势', rating: 'green', reason: '8月强势反弹，创业板/科创综指周涨8%+' },
      { item: '资金环境', rating: 'yellow', reason: 'ETF持续流入但两融余额从3万亿降至2.6万亿' },
      { item: '风险偏好', rating: 'green', reason: '成长风格占优，资金从红利切换至科技' },
      { item: '估值压力', rating: 'yellow', reason: '半导体20日跌20%后反弹，估值仍有压力' },
      { item: '宏观环境', rating: 'yellow', reason: 'GDP +4.7%但7月PMI回落至收缩区间，地产-18%' },
    ],

    observation: {
      marketStage: '底部反弹阶段，成长风格大幅占优',
      opportunity: '半导体CPO量产落地、创新药出海（License-out约997亿美元）、贵金属避险逻辑',
      risk: '7月PMI收缩、地产投资-18%、两融杠杆退潮、美国长端利率上行',
      validation: '关注中报业绩验证、美联储议息、9月PMI能否重回扩张',
    },
  },

  // ========== 市场基本面层 ==========
  fundamentals: {
    radar: [
      { name: '经济增长', value: 55, status: 'yellow' },
      { name: '企业盈利', value: 72, status: 'green' },
      { name: '流动性', value: 75, status: 'green' },
      { name: '利率估值', value: 80, status: 'green' },
    ],

    economicGrowth: [
      { metric: 'GDP', latest: '4.7%', yoy: '符合预期', trend: '平稳', implication: '上半年69.6万亿，Q1+5.0% Q2+4.3%' },
      { metric: '工业增加值', latest: '5.4%', yoy: '+0.5pp', trend: '改善', implication: '装备制造+9.3%，高技术+13.3%' },
      { metric: '社零', latest: '1.3%', yoy: '-0.5pp', trend: '弱', implication: '供强需弱矛盾突出' },
      { metric: '固定资产投资', latest: '-5.7%', yoy: '-3.0pp', trend: '压力', implication: '地产-18%拖累严重' },
      { metric: '制造业投资', latest: '-1.2%', yoy: '-2.0pp', trend: '压力', implication: '投资端整体走弱' },
      { metric: '房地产投资', latest: '-18.0%', yoy: '-3.0pp', trend: '压力', implication: '地产仍在深度调整' },
      { metric: '出口', latest: '13.4%', yoy: '+5.0pp', trend: '改善', implication: '进出口+16.9%，贸易结构优化' },
      { metric: 'PMI(6月)', latest: '50.3%', yoy: '+0.3', trend: '扩张', implication: '6月回到扩张，7月再度回落' },
      { metric: 'PMI(7月)', latest: '<50%', yoy: '-0.5', trend: '收缩', implication: '7月回落至收缩区间' },
      { metric: 'CPI', latest: '1.0%', yoy: '+0.3pp', trend: '温和', implication: '核心CPI 1.2%，价格稳定' },
      { metric: 'PPI', latest: '1.5%', yoy: '转正', trend: '改善', implication: '6月同比+4.1%，由负转正' },
    ],

    earnings: [
      { metric: '规上工业企业利润', latest: '31440亿', change: '+18.8%', judgment: '大幅改善' },
      { metric: '电子行业利润', latest: '+96.9%', change: '+50pp', judgment: 'AI驱动高增' },
      { metric: '集成电路制造利润', latest: '+2600%', change: '近26倍', judgment: '产业趋势爆发' },
      { metric: '计算机整机制造', latest: '+700%', change: '近7倍', judgment: '算力需求驱动' },
      { metric: '药明康德中报', latest: '净利破百亿', change: '上调全年指引+70亿', judgment: 'CXO回暖' },
      { metric: '百济神州', latest: '上调全年业绩', change: '大幅向好', judgment: '创新药出海验证' },
    ],

    earningsDriver: {
      source: 'A. 盈利增长驱动（为主：电子/集成电路/CXO）+ B. 政策催化（半导体知识产权/L3自动驾驶标准）',
      focus: '中报业绩验证、高技术制造业盈利持续性、地产链亏损情况',
    },

    liquidity: [
      { metric: 'M2/MLF', latest: 'MLF 2.50%', change: '稳定', impact: '中性' },
      { metric: 'LPR', latest: '1年3.00% 5年3.50%', change: '稳定', impact: '融资成本偏低' },
      { metric: 'Shibor隔夜', latest: '1.3604%', change: '-0.56BP', impact: '短端流动性充裕' },
      { metric: 'DR007', latest: '1.3738%', change: '-1.10BP', impact: '银行间流动性宽松' },
      { metric: '央行操作', latest: '买断式逆回购5000亿', change: '净投放2000亿', impact: '连续加量续作' },
      { metric: 'ETF净流入', latest: '840.55亿/周', change: '持续流入', impact: '增量资金入市' },
    ],

    liquidityJudgment: {
      isLoose: '是 - DR007 1.37%，Shibor隔夜1.36%，银行间流动性充裕，央行连续加量买断式逆回购',
      enterEquity: '是 - ETF持续净流入（上周840亿），8月5日融资净流入344.54亿，增量资金入场',
      tighteningRisk: '低 - 央行维持宽松基调，LPR已降至3.0%/3.5%，短期内收紧概率极低',
    },

    ratesBonds: [
      { name: '中国1年国债', yield: 1.125, change: -0.043, prevChange: -0.047, implication: '短端利率持续下行' },
      { name: '中国2年国债', yield: 1.260, change: -0.009, prevChange: -0.015, implication: '短端下行' },
      { name: '中国10年国债', yield: 1.701, change: -0.014, prevChange: -0.010, implication: '长端利率下行' },
      { name: '中国30年国债', yield: 2.188, change: 0.001, prevChange: -0.009, implication: '超长端微升' },
      { name: '美国1年国债', yield: 4.029, change: 0.032, prevChange: -0.039, implication: '短端回升' },
      { name: '美国2年国债', yield: 4.280, change: -0.050, prevChange: 0.060, implication: '降息预期波动' },
      { name: '美国10年国债', yield: 4.620, change: 0.060, prevChange: -0.013, implication: '长端上行' },
      { name: '美国30年国债', yield: 5.167, change: 0.110, prevChange: -0.003, implication: '超长端大幅上行' },
      { name: '中美利差(10年)', yield: -2.919, change: 0.074, prevChange: -0.023, implication: '利差走阔' },
      { name: 'LPR 1年/5年', yield: 3.000, change: 0, prevChange: 0, implication: '3.00%/3.50%，融资成本低位' },
      { name: '沪深300 PE', yield: 14.41, change: 0, prevChange: 0, implication: '估值合理偏低' },
      { name: '上证指数 PE', yield: 18.08, change: 0, prevChange: 0, implication: '估值中性' },
      { name: '创业板指 PE', yield: 62.60, change: 0, prevChange: 0, implication: '成长溢价，偏高' },
    ],

    commodities: [
      { name: 'COMEX黄金', changePct: -0.45, prevChange: -0.79, implication: '高位震荡，约4098美元/盎司' },
      { name: 'COMEX白银', changePct: 0.59, prevChange: 1.20, implication: '贵金属分化' },
      { name: 'LME铜', changePct: 1.41, prevChange: 1.16, implication: '供给偏紧回升' },
      { name: 'LME铝', changePct: 0.95, prevChange: 1.12, implication: '有色整体回升' },
      { name: 'WTI原油', changePct: -4.06, prevChange: -2.81, implication: '需求担忧，约86.8美元/桶' },
      { name: 'Brent原油', changePct: -8.40, prevChange: -3.50, implication: '大幅回落' },
    ],

    rating: [
      { item: '经济环境', rating: 'yellow', reason: 'GDP +4.7%平稳但7月PMI收缩，地产-18%深度拖累' },
      { item: '盈利环境', rating: 'green', reason: '规上工业利润+18.8%，电子+96.9%，集成电路+26倍' },
      { item: '流动性', rating: 'green', reason: 'DR007 1.37%，央行加量逆回购，ETF持续流入' },
      { item: '估值环境', rating: 'green', reason: '沪深300 PE 14.4x偏低，利率低位' },
    ],

    observation: {
      confirmSignals: 'PMI重回50以上、社零回升、中报盈利超预期、地产企稳',
      overturnSignals: 'PMI持续收缩、地产投资降幅扩大、美联储推迟降息',
      valuationRisk: '创业板PE 62.6x偏高，半导体20日跌20%后反弹需业绩验证',
      keyMetric: '中报盈利增速、9月PMI、社融增速、地产销售',
      opportunity: '盈利高增（电子/CXO）+流动性宽松+估值偏低，基本面支持结构性机会',
      risk: '供强需弱矛盾、地产深度调整、7月PMI收缩、美国长端利率上行',
      nextStage: '中报季是核心验证期，关注盈利增速能否匹配股价涨幅',
    },
  },

  // ========== 中观结构层 ==========
  meso: {
    radar: [
      { name: '医药医疗', prosperity: 'green', valuation: 'yellow', crowding: 'yellow', fundDirection: 'green', overall: 'green' },
      { name: '半导体', prosperity: 'green', valuation: 'yellow', crowding: 'red', fundDirection: 'green', overall: 'yellow' },
      { name: '贵金属', prosperity: 'green', valuation: 'green', crowding: 'yellow', fundDirection: 'green', overall: 'green' },
      { name: '有色金属', prosperity: 'yellow', valuation: 'green', crowding: 'green', fundDirection: 'green', overall: 'green' },
      { name: 'CPO概念', prosperity: 'green', valuation: 'yellow', crowding: 'red', fundDirection: 'green', overall: 'yellow' },
      { name: '银行', prosperity: 'yellow', valuation: 'green', crowding: 'green', fundDirection: 'red', overall: 'yellow' },
      { name: '煤炭', prosperity: 'yellow', valuation: 'green', crowding: 'green', fundDirection: 'yellow', overall: 'yellow' },
      { name: '红利', prosperity: 'yellow', valuation: 'green', crowding: 'green', fundDirection: 'red', overall: 'yellow' },
      { name: '电力', prosperity: 'yellow', valuation: 'green', crowding: 'green', fundDirection: 'yellow', overall: 'yellow' },
      { name: '房地产', prosperity: 'red', valuation: 'yellow', crowding: 'green', fundDirection: 'red', overall: 'red' },
    ],

    prosperity: [
      { industry: '医药医疗', indicator: 'License-out出海', latest: '997亿美元', trend: '爆发', judgment: '高景气' },
      { industry: '半导体', indicator: '集成电路利润', latest: '+2600%', trend: '爆发', judgment: '高景气' },
      { industry: 'CPO概念', indicator: '量产进度', latest: '正式量产', trend: '加速', judgment: '高景气' },
      { industry: '贵金属', indicator: '黄金价格', latest: '4098美元/盎司', trend: '高位', judgment: '高景气' },
      { industry: '有色金属', indicator: '钴/铜供给', latest: '刚果禁出口', trend: '供给收缩', judgment: '改善' },
      { industry: 'PCB概念', indicator: '产业化进度', latest: '临界点', trend: '加速', judgment: '高景气' },
      { industry: '煤炭', indicator: '工业气体需求', latest: '稳定', trend: '稳定', judgment: '稳定' },
      { industry: '银行', indicator: '净息差', latest: 'LPR 3.0%', trend: '稳定', judgment: '稳定' },
      { industry: '电力', indicator: '新型电力系统规划', latest: '十五五规划', trend: '推进', judgment: '改善' },
      { industry: '房地产', indicator: '开发投资', latest: '-18.0%', trend: '深度调整', judgment: '压力' },
      { industry: '红利', indicator: '股息率', latest: '5.0%+', trend: '稳定', judgment: '稳定' },
    ],

    valuation: [
      { industry: '医药医疗', pe: 28.5, pb: 3.2, percentile: 30, earningsGrowth: 15, judgment: '偏低' },
      { industry: '半导体', pe: 35.0, pb: 3.5, percentile: 50, earningsGrowth: 96.9, judgment: 'PE/G合理' },
      { industry: 'CPO概念', pe: 42.0, pb: 4.0, percentile: 65, earningsGrowth: 30, judgment: '合理偏高' },
      { industry: '贵金属', pe: 20.0, pb: 2.5, percentile: 40, earningsGrowth: 20, judgment: '合理' },
      { industry: '有色金属', pe: 18.0, pb: 2.0, percentile: 35, earningsGrowth: 10, judgment: '偏低' },
      { industry: '银行', pe: 5.5, pb: 0.55, percentile: 20, earningsGrowth: 3, judgment: '极低' },
      { industry: '煤炭', pe: 8.0, pb: 1.2, percentile: 25, earningsGrowth: 5, judgment: '低估' },
      { industry: '红利', pe: 7.5, pb: 0.7, percentile: 20, earningsGrowth: 4, judgment: '低估' },
      { industry: '电力', pe: 16.0, pb: 1.5, percentile: 30, earningsGrowth: 8, judgment: '偏低' },
      { industry: '房地产', pe: '亏损', pb: 0.6, percentile: 10, earningsGrowth: -20, judgment: '困境' },
      { industry: '沪深300', pe: 14.4, pb: 1.3, percentile: 35, earningsGrowth: 5, judgment: '偏低' },
      { industry: '创业板', pe: 62.6, pb: 4.5, percentile: 70, earningsGrowth: 15, judgment: '偏高' },
    ],

    valuationDriver: 'A. 盈利增长驱动（半导体/CXO/CPO）+ B. 供给收缩驱动（贵金属/有色）',

    crowding: [
      { industry: '医药医疗', change5d: 8.25, change20d: -5.0, turnoverChange: 25.5, etfChange: 8.5, marginChange: 5.2, judgment: '资金涌入' },
      { industry: '半导体', change5d: 8.30, change20d: -20.5, turnoverChange: 30.5, etfChange: 8.3, marginChange: 8.5, judgment: '超跌反弹资金涌入' },
      { industry: 'CPO概念', change5d: 7.80, change20d: -15.0, turnoverChange: 28.0, etfChange: 7.8, marginChange: 6.5, judgment: '资金涌入' },
      { industry: '贵金属', change5d: 11.25, change20d: 22.5, turnoverChange: 35.5, etfChange: 11.7, marginChange: 10.5, judgment: '持续涌入' },
      { industry: '有色金属', change5d: 5.50, change20d: 3.0, turnoverChange: 15.5, etfChange: 5.5, marginChange: 4.5, judgment: '流入加速' },
      { industry: '银行', change5d: -3.75, change20d: 4.2, turnoverChange: -8.5, etfChange: -3.8, marginChange: -3.5, judgment: '风格切换流出' },
      { industry: '煤炭', change5d: 2.92, change20d: 10.3, turnoverChange: 5.5, etfChange: 2.9, marginChange: 1.5, judgment: '温和流入' },
      { industry: '红利', change5d: -1.62, change20d: 3.5, turnoverChange: -5.5, etfChange: -1.6, marginChange: -2.5, judgment: '风险偏好回升流出' },
      { industry: '电力', change5d: 1.50, change20d: 5.0, turnoverChange: 3.5, etfChange: 1.5, marginChange: 1.0, judgment: '低关注度' },
      { industry: '房地产', change5d: -2.50, change20d: -8.0, turnoverChange: -12.5, etfChange: -2.5, marginChange: -3.5, judgment: '持续流出' },
    ],

    fundSwitching: {
      valueToGrowth: { bank: -3.75, dividend: -1.62, tech: 8.30, medical: 8.25, direction: '价值→成长切换中' },
      defensiveToCyclical: { bank: -3.75, gold: 11.25, metal: 5.50, direction: '防御→有色/贵金属切换中' },
      highToLow: { csi300: 2.02, csi500: 4.91, csi1000: 5.51, star50: 7.91, direction: '大盘→小盘切换中' },
      themeToEarnings: { stage: '中报验证期', direction: '半导体/CXO盈利兑现中' },
      crowdingRetreat: { semiconductor20d: -20.5, cpo20d: -15.0, direction: '前期拥挤板块超跌反弹' },
    },

    rating: [
      { industry: '医药医疗', prosperity: 'green', earnings: 'green', valuation: 'green', fund: 'green', overall: 'green' },
      { industry: '半导体', prosperity: 'green', earnings: 'green', valuation: 'yellow', fund: 'green', overall: 'green' },
      { industry: 'CPO概念', prosperity: 'green', earnings: 'yellow', valuation: 'yellow', fund: 'green', overall: 'yellow' },
      { industry: '贵金属', prosperity: 'green', earnings: 'green', valuation: 'green', fund: 'green', overall: 'green' },
      { industry: '有色金属', prosperity: 'yellow', earnings: 'yellow', valuation: 'green', fund: 'green', overall: 'green' },
      { industry: '银行', prosperity: 'yellow', earnings: 'yellow', valuation: 'green', fund: 'red', overall: 'yellow' },
      { industry: '煤炭', prosperity: 'yellow', earnings: 'yellow', valuation: 'green', fund: 'yellow', overall: 'yellow' },
      { industry: '红利', prosperity: 'yellow', earnings: 'yellow', valuation: 'green', fund: 'red', overall: 'yellow' },
      { industry: '电力', prosperity: 'yellow', earnings: 'yellow', valuation: 'green', fund: 'yellow', overall: 'yellow' },
      { industry: '房地产', prosperity: 'red', earnings: 'red', valuation: 'yellow', fund: 'red', overall: 'red' },
    ],

    observation: {
      realProsperity: '半导体（集成电路利润+2600%）、医药（License-out 997亿美元）、CPO（正式量产）',
      fundDriven: '贵金属（20日+22.5%，避险情绪驱动）、PCB（产业化临界点主题驱动）',
      overvalued: '创业板PE 62.6x（历史70%分位）、CPO概念PE 42x（需业绩验证）',
      safeHaven: '银行PE 5.5x（但资金流出）、红利PE 7.5x股息率5%+（风险偏好回升流出）',
      dataChange: '半导体中报盈利验证、医药出海持续性、贵金属金价走势、地产政策效果',
      opportunity: '半导体/CXO产业趋势确认，贵金属避险逻辑，有色供给收缩',
      risk: '7月PMI收缩、地产-18%深度调整、创业板估值偏高、美国长端利率上行',
      nextStage: '中报业绩验证是核心，关注高估值成长股盈利兑现情况',
    },
  },
};

// 历史数据（供日期选择器使用，由 fetch_data.py 自动维护）
// 每个元素: { date: 'YYYY-MM-DD', daily: {...} }
const DASHBOARD_HISTORY = [
  {
    date: '2026-08-07',
    daily: DASHBOARD_DATA.daily,
  },
];

// 状态颜色映射
const STATUS_COLORS = {
  green: { bg: '#1a3a2a', text: '#22c55e', label: '改善', icon: '🟢' },
  yellow: { bg: '#3a3520', text: '#eab308', label: '观察', icon: '🟡' },
  red: { bg: '#3a1a1a', text: '#ef4444', label: '风险', icon: '🔴' },
};

// 涨跌颜色（中国市场惯例：红涨绿跌）
const PRICE_COLORS = {
  up: '#ef4444',   // 红色 - 涨
  down: '#22c55e', // 绿色 - 跌
  flat: '#94a3b8', // 灰色 - 平
};
