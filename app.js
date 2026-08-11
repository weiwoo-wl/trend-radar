/**
 * 趋势雷达数据看板 - 主应用逻辑
 */

// ========== 日期选择器逻辑 ==========
let _originalDaily = null;  // 保存原始daily数据
let _currentDate = '';     // 当前选中的日期（空=最新）

function initDateSelector() {
  const selector = document.getElementById('dateSelector');
  if (!selector) return;

  // 保存原始 daily 数据
  _originalDaily = JSON.parse(JSON.stringify(DASHBOARD_DATA.daily));

  // 构建 option 列表：默认显示真实日期 + "最新"标签
  let options = '<option value="">' + DASHBOARD_DATA.meta.reportDate + '（最新）</option>';

  // 从 DASHBOARD_HISTORY 获取历史日期
  if (typeof DASHBOARD_HISTORY !== 'undefined' && DASHBOARD_HISTORY && DASHBOARD_HISTORY.length > 0) {
    DASHBOARD_HISTORY.forEach(h => {
      options += `<option value="${h.date}">${h.date}</option>`;
    });
  }

  selector.innerHTML = options;
}

function onDateChange() {
  const selector = document.getElementById('dateSelector');
  if (!selector) return;

  const selectedDate = selector.value;
  _currentDate = selectedDate;

  if (!selectedDate) {
    // 恢复最新数据
    DASHBOARD_DATA.daily = JSON.parse(JSON.stringify(_originalDaily));
    document.getElementById('updateStatus').textContent = '最新数据';
  } else {
    // 从历史数据中查找
    if (typeof DASHBOARD_HISTORY !== 'undefined' && DASHBOARD_HISTORY) {
      const histItem = DASHBOARD_HISTORY.find(h => h.date === selectedDate);
      if (histItem && histItem.daily) {
        DASHBOARD_DATA.daily = JSON.parse(JSON.stringify(histItem.daily));
        document.getElementById('updateStatus').textContent = '历史数据 · ' + selectedDate;
      }
    }
  }

  // 重新渲染当前页面
  const activePage = document.querySelector('.nav-item.active');
  if (activePage) {
    const page = activePage.dataset.page;
    setTimeout(() => renderPage(page), 50);
  }
  if (typeof syncRealtimeState === 'function') syncRealtimeState();
}

// ========== 全局 ECharts 主题配置 ==========
const CHART_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#94a3b8', fontFamily: 'inherit' },
  color: ['#06b6d4', '#8b5cf6', '#ef4444', '#22c55e', '#eab308', '#3b82f6', '#f97316'],
  grid: { top: 40, right: 20, bottom: 30, left: 50 },
  tooltip: {
    backgroundColor: 'rgba(15,21,37,0.95)',
    borderColor: '#334155',
    textStyle: { color: '#e2e8f0', fontSize: 12 },
  },
};

function hasVerifiedDataset() {
  // 只有被明确标记为未校验的数据才拦截；真实数据（无标记或 strict 模式）均正常展示，避免误伤真实行情
  const mode = DASHBOARD_DATA && DASHBOARD_DATA.meta && DASHBOARD_DATA.meta.scoringMode;
  return mode !== 'unverified';
}

function showUnavailable(el, message = '数据尚未通过严格校验') {
  if (!el) return;
  el.innerHTML = `<div style="height:100%;min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);text-align:center;padding:20px">${message}</div>`;
}

// ========== 工具函数 ==========
function fmtPct(v, withSign = true) {
  if (!Number.isFinite(v)) return '数据暂缺';
  const sign = withSign && v > 0 ? '+' : '';
  return sign + v.toFixed(2) + '%';
}

function fmtNum(v, decimals = 2) {
  if (!Number.isFinite(v)) return '数据暂缺';
  return v.toFixed(decimals);
}

function fmtValue(v, suffix = '', decimals = null) {
  if (!Number.isFinite(v)) return '数据暂缺';
  const value = decimals === null ? v.toLocaleString() : v.toFixed(decimals);
  return value + suffix;
}

function priceColor(v) {
  if (v > 0) return 'num-up';
  if (v < 0) return 'num-down';
  return 'num-flat';
}

function statusLabel(s) {
  return { green: '🟢改善', yellow: '🟡观察', red: '🔴风险' }[s] || s;
}

function statusClass(s) {
  return 'status-' + s;
}

// ========== 导航逻辑 ==========
const charts = {}; // 存储所有 ECharts 实例

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    const titles = {
      overview: '综合总览', daily: '天数据', weekly: '周数据',
      monthly: '月数据', fundamentals: '市场基本面', meso: '中观结构',
      'policy-funds': '政策性资金观察', valuation: '估值模型'
    };
    document.getElementById('pageTitle').textContent = titles[page];

    // 渲染对应页面
    setTimeout(() => renderPage(page), 50);
  });
});

function renderPage(page) {
  if (!hasVerifiedDataset() && page !== 'valuation' && page !== 'policy-funds') {
    renderUnverifiedPage(page);
    return;
  }
  const renderers = {
    overview: renderOverview, daily: renderDaily, weekly: renderWeekly,
    monthly: renderMonthly, fundamentals: renderFundamentals, meso: renderMeso,
    'policy-funds': () => typeof renderPolicyFunds === 'function' && renderPolicyFunds()
  };
  if (renderers[page]) renderers[page]();
}

function renderUnverifiedPage(page) {
  const container = document.getElementById('page-' + page);
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="min-height:260px;display:flex;align-items:center;justify-content:center;text-align:center;padding:32px">
      <div>
        <div style="font-size:20px;font-weight:700;margin-bottom:12px">历史数据尚未通过严格校验</div>
        <div style="color:var(--text-secondary);line-height:1.8">为避免展示固定分数、模拟走势或无法追溯的数字，本页暂不展示旧数据。<br>下一交易日自动更新通过校验后，将恢复原有页面结构和真实数据。</div>
      </div>
    </div>`;
}

// ========== 表格构建器 ==========
function buildTable(containerId, headers, rows, rowRenderer) {
  const container = document.getElementById(containerId);
  let html = '<thead><tr>';
  headers.forEach(h => html += `<th>${h}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(row => { html += rowRenderer(row); });
  html += '</tbody>';
  container.innerHTML = html;
}

// ========== 评级渲染器 ==========
function renderRating(containerId, ratings) {
  const container = document.getElementById(containerId);
  container.innerHTML = ratings.map(r => `
    <div class="rating-item">
      <div>
        <div class="rating-label">${r.item || r.industry}</div>
        ${r.reason ? `<div class="rating-reason">${r.reason}</div>` : ''}
      </div>
      <span class="status-badge ${statusClass(r.rating)}">${statusLabel(r.rating)}</span>
    </div>
  `).join('');
}

// ========== 观察重点渲染器 ==========
function renderObservation(containerId, obs) {
  const container = document.getElementById(containerId);
  const items = [
    ['核心变化', obs.coreChange], ['下周重点', obs.nextWeek], ['最大风险', obs.maxRisk],
  ];
  const items2 = [
    ['当前市场阶段', obs.marketStage], ['核心机会', obs.opportunity],
    ['最大风险', obs.risk], ['下一阶段验证', obs.validation],
  ];
  const useItems = obs.coreChange ? items : items2;
  container.innerHTML = useItems
    .filter(([, v]) => v)
    .map(([title, content]) => `
      <div class="observation-box">
        <div class="obs-title">${title}</div>
        <div class="obs-content">${content}</div>
      </div>`).join('');
}

// ========== 雷达图 ==========
function renderRadar(containerId, radarData, title) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (charts[containerId]) charts[containerId].dispose();
  const allItems = Array.isArray(radarData) ? radarData : [];
  const validItems = allItems.filter(d => Number.isFinite(d.value) && d.formula && d.sourceDate);
  if (!validItems.length) {
    el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">暂无可验证评分</div>';
    return;
  }
  const chart = echarts.init(el);
  charts[containerId] = chart;

  const indicators = validItems.map(d => ({ name: d.name, max: 100 }));
  const values = validItems.map(d => d.value);

  chart.setOption({
    ...CHART_THEME,
    radar: {
      indicator: indicators,
      shape: 'polygon',
      radius: '65%',
      splitNumber: 4,
      axisName: { color: '#94a3b8', fontSize: 12 },
      splitLine: { lineStyle: { color: '#1e293b' } },
      splitArea: { areaStyle: { color: ['rgba(6,182,212,0.02)', 'rgba(6,182,212,0.05)'] } },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: title || '',
        areaStyle: { color: 'rgba(6,182,212,0.15)' },
        lineStyle: { color: '#06b6d4', width: 2 },
        itemStyle: { color: '#06b6d4' },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
  });
}

// ========== 综合总览页 ==========
function renderOverview() {
  // 综合雷达
  const overviewRadar = [
    ...DASHBOARD_DATA.daily.radar.slice(0, 4),
    ...DASHBOARD_DATA.fundamentals.radar,
  ].slice(0, 8);
  renderRadar('overview-radar', overviewRadar, '综合状态');

  // 各层级状态卡片
  const layersEl = document.getElementById('overview-layers');
  const verified = hasVerifiedDataset();
  const layers = [
    { name: '天数据', icon: '📅', data: verified ? DASHBOARD_DATA.daily.radar : [], page: 'daily' },
    { name: '周数据', icon: '📆', data: verified ? DASHBOARD_DATA.weekly.radar : [], page: 'weekly' },
    { name: '月数据', icon: '🗓️', data: verified ? DASHBOARD_DATA.monthly.radar : [], page: 'monthly' },
    { name: '市场基本面', icon: '🏛️', data: verified ? DASHBOARD_DATA.fundamentals.radar : [], page: 'fundamentals' },
    { name: '中观结构', icon: '🏭', data: verified ? DASHBOARD_DATA.meso.rating.slice(0, 4).map(r => ({
      name: r.industry, value: r.overall === 'green' ? 75 : r.overall === 'yellow' ? 50 : 25, status: r.overall
    })) : [], page: 'meso' },
  ];

  layersEl.innerHTML = layers.map(layer => {
    const valid = layer.data.filter(d => Number.isFinite(d.value));
    const avgScore = valid.length ? (valid.reduce((s, d) => s + d.value, 0) / valid.length).toFixed(0) : '暂缺';
    const overallStatus = valid.some(d => d.status === 'red') ? 'red' :
      valid.some(d => d.status === 'yellow') ? 'yellow' : valid.length ? 'green' : 'missing';
    const color = overallStatus === 'green' ? 'color-green' : overallStatus === 'yellow' ? 'color-yellow' : overallStatus === 'red' ? 'color-red' : 'text-muted';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;border-left:3px solid var(--${color})"
           onclick="document.querySelector('[data-page=${layer.page}]').click()">
        <span style="font-size:20px">${layer.icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${layer.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${valid.length}/${layer.data.length} 个有效维度</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:700;font-family:monospace;color:var(--${color})">${avgScore}</div>
          <div style="font-size:11px">${valid.length ? statusLabel(overallStatus) : '数据暂缺'}</div>
        </div>
      </div>`;
  }).join('');

  // 核心指标 - 四大核心指数
  const metricsEl = document.getElementById('overview-metrics');
  const d = DASHBOARD_DATA.daily;
  const coreIdx = d.indices.slice(0, 4); // 上证、深证、创业板、科创综指
  const metrics = coreIdx.map(idx => ({
    label: idx.name,
    value: fmtValue(idx.close, '', 2),
    change: fmtPct(idx.changePct),
    up: idx.changePct > 0,
  }));
  metricsEl.innerHTML = metrics.map(m => `
    <div class="metric-card">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value">${m.value}</div>
      <div class="metric-change" style="color:var(--${m.up ? 'color-up' : 'color-down'})">${m.change}</div>
    </div>`).join('');

  // 市场关键数据 - 成交额、融资、北向、ETF
  const mdEl = document.getElementById('overview-market-data');
  if (mdEl) {
    const marketData = [
      { label: '两市成交额', value: fmtValue(d.turnover.total, '亿'), change: Number.isFinite(d.turnover.change) ? fmtValue(d.turnover.change, '亿') : '数据暂缺', up: d.turnover.change > 0 },
      { label: '融资余额', value: fmtValue(d.margin.financeBalance, '亿'), change: Number.isFinite(d.margin.balanceChange) ? fmtValue(d.margin.balanceChange, '亿') : '数据暂缺', up: d.margin.balanceChange > 0 },
      { label: '北向资金', value: fmtValue(d.northbound.netBuy, '亿'), change: Number.isFinite(d.northbound.turnover) ? '成交' + fmtValue(d.northbound.turnover, '亿') : '数据暂缺', up: d.northbound.netBuy > 0 },
      { label: 'ETF周净流入', value: '数据暂缺', change: '尚未接入可验证数据', up: false },
    ];
    mdEl.innerHTML = marketData.map(m => `
      <div class="metric-card">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value">${m.value}</div>
        <div class="metric-change" style="color:var(--${m.up ? 'color-up' : 'color-down'})">${m.change}</div>
      </div>`).join('');
  }

  // 行业热力图
  renderHeatmap();

  // 指数走势
  renderOverviewIndices();

  // ETF流向
  renderOverviewETF();
}

function renderHeatmap() {
  const el = document.getElementById('overview-heatmap');
  if (!el) return;
  if (!hasVerifiedDataset()) { showUnavailable(el); return; }
  if (charts['overview-heatmap']) charts['overview-heatmap'].dispose();
  const chart = echarts.init(el);
  charts['overview-heatmap'] = chart;

  const industries = DASHBOARD_DATA.meso.crowding;
  const data = [];
  const xLabels = ['5日涨幅', '20日涨幅', '成交变化', 'ETF变化', '融资变化'];
  industries.forEach((ind, i) => {
    const vals = [ind.change5d, ind.change20d, ind.turnoverChange, ind.etfChange, ind.marginChange];
    vals.forEach((v, j) => {
      data.push([j, i, v]);
    });
  });

  chart.setOption({
    ...CHART_THEME,
    tooltip: { ...CHART_THEME.tooltip, formatter: p => {
      const ind = industries[p.data[1]];
      const labels = ['5日涨幅', '20日涨幅', '成交变化%', 'ETF变化%', '融资变化%'];
      return `${ind.industry}<br/>${labels[p.data[0]]}: <b>${p.data[2]}%</b><br/>判断: ${ind.judgment}`;
    }},
    grid: { top: 20, right: 20, bottom: 20, left: 100 },
    xAxis: { type: 'category', data: xLabels, splitArea: { show: true }, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'category', data: industries.map(i => i.industry), axisLabel: { fontSize: 11 } },
    visualMap: {
      min: -10, max: 10, calculable: true, orient: 'horizontal',
      left: 'center', bottom: 0,
      inRange: { color: ['#22c55e', '#1a3a2a', '#0f1525', '#3a1a1a', '#ef4444'] },
      textStyle: { color: '#94a3b8' },
    },
    series: [{
      type: 'heatmap', data: data,
      label: { show: true, fontSize: 10, formatter: p => p.data[2] + '%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  });
}

function renderOverviewIndices() {
  const el = document.getElementById('overview-indices');
  if (!el) return;
  if (charts['overview-indices']) charts['overview-indices'].dispose();
  const chart = echarts.init(el);
  charts['overview-indices'] = chart;

  const indices = DASHBOARD_DATA.daily.indices.slice(0, 4);
  const colors = ['#06b6d4', '#8b5cf6', '#ef4444', '#eab308'];
  const history = (typeof DASHBOARD_HISTORY !== 'undefined' ? DASHBOARD_HISTORY : [])
    .filter(h => h && h.date && h.daily && Array.isArray(h.daily.indices))
    .slice().reverse();
  const points = [...history, { date: DASHBOARD_DATA.meta.reportDate, daily: DASHBOARD_DATA.daily }]
    .filter((item, pos, arr) => arr.findIndex(x => x.date === item.date) === pos);
  const dateList = points.map(p => p.date);

  if (points.length < 2) {
    el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">暂无足够的真实历史数据</div>';
    return;
  }

  const series = indices.map((idx, i) => {
    const data = points.map(point => {
      const found = point.daily.indices.find(item => item.name === idx.name);
      return found && Number.isFinite(found.close) ? found.close : null;
    });
    return {
      name: idx.name, type: 'line', data: data, smooth: true,
      lineStyle: { width: 2, color: colors[i] },
      itemStyle: { color: colors[i] },
      symbol: 'none',
    };
  });

  chart.setOption({
    ...CHART_THEME,
    legend: { data: indices.map(i => i.name), bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: { type: 'category', data: dateList, axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: series,
  });
}

function renderOverviewETF() {
  const el = document.getElementById('overview-etf');
  if (!el) return;
  if (!hasVerifiedDataset() || !DASHBOARD_DATA.daily.etf.length) { showUnavailable(el, 'ETF 数据暂缺'); return; }
  if (charts['overview-etf']) charts['overview-etf'].dispose();
  const chart = echarts.init(el);
  charts['overview-etf'] = chart;

  const etfs = DASHBOARD_DATA.daily.etf;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 100 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}亿' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: etfs.map(e => e.name), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: etfs.map(e => ({
        value: e.shareChange,
        itemStyle: { color: e.shareChange > 0 ? '#ef4444' : '#22c55e' }
      })),
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 10, formatter: '{c}亿' },
      barWidth: '60%',
    }],
  });
}

// ========== 天数据页 ==========
function renderDaily() {
  renderRadar('daily-radar', DASHBOARD_DATA.daily.radar, '天数据');

  // 综合判断
  const j = DASHBOARD_DATA.daily.judgment;
  document.getElementById('daily-judgment').innerHTML = [
    ['数据完整度', j.completeness],
    ['资金来源', j.fundSource],
    ['上涨质量', j.rallyQuality],
    ['风险提示', j.riskAlert],
  ].map(([title, content]) => `
    <div class="observation-box">
      <div class="obs-title">${title}</div>
      <div class="obs-content">${content}</div>
    </div>`).join('');

  // 股指表 - 分为核心指数和宽基指数
  const allIndices = DASHBOARD_DATA.daily.indices;
  const coreIndices = allIndices.slice(0, 4);
  const broadIndices = allIndices.slice(4);
  const volDiff = (cur, avg) => {
    if (!Number.isFinite(cur) || !Number.isFinite(avg) || avg === 0) return '<span style="color:var(--text-muted);font-size:11px">数据暂缺</span>';
    const pct = ((cur - avg) / avg * 100).toFixed(1);
    const up = cur >= avg;
    return `<span style="color:var(--${up ? 'color-up' : 'color-down'});font-size:11px">${up ? '+' : ''}${pct}%</span>`;
  };
  // 核心指数：有5日/10日成交额均值（来源：交易所数据）
  const coreRowFn = idx => `<tr>
      <td style="font-weight:600">${idx.name}</td>
      <td style="font-family:monospace">${fmtValue(idx.close, '', 2)}</td>
      <td class="${priceColor(idx.change)}" style="font-family:monospace">${Number.isFinite(idx.change) && idx.change > 0 ? '+' : ''}${fmtValue(idx.change, '', 2)}</td>
      <td class="${priceColor(idx.changePct)}" style="font-family:monospace;font-weight:600">${fmtPct(idx.changePct)}</td>
      <td style="color:var(--text-primary);font-family:monospace;font-weight:600">${fmtValue(idx.volume)}</td>
      <td style="color:var(--text-secondary);font-family:monospace">${fmtValue(idx.avg5)} <br>${volDiff(idx.volume, idx.avg5)}</td>
      <td style="color:var(--text-secondary);font-family:monospace">${fmtValue(idx.avg10)} <br>${volDiff(idx.volume, idx.avg10)}</td>
    </tr>`;
  // 宽基指数：无均值数据，仅显示成交额
  const broadRowFn = idx => `<tr>
      <td style="font-weight:600">${idx.name}</td>
      <td style="font-family:monospace">${fmtValue(idx.close, '', 2)}</td>
      <td class="${priceColor(idx.change)}" style="font-family:monospace">${Number.isFinite(idx.change) && idx.change > 0 ? '+' : ''}${fmtValue(idx.change, '', 2)}</td>
      <td class="${priceColor(idx.changePct)}" style="font-family:monospace;font-weight:600">${fmtPct(idx.changePct)}</td>
      <td style="color:var(--text-primary);font-family:monospace;font-weight:600">${fmtValue(idx.volume)}</td>
      <td style="color:var(--text-tertiary);font-size:12px">—</td>
      <td style="color:var(--text-tertiary);font-size:12px">—</td>
    </tr>`;
  buildTable('daily-indices-core-table',
    ['指数', '收盘', '涨跌', '涨跌幅', '成交额(亿)', '5日均(亿)', '10日均(亿)'],
    coreIndices, coreRowFn);
  buildTable('daily-indices-broad-table',
    ['指数', '收盘', '涨跌', '涨跌幅', '成交额(亿)', '5日均(亿)', '10日均(亿)'],
    broadIndices, broadRowFn);

  // 行业涨跌
  renderDailyIndustry();

  // 市场广度
  renderDailyBreadth();

  // 成交额
  renderDailyTurnover();

  // 融资融券
  renderDailyMargin();

  // ETF表
  buildTable('daily-etf-table',
    ['ETF', '涨跌幅', '份额变化(亿)', '成交额(亿)', '方向'],
    DASHBOARD_DATA.daily.etf,
    e => `<tr>
      <td style="font-weight:600">${e.name}</td>
      <td class="${priceColor(e.changePct)}" style="font-family:monospace">${fmtPct(e.changePct)}</td>
      <td class="${priceColor(e.shareChange)}" style="font-family:monospace">${e.shareChange > 0 ? '+' : ''}${e.shareChange}</td>
      <td style="color:var(--text-secondary);font-family:monospace">${e.volume.toLocaleString()}</td>
      <td><span class="status-badge ${e.direction === '净申购' ? 'status-green' : 'status-red'}">${e.direction}</span></td>
    </tr>`);

  // 主力资金流向
  renderDailyFundFlow();
}

function renderDailyFundFlow() {
  const flow = DASHBOARD_DATA.daily.fundFlow;

  // 申万一级行业资金流向（水平条形图 - 全量31个行业）
  const rankEl = document.getElementById('daily-fundflow-rank');
  if (rankEl) {
    if (charts['daily-fundflow-rank']) charts['daily-fundflow-rank'].dispose();
    const rankChart = echarts.init(rankEl);
    charts['daily-fundflow-rank'] = rankChart;

    // 按净流入从大到小排序，水平条形图从下往上画需要反转
    const sorted = [...flow.sectors].sort((a, b) => b.netInflow - a.netInflow);
    sorted.reverse();

    rankChart.setOption({
      ...CHART_THEME,
      grid: { top: 15, right: 100, bottom: 15, left: 90 },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: p => {
          const s = sorted[p.dataIndex];
          return `<b>${s.name}</b><br/>主力净流入: <span style="color:${s.netInflow > 0 ? '#ef4444' : '#22c55e'};font-weight:bold">${s.netInflow > 0 ? '+' : ''}${s.netInflow.toFixed(2)} 亿</span><br/>行业涨跌幅: <span style="color:${s.changePct > 0 ? '#ef4444' : '#22c55e'}">${s.changePct > 0 ? '+' : ''}${s.changePct.toFixed(2)}%</span>`;
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 11, formatter: '{value}亿' },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map(s => s.name),
        axisLabel: { color: '#cbd5e1', fontSize: 12 },
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: sorted.map(s => ({
          value: s.netInflow,
          itemStyle: {
            color: s.netInflow > 0 ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: 'rgba(239,68,68,0.3)' },
              { offset: 1, color: '#ef4444' },
            ]) : new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: 'rgba(34,197,94,0.3)' },
              { offset: 1, color: '#22c55e' },
            ]),
            borderRadius: s.netInflow > 0 ? [0, 3, 3, 0] : [3, 0, 0, 3],
          },
        })),
        barWidth: '60%',
        label: {
          show: true,
          position: 'right',
          color: '#e2e8f0',
          fontSize: 11,
          fontWeight: 'bold',
          formatter: p => (p.value > 0 ? '+' : '') + p.value.toFixed(2) + '亿',
        },
        markLine: {
          symbol: 'none',
          data: [{ xAxis: 0 }],
          lineStyle: { color: '#475569', width: 1.5, type: 'solid' },
          label: { show: false },
        },
      }],
    });
  }
  if (typeof renderRealtimeIndustryFlow === 'function') renderRealtimeIndustryFlow();
}

function renderDailyIndustry() {
  const el = document.getElementById('daily-industry');
  if (!el) return;
  if (charts['daily-industry']) charts['daily-industry'].dispose();
  const chart = echarts.init(el);
  charts['daily-industry'] = chart;

  const gainers = DASHBOARD_DATA.daily.industryPerformance.gainers;
  const losers = DASHBOARD_DATA.daily.industryPerformance.losers;
  const all = [...losers.reverse(), ...gainers];

  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 60, bottom: 20, left: 80 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: all.map(a => a.name), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: all.map(a => ({ value: a.changePct, itemStyle: { color: a.changePct > 0 ? '#ef4444' : '#22c55e' } })),
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 10, formatter: p => fmtPct(p.value) },
      barWidth: '55%',
    }],
  });
}

function renderDailyBreadth() {
  const el = document.getElementById('daily-breadth');
  if (!el) return;
  if (charts['daily-breadth']) charts['daily-breadth'].dispose();
  const chart = echarts.init(el);
  charts['daily-breadth'] = chart;

  const b = DASHBOARD_DATA.daily.breadth;
  if (![b.upCount, b.downCount, b.flatCount].some(Number.isFinite)) {
    el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">市场广度数据暂缺</div>';
    return;
  }
  chart.setOption({
    ...CHART_THEME,
    legend: { bottom: 0, textStyle: { color: '#94a3b8' } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: [
        { value: b.upCount, name: `上涨 ${b.upCount}`, itemStyle: { color: '#ef4444' } },
        { value: b.downCount, name: `下跌 ${b.downCount}`, itemStyle: { color: '#22c55e' } },
        { value: b.flatCount, name: `平盘 ${b.flatCount}`, itemStyle: { color: '#64748b' } },
      ],
      label: { color: '#94a3b8', fontSize: 12 },
      labelLine: { lineStyle: { color: '#334155' } },
    }],
  });
}

function renderDailyTurnover() {
  const el = document.getElementById('daily-turnover');
  if (!el) return;
  if (charts['daily-turnover']) charts['daily-turnover'].dispose();
  const chart = echarts.init(el);
  charts['daily-turnover'] = chart;

  const t = DASHBOARD_DATA.daily.turnover;
  chart.setOption({
    ...CHART_THEME,
    series: [{
      type: 'graphograph', // 使用文本展示
      layout: 'none',
      data: [],
    }],
  });
  // 用文本展示成交额关键数据
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:10px 0">
      <div class="metric-card"><div class="metric-label">两市成交额</div><div class="metric-value">${fmtValue(t.total, '亿')}</div><div class="metric-change">较昨日 ${fmtValue(t.change, '亿')}</div></div>
      <div class="metric-card"><div class="metric-label">5日平均</div><div class="metric-value" style="font-size:18px">${fmtValue(t.avg5, '亿')}</div><div class="metric-change">差额 ${fmtValue(t.vs5d, '亿')}</div></div>
      <div class="metric-card"><div class="metric-label">10日平均</div><div class="metric-value" style="font-size:18px">${fmtValue(t.avg10, '亿')}</div><div class="metric-change">差额 ${fmtValue(t.vs10d, '亿')}</div></div>
    </div>`;
}

function renderDailyMargin() {
  const el = document.getElementById('daily-margin');
  if (!el) return;
  const m = DASHBOARD_DATA.daily.margin;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px 0">
      <div class="metric-card"><div class="metric-label">融资余额</div><div class="metric-value">${fmtValue(m.financeBalance, '亿')}</div><div class="metric-change" style="font-size:12px;color:var(--text-secondary)">沪 ${fmtValue(m.shBalance)} · 深 ${fmtValue(m.szBalance)}</div></div>
      <div class="metric-card"><div class="metric-label">两融余额</div><div class="metric-value">${fmtValue(m.totalBalance, '亿')}</div><div class="metric-change" style="font-size:12px">较前日 ${fmtValue(m.balanceChange, '亿')}</div></div>
      <div class="metric-card"><div class="metric-label">融券余额</div><div class="metric-value" style="font-size:18px">${fmtValue(m.securitiesBalance, '亿')}</div></div>
      <div class="metric-card"><div class="metric-label">两融成交占比</div><div class="metric-value" style="font-size:18px">${fmtValue(m.marginTradePct, '%')}</div></div>
    </div>
    <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:8px">数据日期：${m.dataDate || '暂缺'}（${m.dataLevel || '—'}类·T+1披露）</div>`;
}

// ========== 周数据页 ==========
function renderWeekly() {
  if (!hasVerifiedDataset() || !DASHBOARD_DATA.weekly.radar.length) {
    showUnavailable(document.getElementById('weekly-radar'), '周度评分尚无可验证数据');
    showUnavailable(document.getElementById('weekly-fund-strength'));
    return;
  }
  renderRadar('weekly-radar', DASHBOARD_DATA.weekly.radar, '周度市场');

  // 资金强度评级
  const fs = DASHBOARD_DATA.weekly.fundStrength;
  document.getElementById('weekly-fund-strength').innerHTML = fs.map(f => `
    <div class="rating-item">
      <div>
        <div class="rating-label" style="font-size:15px;font-weight:600">${f.direction}</div>
        <div class="rating-reason">${f.basis}</div>
      </div>
      <span class="status-badge ${statusClass(f.strength)}">${statusLabel(f.strength)}</span>
    </div>`).join('');

  // 指数周涨跌
  renderWeeklyIndices();

  // 行业周表现
  renderWeeklyIndustry();

  // ETF净申赎
  renderWeeklyETF();

  // 观察重点
  renderObservation('weekly-observation', DASHBOARD_DATA.weekly.observation);
}

function renderWeeklyIndices() {
  const el = document.getElementById('weekly-indices');
  if (!el) return;
  if (charts['weekly-indices']) charts['weekly-indices'].dispose();
  const chart = echarts.init(el);
  charts['weekly-indices'] = chart;

  const indices = DASHBOARD_DATA.weekly.indices;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 40, left: 80 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: indices.map(i => i.name), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [
      { name: '本周', type: 'bar', data: indices.map(i => ({ value: i.weekChange, itemStyle: { color: i.weekChange > 0 ? '#ef4444' : '#22c55e' } })), barWidth: '35%' },
      { name: '上周', type: 'bar', data: indices.map(i => ({ value: i.prevWeek, itemStyle: { color: i.prevWeek > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)' } })), barWidth: '35%' },
    ],
    legend: { data: ['本周', '上周'], bottom: 0, textStyle: { color: '#94a3b8' } },
  });
}

function renderWeeklyIndustry() {
  const el = document.getElementById('weekly-industry');
  if (!el) return;
  if (charts['weekly-industry']) charts['weekly-industry'].dispose();
  const chart = echarts.init(el);
  charts['weekly-industry'] = chart;

  const industries = DASHBOARD_DATA.weekly.industries;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 80 },
    xAxis: { type: 'category', data: industries.map(i => i.name), axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 35 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      type: 'bar', data: industries.map(i => ({ value: i.weekChange, itemStyle: { color: i.weekChange > 0 ? '#ef4444' : '#22c55e' } })),
      label: { show: true, position: 'top', color: '#94a3b8', fontSize: 9, formatter: p => p.value + '%', rotate: 0 },
      barWidth: '50%',
    }],
  });
}

function renderWeeklyETF() {
  const el = document.getElementById('weekly-etf');
  if (!el) return;
  if (charts['weekly-etf']) charts['weekly-etf'].dispose();
  const chart = echarts.init(el);
  charts['weekly-etf'] = chart;

  const etfs = DASHBOARD_DATA.weekly.etfFlows;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 20, left: 100 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}亿' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: etfs.map(e => e.name), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: etfs.map(e => ({ value: e.netBuy, itemStyle: { color: e.netBuy > 0 ? '#ef4444' : '#22c55e' } })),
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 10, formatter: '{c}亿' },
      barWidth: '55%',
    }],
  });
}

// ========== 月数据页 ==========
function renderMonthly() {
  if (!hasVerifiedDataset() || !DASHBOARD_DATA.monthly.radar.length) {
    showUnavailable(document.getElementById('monthly-radar'), '月度评分尚无可验证数据');
    showUnavailable(document.getElementById('monthly-rating'));
    return;
  }
  renderRadar('monthly-radar', DASHBOARD_DATA.monthly.radar, '月度趋势');

  // 月度评级
  renderRating('monthly-rating', DASHBOARD_DATA.monthly.rating);

  // 指数月度
  renderMonthlyIndices();

  // 风格比较
  renderMonthlyStyle();

  // 行业月度
  renderMonthlyIndustry();

  // ETF月度
  renderMonthlyETF();

  // 债券商品
  renderMonthlyBonds();

  // 观察重点
  renderObservation('monthly-observation', DASHBOARD_DATA.monthly.observation);
}

function renderMonthlyIndices() {
  const el = document.getElementById('monthly-indices');
  if (!el) return;
  if (charts['monthly-indices']) charts['monthly-indices'].dispose();
  const chart = echarts.init(el);
  charts['monthly-indices'] = chart;

  const indices = DASHBOARD_DATA.monthly.indices;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 40, left: 80 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: indices.map(i => i.name), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [
      { name: '本月', type: 'bar', data: indices.map(i => ({ value: i.monthChange, itemStyle: { color: i.monthChange > 0 ? '#ef4444' : '#22c55e' } })), barWidth: '35%' },
      { name: '上月', type: 'bar', data: indices.map(i => ({ value: i.prevMonth, itemStyle: { color: i.prevMonth > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)' } })), barWidth: '35%' },
    ],
    legend: { data: ['本月', '上月'], bottom: 0, textStyle: { color: '#94a3b8' } },
  });
}

function renderMonthlyStyle() {
  const el = document.getElementById('monthly-style');
  if (!el) return;
  if (charts['monthly-style']) charts['monthly-style'].dispose();
  const chart = echarts.init(el);
  charts['monthly-style'] = chart;

  const s = DASHBOARD_DATA.monthly.styleComparison;
  chart.setOption({
    ...CHART_THEME,
    legend: { bottom: 0, textStyle: { color: '#94a3b8' } },
    series: [{
      type: 'pie', radius: ['40%', '65%'], center: ['50%', '45%'],
      data: [
        { value: Math.abs(s.growthVsValue.growth), name: `成长 ${fmtPct(s.growthVsValue.growth)}`, itemStyle: { color: '#ef4444' } },
        { value: Math.abs(s.growthVsValue.value), name: `价值 ${fmtPct(s.growthVsValue.value)}`, itemStyle: { color: '#06b6d4' } },
        { value: Math.abs(s.largeVsSmall.large), name: `大盘 ${fmtPct(s.largeVsSmall.large)}`, itemStyle: { color: '#8b5cf6' } },
        { value: Math.abs(s.largeVsSmall.small), name: `小盘 ${fmtPct(s.largeVsSmall.small)}`, itemStyle: { color: '#eab308' } },
      ],
      label: { color: '#94a3b8', fontSize: 11 },
      labelLine: { lineStyle: { color: '#334155' } },
    }],
  });
}

function renderMonthlyIndustry() {
  const el = document.getElementById('monthly-industry');
  if (!el) return;
  if (charts['monthly-industry']) charts['monthly-industry'].dispose();
  const chart = echarts.init(el);
  charts['monthly-industry'] = chart;

  const industries = DASHBOARD_DATA.monthly.industries;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 80 },
    xAxis: { type: 'category', data: industries.map(i => i.name), axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 35 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      type: 'bar', data: industries.map(i => ({ value: i.monthChange, itemStyle: { color: i.monthChange > 0 ? '#ef4444' : '#22c55e' } })),
      label: { show: true, position: 'top', color: '#94a3b8', fontSize: 9, formatter: p => p.value + '%' },
      barWidth: '50%',
    }],
  });
}

function renderMonthlyETF() {
  const el = document.getElementById('monthly-etf');
  if (!el) return;
  if (charts['monthly-etf']) charts['monthly-etf'].dispose();
  const chart = echarts.init(el);
  charts['monthly-etf'] = chart;

  const etfs = DASHBOARD_DATA.monthly.etfFlows;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 20, left: 100 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}亿' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: etfs.map(e => e.name), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: etfs.map(e => ({ value: e.netBuy, itemStyle: { color: e.netBuy > 0 ? '#ef4444' : '#22c55e' } })),
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 10, formatter: '{c}亿' },
      barWidth: '55%',
    }],
  });
}

function renderMonthlyBonds() {
  const el = document.getElementById('monthly-bonds');
  if (!el) return;
  if (charts['monthly-bonds']) charts['monthly-bonds'].dispose();
  const chart = echarts.init(el);
  charts['monthly-bonds'] = chart;

  const bonds = DASHBOARD_DATA.monthly.bondsCommodities;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 100 },
    xAxis: { type: 'category', data: bonds.map(b => b.name), axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 35 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      type: 'bar',
      data: bonds.map(b => ({ value: b.monthChange, itemStyle: { color: b.monthChange > 0 ? '#ef4444' : '#22c55e' } })),
      label: { show: true, position: 'top', color: '#94a3b8', fontSize: 9, formatter: p => p.value + '%' },
      barWidth: '50%',
    }],
  });
}

// ========== 市场基本面页 ==========
function renderFundamentals() {
  renderRadar('fund-radar', DASHBOARD_DATA.fundamentals.radar, '基本面');

  // 评级
  renderRating('fund-rating', DASHBOARD_DATA.fundamentals.rating);

  // 经济增长表
  buildTable('fund-growth-table',
    ['指标', '最新数据', '同比变化', '趋势', '市场含义'],
    DASHBOARD_DATA.fundamentals.economicGrowth,
    g => `<tr>
      <td style="font-weight:600">${g.metric}</td>
      <td style="font-family:monospace">${g.latest}</td>
      <td style="font-family:monospace;color:var(--text-secondary)">${g.yoy}</td>
      <td><span class="status-badge ${statusClass(g.trend === '改善' || g.trend === '弱改善' ? 'green' : g.trend === '压力' || g.trend === '过剩' ? 'red' : 'yellow')}">${g.trend}</span></td>
      <td style="color:var(--text-secondary)">${g.implication}</td>
    </tr>`);

  // 滚动盈利表：独立数据文件优先，失败时保留原有日终数据
  const rollingEarnings = typeof ROLLING_EARNINGS_DATA === 'object' &&
    ROLLING_EARNINGS_DATA && ROLLING_EARNINGS_DATA.meta &&
    ROLLING_EARNINGS_DATA.meta.status === 'valid' && Array.isArray(ROLLING_EARNINGS_DATA.records)
    ? ROLLING_EARNINGS_DATA.records : null;
  const earningsRows = rollingEarnings || DASHBOARD_DATA.fundamentals.earnings;
  const earningsEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const typeNames = { macro: '总量', industry: '行业', company: '公司' };
  buildTable('fund-earnings-table',
    ['指标', '最新数据', '变化', '判断'],
    earningsRows,
    e => `<tr>
      <td style="font-weight:600">${earningsEscape(e.metric)}${e.entityType ? `<span class="earnings-type">${typeNames[e.entityType] || earningsEscape(e.entityType)}</span>` : ''}
        ${e.sourceUrl ? `<div class="earnings-source">${earningsEscape(e.period)} · <a href="${earningsEscape(e.sourceUrl)}" target="_blank" rel="noopener">${earningsEscape(e.sourceName || '原始来源')}</a> · ${earningsEscape(e.sourceLevel || '')}</div>` : ''}
        ${e.details ? `<details class="earnings-details"><summary>查看明细</summary><div>${Object.entries(e.details).map(([key, value]) => `${earningsEscape(key)}：${earningsEscape(value ?? '暂缺')}`).join('<br>')}</div></details>` : ''}
      </td>
      <td style="font-family:monospace">${earningsEscape(e.latest)}</td>
      <td style="font-family:monospace;color:var(--text-secondary)">${earningsEscape(e.change)}</td>
      <td style="color:var(--text-secondary)">${earningsEscape(e.judgment)}</td>
    </tr>`);

  // 盈利驱动
  const ed = DASHBOARD_DATA.fundamentals.earningsDriver;
  if (rollingEarnings) {
    const counts = rollingEarnings.reduce((result, item) => {
      result[item.entityType] = (result[item.entityType] || 0) + 1;
      return result;
    }, {});
    document.getElementById('fund-earnings-driver').innerHTML = `
      <div class="observation-box"><div class="obs-title">当前覆盖</div><div class="obs-content">固定指标 ${counts.macro || 0} 项 · 动态行业 ${counts.industry || 0} 项 · 动态公司 ${counts.company || 0} 家</div></div>
      <div class="observation-box"><div class="obs-title">数据期间</div><div class="obs-content">工业数据 ${earningsEscape(ROLLING_EARNINGS_DATA.meta.macroPeriod)} · 公司财报 ${earningsEscape(ROLLING_EARNINGS_DATA.meta.companyPeriod)}</div></div>
      <div class="observation-box"><div class="obs-title">筛选口径</div><div class="obs-content">全A股动态筛选；同一行业最多2家公司。判断由收入、利润、扣非每股收益、现金流及低基数规则生成。</div></div>`;
  } else {
    document.getElementById('fund-earnings-driver').innerHTML = `
      <div class="observation-box"><div class="obs-title">上涨来源</div><div class="obs-content">${ed.source}</div></div>
      <div class="observation-box"><div class="obs-title">重点关注</div><div class="obs-content">${ed.focus}</div></div>`;
  }

  // 流动性表
  buildTable('fund-liquidity-table',
    ['指标', '最新数据', '变化', '市场影响'],
    DASHBOARD_DATA.fundamentals.liquidity,
    l => `<tr>
      <td style="font-weight:600">${l.metric}</td>
      <td style="font-family:monospace">${l.latest}</td>
      <td style="font-family:monospace;color:var(--text-secondary)">${l.change}</td>
      <td style="color:var(--text-secondary)">${l.impact}</td>
    </tr>`);

  // 流动性判断
  const lj = DASHBOARD_DATA.fundamentals.liquidityJudgment;
  document.getElementById('fund-liquidity-judgment').innerHTML = [
    ['流动性是否宽松', lj.isLoose],
    ['资金是否进入权益', lj.enterEquity],
    ['流动性收紧风险', lj.tighteningRisk],
  ].map(([title, content]) => `
    <div class="observation-box">
      <div class="obs-title">${title}</div>
      <div class="obs-content">${content}</div>
    </div>`).join('');

  // 利率与债券表
  buildTable('fund-rates-table',
    ['品种', '收益率/PE', '本周变化', '较上周变化', '市场含义'],
    DASHBOARD_DATA.fundamentals.ratesBonds,
    r => `<tr>
      <td style="font-weight:600">${r.name}</td>
      <td style="font-family:monospace">${r.yield.toFixed(2)}</td>
      <td class="${priceColor(r.change)}" style="font-family:monospace">${r.change > 0 ? '+' : ''}${r.change.toFixed(2)}</td>
      <td class="${priceColor(r.prevChange)}" style="font-family:monospace">${r.prevChange > 0 ? '+' : ''}${r.prevChange.toFixed(2)}</td>
      <td style="color:var(--text-secondary)">${r.implication}</td>
    </tr>`);

  // 商品表
  buildTable('fund-commodities-table',
    ['商品', '本周变化', '较上周变化', '市场含义'],
    DASHBOARD_DATA.fundamentals.commodities,
    c => `<tr>
      <td style="font-weight:600">${c.name}</td>
      <td class="${priceColor(c.changePct)}" style="font-family:monospace;font-weight:600">${fmtPct(c.changePct)}</td>
      <td class="${priceColor(c.prevChange)}" style="font-family:monospace">${fmtPct(c.prevChange)}</td>
      <td style="color:var(--text-secondary)">${c.implication}</td>
    </tr>`);

  // 观察重点
  const obs = DASHBOARD_DATA.fundamentals.observation;
  const items = [
    ['确认信号', obs.confirmSignals], ['推翻信号', obs.overturnSignals],
    ['估值验证压力', obs.valuationRisk], ['核心跟踪指标', obs.keyMetric],
    ['当前机会', obs.opportunity], ['当前风险', obs.risk], ['下一阶段验证', obs.nextStage],
  ];
  document.getElementById('fund-observation').innerHTML = items
    .filter(([, v]) => v)
    .map(([title, content]) => `
      <div class="observation-box">
        <div class="obs-title">${title}</div>
        <div class="obs-content">${content}</div>
      </div>`).join('');
}

// ========== 中观结构页 ==========
function renderMeso() {
  if (!hasVerifiedDataset() || !DASHBOARD_DATA.meso.radar.length) {
    showUnavailable(document.getElementById('meso-radar'), '中观数据尚未接入可验证来源');
    showUnavailable(document.getElementById('meso-rating'));
    return;
  }
  // 行业雷达 - 多维度
  renderMesoRadar();

  // 行业评级
  renderMesoRating();

  // 景气度表
  buildTable('meso-prosperity-table',
    ['行业', '核心景气指标', '最新数据', '变化趋势', '判断'],
    DASHBOARD_DATA.meso.prosperity,
    p => `<tr>
      <td style="font-weight:600">${p.industry}</td>
      <td style="color:var(--text-secondary)">${p.indicator}</td>
      <td style="font-family:monospace">${p.latest}</td>
      <td style="color:var(--text-secondary)">${p.trend}</td>
      <td><span class="status-badge ${statusClass(p.judgment === '高景气' || p.judgment === '改善' ? 'green' : p.judgment === '过剩' ? 'red' : 'yellow')}">${p.judgment}</span></td>
    </tr>`);

  // 估值图
  renderMesoValuation();
  renderMesoPercentile();

  // 资金拥挤度
  renderMesoCrowding();

  // 资金切换
  renderMesoSwitching();

  // 观察重点
  const obs = DASHBOARD_DATA.meso.observation;
  const items = [
    ['真实景气行业', obs.realProsperity], ['资金推动行业', obs.fundDriven],
    ['估值透支行业', obs.overvalued], ['避险方向', obs.safeHaven],
    ['数据变化', obs.dataChange], ['当前机会', obs.opportunity],
    ['当前风险', obs.risk], ['下一阶段验证', obs.nextStage],
  ];
  document.getElementById('meso-observation').innerHTML = items
    .filter(([, v]) => v)
    .map(([title, content]) => `
      <div class="observation-box">
        <div class="obs-title">${title}</div>
        <div class="obs-content">${content}</div>
      </div>`).join('');
}

function renderMesoRadar() {
  const el = document.getElementById('meso-radar');
  if (!el) return;
  if (charts['meso-radar']) charts['meso-radar'].dispose();
  const chart = echarts.init(el);
  charts['meso-radar'] = chart;

  const indicators = [
    { name: '景气度', max: 100 },
    { name: '估值', max: 100 },
    { name: '资金拥挤度', max: 100 },
    { name: '资金方向', max: 100 },
  ];

  const statusToValue = { green: 80, yellow: 50, red: 20 };
  const radarData = DASHBOARD_DATA.meso.radar.map(r => ({
    name: r.name,
    value: [statusToValue[r.prosperity], statusToValue[r.valuation], statusToValue[r.crowding], statusToValue[r.fundDirection]],
  }));

  const colors = ['#06b6d4', '#8b5cf6', '#ef4444', '#22c55e', '#eab308', '#3b82f6', '#f97316', '#ec4899', '#14b8a6', '#f59e0b'];

  chart.setOption({
    ...CHART_THEME,
    legend: { data: radarData.map(d => d.name), bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, type: 'scroll' },
    radar: {
      indicator: indicators, shape: 'polygon', radius: '60%', splitNumber: 4,
      axisName: { color: '#94a3b8', fontSize: 12 },
      splitLine: { lineStyle: { color: '#1e293b' } },
      splitArea: { areaStyle: { color: ['rgba(6,182,212,0.02)', 'rgba(6,182,212,0.05)'] } },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      type: 'radar',
      data: radarData.map((d, i) => ({
        name: d.name, value: d.value,
        lineStyle: { color: colors[i], width: 1.5 },
        itemStyle: { color: colors[i] },
        areaStyle: { color: colors[i] + '15' },
        symbolSize: 4,
      })),
    }],
  });
}

function renderMesoRating() {
  const el = document.getElementById('meso-rating');
  if (!el) return;
  if (charts['meso-rating']) charts['meso-rating'].dispose();
  const chart = echarts.init(el);
  charts['meso-rating'] = chart;

  const ratings = DASHBOARD_DATA.meso.rating;
  const statusToValue = { green: 3, yellow: 2, red: 1 };
  const dims = ['景气', '盈利', '估值', '资金'];

  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 80 },
    xAxis: { type: 'category', data: ratings.map(r => r.industry), axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 35 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', max: 3, axisLabel: { color: '#64748b', formatter: v => ({ 3: '强', 2: '中', 1: '弱' })[v] || '' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    legend: { data: dims, bottom: 0, textStyle: { color: '#94a3b8' } },
    series: dims.map((dim, i) => {
      const keys = ['prosperity', 'earnings', 'valuation', 'fund'];
      return {
        name: dim, type: 'bar',
        data: ratings.map(r => statusToValue[r[keys[i]]]),
        itemStyle: { color: CHART_THEME.color[i] },
        barWidth: '15%',
      };
    }),
  });
}

function renderMesoValuation() {
  const el = document.getElementById('meso-valuation');
  if (!el) return;
  if (charts['meso-valuation']) charts['meso-valuation'].dispose();
  const chart = echarts.init(el);
  charts['meso-valuation'] = chart;

  const vals = DASHBOARD_DATA.meso.valuation;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 50 },
    xAxis: { type: 'category', data: vals.map(v => v.industry), axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 35 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    legend: { data: ['PE', 'PB'], bottom: 0, textStyle: { color: '#94a3b8' } },
    series: [
      { name: 'PE', type: 'bar', data: vals.map(v => v.pe), itemStyle: { color: '#06b6d4' }, barWidth: '30%' },
      { name: 'PB', type: 'bar', data: vals.map(v => v.pb), itemStyle: { color: '#8b5cf6' }, barWidth: '30%' },
    ],
  });
}

function renderMesoPercentile() {
  const el = document.getElementById('meso-percentile');
  if (!el) return;
  if (charts['meso-percentile']) charts['meso-percentile'].dispose();
  const chart = echarts.init(el);
  charts['meso-percentile'] = chart;

  const vals = DASHBOARD_DATA.meso.valuation;
  chart.setOption({
    ...CHART_THEME,
    grid: { top: 20, right: 20, bottom: 60, left: 80 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: vals.map(v => v.industry), axisLabel: { color: '#94a3b8', fontSize: 10 } },
    series: [{
      type: 'bar',
      data: vals.map(v => ({
        value: v.percentile,
        itemStyle: { color: v.percentile > 70 ? '#ef4444' : v.percentile > 50 ? '#eab308' : v.percentile > 30 ? '#06b6d4' : '#22c55e' }
      })),
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 10, formatter: '{c}%' },
      barWidth: '55%',
    }],
  });
}

function renderMesoCrowding() {
  const el = document.getElementById('meso-crowding');
  if (!el) return;
  if (charts['meso-crowding']) charts['meso-crowding'].dispose();
  const chart = echarts.init(el);
  charts['meso-crowding'] = chart;

  const data = DASHBOARD_DATA.meso.crowding;
  const metrics = ['change5d', 'change20d', 'turnoverChange', 'etfChange', 'marginChange'];
  const labels = ['5日涨幅%', '20日涨幅%', '成交变化%', 'ETF变化%', '融资变化%'];
  const heatmapData = [];

  data.forEach((ind, i) => {
    metrics.forEach((m, j) => {
      heatmapData.push([j, i, ind[m]]);
    });
  });

  chart.setOption({
    ...CHART_THEME,
    tooltip: { ...CHART_THEME.tooltip, formatter: p => {
      const ind = data[p.data[1]];
      return `${ind.industry}<br/>${labels[p.data[0]]}: <b>${p.data[2]}%</b><br/>判断: ${ind.judgment}`;
    }},
    grid: { top: 20, right: 20, bottom: 20, left: 100 },
    xAxis: { type: 'category', data: labels, splitArea: { show: true }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    yAxis: { type: 'category', data: data.map(d => d.industry), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    visualMap: {
      min: -10, max: 10, calculable: true, orient: 'horizontal',
      left: 'center', bottom: 0,
      inRange: { color: ['#22c55e', '#1a3a2a', '#0f1525', '#3a1a1a', '#ef4444'] },
      textStyle: { color: '#94a3b8' },
    },
    series: [{
      type: 'heatmap', data: heatmapData,
      label: { show: true, fontSize: 10, formatter: p => p.data[2] + '%', color: '#e2e8f0' },
      emphasis: { itemStyle: { shadowBlur: 10 } },
    }],
  });
}

function renderMesoSwitching() {
  const el = document.getElementById('meso-switching');
  if (!el) return;
  if (charts['meso-switching']) charts['meso-switching'].dispose();
  const chart = echarts.init(el);
  charts['meso-switching'] = chart;

  const sw = DASHBOARD_DATA.meso.fundSwitching;
  const categories = ['科技→价值', '成长→红利', '高位→低位', '小盘→大盘'];
  const fromData = [
    sw.techToValue.tech, sw.growthToDividend.growth, sw.highToLow.high, sw.smallToLarge.csi1000
  ].map(v => -Math.abs(v));
  const toData = [
    sw.techToValue.bank, sw.growthToDividend.dividend, sw.highToLow.low, sw.smallToLarge.csi300
  ];

  chart.setOption({
    ...CHART_THEME,
    grid: { top: 30, right: 20, bottom: 40, left: 100 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: categories, axisLabel: { color: '#94a3b8', fontSize: 12 } },
    series: [
      { name: '流出方', type: 'bar', data: fromData.map(v => ({ value: v, itemStyle: { color: '#22c55e' } })), barWidth: '30%',
        label: { show: true, position: 'left', color: '#22c55e', fontSize: 10, formatter: p => Math.abs(p.value) + '%' } },
      { name: '流入方', type: 'bar', data: toData.map(v => ({ value: v, itemStyle: { color: '#ef4444' } })), barWidth: '30%',
        label: { show: true, position: 'right', color: '#ef4444', fontSize: 10, formatter: p => p.value + '%' } },
    ],
    legend: { data: ['流出方', '流入方'], bottom: 0, textStyle: { color: '#94a3b8' } },
  });
}

// ========== 窗口resize ==========
window.addEventListener('resize', () => {
  Object.values(charts).forEach(c => c && c.resize());
});

// ========== 初始化 ==========
initDateSelector();
if (!hasVerifiedDataset()) {
  const status = document.getElementById('updateStatus');
  if (status) status.textContent = '历史数据 · 尚未通过严格校验';
}
renderPage('overview');
