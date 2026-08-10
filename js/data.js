/**
 * 趋势雷达数据模型 - 自动更新数据层
 * 数据来源：AKShare（东方财富/上交所/深交所/中债登等公开数据）
 * 更新模式：自动抓取
 * 自动更新时间：2026-08-10 09:37:12
 * 数据日期：2026-08-10
 * 历史数据：1个交易日
 *
 * 由 scripts/fetch_data.py 自动生成，请勿手动编辑
 */

const DASHBOARD_DATA = {
  "meta": {
    "reportDate": "2026-08-10",
    "dataVersion": "v1.2-verified",
    "marketSession": "收盘",
    "fetchedAt": "2026-08-10T09:37:12",
    "scoringMode": "strict",
    "completeness": 12
  },
  "daily": {
    "radar": [
      {
        "name": "股指表现",
        "value": 49.1,
        "status": "yellow",
        "formula": "50 + 四大核心指数平均涨跌幅×10",
        "sourceDate": "2026-08-10"
      },
      {
        "name": "行业表现",
        "value": null,
        "status": "missing",
        "formula": "50 + 申万行业主力净流入(亿元)÷20",
        "sourceDate": "2026-08-10",
        "reason": "必需数据缺失"
      },
      {
        "name": "成交活跃度",
        "value": null,
        "status": "missing",
        "formula": "当日成交额÷5日均额×50",
        "sourceDate": "2026-08-10",
        "reason": "必需数据缺失"
      },
      {
        "name": "市场广度",
        "value": null,
        "status": "missing",
        "formula": "上涨家数÷有效股票数×100",
        "sourceDate": "2026-08-10",
        "reason": "必需数据缺失"
      },
      {
        "name": "杠杆资金",
        "value": null,
        "status": "missing",
        "formula": "50 + 融资余额日变化(亿元)÷10",
        "sourceDate": null,
        "reason": "必需数据缺失"
      },
      {
        "name": "ETF资金",
        "value": null,
        "status": "missing",
        "formula": "待接入可验证ETF份额数据",
        "sourceDate": "2026-08-10",
        "reason": "必需数据缺失"
      },
      {
        "name": "外资资金",
        "value": null,
        "status": "missing",
        "formula": "北向资金口径稳定后启用",
        "sourceDate": "2026-08-10",
        "reason": "必需数据缺失"
      },
      {
        "name": "市场情绪",
        "value": null,
        "status": "missing",
        "formula": "待建立可验证情绪指标",
        "sourceDate": "2026-08-10",
        "reason": "必需数据缺失"
      }
    ],
    "indices": [
      {
        "name": "上证指数",
        "close": 3966.59,
        "change": 26.55,
        "changePct": 0.67,
        "volume": 11669.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "深证成指",
        "close": 14316.96,
        "change": 5.95,
        "changePct": 0.04,
        "volume": 13562.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "创业板指",
        "close": 3537.21,
        "change": -25.91,
        "changePct": -0.73,
        "volume": 6579.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "科创综指",
        "close": 2012.3,
        "change": -7.14,
        "changePct": -0.35,
        "volume": 3867.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "沪深300",
        "close": 4702.02,
        "change": 7.58,
        "changePct": 0.16,
        "volume": 7331.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "中证500",
        "close": 8030.95,
        "change": 50.83,
        "changePct": 0.64,
        "volume": 4904.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "中证1000",
        "close": 7733.9,
        "change": 54.37,
        "changePct": 0.71,
        "volume": 5299.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "科创50",
        "close": 1737.77,
        "change": -6.25,
        "changePct": -0.36,
        "volume": 1285.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      },
      {
        "name": "北证50",
        "close": 1122.88,
        "change": -11.37,
        "changePct": -1.0,
        "volume": 158.0,
        "source": "腾讯行情",
        "sourceDate": "2026-08-10",
        "status": "valid"
      }
    ],
    "industryPerformance": {
      "gainers": [],
      "losers": []
    },
    "turnover": {
      "sh": 11669.0,
      "sz": 13562.0,
      "bj": 158.0,
      "total": 25389.0,
      "prevDay": null,
      "change": null,
      "changePct": null,
      "avg5": null,
      "vs5d": null,
      "avg10": null,
      "vs10d": null,
      "source": "腾讯行情",
      "sourceDate": "2026-08-10",
      "status": "valid"
    },
    "breadth": {
      "upCount": null,
      "downCount": null,
      "flatCount": null,
      "limitUp": null,
      "limitDown": null,
      "upPct": null,
      "downPct": null,
      "moneyEffect": null
    },
    "margin": {
      "financeBalance": null,
      "securitiesBalance": null,
      "totalBalance": null,
      "balanceChange": null,
      "shBalance": null,
      "szBalance": null,
      "marginTradePct": null,
      "dataDate": null,
      "dataLevel": "B"
    },
    "northbound": {
      "netBuy": null,
      "turnover": null,
      "turnoverPct": null,
      "topStocks": null,
      "dataLevel": "A"
    },
    "etf": [],
    "fundFlow": {
      "updateTime": "15:00",
      "netInflow": null,
      "gemNetInflow": null,
      "starNetInflow": null,
      "csi300NetInflow": null,
      "tailNetInflow": null,
      "inflowCount": null,
      "outflowCount": null,
      "sectors": [],
      "source": "东方财富",
      "sourceDate": "2026-08-10",
      "status": "missing"
    },
    "judgment": {
      "completeness": "有效评分完整度 12%（1/8）",
      "fundSource": "主力资金数据暂缺",
      "rallyQuality": "有效数据不足，暂不形成判断",
      "riskAlert": "缺失数据：行业表现、成交活跃度、市场广度、杠杆资金、ETF资金、外资资金、市场情绪"
    }
  },
  "weekly": {
    "radar": [],
    "indices": [
      {
        "name": "上证指数",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "深证成指",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "创业板指",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "科创综指",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "沪深300",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "中证500",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "中证1000",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "科创50",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "北证50",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      }
    ],
    "industries": [],
    "turnover": {
      "avgDaily": 25389.0,
      "prevAvg": null,
      "change": null,
      "totalWeekly": null,
      "peakDay": null,
      "peakVolume": null
    },
    "breadth": {
      "avgUp": null,
      "avgDown": null,
      "avgLimitUp": null,
      "avgLimitDown": null
    },
    "margin": [],
    "etfFlows": [],
    "fundStrength": [],
    "observation": {
      "coreChange": "-",
      "nextWeek": "-",
      "maxRisk": "-"
    }
  },
  "monthly": {
    "radar": [],
    "indices": [
      {
        "name": "上证指数",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "深证成指",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "创业板指",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "科创综指",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "沪深300",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "中证500",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "中证1000",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "科创50",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      },
      {
        "name": "北证50",
        "weekChange": null,
        "prevWeek": null,
        "trend": null
      }
    ],
    "styleComparison": {
      "growthVsValue": {
        "growth": null,
        "value": null,
        "gap": null,
        "direction": null
      },
      "largeVsSmall": {
        "large": null,
        "small": null,
        "gap": null,
        "direction": null
      },
      "aVsOverseas": {
        "aShare": null,
        "usMarket": null,
        "hkMarket": null,
        "direction": null
      }
    },
    "industries": [],
    "turnover": {
      "avgDaily": null,
      "prevMonth": null,
      "change": null,
      "total": null,
      "halfYearAvg": null,
      "vsHalfYear": null
    },
    "leverage": [],
    "etfFlows": [],
    "bondsCommodities": [],
    "rating": [],
    "observation": {
      "marketStage": "-",
      "opportunity": "-",
      "risk": "-",
      "validation": "-"
    }
  },
  "fundamentals": {
    "radar": [],
    "economicGrowth": [],
    "earnings": [],
    "earningsDriver": {
      "source": "-",
      "focus": "-"
    },
    "liquidity": [],
    "liquidityJudgment": {
      "isLoose": "-",
      "enterEquity": "-",
      "tighteningRisk": "-"
    },
    "ratesBonds": [
      {
        "name": "中国2年国债",
        "yield": 1.25,
        "change": 0.0,
        "prevChange": null,
        "implication": null
      },
      {
        "name": "中国10年国债",
        "yield": 1.71,
        "change": 0.0,
        "prevChange": null,
        "implication": null
      },
      {
        "name": "中国30年国债",
        "yield": 2.18,
        "change": -0.01,
        "prevChange": null,
        "implication": null
      },
      {
        "name": "美国2年国债",
        "yield": 4.19,
        "change": -0.06,
        "prevChange": null,
        "implication": null
      },
      {
        "name": "美国10年国债",
        "yield": 4.65,
        "change": -0.04,
        "prevChange": null,
        "implication": null
      },
      {
        "name": "美国30年国债",
        "yield": 5.19,
        "change": -0.03,
        "prevChange": null,
        "implication": null
      },
      {
        "name": "中美利差(10年)",
        "yield": -2.94,
        "change": null,
        "prevChange": null,
        "implication": null
      }
    ],
    "commodities": [
      {
        "name": "COMEX黄金",
        "changePct": 0.12,
        "prevChange": null,
        "implication": "约4405.9美元/盎司"
      },
      {
        "name": "LME铜",
        "changePct": 0.63,
        "prevChange": null,
        "implication": "-"
      },
      {
        "name": "WTI原油",
        "changePct": 2.21,
        "prevChange": null,
        "implication": "约78.8美元/桶"
      }
    ],
    "rating": [],
    "observation": {
      "confirmSignals": "-",
      "overturnSignals": "-",
      "valuationRisk": "-",
      "keyMetric": "-",
      "opportunity": "-",
      "risk": "-",
      "nextStage": "-"
    }
  },
  "meso": {
    "radar": [],
    "prosperity": [],
    "valuation": [],
    "valuationDriver": "-",
    "crowding": [],
    "fundSwitching": {},
    "rating": [],
    "observation": {}
  }
};

// 历史数据（供日期选择器使用，每个元素含 date 和 daily）
const DASHBOARD_HISTORY = [
  {
    "date": "2026-08-07",
    "daily": {
      "radar": [
        {
          "name": "股指表现",
          "value": 78,
          "status": "green"
        },
        {
          "name": "行业表现",
          "value": 72,
          "status": "green"
        },
        {
          "name": "成交活跃度",
          "value": 85,
          "status": "green"
        },
        {
          "name": "市场广度",
          "value": 65,
          "status": "yellow"
        },
        {
          "name": "杠杆资金",
          "value": 55,
          "status": "yellow"
        },
        {
          "name": "ETF资金",
          "value": 75,
          "status": "green"
        },
        {
          "name": "外资资金",
          "value": 62,
          "status": "yellow"
        },
        {
          "name": "市场情绪",
          "value": 70,
          "status": "green"
        }
      ],
      "indices": [
        {
          "name": "上证指数",
          "close": 3940.04,
          "change": 39.69,
          "changePct": 1.02,
          "volume": 12095,
          "avg5": 11091,
          "avg10": 10908
        },
        {
          "name": "深证成指",
          "close": 14311.01,
          "change": 200.89,
          "changePct": 1.42,
          "volume": 14549,
          "avg5": 13036,
          "avg10": 12439
        },
        {
          "name": "创业板指",
          "close": 3563.12,
          "change": 47.56,
          "changePct": 1.35,
          "volume": 7301,
          "avg5": 6403,
          "avg10": 6038
        },
        {
          "name": "科创综指",
          "close": 2019.44,
          "change": 65.39,
          "changePct": 3.35,
          "volume": 4150,
          "avg5": 3736,
          "avg10": 3879
        },
        {
          "name": "沪深300",
          "close": 4694.44,
          "change": 43.13,
          "changePct": 0.93,
          "volume": 7884
        },
        {
          "name": "中证500",
          "close": 7980.12,
          "change": 150.76,
          "changePct": 1.93,
          "volume": 5253
        },
        {
          "name": "中证1000",
          "close": 7679.53,
          "change": 149.1,
          "changePct": 1.98,
          "volume": 5684
        },
        {
          "name": "科创50",
          "close": 1744.02,
          "change": 42.73,
          "changePct": 2.51,
          "volume": 1363
        },
        {
          "name": "北证50",
          "close": 1134.25,
          "change": 11.37,
          "changePct": 1.01,
          "volume": 192
        }
      ],
      "industryPerformance": {
        "gainers": [
          {
            "name": "医药医疗",
            "changePct": 4.85,
            "reason": "创新药出海+License-out约997亿美元，多股20%涨停"
          },
          {
            "name": "贵金属",
            "changePct": 3.5,
            "reason": "黄金股ETF涨3%+，避险+降息预期"
          },
          {
            "name": "半导体",
            "changePct": 3,
            "reason": "CPO概念连涨，存储芯片/电子化学品走强"
          },
          {
            "name": "有色金属",
            "changePct": 2.8,
            "reason": "刚果(金)禁止铜钴精矿出口，供给偏紧"
          },
          {
            "name": "PCB概念",
            "changePct": 2.5,
            "reason": "宝鼎科技/华正新材/景旺电子涨停"
          }
        ],
        "losers": [
          {
            "name": "软件开发",
            "changePct": -1.2,
            "reason": "前期涨幅较大，获利了结"
          },
          {
            "name": "多元金融",
            "changePct": -1.1,
            "reason": "翠微股份/爱建集团/拉卡拉跌幅居前"
          },
          {
            "name": "银行",
            "changePct": -0.76,
            "reason": "风格切换至成长，银行ETF跌0.7%+"
          },
          {
            "name": "煤炭",
            "changePct": -0.72,
            "reason": "需求担忧，能源板块走弱"
          },
          {
            "name": "房地产",
            "changePct": -0.65,
            "reason": "地产投资仍在调整，开发投资-18%"
          }
        ]
      },
      "turnover": {
        "sh": 12095,
        "sz": 14549,
        "bj": 191,
        "total": 26644,
        "prevDay": 25288,
        "change": 1356,
        "changePct": 5.36,
        "avg5": 24128,
        "avg10": 23348,
        "vs5d": 2516,
        "vs10d": 3296
      },
      "breadth": {
        "upCount": 2856,
        "downCount": 2536,
        "flatCount": 180,
        "limitUp": 83,
        "limitDown": 1,
        "upPct": 51.3,
        "downPct": 45.5,
        "moneyEffect": "偏强"
      },
      "margin": {
        "financeBalance": 26072.7,
        "securitiesBalance": 242.93,
        "totalBalance": 26315.63,
        "balanceChange": 113.73,
        "shBalance": 13559.11,
        "szBalance": 12756.52,
        "marginTradePct": 2.62,
        "dataDate": "2026-08-06",
        "dataLevel": "B"
      },
      "northbound": {
        "netBuy": 4.66,
        "turnover": 3451.5,
        "turnoverPct": 12.95,
        "topStocks": "中际旭创85.25亿、新易盛42.32亿、中国巨石39.14亿",
        "dataLevel": "A"
      },
      "etf": [
        {
          "name": "沪深300ETF",
          "changePct": 0.93,
          "shareChange": 8.5,
          "volume": 7884,
          "direction": "净申购"
        },
        {
          "name": "科创50ETF",
          "changePct": 2.51,
          "shareChange": 5.2,
          "volume": 1363,
          "direction": "净申购"
        },
        {
          "name": "半导体ETF",
          "changePct": 3,
          "shareChange": 8.3,
          "volume": 958,
          "direction": "净申购"
        },
        {
          "name": "黄金股ETF",
          "changePct": 3.99,
          "shareChange": 11.7,
          "volume": 1545,
          "direction": "净申购"
        },
        {
          "name": "中证500ETF",
          "changePct": 1.93,
          "shareChange": 2.6,
          "volume": 5253,
          "direction": "净申购"
        },
        {
          "name": "中证1000ETF",
          "changePct": 1.98,
          "shareChange": 2.8,
          "volume": 5684,
          "direction": "净申购"
        },
        {
          "name": "银行ETF",
          "changePct": -0.76,
          "shareChange": -3.8,
          "volume": 1150,
          "direction": "净赎回"
        },
        {
          "name": "煤炭ETF",
          "changePct": -0.72,
          "shareChange": -1.2,
          "volume": 1241,
          "direction": "净赎回"
        },
        {
          "name": "红利ETF",
          "changePct": -0.5,
          "shareChange": -0.8,
          "volume": 800,
          "direction": "净赎回"
        }
      ],
      "fundFlow": {
        "updateTime": "15:00",
        "netInflow": 427.46,
        "gemNetInflow": 51.95,
        "starNetInflow": 104.35,
        "csi300NetInflow": 62.96,
        "tailNetInflow": 72.06,
        "inflowCount": 13,
        "outflowCount": 18,
        "sectors": [
          {
            "name": "电子",
            "netInflow": 282.97,
            "changePct": 3.53
          },
          {
            "name": "医药生物",
            "netInflow": 88.46,
            "changePct": 4.77
          },
          {
            "name": "有色金属",
            "netInflow": 70.77,
            "changePct": 3.19
          },
          {
            "name": "机械设备",
            "netInflow": 40.49,
            "changePct": 2.08
          },
          {
            "name": "电力设备",
            "netInflow": 29.93,
            "changePct": 1.19
          },
          {
            "name": "建筑材料",
            "netInflow": 29.25,
            "changePct": 3.33
          },
          {
            "name": "国防军工",
            "netInflow": 10.51,
            "changePct": 1.47
          },
          {
            "name": "基础化工",
            "netInflow": 9.73,
            "changePct": 1.23
          },
          {
            "name": "煤炭",
            "netInflow": 1.17,
            "changePct": -0.34
          },
          {
            "name": "钢铁",
            "netInflow": 1,
            "changePct": -0.21
          },
          {
            "name": "石油石化",
            "netInflow": 0.85,
            "changePct": 0.64
          },
          {
            "name": "公用事业",
            "netInflow": 0.35,
            "changePct": -0.1
          },
          {
            "name": "农林牧渔",
            "netInflow": 0.15,
            "changePct": -0.21
          },
          {
            "name": "汽车",
            "netInflow": -1.62,
            "changePct": 0.28
          },
          {
            "name": "纺织服饰",
            "netInflow": -1.75,
            "changePct": -0.27
          },
          {
            "name": "家用电器",
            "netInflow": -1.75,
            "changePct": -0.86
          },
          {
            "name": "食品饮料",
            "netInflow": -1.76,
            "changePct": 0.21
          },
          {
            "name": "房地产",
            "netInflow": -1.83,
            "changePct": -0.51
          },
          {
            "name": "社会服务",
            "netInflow": -1.87,
            "changePct": 0.11
          },
          {
            "name": "轻工制造",
            "netInflow": -2.43,
            "changePct": -0.16
          },
          {
            "name": "商贸零售",
            "netInflow": -2.84,
            "changePct": -0.42
          },
          {
            "name": "环保",
            "netInflow": -2.85,
            "changePct": 0.49
          },
          {
            "name": "交通运输",
            "netInflow": -3.38,
            "changePct": -0.64
          },
          {
            "name": "传媒",
            "netInflow": -9.48,
            "changePct": 0.05
          },
          {
            "name": "银行",
            "netInflow": -10.61,
            "changePct": -0.65
          },
          {
            "name": "非银金融",
            "netInflow": -11.47,
            "changePct": -0.26
          },
          {
            "name": "通信",
            "netInflow": -24.25,
            "changePct": 0.13
          },
          {
            "name": "计算机",
            "netInflow": -58.56,
            "changePct": -0.6
          },
          {
            "name": "建筑装饰",
            "netInflow": -0.35,
            "changePct": -0.06
          },
          {
            "name": "美容护理",
            "netInflow": -0.46,
            "changePct": 0.72
          },
          {
            "name": "综合",
            "netInflow": -0.94,
            "changePct": 0.77
          }
        ]
      },
      "judgment": {
        "completeness": "A类数据完整。融资融券为8月6日数据（B类，T+1披露），北向资金为8月7日实时数据（A类）",
        "fundSource": "主力资金净流入427.46亿（电子282.97亿+医药88.46亿+有色70.77亿），融资余额增加110.1亿，北向净流入4.66亿",
        "rallyQuality": "放量反弹 - 科技/医药领涨，成交额2.68万亿，2856只个股上涨，60股涨停",
        "riskAlert": "计算机净流出58.56亿、通信净流出24.25亿，软件题材资金撤离转向硬件；两融余额2.63万亿较6月末3万亿回落"
      }
    }
  }
];

// 状态颜色映射
const STATUS_COLORS = {
  green: { bg: '#1a3a2a', text: '#22c55e', label: '改善', icon: '🟢' },
  yellow: { bg: '#3a3520', text: '#eab308', label: '观察', icon: '🟡' },
  red: { bg: '#3a1a1a', text: '#ef4444', label: '风险', icon: '🔴' },
};

// 涨跌颜色（中国市场惯例：红涨绿跌）
const PRICE_COLORS = {
  up: '#ef4444',
  down: '#22c55e',
  flat: '#94a3b8',
};
