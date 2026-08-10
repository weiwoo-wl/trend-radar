/**
 * 趋势雷达盘中数据模块
 * 每两分钟整批刷新指数与31个申万一级行业；任何一部分校验失败都保留上一笔有效快照。
 */
(function () {
  'use strict';

  var RT_REFRESH_MS = 120000;
  var RT_CLOCK_MS = 30000;
  var RT_MIN_INDUSTRIES = 31;
  var RT_SECIDS = [
    '1.000001', '0.399001', '0.399006', '1.000680',
    '1.000300', '1.000905', '1.000852', '1.000688', '0.899050'
  ];
  var RT_SECID_MAP = {
    '1.000001': '上证指数', '0.399001': '深证成指', '0.399006': '创业板指',
    '1.000680': '科创综指', '1.000300': '沪深300', '1.000905': '中证500',
    '1.000852': '中证1000', '1.000688': '科创50', '0.899050': '北证50'
  };
  var RT_SW_LEVEL1 = [
    '农林牧渔', '基础化工', '钢铁', '有色金属', '电子', '家用电器', '食品饮料', '纺织服饰',
    '轻工制造', '医药生物', '公用事业', '交通运输', '房地产', '商贸零售', '社会服务', '综合',
    '建筑材料', '建筑装饰', '电力设备', '国防军工', '计算机', '传媒', '通信', '银行',
    '非银金融', '汽车', '机械设备', '煤炭', '石油石化', '环保', '美容护理'
  ];
  var RT_SW_SET = RT_SW_LEVEL1.reduce(function (set, name) { set[name] = true; return set; }, {});

  var _rtTimer = null;
  var _rtClockTimer = null;
  var _rtWanted = true;
  var _rtInFlight = false;
  var _rtLastUpdate = null;
  var _rtLastDataTimestamp = 0;
  var _rtLastError = '';
  var _rtIndustrySnapshot = null;

  function finite(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function sessionState(now) {
    now = now || new Date();
    var day = now.getDay();
    if (day === 0 || day === 6) return 'weekend';
    var minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes >= 9 * 60 + 25 && minutes <= 11 * 60 + 30) return 'trading';
    if (minutes > 11 * 60 + 30 && minutes < 13 * 60) return 'lunch';
    if (minutes >= 13 * 60 && minutes <= 15 * 60 + 5) return 'trading';
    return minutes < 9 * 60 + 25 ? 'preopen' : 'closed';
  }

  function isLatestDate() {
    var selector = document.getElementById('dateSelector');
    return !selector || !selector.value;
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callbackName = '_rt_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      var script = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () { finish(new Error('请求超时')); }, 10000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      function finish(error, data) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error); else resolve(data);
      }
      window[callbackName] = function (data) { finish(null, data); };
      script.onerror = function () { finish(new Error('网络请求失败')); };
      script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'cb=' + callbackName;
      document.head.appendChild(script);
    });
  }

  function quoteRequest() {
    var fields = 'f2,f3,f4,f6,f12,f13,f14,f104,f105,f106,f124';
    var url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=' + fields + '&secids=' + RT_SECIDS.join(',');
    return jsonp(url).then(normalizeQuotes);
  }

  function industryRequest() {
    var fields = 'f2,f3,f6,f12,f14,f62,f124,f184';
    function pageUrl(page) {
      return 'https://push2.eastmoney.com/api/qt/clist/get?pn=' + page + '&pz=100&po=1&np=1&fltt=2&invt=2&fid=f62' +
        '&fs=m%3A90%2Bt%3A2&fields=' + fields;
    }
    return jsonp(pageUrl(1)).then(function (first) {
      var total = finite(first && first.data && first.data.total);
      if (total == null || total < RT_MIN_INDUSTRIES) throw new Error('行业总数异常');
      var pageCount = Math.min(10, Math.ceil(total / 100));
      var requests = [Promise.resolve(first)];
      for (var page = 2; page <= pageCount; page++) requests.push(jsonp(pageUrl(page)));
      return Promise.all(requests);
    }).then(normalizeIndustries);
  }

  function normalizeQuotes(response) {
    var rows = response && response.data && response.data.diff;
    if (!Array.isArray(rows)) throw new Error('指数响应为空');
    var found = {};
    var timestamp = 0;
    rows.forEach(function (row) {
      var secid = row.f13 + '.' + row.f12;
      var name = RT_SECID_MAP[secid];
      if (!name || found[secid]) return;
      var close = finite(row.f2), changePct = finite(row.f3), change = finite(row.f4), turnover = finite(row.f6);
      if (close == null || close <= 0 || changePct == null || Math.abs(changePct) > 20 || change == null || turnover == null || turnover < 0) return;
      found[secid] = {
        secid: secid, name: name, close: close, changePct: changePct, change: change,
        turnover: turnover / 1e8, upCount: finite(row.f104), downCount: finite(row.f105), flatCount: finite(row.f106)
      };
      timestamp = Math.max(timestamp, finite(row.f124) || 0);
    });
    var quotes = RT_SECIDS.map(function (secid) { return found[secid]; }).filter(Boolean);
    if (quotes.length !== RT_SECIDS.length) throw new Error('指数数量不完整');
    return { quotes: quotes, timestamp: timestamp };
  }

  function normalizeIndustries(responses) {
    var allRows = [];
    responses.forEach(function (response) {
      var rows = response && response.data && response.data.diff;
      if (!Array.isArray(rows)) throw new Error('行业分页响应为空');
      allRows = allRows.concat(rows);
    });
    var byName = {};
    var timestamp = 0;
    allRows.forEach(function (row) {
      var name = String(row.f14 || '').trim();
      if (!RT_SW_SET[name] || byName[name]) return;
      var changePct = finite(row.f3), turnover = finite(row.f6), netInflow = finite(row.f62), netRatio = finite(row.f184);
      if (!/^BK\d{4}$/.test(String(row.f12 || '')) || changePct == null || Math.abs(changePct) > 20 ||
          turnover == null || turnover < 0 || netInflow == null || netRatio == null || Math.abs(netRatio) > 100) return;
      byName[name] = {
        code: row.f12, name: name, changePct: changePct,
        turnover: turnover / 1e8, netInflow: netInflow / 1e8, netRatio: netRatio
      };
      timestamp = Math.max(timestamp, finite(row.f124) || 0);
    });
    var sectors = RT_SW_LEVEL1.map(function (name) { return byName[name]; }).filter(Boolean);
    if (sectors.length !== RT_MIN_INDUSTRIES) throw new Error('一级行业数量不足（' + sectors.length + '/31）');
    return { sectors: sectors, timestamp: timestamp };
  }

  function commitSnapshot(quoteBatch, industryBatch) {
    var timestamp = Math.max(quoteBatch.timestamp || 0, industryBatch.timestamp || 0);
    if (_rtLastDataTimestamp && timestamp && timestamp < _rtLastDataTimestamp) throw new Error('接口返回了过期快照');

    var indices = DASHBOARD_DATA.daily.indices;
    quoteBatch.quotes.forEach(function (quote) {
      var target = indices.find(function (item) { return item.name === quote.name; });
      if (!target) return;
      target.close = quote.close;
      target.changePct = quote.changePct;
      target.change = quote.change;
      target.volume = Math.round(quote.turnover);
    });

    var sh = quoteBatch.quotes.find(function (item) { return item.secid === '1.000001'; });
    var sz = quoteBatch.quotes.find(function (item) { return item.secid === '0.399001'; });
    var bj = quoteBatch.quotes.find(function (item) { return item.secid === '0.899050'; });
    var turnover = DASHBOARD_DATA.daily.turnover;
    turnover.sh = Math.round(sh.turnover); turnover.sz = Math.round(sz.turnover); turnover.bj = Math.round(bj.turnover);
    turnover.total = turnover.sh + turnover.sz + turnover.bj;
    turnover.vs5d = Number.isFinite(turnover.avg5) ? Math.round(turnover.total - turnover.avg5) : null;
    turnover.vs10d = Number.isFinite(turnover.avg10) ? Math.round(turnover.total - turnover.avg10) : null;

    var breadth = DASHBOARD_DATA.daily.breadth;
    breadth.upCount = (sh.upCount || 0) + (sz.upCount || 0);
    breadth.downCount = (sh.downCount || 0) + (sz.downCount || 0);
    breadth.flatCount = (sh.flatCount || 0) + (sz.flatCount || 0);
    var breadthTotal = breadth.upCount + breadth.downCount + breadth.flatCount;
    if (breadthTotal > 0) {
      breadth.upPct = Math.round(breadth.upCount / breadthTotal * 1000) / 10;
      breadth.downPct = Math.round(breadth.downCount / breadthTotal * 1000) / 10;
      breadth.moneyEffect = breadth.upCount > breadth.downCount ? '偏强' : breadth.upCount < breadth.downCount ? '偏弱' : '均衡';
    }

    var sectors = industryBatch.sectors.slice().sort(function (a, b) { return b.netInflow - a.netInflow; });
    var totalNet = sectors.reduce(function (sum, item) { return sum + item.netInflow; }, 0);
    _rtIndustrySnapshot = {
      sectors: sectors,
      netInflow: Math.round(totalNet * 100) / 100,
      inflowCount: sectors.filter(function (item) { return item.netInflow > 0; }).length,
      outflowCount: sectors.filter(function (item) { return item.netInflow < 0; }).length,
      upCount: sectors.filter(function (item) { return item.changePct > 0; }).length,
      downCount: sectors.filter(function (item) { return item.changePct < 0; }).length,
      timestamp: timestamp,
      updateTime: timestamp ? new Date(timestamp * 1000) : new Date(),
      source: '东方财富行情平台'
    };
    DASHBOARD_DATA.daily.fundFlow = _rtIndustrySnapshot;
    if (typeof _originalDaily !== 'undefined' && _originalDaily) _originalDaily = JSON.parse(JSON.stringify(DASHBOARD_DATA.daily));

    _rtLastDataTimestamp = timestamp || _rtLastDataTimestamp;
    _rtLastUpdate = new Date();
    _rtLastError = '';
    updateVisiblePage();
    updateStatus();
  }

  function fetchRealtime() {
    if (_rtInFlight || !isLatestDate()) return Promise.resolve(false);
    _rtInFlight = true;
    setStatusText('正在更新实时数据…', 'var(--accent-cyan)');
    return Promise.all([quoteRequest(), industryRequest()])
      .then(function (batches) { commitSnapshot(batches[0], batches[1]); return true; })
      .catch(function (error) {
        _rtLastError = error && error.message ? error.message : '数据请求失败';
        updateStatus();
        renderRealtimeIndustryFlow();
        console.warn('实时数据未覆盖：' + _rtLastError);
        return false;
      })
      .finally(function () { _rtInFlight = false; });
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '数据暂缺';
    return (value > 0 ? '+' : '') + value.toFixed(2) + '亿';
  }

  function formatTime(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '时间暂缺';
    return value.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function summaryCard(label, value, note, positive) {
    var color = positive == null ? 'var(--text-primary)' : positive ? 'var(--color-up)' : 'var(--color-down)';
    return '<div class="metric-card"><div class="metric-label">' + escapeHtml(label) + '</div>' +
      '<div class="metric-value" style="color:' + color + '">' + escapeHtml(value) + '</div>' +
      '<div class="metric-change">' + escapeHtml(note) + '</div></div>';
  }

  function renderRank(targetId, sectors) {
    var target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = sectors.map(function (item, index) {
      return '<div class="industry-flow-row"><span class="industry-flow-rank">' + (index + 1) + '</span>' +
        '<b>' + escapeHtml(item.name) + '</b><span class="industry-flow-money" style="color:var(--' + (item.netInflow >= 0 ? 'color-up' : 'color-down') + ')">' +
        escapeHtml(formatMoney(item.netInflow)) + '</span><span class="industry-flow-change" style="color:var(--' + (item.changePct >= 0 ? 'color-up' : 'color-down') + ')">' +
        escapeHtml((item.changePct > 0 ? '+' : '') + item.changePct.toFixed(2) + '%') + '</span></div>';
    }).join('');
  }

  function fallbackSnapshot() {
    var flow = DASHBOARD_DATA && DASHBOARD_DATA.daily && DASHBOARD_DATA.daily.fundFlow;
    if (!flow || !Array.isArray(flow.sectors) || !flow.sectors.length) return null;
    var sectors = flow.sectors.filter(function (item) { return item && item.name && Number.isFinite(item.netInflow) && Number.isFinite(item.changePct); });
    if (!sectors.length) return null;
    return {
      sectors: sectors.slice().sort(function (a, b) { return b.netInflow - a.netInflow; }),
      netInflow: Number.isFinite(flow.netInflow) ? flow.netInflow : sectors.reduce(function (sum, item) { return sum + item.netInflow; }, 0),
      inflowCount: Number.isFinite(flow.inflowCount) ? flow.inflowCount : sectors.filter(function (item) { return item.netInflow > 0; }).length,
      outflowCount: Number.isFinite(flow.outflowCount) ? flow.outflowCount : sectors.filter(function (item) { return item.netInflow < 0; }).length,
      upCount: sectors.filter(function (item) { return item.changePct > 0; }).length,
      downCount: sectors.filter(function (item) { return item.changePct < 0; }).length,
      updateTime: flow.updateTime || DASHBOARD_DATA.meta.reportDate,
      source: '日终已核验数据'
    };
  }

  function renderRealtimeIndustryFlow() {
    var snapshot = _rtIndustrySnapshot || fallbackSnapshot();
    var summary = document.getElementById('daily-fundflow-summary');
    var status = document.getElementById('daily-fundflow-status');
    var table = document.getElementById('daily-fundflow-table');
    var chartEl = document.getElementById('daily-fundflow-rank');
    if (!summary || !table || !chartEl) return;
    if (!snapshot) {
      summary.innerHTML = summaryCard('当前状态', '数据暂缺', '未取得通过校验的行业数据', null);
      table.innerHTML = '<tbody><tr><td style="text-align:center;color:var(--text-muted)">暂未取得有效行业数据</td></tr></tbody>';
      if (status) status.textContent = '等待有效数据';
      return;
    }

    if (status) status.textContent = snapshot.source + ' · ' + (snapshot.updateTime instanceof Date ? formatTime(snapshot.updateTime) : snapshot.updateTime);
    summary.innerHTML = [
      summaryCard('31行业净额合计', formatMoney(snapshot.netInflow), '一级行业统计合计', snapshot.netInflow >= 0),
      summaryCard('净流入 / 净流出', snapshot.inflowCount + ' / ' + snapshot.outflowCount, '按主力净流入金额', snapshot.inflowCount >= snapshot.outflowCount),
      summaryCard('上涨 / 下跌行业', snapshot.upCount + ' / ' + snapshot.downCount, '按行业指数涨跌幅', snapshot.upCount >= snapshot.downCount),
      summaryCard('数据状态', _rtLastError ? '已延迟' : (_rtIndustrySnapshot ? '盘中有效' : '日终数据'), _rtLastError || '已通过整批校验', _rtLastError ? false : true)
    ].join('');

    var sectors = snapshot.sectors.slice().sort(function (a, b) { return b.netInflow - a.netInflow; });
    renderRank('daily-fundflow-inflow', sectors.slice(0, 5));
    renderRank('daily-fundflow-outflow', sectors.slice(-5).reverse());
    table.innerHTML = '<thead><tr><th>排名</th><th>行业</th><th>涨跌幅</th><th>成交额</th><th>主力净流入</th><th>净流入占比</th></tr></thead><tbody>' +
      sectors.map(function (item, index) {
        return '<tr><td>' + (index + 1) + '</td><td><b>' + escapeHtml(item.name) + '</b></td>' +
          '<td class="' + (item.changePct > 0 ? 'num-up' : item.changePct < 0 ? 'num-down' : 'num-flat') + '">' + escapeHtml((item.changePct > 0 ? '+' : '') + item.changePct.toFixed(2) + '%') + '</td>' +
          '<td>' + (Number.isFinite(item.turnover) ? item.turnover.toFixed(2) + '亿' : '日终未提供') + '</td>' +
          '<td class="' + (item.netInflow > 0 ? 'num-up' : item.netInflow < 0 ? 'num-down' : 'num-flat') + '">' + escapeHtml(formatMoney(item.netInflow)) + '</td>' +
          '<td>' + (Number.isFinite(item.netRatio) ? item.netRatio.toFixed(2) + '%' : '日终未提供') + '</td></tr>';
      }).join('') + '</tbody>';

    if (typeof echarts !== 'undefined') {
      if (typeof charts !== 'undefined' && charts['daily-fundflow-rank']) charts['daily-fundflow-rank'].dispose();
      var chart = echarts.init(chartEl);
      if (typeof charts !== 'undefined') charts['daily-fundflow-rank'] = chart;
      var ascending = sectors.slice().reverse();
      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (params) {
          var item = ascending[params[0].dataIndex];
          return '<b>' + escapeHtml(item.name) + '</b><br>主力净流入：' + escapeHtml(formatMoney(item.netInflow)) + '<br>涨跌幅：' + (item.changePct > 0 ? '+' : '') + item.changePct.toFixed(2) + '%';
        } },
        grid: { top: 12, right: 90, bottom: 25, left: 90 },
        xAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}亿' }, splitLine: { lineStyle: { color: '#1e293b' } } },
        yAxis: { type: 'category', data: ascending.map(function (item) { return item.name; }), axisLabel: { color: '#94a3b8', fontSize: 11 } },
        series: [{ type: 'bar', barWidth: '58%', data: ascending.map(function (item) { return { value: item.netInflow, itemStyle: { color: item.netInflow >= 0 ? '#ef4444' : '#22c55e' } }; }),
          label: { show: true, position: 'right', color: '#cbd5e1', fontSize: 10, formatter: function (params) { return (params.value > 0 ? '+' : '') + Number(params.value).toFixed(1); } },
          markLine: { symbol: 'none', data: [{ xAxis: 0 }], lineStyle: { color: '#475569' }, label: { show: false } }
        }]
      });
    }
  }

  function updateVisiblePage() {
    var active = document.querySelector('.nav-item.active');
    if (!active) return;
    if (active.dataset.page === 'daily') {
      if (typeof _rtRebuildTables === 'function') _rtRebuildTables();
      updateTurnover(); updateBreadth(); renderRealtimeIndustryFlow();
    } else if (active.dataset.page === 'overview') {
      updateOverview();
    }
  }

  function updateTurnover() {
    var target = document.getElementById('daily-turnover');
    if (!target || typeof renderDailyTurnover !== 'function') return;
    renderDailyTurnover();
  }

  function updateBreadth() {
    if (typeof renderDailyBreadth === 'function') renderDailyBreadth();
  }

  function updateOverview() {
    var data = DASHBOARD_DATA.daily;
    var metrics = document.getElementById('overview-metrics');
    if (metrics) metrics.innerHTML = data.indices.slice(0, 4).map(function (index) {
      return '<div class="metric-card"><div class="metric-label">' + escapeHtml(index.name) + '</div><div class="metric-value">' +
        (Number.isFinite(index.close) ? index.close.toFixed(2) : '数据暂缺') + '</div><div class="metric-change" style="color:var(--' +
        (index.changePct >= 0 ? 'color-up' : 'color-down') + ')">' + (index.changePct > 0 ? '+' : '') + (Number.isFinite(index.changePct) ? index.changePct.toFixed(2) + '%' : '数据暂缺') + '</div></div>';
    }).join('');
  }

  function _rtRebuildTables() {
    if (typeof buildTable !== 'function') return;
    var all = DASHBOARD_DATA.daily.indices;
    function row(index, averages) {
      function difference(current, average) {
        if (!Number.isFinite(current) || !Number.isFinite(average) || !average) return '—';
        var value = (current - average) / average * 100;
        return '<span class="' + (value >= 0 ? 'num-up' : 'num-down') + '">' + (value > 0 ? '+' : '') + value.toFixed(1) + '%</span>';
      }
      return '<tr><td><b>' + escapeHtml(index.name) + '</b></td><td>' + index.close.toFixed(2) + '</td><td class="' + (index.change >= 0 ? 'num-up' : 'num-down') + '">' +
        (index.change > 0 ? '+' : '') + index.change.toFixed(2) + '</td><td class="' + (index.changePct >= 0 ? 'num-up' : 'num-down') + '">' +
        (index.changePct > 0 ? '+' : '') + index.changePct.toFixed(2) + '%</td><td>' + index.volume.toLocaleString() + '</td>' +
        (averages ? '<td>' + (Number.isFinite(index.avg5) ? index.avg5.toLocaleString() : '—') + '<br>' + difference(index.volume, index.avg5) + '</td><td>' +
          (Number.isFinite(index.avg10) ? index.avg10.toLocaleString() : '—') + '<br>' + difference(index.volume, index.avg10) + '</td>' : '<td>—</td><td>—</td>') + '</tr>';
    }
    buildTable('daily-indices-core-table', ['指数', '点位', '涨跌', '涨跌幅', '成交额(亿)', '5日均(亿)', '10日均(亿)'], all.slice(0, 4), function (item) { return row(item, true); });
    buildTable('daily-indices-broad-table', ['指数', '点位', '涨跌', '涨跌幅', '成交额(亿)', '5日均(亿)', '10日均(亿)'], all.slice(4), function (item) { return row(item, false); });
  }

  function setStatusText(text, color) {
    var status = document.getElementById('updateStatus');
    if (!status || !isLatestDate()) return;
    status.textContent = text;
    status.style.color = color || '';
  }

  function updateStatus() {
    var state = sessionState();
    var market = document.getElementById('marketStatus');
    if (market) {
      var labels = { trading: '交易中', lunch: '午间休市', preopen: '未开盘', closed: '已收盘', weekend: '休市' };
      market.innerHTML = '<span style="color:var(--' + (state === 'trading' ? 'color-up' : 'color-yellow') + ')">' + labels[state] + '</span>';
    }
    if (!isLatestDate()) return;
    if (_rtLastError) setStatusText('实时数据延迟 · ' + _rtLastError, 'var(--color-yellow)');
    else if (_rtLastUpdate) setStatusText('<span class="rt-pulse"></span> 实时 ' + formatTime(_rtLastUpdate), 'var(--color-up)');
    else setStatusText(state === 'trading' ? '等待实时数据' : '日终数据 · ' + (state === 'lunch' ? '午休' : '非交易时段'), '');
    var status = document.getElementById('updateStatus');
    if (status && _rtLastUpdate && !_rtLastError) status.innerHTML = '<span class="rt-pulse"></span> 实时 ' + formatTime(_rtLastUpdate);
  }

  function startTimer() {
    if (_rtTimer) return;
    fetchRealtime();
    _rtTimer = setInterval(fetchRealtime, RT_REFRESH_MS);
  }

  function stopTimer() {
    if (_rtTimer) clearInterval(_rtTimer);
    _rtTimer = null;
  }

  function updateButton() {
    var button = document.getElementById('realtimeToggle');
    if (!button) return;
    var active = _rtTimer !== null && isLatestDate();
    button.innerHTML = active ? '<span class="rt-pulse"></span> 实时' : '▶ 实时';
    button.classList.toggle('rt-on', active);
  }

  function syncRealtimeState() {
    var shouldRun = _rtWanted && isLatestDate() && sessionState() === 'trading';
    if (shouldRun) startTimer(); else stopTimer();
    updateButton(); updateStatus();
  }

  function toggleRealtime() {
    if (_rtWanted && _rtTimer) {
      _rtWanted = false;
      stopTimer();
    } else {
      _rtWanted = true;
      if (isLatestDate()) fetchRealtime();
    }
    syncRealtimeState();
  }

  function init() {
    var button = document.getElementById('realtimeToggle');
    if (button) button.addEventListener('click', toggleRealtime);
    syncRealtimeState();
    _rtClockTimer = setInterval(syncRealtimeState, RT_CLOCK_MS);
  }

  window.renderRealtimeIndustryFlow = renderRealtimeIndustryFlow;
  window.syncRealtimeState = syncRealtimeState;
  window.__realtimeTest = { sessionState: sessionState, normalizeQuotes: normalizeQuotes, normalizeIndustries: normalizeIndustries };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
