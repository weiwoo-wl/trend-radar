#!/usr/bin/env python3
"""
趋势雷达数据看板 - 自动数据抓取脚本
使用 AKShare 抓取真实市场数据，重新生成 data.js

数据源：
- 指数行情：东方财富 (stock_zh_index_spot_em)
- 历史数据：东方财富 (index_zh_a_hist)
- 资金流向：东方财富 (stock_sector_fund_flow_rank)
- 融资融券：上交所/深交所 (stock_margin_sse/szse)
- 北向资金：东方财富 (stock_hsgt_north_net_flow_in_em)
- 债券利率：中债登 (bond_zh_us_rate)
- 商品价格：新浪财经/东方财富

运行方式：
    python fetch_data.py          # 正常模式，抓取真实数据
    python fetch_data.py --test   # 测试模式，生成示例数据（不联网）

输出：
    覆盖 js/data.js
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data.js')
TEST_MODE = '--test' in sys.argv

if not TEST_MODE:
    import akshare as ak

# ============================================================
# 配置
# ============================================================

INDEX_CODES = {
    '上证指数': '000001',
    '深证成指': '399001',
    '创业板指': '399006',
    '科创综指': '000680',
    '沪深300': '000300',
    '中证500': '000905',
    '中证1000': '000852',
    '科创50': '000688',
    '北证50': '899050',
}

CORE_INDICES = ['上证指数', '深证成指', '创业板指', '科创综指']
BROAD_INDICES = ['沪深300', '中证500', '中证1000', '科创50', '北证50']

BOND_NAME_MAP = {
    '中国国债收益率1年': '中国1年国债',
    '中国国债收益率2年': '中国2年国债',
    '中国国债收益率10年': '中国10年国债',
    '中国国债收益率30年': '中国30年国债',
    '美国国债收益率1年': '美国1年国债',
    '美国国债收益率2年': '美国2年国债',
    '美国国债收益率10年': '美国10年国债',
    '美国国债收益率30年': '美国30年国债',
}

# ============================================================
# 工具函数
# ============================================================

def safe_float(val, default=None):
    try:
        if val is None or val == '' or (isinstance(val, float) and val != val):
            return default
        return round(float(val), 2)
    except (ValueError, TypeError):
        return default

def today_str():
    return datetime.now().strftime('%Y-%m-%d')

def fmt_volume(val):
    if val is None:
        return 0
    try:
        return round(float(val) / 1e8, 0)
    except (ValueError, TypeError):
        return 0

# ============================================================
# 数据抓取函数
# ============================================================

def fetch_index_spot():
    """获取实时指数行情"""
    print('[1/8] 抓取指数行情...')
    if TEST_MODE:
        print('  [测试模式] 使用示例数据')
        return {}
    result = {}
    try:
        df = ak.stock_zh_index_spot_em()
        for name, code in INDEX_CODES.items():
            row = df[df['代码'] == code]
            if len(row) == 0:
                print(f'  - 未找到 {name}({code})')
                continue
            row = row.iloc[0]
            close = safe_float(row.get('最新价'))
            change = safe_float(row.get('涨跌额'))
            change_pct = safe_float(row.get('涨跌幅'))
            volume = 0
            for col in ['成交额', '成交量额']:
                v = row.get(col)
                if v:
                    volume = fmt_volume(v)
                    break
            result[name] = {
                'close': close or 0,
                'change': change or 0,
                'changePct': change_pct or 0,
                'volume': volume,
            }
            print(f'  + {name}: {close} ({change_pct}%)')
    except Exception as e:
        print(f'  ! 指数行情抓取失败: {e}')
    return result


def fetch_index_history(name, code, days=10):
    """获取指数历史数据用于计算5日均值"""
    if TEST_MODE:
        return None
    try:
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=days + 15)).strftime('%Y%m%d')
        df = ak.index_zh_a_hist(symbol=code, period='daily', start_date=start_date, end_date=end_date)
        if len(df) == 0:
            return None
        df = df.tail(days)
        if '成交额' in df.columns:
            avg5 = safe_float(df['成交额'].tail(5).mean() / 1e8, 0)
            return {'avg5': avg5}
        return None
    except Exception:
        return None


def fetch_weekly_changes():
    """计算指数周涨跌幅"""
    print('[2/8] 计算周涨跌幅...')
    if TEST_MODE:
        return {}
    result = {}
    for name, code in INDEX_CODES.items():
        try:
            end_date = datetime.now().strftime('%Y%m%d')
            start_date = (datetime.now() - timedelta(days=14)).strftime('%Y%m%d')
            df = ak.index_zh_a_hist(symbol=code, period='daily', start_date=start_date, end_date=end_date)
            if len(df) < 2:
                result[name] = {'weekChange': 0, 'trend': '-'}
                continue
            closes = df['收盘'].tolist()
            week_change = round((closes[-1] - closes[0]) / closes[0] * 100, 2)
            trend = '反弹' if week_change > 0 else '调整'
            if abs(week_change) > 5:
                trend = '强势' + trend
            result[name] = {'weekChange': week_change, 'trend': trend}
            print(f'  + {name}周涨跌: {week_change}%')
        except Exception as e:
            print(f'  ! {name}周涨跌失败: {e}')
            result[name] = {'weekChange': 0, 'trend': '-'}
    return result


def fetch_fund_flow():
    """获取板块资金流向"""
    print('[3/8] 抓取主力资金流向...')
    if TEST_MODE:
        return {'sectors': [], 'netInflow': 0, 'inflowCount': 0, 'outflowCount': 0}
    try:
        df = ak.stock_sector_fund_flow_rank(indicator='今日', sector_type='行业资金流')
        sectors = []
        for _, row in df.iterrows():
            name = row.get('名称', '')
            net_inflow = safe_float(row.get('今日主力净流入-净额'), 0)
            if net_inflow is not None:
                net_inflow = round(net_inflow / 1e8, 2)
            change_pct = safe_float(row.get('今日涨跌幅'), 0)
            sectors.append({
                'name': name,
                'netInflow': net_inflow or 0,
                'changePct': change_pct or 0,
            })
        sectors.sort(key=lambda x: x['netInflow'], reverse=True)
        inflow_count = sum(1 for s in sectors if s['netInflow'] > 0)
        outflow_count = sum(1 for s in sectors if s['netInflow'] < 0)
        total_net = round(sum(s['netInflow'] for s in sectors), 2)
        print(f'  + {len(sectors)}个行业，净流入{total_net}亿')
        return {'sectors': sectors, 'netInflow': total_net, 'inflowCount': inflow_count, 'outflowCount': outflow_count}
    except Exception as e:
        print(f'  ! 资金流向抓取失败: {e}')
        return {'sectors': [], 'netInflow': 0, 'inflowCount': 0, 'outflowCount': 0}


def fetch_margin():
    """获取融资融券数据"""
    print('[4/8] 抓取融资融券...')
    if TEST_MODE:
        return {'financeBalance': 0, 'securitiesBalance': 0, 'totalBalance': 0, 'balanceChange': 0, 'shBalance': 0, 'szBalance': 0, 'marginTradePct': 0, 'dataDate': today_str(), 'dataLevel': 'B'}
    try:
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=10)).strftime('%Y%m%d')
        sh_finance = 0
        sz_finance = 0
        try:
            df_sse = ak.stock_margin_sse(start_date=start_date, end_date=end_date)
            if len(df_sse) > 0:
                sh_finance = safe_float(df_sse.iloc[-1].get('融资余额'), 0)
                if sh_finance:
                    sh_finance = round(sh_finance / 1e8, 2)
        except Exception as e:
            print(f'  ! 上交所融资融券失败: {e}')
        try:
            df_szse = ak.stock_margin_szse(date=end_date)
            if len(df_szse) > 0:
                sz_finance = safe_float(df_szse.iloc[-1].get('融资余额'), 0)
                if sz_finance:
                    sz_finance = round(sz_finance / 1e8, 2)
        except Exception as e:
            print(f'  ! 深交所融资融券失败: {e}')
        total_finance = round(sh_finance + sz_finance, 2)
        print(f'  + 融资余额: {total_finance}亿')
        return {'financeBalance': total_finance, 'securitiesBalance': 0, 'totalBalance': total_finance, 'balanceChange': 0, 'shBalance': sh_finance, 'szBalance': sz_finance, 'marginTradePct': 0, 'dataDate': today_str(), 'dataLevel': 'B'}
    except Exception as e:
        print(f'  ! 融资融券抓取失败: {e}')
        return {'financeBalance': 0, 'securitiesBalance': 0, 'totalBalance': 0, 'balanceChange': 0, 'shBalance': 0, 'szBalance': 0, 'marginTradePct': 0, 'dataDate': today_str(), 'dataLevel': 'B'}


def fetch_northbound():
    """获取北向资金数据"""
    print('[5/8] 抓取北向资金...')
    if TEST_MODE:
        return {'netBuy': 0, 'turnover': 0, 'turnoverPct': 0, 'topStocks': '-', 'dataLevel': 'A'}
    try:
        df = ak.stock_hsgt_north_net_flow_in_em(symbol='北上')
        if len(df) == 0:
            df = ak.stock_hsgt_hist_em(symbol='沪股通')
        latest = df.iloc[-1]
        net_buy = safe_float(latest.get('当日成交净买额') or latest.get('净买额') or latest.get('value'), 0)
        if net_buy:
            net_buy = round(net_buy / 1e4, 2)
        turnover = safe_float(latest.get('当日成交总额') or latest.get('成交额'), 0)
        if turnover:
            turnover = round(turnover / 1e4, 2)
        print(f'  + 北向净买入: {net_buy}亿')
        return {'netBuy': net_buy or 0, 'turnover': turnover or 0, 'turnoverPct': 0, 'topStocks': '-', 'dataLevel': 'A'}
    except Exception as e:
        print(f'  ! 北向资金抓取失败: {e}')
        return {'netBuy': 0, 'turnover': 0, 'turnoverPct': 0, 'topStocks': '-', 'dataLevel': 'A'}


def fetch_bonds():
    """获取国债收益率"""
    print('[6/8] 抓取债券利率...')
    if TEST_MODE:
        return []
    try:
        start_date = (datetime.now() - timedelta(days=15)).strftime('%Y%m%d')
        df = ak.bond_zh_us_rate(start_date=start_date)
        bonds = []
        latest = df.iloc[-1] if len(df) > 0 else None
        prev = df.iloc[-2] if len(df) > 1 else None
        for col, display_name in BOND_NAME_MAP.items():
            if col in df.columns and latest is not None:
                curr_val = safe_float(latest[col])
                prev_val = safe_float(prev[col]) if prev is not None else None
                change = round(curr_val - prev_val, 3) if curr_val and prev_val else 0
                bonds.append({'name': display_name, 'yield': curr_val or 0, 'change': change, 'prevChange': 0, 'implication': '-'})
        if '中国国债收益率10年' in df.columns and '美国国债收益率10年' in df.columns and latest is not None:
            cn10 = safe_float(latest['中国国债收益率10年']) or 0
            us10 = safe_float(latest['美国国债收益率10年']) or 0
            bonds.append({'name': '中美利差(10年)', 'yield': round(cn10 - us10, 3), 'change': 0, 'prevChange': 0, 'implication': '-'})
        bonds.append({'name': 'LPR 1年/5年', 'yield': 3.0, 'change': 0, 'prevChange': 0, 'implication': '3.00%/3.50%'})
        print(f'  + {len(bonds)}条债券数据')
        return bonds
    except Exception as e:
        print(f'  ! 债券利率抓取失败: {e}')
        return []


def fetch_commodities():
    """获取商品价格"""
    print('[7/8] 抓取商品价格...')
    if TEST_MODE:
        return []
    commodities = []
    targets = [
        ('GC', 'COMEX黄金', '美元/盎司'),
        ('HG', 'LME铜', '-'),
        ('CL', 'WTI原油', '美元/桶'),
    ]
    for symbol, display_name, unit in targets:
        try:
            df = ak.futures_foreign_hist(symbol=symbol)
            if len(df) >= 2:
                curr = df.iloc[-1]['close']
                prev = df.iloc[-2]['close']
                change_pct = round((curr - prev) / prev * 100, 2)
                impl = f'约{round(curr, 1)}{unit}' if unit != '-' else '-'
                commodities.append({'name': display_name, 'changePct': change_pct, 'prevChange': 0, 'implication': impl})
                print(f'  + {display_name}: {change_pct}%')
        except Exception as e:
            print(f'  ! {display_name}获取失败: {e}')
    return commodities


def fetch_market_breadth():
    """获取市场广度数据"""
    print('[8/8] 抓取市场广度...')
    if TEST_MODE:
        return {'upCount': 0, 'downCount': 0, 'flatCount': 0, 'limitUp': 0, 'limitDown': 0, 'upPct': 0, 'downPct': 0, 'moneyEffect': '-'}
    try:
        df = ak.stock_zh_a_spot_em()
        if len(df) == 0:
            return {'upCount': 0, 'downCount': 0, 'flatCount': 0, 'limitUp': 0, 'limitDown': 0, 'upPct': 0, 'downPct': 0, 'moneyEffect': '-'}
        changes = df['涨跌幅']
        up_count = int((changes > 0).sum())
        down_count = int((changes < 0).sum())
        flat_count = int((changes == 0).sum())
        limit_up = int((changes >= 9.9).sum())
        limit_down = int((changes <= -9.9).sum())
        total = up_count + down_count + flat_count
        up_pct = round(up_count / total * 100, 1) if total > 0 else 0
        down_pct = round(down_count / total * 100, 1) if total > 0 else 0
        effect = '偏强' if up_count > down_count else '偏弱' if down_count > up_count else '均衡'
        print(f'  + 涨{up_count}/跌{down_count}/涨停{limit_up}/跌停{limit_down}')
        return {'upCount': up_count, 'downCount': down_count, 'flatCount': flat_count, 'limitUp': limit_up, 'limitDown': limit_down, 'upPct': up_pct, 'downPct': down_pct, 'moneyEffect': effect}
    except Exception as e:
        print(f'  ! 市场广度抓取失败: {e}')
        return {'upCount': 0, 'downCount': 0, 'flatCount': 0, 'limitUp': 0, 'limitDown': 0, 'upPct': 0, 'downPct': 0, 'moneyEffect': '-'}


# ============================================================
# 数据组装
# ============================================================

def build_data(index_spot, fund_flow, margin, northbound, bonds, commodities, breadth, weekly_changes):
    today = today_str()

    indices = []
    for name in CORE_INDICES + BROAD_INDICES:
        spot = index_spot.get(name, {})
        hist = fetch_index_history(name, INDEX_CODES[name]) if not TEST_MODE else None
        idx = {
            'name': name,
            'close': spot.get('close', 0),
            'change': spot.get('change', 0),
            'changePct': spot.get('changePct', 0),
            'volume': spot.get('volume', 0),
        }
        if hist:
            idx['avg5'] = hist.get('avg5', 0)
        indices.append(idx)

    sh_vol = index_spot.get('上证指数', {}).get('volume', 0)
    sz_vol = index_spot.get('深证成指', {}).get('volume', 0)
    bj_vol = index_spot.get('北证50', {}).get('volume', 0)
    total_vol = sh_vol + sz_vol + bj_vol

    sh_hist = fetch_index_history('上证指数', '000001') if not TEST_MODE else None
    sz_hist = fetch_index_history('深证成指', '399001') if not TEST_MODE else None
    avg5_total = (sh_hist or {}).get('avg5', 0) + (sz_hist or {}).get('avg5', 0)

    turnover = {
        'sh': sh_vol, 'sz': sz_vol, 'bj': bj_vol, 'total': total_vol,
        'prevDay': 0, 'change': 0, 'changePct': 0,
        'avg5': round(avg5_total, 0), 'vs5d': round(total_vol - avg5_total, 0),
    }

    fund_flow_data = {
        'updateTime': '15:00',
        'netInflow': fund_flow.get('netInflow', 0),
        'gemNetInflow': 0, 'starNetInflow': 0, 'csi300NetInflow': 0, 'tailNetInflow': 0,
        'inflowCount': fund_flow.get('inflowCount', 0),
        'outflowCount': fund_flow.get('outflowCount', 0),
        'sectors': fund_flow.get('sectors', []),
    }

    daily = {
        'radar': [
            {'name': '股指表现', 'value': 75, 'status': 'green' if any(i['changePct'] > 0 for i in indices[:4]) else 'yellow'},
            {'name': '行业表现', 'value': 70, 'status': 'green' if fund_flow.get('netInflow', 0) > 0 else 'yellow'},
            {'name': '成交活跃度', 'value': 80 if total_vol > 20000 else 60, 'status': 'green' if total_vol > 20000 else 'yellow'},
            {'name': '市场广度', 'value': 65, 'status': 'green' if breadth.get('upCount', 0) > breadth.get('downCount', 0) else 'yellow'},
            {'name': '杠杆资金', 'value': 55, 'status': 'yellow'},
            {'name': 'ETF资金', 'value': 75, 'status': 'green'},
            {'name': '外资资金', 'value': 62, 'status': 'green' if northbound.get('netBuy', 0) > 0 else 'yellow'},
            {'name': '市场情绪', 'value': 70, 'status': 'green'},
        ],
        'indices': indices,
        'industryPerformance': {'gainers': [], 'losers': []},
        'turnover': turnover,
        'breadth': breadth,
        'margin': margin,
        'northbound': northbound,
        'etf': [],
        'fundFlow': fund_flow_data,
        'judgment': {
            'completeness': f'数据更新至{today}收盘。融资融券为T+1数据（B类）',
            'fundSource': f'主力资金净流入{fund_flow.get("netInflow", 0)}亿，北向净流入{northbound.get("netBuy", 0)}亿',
            'rallyQuality': '-',
            'riskAlert': '-',
        },
    }

    weekly_indices = []
    for name in CORE_INDICES + BROAD_INDICES:
        wc = weekly_changes.get(name, {})
        weekly_indices.append({'name': name, 'weekChange': wc.get('weekChange', 0), 'prevWeek': 0, 'trend': wc.get('trend', '-')})

    weekly = {
        'radar': [
            {'name': '市场趋势', 'value': 75, 'status': 'green'},
            {'name': '风格方向', 'value': 80, 'status': 'green'},
            {'name': '资金状态', 'value': 68, 'status': 'yellow'},
            {'name': '杠杆水平', 'value': 50, 'status': 'yellow'},
            {'name': 'ETF资金方向', 'value': 82, 'status': 'green'},
            {'name': '风险水平', 'value': 55, 'status': 'yellow'},
        ],
        'indices': weekly_indices,
        'industries': [],
        'turnover': {'avgDaily': round(total_vol, 0), 'prevAvg': 0, 'change': 0, 'totalWeekly': round(total_vol * 5, 0), 'peakDay': '-', 'peakVolume': 0},
        'breadth': {'avgUp': 0, 'avgDown': 0, 'avgLimitUp': 0, 'avgLimitDown': 0},
        'margin': [],
        'etfFlows': [],
        'fundStrength': [],
        'observation': {'coreChange': '-', 'nextWeek': '-', 'maxRisk': '-'},
    }

    monthly = {
        'radar': [
            {'name': '市场阶段', 'value': 65, 'status': 'yellow'},
            {'name': '风格方向', 'value': 75, 'status': 'green'},
            {'name': '资金周期', 'value': 55, 'status': 'yellow'},
            {'name': '杠杆水平', 'value': 50, 'status': 'yellow'},
            {'name': 'ETF资金方向', 'value': 82, 'status': 'green'},
            {'name': '宏观环境', 'value': 58, 'status': 'yellow'},
        ],
        'indices': weekly_indices,
        'styleComparison': {
            'growthVsValue': {'growth': 0, 'value': 0, 'gap': 0, 'direction': '-'},
            'largeVsSmall': {'large': 0, 'small': 0, 'gap': 0, 'direction': '-'},
            'aVsOverseas': {'aShare': 0, 'usMarket': 0, 'hkMarket': 0, 'direction': '-'},
        },
        'industries': [],
        'turnover': {'avgDaily': 0, 'prevMonth': 0, 'change': 0, 'total': 0, 'halfYearAvg': 0, 'vsHalfYear': 0},
        'leverage': [],
        'etfFlows': [],
        'bondsCommodities': [],
        'rating': [],
        'observation': {'marketStage': '-', 'opportunity': '-', 'risk': '-', 'validation': '-'},
    }

    fundamentals = {
        'radar': [
            {'name': '经济增长', 'value': 55, 'status': 'yellow'},
            {'name': '企业盈利', 'value': 72, 'status': 'green'},
            {'name': '流动性', 'value': 75, 'status': 'green'},
            {'name': '利率估值', 'value': 80, 'status': 'green'},
        ],
        'economicGrowth': [],
        'earnings': [],
        'earningsDriver': {'source': '-', 'focus': '-'},
        'liquidity': [],
        'liquidityJudgment': {'isLoose': '-', 'enterEquity': '-', 'tighteningRisk': '-'},
        'ratesBonds': bonds,
        'commodities': commodities,
        'rating': [],
        'observation': {'confirmSignals': '-', 'overturnSignals': '-', 'valuationRisk': '-', 'keyMetric': '-', 'opportunity': '-', 'risk': '-', 'nextStage': '-'},
    }

    meso = {
        'radar': [],
        'prosperity': [],
        'valuation': [],
        'valuationDriver': '-',
        'crowding': [],
        'fundSwitching': {},
        'rating': [],
        'observation': {},
    }

    return {
        'meta': {'reportDate': today, 'dataVersion': 'v1.1-auto', 'marketSession': '收盘'},
        'daily': daily,
        'weekly': weekly,
        'monthly': monthly,
        'fundamentals': fundamentals,
        'meso': meso,
    }


# ============================================================
# 生成 data.js
# ============================================================

def generate_js(data):
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    report_date = data.get('meta', {}).get('reportDate', '')
    mode_str = '测试模式' if TEST_MODE else '自动抓取'
    js_content = f"""/**
 * 趋势雷达数据模型 - 自动更新数据层
 * 数据来源：AKShare（东方财富/上交所/深交所/中债登等公开数据）
 * 更新模式：{mode_str}
 * 自动更新时间：{now_str}
 * 数据日期：{report_date}
 *
 * 由 scripts/fetch_data.py 自动生成，请勿手动编辑
 */

const DASHBOARD_DATA = {json_str};

// 状态颜色映射
const STATUS_COLORS = {{
  green: {{ bg: '#1a3a2a', text: '#22c55e', label: '改善', icon: '🟢' }},
  yellow: {{ bg: '#3a3520', text: '#eab308', label: '观察', icon: '🟡' }},
  red: {{ bg: '#3a1a1a', text: '#ef4444', label: '风险', icon: '🔴' }},
}};

// 涨跌颜色（中国市场惯例：红涨绿跌）
const PRICE_COLORS = {{
  up: '#ef4444',
  down: '#22c55e',
  flat: '#94a3b8',
}};
"""
    return js_content


# ============================================================
# 主函数
# ============================================================

def main():
    print('=' * 60)
    print(f'趋势雷达数据看板 - 自动数据抓取')
    print(f'运行时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    if TEST_MODE:
        print('模式: 测试模式（不联网，生成空数据）')
    print('=' * 60)

    index_spot = fetch_index_spot()
    weekly_changes = fetch_weekly_changes()
    fund_flow = fetch_fund_flow()
    margin = fetch_margin()
    northbound = fetch_northbound()
    bonds = fetch_bonds()
    commodities = fetch_commodities()
    breadth = fetch_market_breadth()

    print('\n组装数据...')
    data = build_data(
        index_spot, fund_flow, margin, northbound,
        bonds, commodities, breadth, weekly_changes
    )

    js_content = generate_js(data)
    output_path = os.path.normpath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f'\n{"=" * 60}')
    print(f'数据已写入: {output_path}')
    print(f'数据日期: {data["meta"]["reportDate"]}')
    print(f'指数数量: {len(data["daily"]["indices"])}')
    print(f'资金流向板块: {len(data["daily"]["fundFlow"]["sectors"])}')
    print(f'债券数据: {len(data["fundamentals"]["ratesBonds"])}')
    print(f'商品数据: {len(data["fundamentals"]["commodities"])}')
    print(f'{"=" * 60}')


if __name__ == '__main__':
    main()
