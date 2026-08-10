/**
 * 趋势雷达 - 天数据实时刷新模块
 * 轻量级实现：每2分钟通过东方财富JSONP API刷新指数行情
 * 仅在交易时段(9:25-15:05)自动运行，手动可随时开关
 * 只刷新表格和卡片，不重建ECharts图表（避免闪烁）
 */

// 9个指数的东方财富 secid（市场.代码）
var RT_SECIDS = [
  '1.000001', '0.399001', '0.399006', '1.000680',
  '1.000300', '1.000905', '1.000852', '1.000688', '0.899050'
];

var RT_SECID_MAP = {
  '1.000001': '上证指数', '0.399001': '深证成指', '0.399006': '创业板指',
  '1.000680': '科创综指', '1.000300': '沪深300', '1.000905': '中证500',
  '1.000852': '中证1000', '1.000688': '科创50', '0.899050': '北证50'
};

var _rtTimer = null;
var _rtActive = false;
var _rtLastUpdate = null;

// 判断是否在交易时段
function _rtIsTradingHours() {
  var now = new Date();
  var day = now.getDay();
  if (day === 0 || day === 6) return false;
  var minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 925 && minutes <= 1505;
}

// JSONP 请求
function _rtJsonp(url, callback) {
  var cbName = '_rt_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  var script = document.createElement('script');
  window[cbName] = function(data) {
    try { callback(data); } catch(e) { console.warn('RT callback error:', e); }
    delete window[cbName];
    if (script.parentNode) script.parentNode.removeChild(script);
  };
  script.onerror = function() {
    delete window[cbName];
    if (script.parentNode) script.parentNode.removeChild(script);
  };
  script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'cb=' + cbName;
  document.head.appendChild(script);
  setTimeout(function() {
    if (window[cbName]) {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
  }, 10000);
}

// 拉取实时行情
function _rtFetchQuotes() {
  var secids = RT_SECIDS.join(',');
  var fields = 'f2,f3,f4,f6,f12,f13,f14,f104,f105,f106';
  var url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=' + fields + '&secids=' + secids;

  _rtJsonp(url, function(data) {
    if (!data || !data.data || !data.data.diff) return;

    var diff = data.data.diff;
    var updated = 0;
    var shUp = 0, shDown = 0, shFlat = 0;
    var szUp = 0, szDown = 0, szFlat = 0;

    diff.forEach(function(item) {
      var secid = item.f13 + '.' + item.f12;
      var name = RT_SECID_MAP[secid];
      if (!name) return;

      var idx = null;
      for (var i = 0; i < DASHBOARD_DATA.daily.indices.length; i++) {
        if (DASHBOARD_DATA.daily.indices[i].name === name) { idx = DASHBOARD_DATA.daily.indices[i]; break; }
      }
      if (!idx) return;

      idx.close = item.f2;
      idx.changePct = item.f3;
      idx.change = item.f4;
      if (item.f6 && item.f6 > 0) {
        idx.volume = Math.round(item.f6 / 1e8);
      }

      // 涨跌家数（仅上证/深证有）
      if (secid === '1.000001') { shUp = item.f104 || 0; shDown = item.f105 || 0; shFlat = item.f106 || 0; }
      if (secid === '0.399001') { szUp = item.f104 || 0; szDown = item.f105 || 0; szFlat = item.f106 || 0; }

      updated++;
    });

    // 同步到 _originalDaily（避免切换历史日期后丢失实时数据）
    if (typeof _originalDaily !== 'undefined' && _originalDaily) {
      _originalDaily.indices.forEach(function(origIdx) {
        for (var i = 0; i < DASHBOARD_DATA.daily.indices.length; i++) {
          if (DASHBOARD_DATA.daily.indices[i].name === origIdx.name) {
            origIdx.close = DASHBOARD_DATA.daily.indices[i].close;
            origIdx.changePct = DASHBOARD_DATA.daily.indices[i].changePct;
            origIdx.change = DASHBOARD_DATA.daily.indices[i].change;
            origIdx.volume = DASHBOARD_DATA.daily.indices[i].volume;
            break;
          }
        }
      });
    }

    // 更新成交额
    var sh = _rtFindIndex('上证指数');
    var sz = _rtFindIndex('深证成指');
    var bj = _rtFindIndex('北证50');
    if (sh && sz) {
      var shVol = sh.volume || 0;
      var szVol = sz.volume || 0;
      var bjVol = bj ? (bj.volume || 0) : 0;
      var total = shVol + szVol + bjVol;
      var t = DASHBOARD_DATA.daily.turnover;
      t.sh = shVol; t.sz = szVol; t.bj = bjVol; t.total = total;
      if (t.avg5) t.vs5d = Math.round(total - t.avg5);
      if (t.avg10) t.vs10d = Math.round(total - t.avg10);
    }

    // 更新市场广度
    var totalUp = shUp + szUp;
    var totalDown = shDown + szDown;
    var totalFlat = shFlat + szFlat;
    if (totalUp + totalDown > 0) {
      var b = DASHBOARD_DATA.daily.breadth;
      b.upCount = totalUp; b.downCount = totalDown; b.flatCount = totalFlat;
      var sum = totalUp + totalDown + totalFlat;
      if (sum > 0) {
        b.upPct = Math.round(totalUp / sum * 1000) / 10;
        b.downPct = Math.round(totalDown / sum * 1000) / 10;
        b.moneyEffect = totalUp > totalDown ? '偏强' : totalUp < totalDown ? '偏弱' : '均衡';
      }
    }

    _rtLastUpdate = new Date();
    if (updated > 0) _rtUpdateUI();
  });
}

function _rtFindIndex(name) {
  for (var i = 0; i < DASHBOARD_DATA.daily.indices.length; i++) {
    if (DASHBOARD_DATA.daily.indices[i].name === name) return DASHBOARD_DATA.daily.indices[i];
  }
  return null;
}

// 更新UI（只刷新表格和卡片，不重建图表）
function _rtUpdateUI() {
  // 更新状态文本
  var status = document.getElementById('updateStatus');
  if (status && _rtLastUpdate) {
    var t = _rtLastUpdate.toTimeString().slice(0, 8);
    status.innerHTML = '<span class="rt-pulse"></span> 实时 ' + t;
    status.style.color = 'var(--color-up)';
  }

  // 更新市场状态
  var ms = document.getElementById('marketStatus');
  if (ms) {
    if (_rtIsTradingHours()) {
      ms.innerHTML = '<span style="color:var(--color-up)">交易中</span>';
    } else {
      ms.innerHTML = '<span style="color:var(--color-yellow)">收盘</span>';
    }
  }

  var activePage = document.querySelector('.nav-item.active');
  if (!activePage) return;
  var page = activePage.dataset.page;

  // 查看历史数据时不刷新
  var selector = document.getElementById('dateSelector');
  if (selector && selector.value) return;

  // 天数据页：刷新指数表 + 成交额 + 广度饼图
  if (page === 'daily') {
    _rtRebuildTables();
    _rtUpdateTurnover();
    _rtUpdateBreadth();
  }

  // 总览页：刷新核心指标卡
  if (page === 'overview') {
    _rtUpdateOverview();
  }
}

function _rtRebuildTables() {
  var allIndices = DASHBOARD_DATA.daily.indices;
  var coreIndices = allIndices.slice(0, 4);
  var broadIndices = allIndices.slice(4);

  var volDiff = function(cur, avg) {
    if (!Number.isFinite(cur) || !Number.isFinite(avg) || avg === 0) return '<span style="color:var(--text-muted);font-size:11px">—</span>';
    var pct = ((cur - avg) / avg * 100).toFixed(1);
    var up = cur >= avg;
    return '<span style="color:var(--' + (up ? 'color-up' : 'color-down') + ');font-size:11px">' + (up ? '+' : '') + pct + '%</span>';
  };

  var coreRowFn = function(idx) {
    return '<tr>' +
      '<td style="font-weight:600">' + idx.name + '</td>' +
      '<td style="font-family:monospace">' + (Number.isFinite(idx.close) ? idx.close.toFixed(2) : '—') + '</td>' +
      '<td class="' + priceColor(idx.change) + '" style="font-family:monospace">' + (Number.isFinite(idx.change) && idx.change > 0 ? '+' : '') + (Number.isFinite(idx.change) ? idx.change.toFixed(2) : '—') + '</td>' +
      '<td class="' + priceColor(idx.changePct) + '" style="font-family:monospace;font-weight:600">' + fmtPct(idx.changePct) + '</td>' +
      '<td style="color:var(--text-primary);font-family:monospace;font-weight:600">' + (Number.isFinite(idx.volume) ? idx.volume.toLocaleString() : '—') + '</td>' +
      '<td style="color:var(--text-secondary);font-family:monospace">' + (Number.isFinite(idx.avg5) ? idx.avg5.toLocaleString() : '—') + ' <br>' + volDiff(idx.volume, idx.avg5) + '</td>' +
      '<td style="color:var(--text-secondary);font-family:monospace">' + (Number.isFinite(idx.avg10) ? idx.avg10.toLocaleString() : '—') + ' <br>' + volDiff(idx.volume, idx.avg10) + '</td>' +
    '</tr>';
  };

  var broadRowFn = function(idx) {
    return '<tr>' +
      '<td style="font-weight:600">' + idx.name + '</td>' +
      '<td style="font-family:monospace">' + (Number.isFinite(idx.close) ? idx.close.toFixed(2) : '—') + '</td>' +
      '<td class="' + priceColor(idx.change) + '" style="font-family:monospace">' + (Number.isFinite(idx.change) && idx.change > 0 ? '+' : '') + (Number.isFinite(idx.change) ? idx.change.toFixed(2) : '—') + '</td>' +
      '<td class="' + priceColor(idx.changePct) + '" style="font-family:monospace;font-weight:600">' + fmtPct(idx.changePct) + '</td>' +
      '<td style="color:var(--text-primary);font-family:monospace;font-weight:600">' + (Number.isFinite(idx.volume) ? idx.volume.toLocaleString() : '—') + '</td>' +
      '<td style="color:var(--text-tertiary);font-size:12px">—</td>' +
      '<td style="color:var(--text-tertiary);font-size:12px">—</td>' +
    '</tr>';
  };

  if (typeof buildTable === 'function') {
    buildTable('daily-indices-core-table',
      ['指数', '收盘', '涨跌', '涨跌幅', '成交额(亿)', '5日均(亿)', '10日均(亿)'],
      coreIndices, coreRowFn);
    buildTable('daily-indices-broad-table',
      ['指数', '收盘', '涨跌', '涨跌幅', '成交额(亿)', '5日均(亿)', '10日均(亿)'],
      broadIndices, broadRowFn);
  }
}

function _rtUpdateTurnover() {
  var t = DASHBOARD_DATA.daily.turnover;
  var el = document.getElementById('daily-turnover');
  if (!el) return;
  var fmt = function(v, suffix) {
    if (!Number.isFinite(v)) return '数据暂缺';
    return v.toLocaleString() + (suffix || '');
  };
  var fmtSign = function(v, suffix) {
    if (!Number.isFinite(v)) return '数据暂缺';
    return (v > 0 ? '+' : '') + v + (suffix || '');
  };
  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:10px 0">' +
      '<div class="metric-card"><div class="metric-label">两市成交额</div><div class="metric-value">' + fmt(t.total, '亿') + '</div><div class="metric-change">较昨日 ' + fmtSign(t.change, '亿') + '</div></div>' +
      '<div class="metric-card"><div class="metric-label">5日平均</div><div class="metric-value" style="font-size:18px">' + fmt(t.avg5, '亿') + '</div><div class="metric-change">差额 ' + fmtSign(t.vs5d, '亿') + '</div></div>' +
      '<div class="metric-card"><div class="metric-label">10日平均</div><div class="metric-value" style="font-size:18px">' + fmt(t.avg10, '亿') + '</div><div class="metric-change">差额 ' + fmtSign(t.vs10d, '亿') + '</div></div>' +
    '</div>';
}

function _rtUpdateBreadth() {
  var b = DASHBOARD_DATA.daily.breadth;
  if (charts['daily-breadth'] && b.upCount && b.downCount) {
    charts['daily-breadth'].setOption({
      series: [{
        data: [
          { value: b.upCount, name: '上涨 ' + b.upCount, itemStyle: { color: '#ef4444' } },
          { value: b.downCount, name: '下跌 ' + b.downCount, itemStyle: { color: '#22c55e' } },
          { value: b.flatCount, name: '平盘 ' + b.flatCount, itemStyle: { color: '#64748b' } },
        ],
      }],
    });
  }
}

function _rtUpdateOverview() {
  var d = DASHBOARD_DATA.daily;
  var coreIdx = d.indices.slice(0, 4);
  var metricsEl = document.getElementById('overview-metrics');
  if (!metricsEl) return;
  metricsEl.innerHTML = coreIdx.map(function(idx) {
    return '<div class="metric-card">' +
      '<div class="metric-label">' + idx.name + '</div>' +
      '<div class="metric-value">' + (Number.isFinite(idx.close) ? idx.close.toFixed(2) : '—') + '</div>' +
      '<div class="metric-change" style="color:var(--' + (idx.changePct > 0 ? 'color-up' : 'color-down') + ')">' + fmtPct(idx.changePct) + '</div>' +
    '</div>';
  }).join('');

  // 也更新成交额
  var mdEl = document.getElementById('overview-market-data');
  if (mdEl) {
    mdEl.innerHTML = [
      { label: '两市成交额', value: (Number.isFinite(d.turnover.total) ? d.turnover.total.toLocaleString() + '亿' : '—'), change: Number.isFinite(d.turnover.change) ? (d.turnover.change > 0 ? '+' : '') + d.turnover.change + '亿' : '—', up: d.turnover.change > 0 },
      { label: '融资余额', value: (Number.isFinite(d.margin.financeBalance) ? d.margin.financeBalance + '亿' : '—'), change: Number.isFinite(d.margin.balanceChange) ? (d.margin.balanceChange > 0 ? '+' : '') + d.margin.balanceChange + '亿' : '—', up: d.margin.balanceChange > 0 },
      { label: '北向资金', value: (Number.isFinite(d.northbound.netBuy) ? d.northbound.netBuy + '亿' : '—'), change: Number.isFinite(d.northbound.turnover) ? '成交' + d.northbound.turnover + '亿' : '—', up: d.northbound.netBuy > 0 },
      { label: '涨跌家数', value: (d.breadth.upCount || 0) + '/' + (d.breadth.downCount || 0), change: d.breadth.moneyEffect || '—', up: (d.breadth.upCount || 0) > (d.breadth.downCount || 0) },
    ].map(function(m) {
      return '<div class="metric-card"><div class="metric-label">' + m.label + '</div><div class="metric-value">' + m.value + '</div><div class="metric-change" style="color:var(--' + (m.up ? 'color-up' : 'color-down') + ')">' + m.change + '</div></div>';
    }).join('');
  }
}

// 启动/停止
function startRealtime() {
  if (_rtTimer) return;
  _rtActive = true;
  _rtFetchQuotes();
  _rtTimer = setInterval(_rtFetchQuotes, 120000);
  var btn = document.getElementById('realtimeToggle');
  if (btn) { btn.innerHTML = '<span class="rt-pulse"></span> 实时'; btn.classList.add('rt-on'); }
}

function stopRealtime() {
  if (_rtTimer) { clearInterval(_rtTimer); _rtTimer = null; }
  _rtActive = false;
  var btn = document.getElementById('realtimeToggle');
  if (btn) { btn.innerHTML = '▶ 实时'; btn.classList.remove('rt-on'); }
  var status = document.getElementById('updateStatus');
  if (status) { status.textContent = '最新数据'; status.style.color = ''; }
}

function toggleRealtime() {
  if (_rtActive) { stopRealtime(); } else { startRealtime(); }
}

// 初始化
function _rtInit() {
  var btn = document.getElementById('realtimeToggle');
  if (btn) btn.addEventListener('click', toggleRealtime);
  // 交易时段自动启动
  if (_rtIsTradingHours()) startRealtime();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _rtInit);
} else {
  _rtInit();
}
