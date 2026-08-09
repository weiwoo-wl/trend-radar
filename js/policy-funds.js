/** 政策性资金观察页：只消费独立、已核验的数据文件。 */
(function () {
  const money = value => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(1)} 亿` : '数据不足';
  const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : '数据不足';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const empty = text => `<div class="policy-empty">${safe(text)}</div>`;

  function metric(title, value, note) {
    return `<div class="metric-card"><div class="metric-label">${safe(title)}</div><div class="metric-value">${safe(value)}</div><div class="metric-change">${safe(note)}</div></div>`;
  }

  function dispose(id) {
    const element = document.getElementById(id);
    if (!element || typeof echarts === 'undefined') return null;
    const old = echarts.getInstanceByDom(element);
    if (old) old.dispose();
    return echarts.init(element);
  }

  function renderSummary(data, latest) {
    const target = document.getElementById('policy-summary');
    if (!target) return;
    if (!latest) {
      target.innerHTML = metric('当前状态', '等待有效数据', data.meta?.message || '首次更新后开始积累基线');
      return;
    }
    target.innerHTML = [
      metric('当日宽基 ETF 净流量', money(latest.totalFlow), '客观份额变化 × 当日净值'),
      metric('当日异常流量', money(latest.anomalyFlow), '剔除 60 日正常波动后的部分'),
      metric('累计异常流量', money(latest.cumulativeAnomalyFlow), '观察值，不等于国家队资金余额'),
      metric('证据等级', `L${latest.evidenceLevel || 0}`, latest.reasons?.join('；') || '未出现显著同步异动'),
      metric('数据覆盖率', pct(latest.coverage), `数据日 ${latest.date}`)
    ].join('');
  }

  function renderFlow(history) {
    const chart = dispose('policy-flow-chart');
    if (!chart) return;
    if (!history.length) { chart.getDom().innerHTML = empty('尚无历史记录。每日更新会自动积累；基线不足时不计算异常金额。'); return; }
    chart.setOption({
      tooltip: { trigger: 'axis' }, legend: { data: ['全部净流量', '异常流量', '累计异常流量'], textStyle: { color: '#94a3b8' } },
      grid: { left: 60, right: 60, top: 45, bottom: 45 },
      xAxis: { type: 'category', data: history.map(x => x.date), axisLabel: { color: '#64748b' } },
      yAxis: [{ type: 'value', name: '亿元', axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#1e293b' } } }, { type: 'value', name: '累计亿元', axisLabel: { color: '#64748b' } }],
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18 }],
      series: [
        { name: '全部净流量', type: 'bar', data: history.map(x => x.totalFlow), itemStyle: { color: '#475569' } },
        { name: '异常流量', type: 'bar', data: history.map(x => x.anomalyFlow), itemStyle: { color: p => p.value >= 0 ? '#ef4444' : '#22c55e' } },
        { name: '累计异常流量', type: 'line', yAxisIndex: 1, showSymbol: false, data: history.map(x => x.cumulativeAnomalyFlow), lineStyle: { color: '#06b6d4', width: 2 } }
      ]
    });
  }

  function renderCategories(latest) {
    const rows = latest?.categories || [];
    const table = document.getElementById('policy-category-table');
    if (table) table.innerHTML = rows.length ? `<thead><tr><th>宽基类别</th><th>总流量</th><th>异常流量</th><th>覆盖率</th></tr></thead><tbody>${rows.map(x => `<tr><td>${safe(x.name)}</td><td>${money(x.totalFlow)}</td><td>${money(x.anomalyFlow)}</td><td>${pct(x.coverage)}</td></tr>`).join('')}</tbody>` : `<tbody><tr><td>${empty('暂无可核验分类数据')}</td></tr></tbody>`;
    const chart = dispose('policy-category-chart');
    if (!chart || !rows.length) return;
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 75, right: 30, top: 15, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      yAxis: { type: 'category', data: rows.map(x => x.name), axisLabel: { color: '#94a3b8' } },
      series: [{ type: 'bar', data: rows.map(x => ({ value: x.anomalyFlow, itemStyle: { color: (x.anomalyFlow || 0) >= 0 ? '#ef4444' : '#22c55e' } })) }]
    });
  }

  function renderEvidence(data) {
    const events = data.history.filter(x => (x.evidenceLevel || 0) >= 2).slice(-12).reverse();
    const eventTarget = document.getElementById('policy-events');
    if (eventTarget) eventTarget.innerHTML = events.length ? events.map(x => `<div class="policy-event"><span class="policy-level">L${x.evidenceLevel}</span><b>${safe(x.date)}</b>　异常流量 ${money(x.anomalyFlow)}<br><span class="text-muted">${safe(x.reasons?.join('；') || '')}</span></div>`).join('') : empty('尚未观察到至少三类宽基 ETF 同步异动。');
    const anchors = data.quarterlyAnchors || [];
    const anchorTarget = document.getElementById('policy-quarterly');
    if (anchorTarget) anchorTarget.innerHTML = anchors.length ? anchors.slice(-8).reverse().map(x => `<div class="policy-event"><b>${safe(x.date || x.period)}</b><br>${safe(x.description || x.note || '已确认季报锚点')}</div>`).join('') : empty('暂未录入可追溯的季报确认锚点；不会用估算值替代。');
  }

  window.renderPolicyFunds = function renderPolicyFunds() {
    const data = typeof POLICY_FUNDS_DATA === 'object' && POLICY_FUNDS_DATA ? POLICY_FUNDS_DATA : { meta: {}, history: [], quarterlyAnchors: [] };
    const history = Array.isArray(data.history) ? data.history : [];
    const latest = history.length ? history[history.length - 1] : null;
    renderSummary(data, latest); renderFlow(history); renderCategories(latest); renderEvidence(data);
  };
})();
