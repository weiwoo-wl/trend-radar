#!/usr/bin/env python3
"""滚动盈利信息：国家统计局工业利润 + 全A股正式财报动态筛选。"""

import argparse
import json
import math
import os
import re
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'js' / 'earnings-data.js'
NBS_MAIN_PATH = '工业>工业企业主要经济指标'
NBS_INDUSTRY_PATH = '工业>按行业分工业企业主要经济指标 (2018-至今)>工业企业利润总额'


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def round_value(value, digits=2):
    number = finite(value)
    return round(number, digits) if number is not None else None


def load_existing():
    if not OUTPUT.exists():
        return {'meta': {}, 'records': [], 'history': []}
    content = OUTPUT.read_text(encoding='utf-8')
    match = re.search(r'const\s+ROLLING_EARNINGS_DATA\s*=\s*(\{.*\});?\s*$', content, re.S)
    if not match:
        return {'meta': {}, 'records': [], 'history': []}
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return {'meta': {}, 'records': [], 'history': []}


def period_columns(frame):
    columns = list(frame.columns)
    if len(columns) < 2:
        raise ValueError('国家统计局返回的有效月份不足2期')
    return columns[0], columns[1]


def frame_value(frame, row_name, column):
    if row_name not in frame.index:
        return None
    return finite(frame.loc[row_name, column])


def source_record(record_id, entity_type, name, latest, change, judgment, period, published_at,
                  source_url, source_name='国家统计局', source_level='A', **extra):
    record = {
        'id': record_id, 'entityType': entity_type, 'metric': name,
        'latest': latest, 'change': change, 'judgment': judgment,
        'period': period, 'publishedAt': published_at,
        'sourceName': source_name, 'sourceUrl': source_url, 'sourceLevel': source_level,
    }
    if published_at is None:
        record['checkedAt'] = datetime.now().date().isoformat()
    record.update(extra)
    return record


def nbs_records(main, industry):
    latest_col, previous_col = period_columns(main)
    data_url = 'https://data.stats.gov.cn/dg/website/page.html'
    # 新统计接口没有返回新闻稿发布日期；宁可留空，也不把检查日期冒充发布日期。
    published_at = None
    profit = frame_value(main, '利润总额_累计值(亿元)', latest_col)
    profit_growth = frame_value(main, '利润总额累计增长(%)', latest_col)
    previous_profit_growth = frame_value(main, '利润总额累计增长(%)', previous_col)
    revenue = frame_value(main, '营业收入_累计值(亿元)', latest_col)
    revenue_growth = frame_value(main, '营业收入累计增长(%)', latest_col)
    previous_revenue_growth = frame_value(main, '营业收入累计增长(%)', previous_col)
    inventory_growth = frame_value(main, '产成品存货增减(%)', latest_col)
    previous_inventory_growth = frame_value(main, '产成品存货增减(%)', previous_col)
    receivable_growth = frame_value(main, '应收账款增减(%)', latest_col)
    previous_receivable_growth = frame_value(main, '应收账款增减(%)', previous_col)
    companies = frame_value(main, '企业单位数本月末(个)', latest_col)
    loss_companies = frame_value(main, '亏损企业本月末(个)', latest_col)
    loss_ratio = loss_companies / companies * 100 if companies and loss_companies is not None else None
    margin = profit / revenue * 100 if profit is not None and revenue else None

    def direction(current, previous, positive_is_good=True):
        if current is None or previous is None:
            return '数据待确认'
        improved = current > previous if positive_is_good else current < previous
        return '连续改善' if improved else '增长减速'

    fixed = [
        source_record('macro-profit', 'macro', '规上工业企业利润',
                      f'{profit:,.1f}亿元' if profit is not None else '数据暂缺',
                      f'累计同比 {profit_growth:+.1f}%' if profit_growth is not None else '同比暂缺',
                      direction(profit_growth, previous_profit_growth), latest_col, published_at, data_url),
        source_record('macro-revenue', 'macro', '规上工业企业营业收入',
                      f'{revenue:,.1f}亿元' if revenue is not None else '数据暂缺',
                      f'累计同比 {revenue_growth:+.1f}%' if revenue_growth is not None else '同比暂缺',
                      direction(revenue_growth, previous_revenue_growth), latest_col, published_at, data_url),
        source_record('macro-margin', 'macro', '规上工业营业收入利润率',
                      f'{margin:.2f}%' if margin is not None else '数据暂缺',
                      '利润总额÷营业收入', '盈利质量观察', latest_col, published_at, data_url),
        source_record('macro-inventory', 'macro', '规上工业产成品存货',
                      f'{inventory_growth:+.1f}%' if inventory_growth is not None else '数据暂缺',
                      f'较上期 {(inventory_growth - previous_inventory_growth):+.1f}个百分点' if inventory_growth is not None and previous_inventory_growth is not None else '上期暂缺',
                      direction(inventory_growth, previous_inventory_growth, False), latest_col, published_at, data_url),
        source_record('macro-receivable', 'macro', '规上工业应收账款',
                      f'{receivable_growth:+.1f}%' if receivable_growth is not None else '数据暂缺',
                      f'较上期 {(receivable_growth - previous_receivable_growth):+.1f}个百分点' if receivable_growth is not None and previous_receivable_growth is not None else '上期暂缺',
                      direction(receivable_growth, previous_receivable_growth, False), latest_col, published_at, data_url),
        source_record('macro-loss-ratio', 'macro', '规上工业亏损企业比例',
                      f'{loss_ratio:.1f}%' if loss_ratio is not None else '数据暂缺',
                      f'{int(loss_companies):,}/{int(companies):,}家' if loss_companies is not None and companies else '企业数暂缺',
                      '盈利广度观察', latest_col, published_at, data_url),
    ]

    industry_latest, industry_previous = period_columns(industry)
    candidates = []
    suffix = '利润总额累计增长(%)'
    for row_name in industry.index:
        if not str(row_name).endswith(suffix) or str(row_name) == '工业企业利润总额累计增长(%)':
            continue
        name = str(row_name)[:-len(suffix)]
        current = finite(industry.loc[row_name, industry_latest])
        previous = finite(industry.loc[row_name, industry_previous])
        if current is None or previous is None:
            continue
        delta = current - previous
        reversal = (current >= 0 > previous) or (current < 0 <= previous)
        score = abs(delta) + (30 if reversal else 0)
        candidates.append({'name': name, 'current': current, 'previous': previous, 'delta': delta, 'score': score})

    positive = sorted((x for x in candidates if x['delta'] > 0), key=lambda x: x['score'], reverse=True)[:3]
    negative = sorted((x for x in candidates if x['delta'] <= 0), key=lambda x: x['score'], reverse=True)[:2]
    dynamic = []
    for item in positive + negative:
        if item['current'] >= 0 > item['previous']:
            judgment = '增速反转 · 连续改善'
        elif item['current'] < 0 <= item['previous']:
            judgment = '由增转降 · 增长减速'
        elif item['delta'] > 0:
            judgment = '连续改善'
        else:
            judgment = '增长减速'
        dynamic.append(source_record(
            'industry-' + re.sub(r'\W+', '-', item['name']), 'industry', item['name'] + '利润',
            f"{item['current']:+.1f}%", f"较上期 {item['delta']:+.1f}个百分点", judgment,
            industry_latest, published_at, data_url,
            rawValue=round_value(item['current']), previousValue=round_value(item['previous'])
        ))
    return fixed, dynamic, str(latest_col)


def latest_report_dates(today=None):
    today = today or date.today()
    year = today.year
    endpoints = [date(year, 9, 30), date(year, 6, 30), date(year, 3, 31), date(year - 1, 12, 31)]
    return [item.strftime('%Y%m%d') for item in endpoints if item <= today]


def eastmoney_report(requests, report_date):
    url = 'https://datacenter-web.eastmoney.com/api/data/v1/get'
    period = f'{report_date[:4]}-{report_date[4:6]}-{report_date[6:]}'
    params = {
        'sortColumns': 'UPDATE_DATE,SECURITY_CODE', 'sortTypes': '-1,-1',
        'pageSize': 500, 'pageNumber': 1, 'reportName': 'RPT_LICO_FN_CPD',
        'columns': 'ALL', 'filter': f"(REPORTDATE='{period}')",
    }
    first = requests.get(url, params=params, timeout=30).json()
    result = first.get('result') or {}
    pages = int(result.get('pages') or 0)
    rows = list(result.get('data') or [])
    for page in range(2, pages + 1):
        params['pageNumber'] = page
        response = requests.get(url, params=params, timeout=30).json()
        rows.extend((response.get('result') or {}).get('data') or [])
    return rows


def notice_index(requests, begin_date, end_date):
    url = 'https://np-anotice-stock.eastmoney.com/api/security/ann'
    params = {
        'sr': -1, 'page_size': 100, 'page_index': 1, 'ann_type': 'A',
        'client_source': 'web', 'f_node': 1, 's_node': 0,
        'begin_time': begin_date, 'end_time': end_date,
    }
    response = requests.get(url, params=params, timeout=30).json()
    data = response.get('data') or {}
    total = int(data.get('total_hits') or 0)
    pages = min(20, math.ceil(total / 100))
    items = list(data.get('list') or [])
    for page in range(2, pages + 1):
        params['page_index'] = page
        items.extend((requests.get(url, params=params, timeout=30).json().get('data') or {}).get('list') or [])
    mapping = {}
    allowed = ('年度报告', '半年度报告', '季度报告', '业绩快报')
    for item in items:
        title = str(item.get('title') or '')
        if not any(word in title for word in allowed) or '摘要' in title:
            continue
        codes = item.get('codes') or []
        code_item = next((code for code in codes if str(code.get('ann_type', '')).startswith('A')), codes[0] if codes else {})
        code = str(code_item.get('stock_code') or '')
        art_code = str(item.get('art_code') or '')
        if code and art_code and code not in mapping:
            mapping[code] = {
                'title': title,
                'url': f'https://data.eastmoney.com/notices/detail/{code}/{art_code}.html',
                'date': str(item.get('notice_date') or '')[:10],
            }
    return mapping


def company_records(rows, notices, report_date):
    candidates = []
    for row in rows:
        code = str(row.get('SECURITY_CODE') or '')
        notice = notices.get(code)
        if not notice:
            continue
        name = str(row.get('SECURITY_NAME_ABBR') or '')
        if 'ST' in name.upper() or '退' in name:
            continue
        industry = str(row.get('PUBLISHNAME') or row.get('BOARD_NAME') or '行业未分类')
        revenue = finite(row.get('TOTAL_OPERATE_INCOME'))
        revenue_yoy = finite(row.get('YSTZ'))
        net_profit = finite(row.get('PARENT_NETPROFIT'))
        profit_yoy = finite(row.get('SJLTZ'))
        cashflow_ps = finite(row.get('MGJYXJJE'))
        eps = finite(row.get('BASIC_EPS'))
        deduct_eps = finite(row.get('DEDUCT_BASIC_EPS'))
        margin = finite(row.get('XSMLL'))
        if None in (revenue, revenue_yoy, net_profit, profit_yoy) or revenue <= 0:
            continue
        nonrecurring_gap = abs(eps - deduct_eps) / max(abs(eps), 0.01) if eps is not None and deduct_eps is not None else None
        low_base = abs(profit_yoy) > 300 or abs(net_profit) < 10_000_000
        cashflow_ok = cashflow_ps is not None and cashflow_ps > 0
        clean_profit = nonrecurring_gap is not None and nonrecurring_gap <= 0.25
        strong = revenue_yoy >= 15 and profit_yoy >= 30 and net_profit > 0
        weak = revenue_yoy <= -10 and profit_yoy <= -30
        if not strong and not weak:
            continue
        score = min(abs(profit_yoy), 200) * 0.45 + min(abs(revenue_yoy), 100) * 0.25 + min(abs(net_profit) / 1e8, 30)
        if cashflow_ok: score += 12
        if clean_profit: score += 10
        if low_base: score -= 18
        labels = []
        if low_base:
            labels.append('低基数高增' if profit_yoy > 0 else '盈利明显承压')
        elif strong:
            labels.append('增长加速')
        else:
            labels.append('增长减速')
        if cashflow_ok and strong:
            labels.append('现金流同步')
        elif strong:
            labels.append('现金流未验证')
        if not clean_profit and strong:
            labels[-1:] = ['扣非口径待确认']
        candidates.append({
            'code': code, 'name': name, 'industry': industry, 'revenue': revenue,
            'revenueYoy': revenue_yoy, 'netProfit': net_profit, 'profitYoy': profit_yoy,
            'cashflowPerShare': cashflow_ps, 'grossMargin': margin,
            'deductEps': deduct_eps, 'score': score, 'labels': labels[:2], 'notice': notice,
        })

    selected, industry_counts = [], {}
    positive = sorted((x for x in candidates if x['profitYoy'] >= 0), key=lambda x: x['score'], reverse=True)
    negative = sorted((x for x in candidates if x['profitYoy'] < 0), key=lambda x: x['score'], reverse=True)
    low_base_count = 0

    def take(pool, target):
        nonlocal low_base_count
        added = 0
        for candidate in pool:
            if industry_counts.get(candidate['industry'], 0) >= 2:
                continue
            is_low_base = '低基数高增' in candidate['labels']
            if is_low_base and low_base_count >= 2:
                continue
            selected.append(candidate)
            industry_counts[candidate['industry']] = industry_counts.get(candidate['industry'], 0) + 1
            low_base_count += 1 if is_low_base else 0
            added += 1
            if added >= target:
                break

    take(positive, 5)
    take(negative, 2)

    records = []
    for item in selected:
        latest = f"营收{item['revenueYoy']:+.1f}% / 净利{item['profitYoy']:+.1f}%"
        change = f"净利润 {item['netProfit'] / 1e8:,.2f}亿元"
        records.append(source_record(
            'company-' + item['code'], 'company', f"{item['name']}（{item['code']}）", latest, change,
            ' · '.join(item['labels']), report_date, item['notice']['date'], item['notice']['url'],
            source_name='交易所公告镜像索引', source_level='A-', industry=item['industry'],
            rawValue=round_value(item['netProfit']), previousValue=None,
            details={
                '营业收入': round_value(item['revenue'] / 1e8), '营收同比': round_value(item['revenueYoy']),
                '净利润': round_value(item['netProfit'] / 1e8), '净利润同比': round_value(item['profitYoy']),
                '每股经营现金流': round_value(item['cashflowPerShare']), '毛利率': round_value(item['grossMargin']),
                '扣非每股收益': round_value(item['deductEps']), '公告标题': item['notice']['title'],
            }
        ))
    return records


def validate(data):
    records = data.get('records') or []
    errors = []
    if len(records) < 11:
        errors.append(f'有效记录不足：{len(records)}')
    if len([item for item in records if item.get('entityType') == 'macro']) < 5:
        errors.append('固定宏观指标不足5项')
    ids = [item.get('id') for item in records]
    if len(ids) != len(set(ids)):
        errors.append('记录ID重复')
    for item in records:
        for key in ('metric', 'latest', 'change', 'judgment', 'period', 'sourceUrl'):
            if not item.get(key):
                errors.append(f"{item.get('id')} 缺少 {key}")
    company_industries = {}
    for item in records:
        if item.get('entityType') == 'company':
            industry = item.get('industry')
            company_industries[industry] = company_industries.get(industry, 0) + 1
    if any(count > 2 for count in company_industries.values()):
        errors.append('同一行业公司超过2家')
    return errors


def render_js(data):
    return '/** 滚动盈利信息；由 scripts/fetch_earnings.py 自动生成。 */\nconst ROLLING_EARNINGS_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'


def write_atomic(content):
    fd, temporary = tempfile.mkstemp(prefix='earnings-', suffix='.js', dir=str(OUTPUT.parent))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(content)
        os.replace(temporary, OUTPUT)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def self_test():
    assert latest_report_dates(date(2026, 8, 10))[0] == '20260630'
    assert latest_report_dates(date(2026, 4, 15))[0] == '20260331'
    sample = {'records': [
        {'id': f'macro-{i}', 'entityType': 'macro', 'metric': 'x', 'latest': '1', 'change': '2', 'judgment': '连续改善', 'period': '2026-06', 'sourceUrl': 'https://example.com'}
        for i in range(11)
    ]}
    assert not [error for error in validate(sample) if '宏观' in error or '不足' in error]
    print('earnings self-test passed')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return

    import requests
    from akshare.economic.macro_china_nbs import macro_china_nbs_nation

    existing = load_existing()
    main_frame = macro_china_nbs_nation('月度数据', NBS_MAIN_PATH, 'LAST4')
    industry_frame = macro_china_nbs_nation('月度数据', NBS_INDUSTRY_PATH, 'LAST4')
    fixed, industries, macro_period = nbs_records(main_frame, industry_frame)

    report_rows, report_date = [], None
    for candidate_date in latest_report_dates():
        report_rows = eastmoney_report(requests, candidate_date)
        if report_rows:
            report_date = candidate_date
            break
    if not report_rows or not report_date:
        raise SystemExit('未取得有效A股业绩报表，保留旧文件')
    newest_notice = max((str(row.get('NOTICE_DATE') or '')[:10] for row in report_rows), default=date.today().isoformat())
    begin = (datetime.fromisoformat(newest_notice) - timedelta(days=45)).date().isoformat()
    notices = notice_index(requests, begin, date.today().isoformat())
    companies = company_records(report_rows, notices, report_date)
    records = fixed + industries + companies
    history = list(existing.get('history', []))
    previous_records = existing.get('records') or []
    previous_signature = json.dumps(previous_records, ensure_ascii=False, sort_keys=True)
    current_signature = json.dumps(records, ensure_ascii=False, sort_keys=True)
    if previous_records and previous_signature != current_signature:
        history.append({
            'archivedAt': datetime.now().isoformat(timespec='seconds'),
            'macroPeriod': existing.get('meta', {}).get('macroPeriod'),
            'companyPeriod': existing.get('meta', {}).get('companyPeriod'),
            'records': previous_records,
        })
    data = {
        'meta': {
            'version': 'v1-rules', 'status': 'valid', 'updatedAt': datetime.now().isoformat(timespec='seconds'),
            'macroPeriod': macro_period, 'companyPeriod': report_date,
            'recordCount': len(records), 'sourcePolicy': 'official-first',
        },
        'records': records,
        'history': history[-24:],
    }
    errors = validate(data)
    if errors:
        raise SystemExit('盈利数据校验失败：' + '；'.join(errors))
    write_atomic(render_js(data))
    print(f'滚动盈利数据已更新：宏观{macro_period}，公司{report_date}，共{len(records)}条')


if __name__ == '__main__':
    main()
