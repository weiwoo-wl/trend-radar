#!/usr/bin/env python3
"""Build the policy-funds observer dataset from verified ETF shares and prices."""

import argparse
import json
import math
import os
import statistics
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, 'config', 'policy-funds-etfs.json')
OUTPUT_PATH = os.path.join(ROOT, 'js', 'policy-funds-data.js')
PREFIX = 'const POLICY_FUNDS_DATA = '


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def load_json(path):
    with open(path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def load_existing(path=OUTPUT_PATH):
    if not os.path.exists(path):
        return {'meta': {}, 'categories': [], 'history': [], 'quarterlyAnchors': []}
    with open(path, 'r', encoding='utf-8') as handle:
        content = handle.read()
    start = content.find(PREFIX)
    end = content.rfind('};')
    if start < 0 or end < 0:
        raise ValueError('无法解析现有政策性资金数据文件')
    return json.loads(content[start + len(PREFIX):end + 1])


def classify_etf(name, config):
    text = str(name or '').strip()
    if not text or any(term.lower() in text.lower() for term in config['excludePatterns']):
        return None
    # Specific names are evaluated before broad aliases such as "50ETF".
    categories = sorted(config['categories'], key=lambda item: max(map(len, item['patterns'])), reverse=True)
    for category in categories:
        if any(pattern.lower() in text.lower() for pattern in category['patterns']):
            return category['id']
    return None


def median_absolute_deviation(values):
    center = statistics.median(values)
    deviations = [abs(value - center) for value in values]
    mad = statistics.median(deviations)
    if mad == 0:
        non_zero = [abs(value) for value in values if value != 0]
        mad = statistics.median(non_zero) if non_zero else 0
    return center, mad


def anomaly_for(values, current, window=60, minimum=40, multiplier=2.0):
    sample = [finite(value) for value in values[-window:]]
    sample = [value for value in sample if value is not None]
    if current is None or len(sample) < minimum:
        return None
    center, mad = median_absolute_deviation(sample)
    if mad == 0:
        return None
    upper = center + multiplier * mad
    lower = center - multiplier * mad
    anomaly = current - upper if current > upper else current - lower if current < lower else 0.0
    return {
        'baseline': round(center, 2), 'mad': round(mad, 2),
        'normalLower': round(lower, 2), 'normalUpper': round(upper, 2),
        'anomalyFlow': round(anomaly, 2),
    }


def normalize_shares(raw_shares, implied_shares=None, source='unknown'):
    raw = finite(raw_shares)
    if raw is None or raw <= 0:
        return None
    if source == 'sse':
        return raw * 10000
    if source == 'szse':
        return raw
    if implied_shares and implied_shares > 0:
        candidates = [raw, raw * 10000, raw * 1e8]
        return min(candidates, key=lambda candidate: abs(candidate - implied_shares) / implied_shares)
    return raw


def spot_rows(ak):
    frame = ak.fund_etf_spot_em()
    rows = {}
    for _, row in frame.iterrows():
        code = str(row.get('代码', '')).zfill(6)
        price = finite(row.get('最新价')) or finite(row.get('单位净值'))
        market_cap = finite(row.get('总市值'))
        implied = market_cap / price if market_cap and price else None
        rows[code] = {
            'code': code, 'name': str(row.get('名称', '')).strip(),
            'price': price, 'marketCap': market_cap,
            'spotShares': normalize_shares(row.get('最新份额'), implied, 'spot'),
        }
    return rows


def official_share_rows(ak, report_date):
    rows = {}
    try:
        sse = ak.fund_etf_scale_sse(date=report_date.replace('-', ''))
        for _, row in sse.iterrows():
            code = str(row.get('基金代码', '')).zfill(6)
            rows[code] = {
                'name': str(row.get('基金简称', '')).strip(),
                'shares': normalize_shares(row.get('基金份额'), source='sse'),
                'source': '上海证券交易所',
                'sourceDate': str(row.get('统计日期', report_date))[:10],
            }
    except Exception as exc:
        print(f'  ! 上交所ETF份额获取失败: {exc}')
    try:
        szse = ak.fund_etf_scale_szse()
        for _, row in szse.iterrows():
            code = str(row.get('基金代码', '')).zfill(6)
            rows[code] = {
                'name': str(row.get('基金简称', '')).strip(),
                'shares': normalize_shares(row.get('基金份额'), source='szse'),
                'source': '深圳证券交易所',
                'sourceDate': report_date,
            }
    except Exception as exc:
        print(f'  ! 深交所ETF份额获取失败: {exc}')
    return rows


def is_trading_day(ak, report_date):
    try:
        calendar = ak.tool_trade_date_hist_sina()
        dates = {str(value)[:10] for value in calendar['trade_date'].tolist()}
        return report_date in dates
    except Exception as exc:
        raise RuntimeError(f'交易日历不可用: {exc}') from exc


def market_proxy_change(ak, code):
    try:
        frame = ak.stock_zh_index_spot_em()
        row = frame[frame['代码'].astype(str) == str(code)]
        return finite(row.iloc[0].get('涨跌幅')) if len(row) else None
    except Exception as exc:
        print(f'  ! 市场代理指数获取失败: {exc}')
        return None


def previous_etfs(existing):
    history = existing.get('history', [])
    return {item['code']: item for item in history[-1].get('etfs', [])} if history else {}


def observation_counts(existing):
    counts = {}
    for record in existing.get('history', []):
        for item in record.get('etfs', []):
            code = item.get('code')
            if code:
                counts[code] = counts.get(code, 0) + 1
    return counts


def build_daily_record(report_date, official, spots, existing, config, market_change_pct=None):
    prior = previous_etfs(existing)
    observations = observation_counts(existing)
    category_names = {item['id']: item['name'] for item in config['categories']}
    categories = {key: {'id': key, 'name': name, 'totalFlow': 0.0, 'assetValue': 0.0, 'validAssetValue': 0.0, 'etfCount': 0}
                  for key, name in category_names.items()}
    etfs = []

    for code, share_row in official.items():
        spot = spots.get(code, {})
        name = share_row.get('name') or spot.get('name')
        category = classify_etf(name, config)
        shares, nav = finite(share_row.get('shares')), finite(spot.get('price'))
        if not category or shares is None or nav is None or nav <= 0:
            continue
        asset_value = shares * nav
        previous = prior.get(code)
        previous_shares = finite(previous.get('shares')) if previous else None
        listing_ready = observations.get(code, 0) >= config['minimumListingDays']
        flow = (shares - previous_shares) * nav / 1e8 if previous_shares is not None and listing_ready else None
        item = {
            'code': code, 'name': name, 'category': category,
            'shares': round(shares, 2), 'nav': round(nav, 4),
            'assetValue': round(asset_value / 1e8, 2),
            'netFlow': round(flow, 2) if flow is not None else None,
            'source': share_row.get('source'), 'sourceDate': share_row.get('sourceDate'),
            'status': 'valid' if flow is not None else ('listing_pending' if previous_shares is not None else 'baseline_pending'),
        }
        etfs.append(item)
        bucket = categories[category]
        bucket['assetValue'] += asset_value / 1e8
        bucket['validAssetValue'] += asset_value / 1e8 if flow is not None else 0
        bucket['etfCount'] += 1
        if flow is not None:
            bucket['totalFlow'] += flow

    previous_category_values = {category['id']: [] for category in config['categories']}
    for record in existing.get('history', []):
        for category in record.get('categories', []):
            value = finite(category.get('totalFlow'))
            if category.get('id') in previous_category_values and value is not None:
                previous_category_values[category['id']].append(value)

    valid_market_value = total_market_value = 0.0
    category_results = []
    for category in categories.values():
        total_market_value += category['assetValue']
        coverage = category['validAssetValue'] / category['assetValue'] if category['assetValue'] else 0
        valid_market_value += category['validAssetValue']
        total_flow = round(category['totalFlow'], 2) if coverage >= config['minimumCoverage'] else None
        anomaly = anomaly_for(
            previous_category_values[category['id']], total_flow,
            config['baselineWindow'], config['minimumBaselinePoints'], config['madMultiplier']
        )
        category_results.append({
            'id': category['id'], 'name': category['name'], 'totalFlow': total_flow,
            'assetValue': round(category['assetValue'], 2), 'coverage': round(coverage, 4),
            'etfCount': category['etfCount'], **(anomaly or {'anomalyFlow': None}),
        })

    coverage = valid_market_value / total_market_value if total_market_value else 0
    valid_flows = [item['totalFlow'] for item in category_results if item['totalFlow'] is not None]
    anomaly_flows = [item['anomalyFlow'] for item in category_results if item.get('anomalyFlow') is not None]
    total_flow = round(sum(valid_flows), 2) if coverage >= config['minimumCoverage'] and valid_flows else None
    anomaly_flow = round(sum(anomaly_flows), 2) if coverage >= config['minimumCoverage'] and anomaly_flows else None
    abnormal = [item for item in category_results if finite(item.get('anomalyFlow')) not in (None, 0)]
    same_direction = [item for item in abnormal if math.copysign(1, item['anomalyFlow']) == math.copysign(1, anomaly_flow or 1)]
    level, reasons = 0, []
    if abnormal:
        level, reasons = 1, [f'{len(abnormal)}类宽基ETF超过60日正常区间']
    if len(same_direction) >= config['synchronousCategoryCount']:
        level, reasons = 2, reasons + [f'{len(same_direction)}类核心宽基ETF同步异动']
    if level >= 2 and anomaly_flow and anomaly_flow > 0 and finite(market_change_pct) is not None and market_change_pct <= config['marketDropThresholdPct']:
        level, reasons = 3, reasons + [f'沪深300下跌{market_change_pct:.2f}%，出现逆势承接']

    return {
        'date': report_date, 'coverage': round(coverage, 4),
        'totalFlow': total_flow, 'anomalyFlow': anomaly_flow,
        'evidenceLevel': level, 'reasons': reasons,
        'marketChangePct': finite(market_change_pct),
        'categories': category_results, 'etfs': etfs,
    }


def cumulative_history(history):
    cumulative = 0.0
    for record in history:
        anomaly = finite(record.get('anomalyFlow'))
        if anomaly is not None:
            cumulative += anomaly
            record['cumulativeAnomalyFlow'] = round(cumulative, 2)
        else:
            record['cumulativeAnomalyFlow'] = None
    return history


def validate_output(data, config):
    errors = []
    history = data.get('history', [])
    dates = [record.get('date') for record in history]
    if len(dates) != len(set(dates)):
        errors.append('历史记录存在重复日期')
    if len(history) > config['retentionTradingDays']:
        errors.append('历史记录超过保留范围')
    for record in history:
        coverage = finite(record.get('coverage'))
        if coverage is None or not 0 <= coverage <= 1:
            errors.append(f'{record.get("date")}覆盖率无效')
        if coverage < config['minimumCoverage'] and record.get('anomalyFlow') is not None:
            errors.append(f'{record.get("date")}覆盖不足但生成了异常金额')
    return errors


def render_js(data):
    return '/**\n * 政策性资金观察数据 - 自动生成\n */\n' + PREFIX + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'


def write_atomic(path, content):
    temp = path + '.tmp'
    with open(temp, 'w', encoding='utf-8') as handle:
        handle.write(content)
    os.replace(temp, path)


def self_test():
    values = [0] * 40 + [2, -2, 1, -1] * 5
    result = anomaly_for(values, 20, minimum=40)
    assert result and result['anomalyFlow'] > 0
    assert anomaly_for(values, 1, minimum=40)['anomalyFlow'] == 0
    assert classify_etf('沪深300ETF华夏', load_json(CONFIG_PATH)) == 'csi300'
    assert classify_etf('港股通红利ETF', load_json(CONFIG_PATH)) is None
    print('policy funds self-test passed')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return

    import akshare as ak
    config = load_json(CONFIG_PATH)
    existing = load_existing()
    report_date = datetime.now().strftime('%Y-%m-%d')
    if not is_trading_day(ak, report_date):
        print(f'{report_date} 不是交易日，跳过政策性资金更新')
        return
    spots = spot_rows(ak)
    official = official_share_rows(ak, report_date)
    if not official or not spots:
        raise SystemExit('ETF份额或行情数据为空，保留现有文件')

    record = build_daily_record(report_date, official, spots, existing, config, market_proxy_change(ak, config['marketProxy']))
    history = [item for item in existing.get('history', []) if item.get('date') != report_date]
    history.append(record)
    history.sort(key=lambda item: item['date'])
    history = cumulative_history(history[-config['retentionTradingDays']:])
    data = {
        'meta': {
            'version': 'v1-mad60', 'status': 'valid' if record['coverage'] >= config['minimumCoverage'] else 'insufficient_coverage',
            'reportDate': report_date, 'updatedAt': datetime.now().isoformat(timespec='seconds'),
            'coverage': record['coverage'], 'configVersion': config['version'],
            'disclaimer': '异常宽基ETF流量用于观察潜在政策性资金趋势，不代表国家队实际持仓或账户余额。',
        },
        'categories': [{'id': item['id'], 'name': item['name']} for item in config['categories']],
        'history': history,
        'quarterlyAnchors': existing.get('quarterlyAnchors', []),
    }
    errors = validate_output(data, config)
    if errors:
        raise SystemExit('最终校验失败：' + '；'.join(errors))
    write_atomic(OUTPUT_PATH, render_js(data))
    print(f'政策性资金数据已更新：{report_date}，覆盖率 {record["coverage"]:.1%}')


if __name__ == '__main__':
    main()
