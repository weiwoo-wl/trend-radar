#!/usr/bin/env python3
"""
趋势雷达数据看板 - 自动数据抓取脚本
使用 AKShare 抓取真实市场数据，重新生成 data.js

功能：
1. 自动判断交易日（周末和节假日跳过）
2. 抓取失败时标记缺失，不用零值或旧值冒充当日数据
3. 保存历史数据（最近30个交易日），供前端日期选择器使用

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
    python fetch_data.py --force  # 强制模式，跳过交易日检查
"""

import json
import os
import re
import subprocess
import sys
import time
from copy import deepcopy
from datetime import datetime, timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# === 全局 socket 超时：海外环境下东方财富接口会"挂起"而不是快速失败，
# 不设超时会导致整个抓取脚本卡死数小时（GitHub Actions 上实测 14 分钟仍未结束）。
# 设 30 秒快速失败，让脚本走到腾讯源兜底逻辑。 ===
try:
    import socket as _socket
    _socket.setdefaulttimeout(30)
except Exception:
    pass


# === OpenSSL 兼容补丁：Gitee Go 容器内 OpenSSL 3.x 与东方财富 TLS 握手失败 (unexpected eof) ===
try:
    import ssl
    _orig_create_default = ssl.create_default_context

    def _patched_create_default_context(*args, **kwargs):
        ctx = _orig_create_default(*args, **kwargs)
        try:
            ctx.set_ciphers('DEFAULT@SECLEVEL=1')
            ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        except Exception:
            pass
        return ctx

    ssl.create_default_context = _patched_create_default_context
    ssl._create_default_https_context = _patched_create_default_context
    ssl._create_stdlib_context = _patched_create_default_context
except Exception:
    pass

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data.js')
POLICY_FUNDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'policy-funds-data.js')
TEST_MODE = '--test' in sys.argv
FORCE_MODE = '--force' in sys.argv

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

TENCENT_INDEX_SYMBOLS = {
    '上证指数': 'sh000001', '深证成指': 'sz399001', '创业板指': 'sz399006',
    '科创综指': 'sh000680', '沪深300': 'sh000300', '中证500': 'sh000905',
    '中证1000': 'sh000852', '科创50': 'sh000688', '北证50': 'bj899050',
}

EASTMONEY_INDEX_SECIDS = {
    '上证指数': '1.000001', '深证成指': '0.399001', '创业板指': '0.399006',
    '科创综指': '1.000680', '沪深300': '1.000300', '中证500': '1.000905',
    '中证1000': '1.000852', '科创50': '1.000688', '北证50': '0.899050',
}

SW_LEVEL1_INDUSTRIES = [
    '农林牧渔', '基础化工', '钢铁', '有色金属', '电子', '家用电器', '食品饮料', '纺织服饰',
    '轻工制造', '医药生物', '公用事业', '交通运输', '房地产', '商贸零售', '社会服务', '综合',
    '建筑材料', '建筑装饰', '电力设备', '国防军工', '计算机', '传媒', '通信', '银行',
    '非银金融', '汽车', '机械设备', '煤炭', '石油石化', '环保', '美容护理',
]

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

MAX_HISTORY = 30  # 保留最近30个交易日的数据

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

def normalize_date(value):
    if value is None:
        return None
    text = str(value).strip()[:10]
    digits = re.sub(r'\D', '', text)
    if len(digits) >= 8:
        return f'{digits[:4]}-{digits[4:6]}-{digits[6:8]}'
    return None

def fmt_volume(val):
    if val is None:
        return None
    try:
        return round(float(val) / 1e8, 0)
    except (ValueError, TypeError):
        return None

def clamp(value, lower=0, upper=100):
    return round(max(lower, min(upper, value)), 1)

def valid_number(value, allow_zero=True):
    return isinstance(value, (int, float)) and (allow_zero or value != 0)

def fetch_json(url, referer='https://quote.eastmoney.com/', timeout=20, attempts=4):
    last_error = None
    for attempt in range(attempts):
        try:
            request = Request(url, headers={'Referer': referer, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(2 * (2 ** attempt))
    raise last_error

def radar_item(name, value, formula, inputs, source_date):
    """Create a traceable score. Missing inputs never become an estimated score."""
    if value is None or any(v is None for v in inputs):
        return {
            'name': name, 'value': None, 'status': 'missing',
            'formula': formula, 'sourceDate': source_date,
            'reason': '必需数据缺失',
        }
    score = clamp(value)
    status = 'green' if score >= 65 else 'red' if score < 40 else 'yellow'
    return {
        'name': name, 'value': score, 'status': status,
        'formula': formula, 'sourceDate': source_date,
    }


# Errors that will never succeed on retry (API/version mismatch, bad args).
# Retrying these only wastes time and delays the fallback path.
PERMANENT_ERRORS = (AttributeError, ImportError, NameError, TypeError,
                    KeyError, ValueError, NotImplementedError)

def with_retry(func, *args, attempts=4, base_delay=2, label='', **kwargs):
    """Wrap an akshare/network call with exponential backoff retries.
    Returns the result, or None if all attempts fail (so callers can handle
    missing data honestly instead of crashing on a transient network blip).
    Permanent errors (e.g. a removed akshare function) are NOT retried."""
    last_error = None
    for attempt in range(attempts):
        try:
            return func(*args, **kwargs)
        except PERMANENT_ERRORS as exc:
            last_error = exc
            if label:
                print(f'  ! {label} 永久性错误(跳过重试): {exc}')
            return None
        except Exception as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(base_delay * (2 ** attempt))
    if label:
        print(f'  ! {label} 重试{attempts}次仍失败: {last_error}')
    return None


def is_trading_day():
    """Use the exchange calendar; fail closed when the calendar is unavailable."""
    today = datetime.now()
    if today.weekday() >= 5:
        return False
    if TEST_MODE:
        return True
    try:
        calendar = ak.tool_trade_date_hist_sina()
        dates = set(str(v)[:10] for v in calendar['trade_date'].tolist())
        return today.strftime('%Y-%m-%d') in dates
    except Exception as exc:
        print(f'  ! 交易日历不可用，停止更新: {exc}')
        return False

def is_market_open_today():
    """通过AKShare检查今天是否有交易数据（排除节假日）"""
    if TEST_MODE:
        return True
    try:
        df = ak.stock_zh_index_spot_em()
        if len(df) == 0:
            return False
        # 检查最新价是否有变化（非交易日可能返回0或None）
        sh_row = df[df['代码'] == '000001']
        if len(sh_row) > 0:
            close = safe_float(sh_row.iloc[0].get('最新价'))
            if close and close > 0:
                return True
        return False
    except Exception:
        return True  # 无法判断时假设是交易日，让后续数据验证来把关

# ============================================================
# 数据抓取函数
# ============================================================

def fetch_index_spot_tencent():
    """Fetch one coherent, timestamped batch from Tencent as a fallback."""
    symbols = ','.join(TENCENT_INDEX_SYMBOLS.values())
    reverse_names = {symbol: name for name, symbol in TENCENT_INDEX_SYMBOLS.items()}
    request = Request(
        f'https://qt.gtimg.cn/q={symbols}',
        headers={'Referer': 'https://gu.qq.com/', 'User-Agent': 'Mozilla/5.0'},
    )
    result = {}
    with urlopen(request, timeout=20) as response:
        content = response.read().decode('gb18030', errors='replace')
    for line in content.splitlines():
        match = re.match(r'v_([a-z0-9]+)="(.*)";', line.strip(), re.I)
        if not match or match.group(1) not in reverse_names:
            continue
        fields = match.group(2).split('~')
        if len(fields) <= 37:
            continue
        timestamp = fields[30].strip()
        source_date = f'{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}' if len(timestamp) >= 8 else None
        amount_ten_thousand = safe_float(fields[37])
        result[reverse_names[match.group(1)]] = {
            'close': safe_float(fields[3]),
            'change': safe_float(fields[31]),
            'changePct': safe_float(fields[32]),
            'volume': round(amount_ten_thousand / 10000, 0) if amount_ten_thousand is not None else None,
            'source': '腾讯行情',
            'sourceDate': source_date,
        }
    return result


def fetch_index_spot():
    """获取实时指数行情；东方财富失败时整批切换腾讯行情。"""
    print('[1/8] 抓取指数行情...')
    if TEST_MODE:
        print('  [测试模式] 使用示例数据')
        return {}
    result = {}
    try:
        df = with_retry(ak.stock_zh_index_spot_em, label='指数行情')
        if df is None or len(df) == 0:
            raise Exception('东方财富指数行情为空')
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
                'close': close,
                'change': change,
                'changePct': change_pct,
                'volume': volume,
                'source': '东方财富',
                'sourceDate': today_str(),
            }
            print(f'  + {name}: {close} ({change_pct}%)')
    except Exception as e:
        print(f'  ! 指数行情抓取失败: {e}')
    if has_valid_indices(result):
        return result

    print('  ! 东方财富指数批次不完整，切换腾讯行情备用源...')
    try:
        fallback = fetch_index_spot_tencent()
        if has_valid_indices(fallback):
            for name in CORE_INDICES + BROAD_INDICES:
                quote = fallback[name]
                print(f'  + {name}: {quote["close"]} ({quote["changePct"]}%) [腾讯行情]')
            return fallback
        print('  ! 腾讯行情批次校验失败，保留现有市场数据')
    except Exception as exc:
        print(f'  ! 腾讯行情备用源失败: {exc}')
    return {}


def fetch_index_history_rows_eastmoney(name, days=10):
    """Fetch dated closes and turnover from Eastmoney's direct kline API."""
    secid = EASTMONEY_INDEX_SECIDS.get(name)
    if not secid:
        return []
    query = urlencode({
        'secid': secid, 'fields1': 'f1,f2,f3,f4,f5,f6',
        'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        'klt': 101, 'fqt': 1, 'end': '20500101', 'lmt': max(days, 10),
    })
    payload = fetch_json('https://push2his.eastmoney.com/api/qt/stock/kline/get?' + query)
    lines = (payload.get('data') or {}).get('klines') or []
    rows = []
    for line in lines:
        fields = str(line).split(',')
        if len(fields) < 7:
            continue
        close = safe_float(fields[2])
        turnover = safe_float(fields[6])
        if close is None or close <= 0 or turnover is None or turnover < 0:
            continue
        rows.append({'date': fields[0], 'close': close, 'turnover': turnover / 1e8})
    return rows[-days:]


def fetch_index_history_rows_tencent(name, days=10):
    """Tencent kline fallback for index history (works from CI when Eastmoney is blocked)."""
    code = TENCENT_INDEX_SYMBOLS.get(name)
    if not code:
        return []
    rows = []
    query = urlencode({'param': f'{code},day,,,{days},qfq'})
    try:
        payload = fetch_json('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?' + query,
                             referer='https://gu.qq.com/')
        node = (payload.get('data') or {}).get(code) or {}
        series = node.get('qfqday') or node.get('day') or []
        for item in series:
            if isinstance(item, str):
                item = item.split(',')
            if not isinstance(item, (list, tuple)) or len(item) < 7:
                continue
            date = str(item[0])[:10]
            close = safe_float(item[2])
            amount = safe_float(item[6])
            if close is None or close <= 0 or amount is None or amount < 0:
                continue
            rows.append({'date': date, 'close': close, 'turnover': amount / 1e8})
    except Exception as exc:
        print(f'  ! 腾讯K线JSON失败({name}): {exc}')
    if len(rows) >= 2:
        return rows[-days:]
    # secondary: akshare Tencent daily wrapper (cleaner DataFrame)
    try:
        df = ak.stock_zh_index_daily_tx(symbol=code)
        if df is not None and len(df) > 0:
            df = df.tail(days)
            out = []
            for _, r in df.iterrows():
                close = safe_float(r.get('close'))
                amount = safe_float(r.get('amount'))
                if close is None or close <= 0:
                    continue
                out.append({'date': str(r.get('date'))[:10], 'close': close,
                            'turnover': amount / 1e8 if amount is not None else None})
            if len(out) >= 2:
                print(f'  + 腾讯日线({name}) {len(out)}行')
                return out
    except Exception as exc:
        print(f'  ! 腾讯日线包装失败({name}): {exc}')
    return []


def fetch_index_history_rows(name, days=10):
    """Fetch dated closes and turnover; Eastmoney first, Tencent kline as fallback."""
    try:
        rows = fetch_index_history_rows_eastmoney(name, days)
    except Exception as exc:
        print(f'  ! 东方财富K线失败({name}): {exc}')
        rows = []
    if len(rows) >= 2:
        return rows
    print(f'  ! 切换腾讯K线({name})...')
    return fetch_index_history_rows_tencent(name, days)


def fetch_index_history(name, code, days=10):
    """获取带真实日期和成交额的指数历史数据，用于5日、10日均值。"""
    if TEST_MODE:
        return None
    try:
        rows = fetch_index_history_rows(name, days)
        turnover = [row['turnover'] for row in rows]
        return {
            'avg5': round(sum(turnover[-5:]) / 5, 0) if len(turnover) >= 5 else None,
            'avg10': round(sum(turnover[-10:]) / 10, 0) if len(turnover) >= 10 else None,
        }
    except Exception as exc:
        print(f'  ! {name}历史成交额获取失败: {exc}')
        return None


def fetch_weekly_changes():
    """计算指数周涨跌幅"""
    print('[2/8] 计算周涨跌幅...')
    if TEST_MODE:
        return {}
    result = {}
    for name, code in INDEX_CODES.items():
        try:
            rows = fetch_index_history_rows(name, 10)
            if len(rows) < 2:
                result[name] = {'weekChange': None, 'trend': None}
                continue
            closes = [row['close'] for row in rows[-5:]]
            week_change = round((closes[-1] - closes[0]) / closes[0] * 100, 2)
            trend = '反弹' if week_change > 0 else '调整'
            if abs(week_change) > 5:
                trend = '强势' + trend
            result[name] = {'weekChange': week_change, 'trend': trend}
            print(f'  + {name}周涨跌: {week_change}%')
        except Exception as e:
            print(f'  ! {name}周涨跌失败: {e}')
            result[name] = {'weekChange': None, 'trend': None}
    return result


def summarize_industry_flow(sectors, source, source_date):
    by_name = {item.get('name'): item for item in sectors if item.get('name') in SW_LEVEL1_INDUSTRIES}
    ordered = [by_name[name] for name in SW_LEVEL1_INDUSTRIES if name in by_name]
    if len(ordered) != len(SW_LEVEL1_INDUSTRIES) or source_date != today_str():
        return None
    ordered.sort(key=lambda item: item['netInflow'], reverse=True)
    return {
        'sectors': ordered,
        'netInflow': round(sum(item['netInflow'] for item in ordered), 2),
        'inflowCount': sum(1 for item in ordered if item['netInflow'] > 0),
        'outflowCount': sum(1 for item in ordered if item['netInflow'] < 0),
        'source': source, 'sourceDate': source_date,
    }


def fetch_fund_flow_direct():
    fields = 'f2,f3,f6,f12,f14,f62,f124,f184'
    all_rows = []
    total = 0
    page = 1
    while page == 1 or len(all_rows) < total:
        query = urlencode({
            'pn': page, 'pz': 100, 'po': 1, 'np': 1, 'fltt': 2, 'invt': 2,
            'fid': 'f62', 'fs': 'm:90+t:2', 'fields': fields,
            'ut': 'bd1d9ddb04089700cf9c27f6f7426281',
        })
        payload = fetch_json('https://push2.eastmoney.com/api/qt/clist/get?' + query)
        data = payload.get('data') or {}
        rows = data.get('diff') or []
        total = int(data.get('total') or 0)
        if not rows:
            break
        all_rows.extend(rows)
        page += 1
        if page > 10:
            break
    sectors = []
    timestamp = 0
    for row in all_rows:
        name = str(row.get('f14') or '').strip()
        net_inflow = safe_float(row.get('f62'))
        change_pct = safe_float(row.get('f3'))
        turnover = safe_float(row.get('f6'))
        net_ratio = safe_float(row.get('f184'))
        if name not in SW_LEVEL1_INDUSTRIES or net_inflow is None or change_pct is None:
            continue
        if abs(change_pct) > 20 or turnover is None or turnover < 0 or net_ratio is None or abs(net_ratio) > 100:
            continue
        sectors.append({
            'name': name, 'netInflow': round(net_inflow / 1e8, 2),
            'changePct': change_pct, 'turnover': round(turnover / 1e8, 2),
            'netRatio': net_ratio,
        })
        timestamp = max(timestamp, int(safe_float(row.get('f124'), 0) or 0))
    source_date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d') if timestamp else None
    return summarize_industry_flow(sectors, '东方财富行情平台', source_date)


def fetch_fund_flow():
    """获取31个申万一级行业资金流向，失败时使用直接行情接口。"""
    print('[3/8] 抓取主力资金流向...')
    if TEST_MODE:
        return {'sectors': [], 'netInflow': None, 'inflowCount': None, 'outflowCount': None}
    try:
        df = with_retry(ak.stock_sector_fund_flow_rank, indicator='今日', sector_type='行业资金流')
        if df is None:
            raise Exception('AKShare行业资金流为空')
        sectors = []
        for _, row in df.iterrows():
            name = row.get('名称', '')
            net_inflow = safe_float(row.get('今日主力净流入-净额'))
            if net_inflow is not None:
                net_inflow = round(net_inflow / 1e8, 2)
            change_pct = safe_float(row.get('今日涨跌幅'))
            sectors.append({
                'name': name,
                'netInflow': net_inflow,
                'changePct': change_pct,
            })
        summary = summarize_industry_flow(sectors, '东方财富/AKShare', today_str())
        if summary:
            print(f'  + {len(summary["sectors"])}个申万一级行业，净流入{summary["netInflow"]}亿')
            return summary
        print('  ! AKShare行业批次不完整，切换直接行情接口')
    except Exception as e:
        print(f'  ! 资金流向抓取失败: {e}')
    try:
        summary = fetch_fund_flow_direct()
        if summary:
            print(f'  + {len(summary["sectors"])}个申万一级行业，净流入{summary["netInflow"]}亿 [直接接口]')
            return summary
        print('  ! 行业直接接口未通过31行业和日期校验')
    except Exception as exc:
        print(f'  ! 行业直接接口失败: {exc}')
    # 路径A：东方财富系被屏蔽时，Tushare 备用源补充行业资金流
    pro = get_tushare_pro()
    if pro is not None:
        try:
            summary = fetch_fund_flow_tushare(pro)
            if summary:
                return summary
        except Exception as exc:
            print(f'  ! Tushare 行业资金流失败: {exc}')
    return {'sectors': [], 'netInflow': None, 'inflowCount': None, 'outflowCount': None, 'source': None, 'sourceDate': None}


def fetch_margin():
    """获取融资融券数据"""
    print('[4/8] 抓取融资融券...')
    if TEST_MODE:
        return {'financeBalance': None, 'securitiesBalance': None, 'totalBalance': None, 'balanceChange': None, 'shBalance': None, 'szBalance': None, 'marginTradePct': None, 'dataDate': None, 'dataLevel': 'B'}
    try:
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=10)).strftime('%Y%m%d')
        sh_finance = None
        sz_finance = None
        sh_date = None
        sz_date = None
        sh_change = None
        sz_change = None
        try:
            df_sse = with_retry(ak.stock_margin_sse, start_date=start_date, end_date=end_date)
            if df_sse is not None and len(df_sse) > 0:
                latest_sse = df_sse.iloc[-1]
                sh_finance = safe_float(latest_sse.get('融资余额'))
                if sh_finance:
                    sh_finance = round(sh_finance / 1e8, 2)
                raw_date = latest_sse.get('信用交易日期') or latest_sse.get('日期')
                sh_date = normalize_date(raw_date)
                # 融资余额日变化：取区间末两个交易日之差
                if len(df_sse) >= 2:
                    prev_sh = safe_float(df_sse.iloc[-2].get('融资余额'))
                    if prev_sh:
                        sh_change = round(sh_finance - prev_sh / 1e8, 2)
        except Exception as e:
            print(f'  ! 上交所融资融券失败: {e}')
        try:
            df_szse = with_retry(ak.stock_margin_szse, date=end_date)
            if df_szse is not None and len(df_szse) > 0:
                latest_szse = df_szse.iloc[-1]
                sz_finance = safe_float(latest_szse.get('融资余额'))
                if sz_finance:
                    sz_finance = round(sz_finance / 1e8, 2)
                raw_date = latest_szse.get('信用交易日期') or latest_szse.get('日期')
                sz_date = normalize_date(raw_date) if raw_date is not None else today_str()
                # 深交所单日接口无法计算日变化，保留 None（总价变化用上交所口径近似）
        except Exception as e:
            print(f'  ! 深交所融资融券失败: {e}')
        total_finance = round(sh_finance + sz_finance, 2) if sh_finance is not None and sz_finance is not None else None
        # 日变化：两所都有则用合计，否则用上交所口径（深交所无日变化数据）
        total_change = round(sh_change + sz_change, 2) if sh_change is not None and sz_change is not None else (sh_change if sh_change is not None else None)
        data_date = min(sh_date, sz_date) if total_finance is not None and sh_date and sz_date else None
        print(f'  + 融资余额: {total_finance}亿 (日变化 {total_change}亿)')
        return {'financeBalance': total_finance, 'securitiesBalance': None, 'totalBalance': total_finance, 'balanceChange': total_change, 'shBalance': sh_finance, 'szBalance': sz_finance, 'marginTradePct': None, 'dataDate': data_date, 'dataLevel': 'B'}
    except Exception as e:
        print(f'  ! 融资融券抓取失败: {e}')
        return {'financeBalance': None, 'securitiesBalance': None, 'totalBalance': None, 'balanceChange': None, 'shBalance': None, 'szBalance': None, 'marginTradePct': None, 'dataDate': None, 'dataLevel': 'B'}


def fetch_northbound():
    """获取北向资金数据"""
    print('[5/8] 抓取北向资金...')
    if TEST_MODE:
        return {'netBuy': None, 'turnover': None, 'turnoverPct': None, 'topStocks': None, 'dataLevel': 'A'}
    try:
        # 港交所自2024-08起停止披露北向实时净买入额，AKShare相关接口已废弃；
        # 暂无可验证的真实替代数据源，如实标注停更，不编造、不无效重试。
        print('  ! 北向资金：港交所2024-08起停止披露，暂无真实数据源，标注停更')
        return {'netBuy': None, 'turnover': None, 'turnoverPct': None, 'topStocks': None,
                'dataLevel': 'X', 'statusNote': '停更：港交所2024-08起不再披露北向实时净买入'}
        latest = df.iloc[-1]
        net_buy = safe_float(latest.get('当日成交净买额') or latest.get('净买额') or latest.get('value'))
        if net_buy:
            net_buy = round(net_buy / 1e4, 2)
        turnover = safe_float(latest.get('当日成交总额') or latest.get('成交额'))
        if turnover:
            turnover = round(turnover / 1e4, 2)
        print(f'  + 北向净买入: {net_buy}亿')
        return {'netBuy': net_buy, 'turnover': turnover, 'turnoverPct': None, 'topStocks': None, 'dataLevel': 'A'}
    except Exception as e:
        print(f'  ! 北向资金抓取失败: {e}')
        return {'netBuy': None, 'turnover': None, 'turnoverPct': None, 'topStocks': None, 'dataLevel': 'A'}


def fetch_bonds():
    """获取国债收益率"""
    print('[6/8] 抓取债券利率...')
    if TEST_MODE:
        return []
    try:
        start_date = (datetime.now() - timedelta(days=15)).strftime('%Y%m%d')
        df = with_retry(ak.bond_zh_us_rate, start_date=start_date)
        if df is None or len(df) == 0:
            raise Exception('债券利率数据为空')
        bonds = []
        latest = df.iloc[-1] if len(df) > 0 else None
        prev = df.iloc[-2] if len(df) > 1 else None
        for col, display_name in BOND_NAME_MAP.items():
            if col in df.columns and latest is not None:
                curr_val = safe_float(latest[col])
                prev_val = safe_float(prev[col]) if prev is not None else None
                if curr_val is None:
                    continue
                change = round(curr_val - prev_val, 3) if prev_val is not None else None
                bonds.append({'name': display_name, 'yield': curr_val, 'change': change, 'prevChange': None, 'implication': None})
        if '中国国债收益率10年' in df.columns and '美国国债收益率10年' in df.columns and latest is not None:
            cn10 = safe_float(latest['中国国债收益率10年'])
            us10 = safe_float(latest['美国国债收益率10年'])
            if cn10 is not None and us10 is not None:
                bonds.append({'name': '中美利差(10年)', 'yield': round(cn10 - us10, 3), 'change': None, 'prevChange': None, 'implication': None})
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
                commodities.append({'name': display_name, 'changePct': change_pct, 'prevChange': None, 'implication': impl})
                print(f'  + {display_name}: {change_pct}%')
        except Exception as e:
            print(f'  ! {display_name}获取失败: {e}')
    return commodities


def fetch_full_snapshot_sina():
    """Sina full A-share snapshot: fallback for market breadth when Eastmoney is blocked."""
    try:
        df = ak.stock_zh_a_spot()
    except Exception as exc:
        print(f'  ! 新浪全量快照失败: {exc}')
        return None
    if df is None or len(df) == 0:
        return None
    chg_col = '涨跌幅' if '涨跌幅' in df.columns else None
    if chg_col is None:
        print('  ! 新浪快照缺少涨跌幅列')
        return None
    try:
        changes = df[chg_col]
        up_count = int((changes > 0).sum())
        down_count = int((changes < 0).sum())
        flat_count = int((changes == 0).sum())
        limit_up = int((changes >= 9.9).sum())
        limit_down = int((changes <= -9.9).sum())
        total = up_count + down_count + flat_count
        up_pct = round(up_count / total * 100, 1) if total > 0 else 0
        down_pct = round(down_count / total * 100, 1) if total > 0 else 0
        effect = '偏强' if up_count > down_count else '偏弱' if down_count > up_count else '均衡'
        return {'upCount': up_count, 'downCount': down_count, 'flatCount': flat_count,
                'limitUp': limit_up, 'limitDown': limit_down, 'upPct': up_pct,
                'downPct': down_pct, 'moneyEffect': effect}
    except Exception as exc:
        print(f'  ! 新浪快照解析失败: {exc}')
        return None


def fetch_market_breadth():
    """获取市场广度数据（东方财富优先，新浪全量快照备用）"""
    print('[8/8] 抓取市场广度...')
    if TEST_MODE:
        return {'upCount': None, 'downCount': None, 'flatCount': None, 'limitUp': None, 'limitDown': None, 'upPct': None, 'downPct': None, 'moneyEffect': None}
    df = with_retry(ak.stock_zh_a_spot_em, label='市场广度')
    if df is not None and len(df) > 0:
        try:
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
            print(f'  + 涨{up_count}/跌{down_count}/涨停{limit_up}/跌停{limit_down} [东方财富]')
            return {'upCount': up_count, 'downCount': down_count, 'flatCount': flat_count, 'limitUp': limit_up, 'limitDown': limit_down, 'upPct': up_pct, 'downPct': down_pct, 'moneyEffect': effect}
        except Exception as e:
            print(f'  ! 东方财富广度解析失败: {e}')
    print('  ! 东方财富全市场快照失败，切换新浪备用源...')
    sina = fetch_full_snapshot_sina()
    if sina:
        print(f'  + 涨{sina["upCount"]}/跌{sina["downCount"]}/涨停{sina["limitUp"]}/跌停{sina["limitDown"]} [新浪]')
        return sina
    return {'upCount': None, 'downCount': None, 'flatCount': None, 'limitUp': None, 'limitDown': None, 'upPct': None, 'downPct': None, 'moneyEffect': None}


# ============================================================
# 路径A：Tushare 备用数据源
# 用途：东方财富被 GitHub Actions 服务器屏蔽时，用 Tushare(独立服务器)补充
#       - 行业资金流 industry_rank
#       - ETF 份额 fund_share
# 说明：北向资金(外资)因港交所2024-08-20起停止日度披露、改为季度披露，
#       Tushare hk_hold 亦无日度数据，无法补，如实标注停更。
# 依赖：环境变量 TUSHARE_TOKEN（GitHub Secrets 注入）；未配置时本段自动跳过。
# ============================================================

def get_tushare_pro():
    """返回 Tushare pro_api 客户端；无 token 或导入失败则返回 None（自动跳过）。"""
    token = os.environ.get('TUSHARE_TOKEN')
    if not token:
        return None
    try:
        import tushare as ts
        ts.set_token(token)
        return ts.pro_api()
    except Exception as exc:
        print(f'  ! Tushare 初始化失败: {exc}')
        return None


def get_recent_trading_dates(n=2):
    """最近 n 个交易日(YYYYMMDD)，用于 ETF 份额环比。新浪交易日历从 runner 可达。"""
    try:
        df = with_retry(ak.tool_trade_date_hist_sina)
        if df is None or len(df) == 0:
            return []
        col = 'trade_date' if 'trade_date' in getattr(df, 'columns', []) else df.columns[0]
        vals = []
        for d in df[col].tolist()[-n:]:
            if hasattr(d, 'strftime'):
                vals.append(d.strftime('%Y%m%d'))
            else:
                digits = re.sub(r'\D', '', str(d))
                if len(digits) >= 8:
                    vals.append(digits[:8])
        return vals
    except Exception as exc:
        print(f'  ! 获取交易日历失败: {exc}')
        return []


def fetch_fund_flow_tushare(pro):
    """Tushare 行业资金流：按 industry 聚合个股 net_amount（单位千元 -> 亿元）。"""
    trade_date = datetime.now().strftime('%Y%m%d')
    try:
        df = pro.industry_rank(trade_date=trade_date)
    except Exception as exc:
        print(f'  ! Tushare industry_rank 调用失败: {exc}')
        return None
    if df is None or len(df) == 0:
        return None
    agg = {}
    for _, row in df.iterrows():
        ind = str(row.get('industry') or '').strip()
        na = safe_float(row.get('net_amount'))
        chg = safe_float(row.get('pct_change'))
        if not ind or na is None:
            continue
        bucket = agg.setdefault(ind, {'net': 0.0, 'chg': []})
        bucket['net'] += na
        if chg is not None:
            bucket['chg'].append(chg)
    sectors = []
    for ind, v in agg.items():
        net = round(v['net'] / 1e4, 2)  # 千元 -> 亿元
        avg_chg = round(sum(v['chg']) / len(v['chg']), 2) if v['chg'] else None
        sectors.append({'name': ind, 'netInflow': net, 'changePct': avg_chg})
    if not sectors:
        return None
    total = round(sum(s['netInflow'] for s in sectors), 2)
    sectors.sort(key=lambda x: x['netInflow'], reverse=True)
    print(f'  + Tushare 行业资金流: {len(sectors)}个行业，合计净流入{total}亿')
    return {
        'sectors': sectors,
        'netInflow': total,
        'inflowCount': sum(1 for s in sectors if s['netInflow'] > 0),
        'outflowCount': sum(1 for s in sectors if s['netInflow'] < 0),
        'source': 'Tushare industry_rank', 'sourceDate': today_str(),
    }


ETF_BROAD = [
    ('沪深300ETF', '510300.SH'), ('上证50ETF', '510050.SH'), ('中证500ETF', '510500.SH'),
    ('创业板ETF', '159915.SZ'), ('科创50ETF', '588000.SH'), ('中证1000ETF', '512100.SH'),
    ('中证A500ETF', '563360.SH'), ('上证180ETF', '510180.SH'),
]


def fetch_etf_flow_tushare(pro):
    """Tushare ETF 份额净变动（主要宽基 ETF），份额(万份) -> 亿份。"""
    dates = get_recent_trading_dates(2)
    if len(dates) < 2:
        print('  ! 无法获取交易日历，跳过 ETF 份额环比')
        return None
    today_dt, prev_dt = dates[0], dates[1]
    items = []
    for name, code in ETF_BROAD:
        try:
            df_t = pro.fund_share(ts_code=code, trade_date=today_dt)
            df_p = pro.fund_share(ts_code=code, trade_date=prev_dt)
            vt = safe_float(df_t.iloc[0]['fund_volume']) if df_t is not None and len(df_t) > 0 else None
            vp = safe_float(df_p.iloc[0]['fund_volume']) if df_p is not None and len(df_p) > 0 else None
            if vt is None or vp is None:
                continue
            delta_yi = round((vt - vp) / 1e4, 2)  # 万份 -> 亿份
            items.append({
                'name': name, 'code': code, 'shareChange': delta_yi,
                'direction': '净申购' if delta_yi > 0 else '净赎回' if delta_yi < 0 else '持平',
                'volume': vt, 'status': 'valid', 'source': 'Tushare fund_share', 'sourceDate': today_dt,
            })
            time.sleep(0.3)
        except Exception as exc:
            print(f'  ! ETF {name} 份额获取失败: {exc}')
    if not items:
        return None
    total = round(sum(i['shareChange'] for i in items), 2)
    print(f'  + Tushare ETF 份额净变动: {total}亿份（{len(items)}只宽基）')
    return {'items': items, 'totalFlow': total, 'sourceDate': today_dt, 'source': 'Tushare fund_share'}


def load_policy_etf_daily(report_date):
    """Reuse only same-date, individually validated ETF observations."""
    try:
        with open(os.path.normpath(POLICY_FUNDS_PATH), 'r', encoding='utf-8') as handle:
            content = handle.read()
        prefix = 'const POLICY_FUNDS_DATA = '
        start = content.find(prefix)
        end = content.rfind('};')
        if start < 0 or end < 0:
            return {'items': [], 'totalFlow': None, 'sourceDate': None}
        payload = json.loads(content[start + len(prefix):end + 1])
        record = next((item for item in reversed(payload.get('history', [])) if item.get('date') == report_date), None)
        if not record:
            return {'items': [], 'totalFlow': None, 'sourceDate': None}
        category_names = {item.get('id'): item.get('name') for item in record.get('categories', [])}
        items = []
        for item in record.get('etfs', []):
            net_flow = safe_float(item.get('netFlow'))
            asset_value = safe_float(item.get('assetValue'))
            if asset_value is None:
                continue
            items.append({
                'name': item.get('name'), 'code': item.get('code'),
                'category': category_names.get(item.get('category'), item.get('category')),
                'changePct': None, 'shareChange': net_flow, 'volume': asset_value,
                'direction': ('净申购' if net_flow > 0 else '净赎回' if net_flow < 0 else '持平') if net_flow is not None else '基线积累中',
                'status': item.get('status'),
                'source': item.get('source'), 'sourceDate': item.get('sourceDate'),
            })
        valid_flows = [item['shareChange'] for item in items if item['shareChange'] is not None]
        total = round(sum(valid_flows), 2) if valid_flows else None
        return {'items': items, 'totalFlow': total, 'sourceDate': report_date}
    except Exception as exc:
        print(f'  ! ETF日数据映射失败: {exc}')
        return {'items': [], 'totalFlow': None, 'sourceDate': None}
    except Exception as e:
        print(f'  ! 市场广度抓取失败: {e}')
        return {'upCount': None, 'downCount': None, 'flatCount': None, 'limitUp': None, 'limitDown': None, 'upPct': None, 'downPct': None, 'moneyEffect': None}


# ============================================================
# 数据组装
# ============================================================

def build_data(index_spot, fund_flow, margin, northbound, bonds, commodities, breadth, weekly_changes, etf_data=None):
    breadth = breadth or {}
    today = next((item.get('sourceDate') for item in index_spot.values() if item.get('sourceDate')), today_str())
    etf_data = etf_data or {'items': [], 'totalFlow': None, 'sourceDate': None}

    indices = []
    for name in CORE_INDICES + BROAD_INDICES:
        spot = index_spot.get(name, {})
        hist = fetch_index_history(name, INDEX_CODES[name]) if not TEST_MODE else None
        idx = {
            'name': name,
            'close': spot.get('close'),
            'change': spot.get('change'),
            'changePct': spot.get('changePct'),
            'volume': spot.get('volume'),
            'source': spot.get('source'), 'sourceDate': spot.get('sourceDate'),
            'status': 'valid' if valid_number(spot.get('close'), False) else 'missing',
        }
        if hist:
            idx['avg5'] = hist.get('avg5')
            idx['avg10'] = hist.get('avg10')
        indices.append(idx)

    sh_vol = index_spot.get('上证指数', {}).get('volume')
    sz_vol = index_spot.get('深证成指', {}).get('volume')
    bj_vol = index_spot.get('北证50', {}).get('volume')
    total_vol = sum(v for v in [sh_vol, sz_vol, bj_vol] if v is not None) if sh_vol is not None and sz_vol is not None else None

    sh_hist = fetch_index_history('上证指数', '000001') if not TEST_MODE else None
    sz_hist = fetch_index_history('深证成指', '399001') if not TEST_MODE else None
    sh_avg5, sz_avg5 = (sh_hist or {}).get('avg5'), (sz_hist or {}).get('avg5')
    sh_avg10, sz_avg10 = (sh_hist or {}).get('avg10'), (sz_hist or {}).get('avg10')
    avg5_total = sh_avg5 + sz_avg5 if sh_avg5 is not None and sz_avg5 is not None else None
    avg10_total = sh_avg10 + sz_avg10 if sh_avg10 is not None and sz_avg10 is not None else None

    turnover = {
        'sh': sh_vol, 'sz': sz_vol, 'bj': bj_vol, 'total': total_vol,
        'prevDay': None, 'change': None, 'changePct': None,
        'avg5': round(avg5_total, 0) if avg5_total is not None else None,
        'vs5d': round(total_vol - avg5_total, 0) if total_vol is not None and avg5_total is not None else None,
        'avg10': round(avg10_total, 0) if avg10_total is not None else None,
        'vs10d': round(total_vol - avg10_total, 0) if total_vol is not None and avg10_total is not None else None,
        'source': index_spot.get('上证指数', {}).get('source'), 'sourceDate': today,
        'status': 'valid' if total_vol is not None else 'missing',
    }

    fund_flow_data = {
        'updateTime': '15:00',
        'netInflow': fund_flow.get('netInflow'),
        'gemNetInflow': None, 'starNetInflow': None, 'csi300NetInflow': None, 'tailNetInflow': None,
        'inflowCount': fund_flow.get('inflowCount'),
        'outflowCount': fund_flow.get('outflowCount'),
        'sectors': fund_flow.get('sectors', []),
        'source': fund_flow.get('source'), 'sourceDate': fund_flow.get('sourceDate'),
        'status': 'valid' if fund_flow.get('sectors') else 'missing',
    }

    core_changes = [i['changePct'] for i in indices[:4] if i.get('changePct') is not None]
    index_score = clamp(50 + (sum(core_changes) / len(core_changes)) * 10) if len(core_changes) == 4 else None
    industry_net = fund_flow.get('netInflow')
    industry_score = clamp(50 + industry_net / 20) if industry_net is not None else None
    turnover_score = clamp(total_vol / avg5_total * 50) if total_vol is not None and avg5_total else None
    breadth_score = breadth.get('upPct') if breadth.get('upCount') is not None and breadth.get('downCount') is not None else None
    margin_change = margin.get('balanceChange')
    margin_score = clamp(50 + margin_change / 10) if margin_change is not None else None

    # 市场情绪：用已真实获取的市场广度派生（上涨家数占比 + 涨跌停板温度修正），不编造
    up_pct = breadth.get('upPct')
    limit_up = breadth.get('limitUp') or 0
    limit_down = breadth.get('limitDown') or 0
    if up_pct is not None:
        lb = ((limit_up - limit_down) / (limit_up + limit_down) * 15) if (limit_up + limit_down) > 0 else 0.0
        emotion_score = clamp(up_pct + lb)
        emotion_inputs = [up_pct, round(lb, 1)]
        emotion_formula = '上涨家数占比 + 涨跌停板温度修正(±15)'
    else:
        emotion_score = None
        emotion_inputs = [None]
        emotion_formula = '缺少市场广度数据无法计算'

    etf_flow = etf_data.get('totalFlow') if etf_data else None
    etf_score = clamp(50 + etf_flow) if etf_flow is not None else None

    daily_radar = [
        radar_item('股指表现', index_score, '50 + 四大核心指数平均涨跌幅×10', core_changes if len(core_changes) == 4 else [None], today),
        radar_item('行业表现', industry_score, '50 + 申万行业主力净流入(亿元)÷20', [industry_net], today),
        radar_item('成交活跃度', turnover_score, '当日成交额÷5日均额×50', [total_vol, avg5_total], today),
        radar_item('市场广度', breadth_score, '上涨家数÷有效股票数×100', [breadth.get('upCount'), breadth.get('downCount')], today),
        radar_item('杠杆资金', margin_score, '50 + 融资余额日变化(亿元)÷10', [margin_change], margin.get('dataDate')),
        radar_item('ETF资金', etf_score, '50 + 主要宽基ETF净申购份额(亿份)', [etf_flow], etf_data.get('sourceDate') if etf_data else today),
        radar_item('外资资金', None, '停更：港交所2024-08-20起停止日度北向披露，改为季度披露', [None], today),
        radar_item('市场情绪', emotion_score, emotion_formula, emotion_inputs, today),
    ]

    valid_scores = [r['value'] for r in daily_radar if r['value'] is not None]
    completeness = round(len(valid_scores) / len(daily_radar) * 100)
    if len(valid_scores) >= 4:
        overall = round(sum(valid_scores) / len(valid_scores), 1)
        state = '偏强' if overall >= 65 else '偏弱' if overall < 40 else '中性'
        rally_quality = f'{state}；有效评分 {len(valid_scores)}/{len(daily_radar)}，平均 {overall} 分'
    else:
        rally_quality = '有效数据不足，暂不形成判断'
    missing_names = [r['name'] for r in daily_radar if r['value'] is None]

    daily = {
        'radar': daily_radar,
        'indices': indices,
        'industryPerformance': {
            'gainers': sorted(fund_flow.get('sectors', []), key=lambda item: item.get('changePct', 0), reverse=True)[:5],
            'losers': sorted(fund_flow.get('sectors', []), key=lambda item: item.get('changePct', 0))[:5],
        },
        'turnover': turnover,
        'breadth': breadth,
        'margin': margin,
        'northbound': northbound,
        'etf': etf_data.get('items', []),
        'fundFlow': fund_flow_data,
        'judgment': {
            'completeness': f'有效评分完整度 {completeness}%（{len(valid_scores)}/{len(daily_radar)}）',
            'fundSource': f'主力资金净流入 {industry_net} 亿元' if industry_net is not None else '主力资金数据暂缺',
            'rallyQuality': rally_quality,
            'riskAlert': '缺失数据：' + '、'.join(missing_names) if missing_names else '未发现数据缺口',
        },
    }

    weekly_indices = []
    for name in CORE_INDICES + BROAD_INDICES:
        wc = weekly_changes.get(name, {})
        weekly_indices.append({'name': name, 'weekChange': wc.get('weekChange'), 'prevWeek': None, 'trend': wc.get('trend')})

    weekly = {
        'radar': [],
        'indices': weekly_indices,
        'industries': [],
        'turnover': {'avgDaily': round(total_vol, 0) if total_vol is not None else None, 'prevAvg': None, 'change': None, 'totalWeekly': None, 'peakDay': None, 'peakVolume': None},
        'breadth': {'avgUp': None, 'avgDown': None, 'avgLimitUp': None, 'avgLimitDown': None},
        'margin': [],
        'etfFlows': [],
        'fundStrength': [],
        'observation': {'coreChange': '-', 'nextWeek': '-', 'maxRisk': '-'},
    }

    monthly = {
        'radar': [],
        'indices': weekly_indices,
        'styleComparison': {
            'growthVsValue': {'growth': None, 'value': None, 'gap': None, 'direction': None},
            'largeVsSmall': {'large': None, 'small': None, 'gap': None, 'direction': None},
            'aVsOverseas': {'aShare': None, 'usMarket': None, 'hkMarket': None, 'direction': None},
        },
        'industries': [],
        'turnover': {'avgDaily': None, 'prevMonth': None, 'change': None, 'total': None, 'halfYearAvg': None, 'vsHalfYear': None},
        'leverage': [],
        'etfFlows': [],
        'bondsCommodities': [],
        'rating': [],
        'observation': {'marketStage': '-', 'opportunity': '-', 'risk': '-', 'validation': '-'},
    }

    fundamentals = {
        'radar': [],
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
        'meta': {
            'reportDate': today, 'dataVersion': 'v1.2-verified', 'marketSession': '收盘',
            'fetchedAt': datetime.now().isoformat(timespec='seconds'),
            'scoringMode': 'strict', 'completeness': completeness,
        },
        'daily': daily,
        'weekly': weekly,
        'monthly': monthly,
        'fundamentals': fundamentals,
        'meso': meso,
    }


# ============================================================
# 历史数据管理
# ============================================================

def load_existing_data():
    """读取现有 data.js 中的数据"""
    try:
        existing_path = os.path.normpath(OUTPUT_PATH)
        if not os.path.exists(existing_path):
            return None
        with open(existing_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'const DASHBOARD_DATA' not in content:
            return None

        # data.js is executable JavaScript rather than strict JSON: older files
        # contain comments, unquoted keys and single-quoted strings.  Parse it
        # with the Node runtime already provided by GitHub Actions, and also
        # recover DASHBOARD_HISTORY when it is stored as a separate constant.
        export_script = content + r'''
process.stdout.write(JSON.stringify({
  data: DASHBOARD_DATA,
  history: typeof DASHBOARD_HISTORY === 'undefined' ? [] : DASHBOARD_HISTORY
}));
'''
        result = subprocess.run(
            ['node'], input=export_script, text=True, capture_output=True,
            encoding='utf-8', timeout=20, check=True
        )
        parsed = json.loads(result.stdout)
        data = parsed.get('data')
        if not isinstance(data, dict):
            return None
        history = parsed.get('history')
        data['history'] = history if isinstance(history, list) else []
        return data
    except Exception as e:
        print(f'  ! 读取现有数据失败: {e}')
        return None


def has_valid_indices(index_spot):
    """Only accept a complete nine-index batch stamped with today's date."""
    if not index_spot:
        return False
    for name in CORE_INDICES + BROAD_INDICES:
        spot = index_spot.get(name, {})
        if not valid_number(spot.get('close'), False):
            return False
        if spot.get('sourceDate') != today_str():
            return False
    return True


def build_history(existing_data, new_data):
    """构建历史数据数组：把旧数据存入history，保留最近MAX_HISTORY天"""
    history = []
    new_date = new_data.get('meta', {}).get('reportDate', '') if new_data else ''
    # 从现有数据中提取history
    if existing_data:
        old_history = existing_data.get('history', [])
        history.extend(old_history)
        # 把旧的当日数据加入history
        old_date = existing_data.get('meta', {}).get('reportDate', '')
        old_daily = existing_data.get('daily', {})
        if old_date and old_daily and old_date != new_date:
            # 去重：如果该日期已在history中，先移除
            history = [h for h in history if h.get('date') != old_date]
            snapshot = {
                key: deepcopy(existing_data.get(key))
                for key in ['meta', 'daily', 'weekly', 'monthly', 'fundamentals', 'meso']
                if existing_data.get(key) is not None
            }
            history.append({'date': old_date, 'daily': deepcopy(old_daily), 'snapshot': snapshot})
    # 按日期降序排序
    history.sort(key=lambda x: x.get('date', ''), reverse=True)
    # 保留最近MAX_HISTORY条
    history = history[:MAX_HISTORY]
    return history

def validate_report(data):
    """Final fail-closed validation before replacing the published data file."""
    errors = []
    core = data.get('daily', {}).get('indices', [])[:len(CORE_INDICES)]
    if len(core) != len(CORE_INDICES):
        errors.append('核心指数数量不完整')
    for item in core:
        if not valid_number(item.get('close'), False):
            errors.append(f'{item.get("name", "未知指数")}收盘点位无效')
        change_pct = item.get('changePct')
        if change_pct is None or abs(change_pct) > 25:
            errors.append(f'{item.get("name", "未知指数")}涨跌幅异常')
    breadth = data.get('daily', {}).get('breadth', {})
    counts = [breadth.get('upCount'), breadth.get('downCount'), breadth.get('flatCount')]
    if all(v is not None for v in counts) and not 1000 <= sum(counts) <= 10000:
        errors.append('市场广度股票数量异常')
    return errors


# ============================================================
# 生成 data.js
# ============================================================

def generate_js(data, history):
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    report_date = data.get('meta', {}).get('reportDate', '')
    mode_str = '测试模式' if TEST_MODE else '自动抓取'

    # 单独输出history（避免嵌套在DASHBOARD_DATA中过大）
    history_str = json.dumps(history, ensure_ascii=False, indent=2)

    js_content = f"""/**
 * 趋势雷达数据模型 - 自动更新数据层
 * 数据来源：AKShare（东方财富/上交所/深交所/中债登等公开数据）
 * 更新模式：{mode_str}
 * 自动更新时间：{now_str}
 * 数据日期：{report_date}
 * 历史数据：{len(history)}个交易日
 *
 * 由 scripts/fetch_data.py 自动生成，请勿手动编辑
 */

const DASHBOARD_DATA = {json_str};

// 历史数据（供日期选择器使用，每个元素含 date 和 daily）
const DASHBOARD_HISTORY = {history_str};

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
    elif FORCE_MODE:
        print('模式: 强制模式（跳过交易日检查）')
    print('=' * 60)

    # 检查交易日
    if not TEST_MODE and not FORCE_MODE:
        if not is_trading_day():
            print('\n⏭ 今天是周末，非交易日，跳过更新。')
            print('  下一个工作日16:30会自动运行。')
            print('  如需强制运行，使用: python fetch_data.py --force')
            return
        print(f'[交易日检查] 今天是交易日，继续执行。')

    # 读取现有数据
    existing_data = None
    if not TEST_MODE:
        existing_data = load_existing_data()
        if existing_data:
            old_date = existing_data.get('meta', {}).get('reportDate', '未知')
            print(f'[0/8] 已加载现有数据（数据日期: {old_date}），仅用于历史记录')
        else:
            print('[0/8] 未找到现有数据，将使用新抓取的数据')

    index_spot = fetch_index_spot()

    # 检查指数数据是否有效
    if not TEST_MODE and not has_valid_indices(index_spot):
        print('\n⚠ 指数数据抓取失败！保留现有 data.js 不覆盖。')
        print('  可能原因：非交易日、节假日、或数据源暂时不可达。')
        print('  下次定时运行时会自动重试。')
        return

    weekly_changes = fetch_weekly_changes()
    fund_flow = fetch_fund_flow()

    margin = fetch_margin()
    northbound = fetch_northbound()
    bonds = fetch_bonds()
    commodities = fetch_commodities()
    breadth = fetch_market_breadth()
    report_date = next((item.get('sourceDate') for item in index_spot.values() if item.get('sourceDate')), today_str())
    etf_data = load_policy_etf_daily(report_date)
    # 路径A：Tushare 补充 ETF 份额净变动（若可用则覆盖 policy 基线）
    pro = get_tushare_pro()
    if pro is not None:
        try:
            tushare_etf = fetch_etf_flow_tushare(pro)
            if tushare_etf:
                etf_data = tushare_etf
        except Exception as exc:
            print(f'  ! Tushare ETF 份额失败: {exc}')

    print('\n组装数据...')
    data = build_data(
        index_spot, fund_flow, margin, northbound,
        bonds, commodities, breadth, weekly_changes, etf_data
    )

    validation_errors = validate_report(data)
    if validation_errors:
        print('\n⚠ 最终数据校验失败，保留现有 data.js：')
        for error in validation_errors:
            print(f'  - {error}')
        raise SystemExit(1)

    # 构建历史数据
    history = []
    if not TEST_MODE:
        history = build_history(existing_data, data)
        print(f'历史数据: {len(history)}个交易日')

    js_content = generate_js(data, history)
    output_path = os.path.normpath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    temp_path = output_path + '.tmp'
    with open(temp_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    os.replace(temp_path, output_path)

    print(f'\n{"=" * 60}')
    print(f'数据已写入: {output_path}')
    print(f'数据日期: {data["meta"]["reportDate"]}')
    print(f'指数数量: {len(data["daily"]["indices"])}')
    print(f'资金流向板块: {len(data["daily"]["fundFlow"]["sectors"])}')
    print(f'债券数据: {len(data["fundamentals"]["ratesBonds"])}')
    print(f'商品数据: {len(data["fundamentals"]["commodities"])}')
    print(f'历史数据: {len(history)}个交易日')
    print(f'{"=" * 60}')


if __name__ == '__main__':
    main()
