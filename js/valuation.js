/**
 * 达摩达兰估值模型引擎
 * 基于 Aswath Damodaran《估值》体系
 * 5大模型：DCF / DDM / 相对估值 / 蒙特卡洛 / 实物期权
 */

// ========== 全局状态 ==========
let VAL_STOCK_DATA = null;      // 当前股票行情数据
let VAL_FINANCE_DATA = null;     // 财务数据
let VAL_RESULTS = {};            // 各模型估值结果
let VAL_CURRENT_TAB = 'dcf';     // 当前标签页

// ========== JSONP 工具函数 ==========
function valJsonp(url, callback) {
  const cbName = 'val_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  window[cbName] = function(data) {
    try { callback(data); } catch(e) { console.error('Valuation callback error:', e); callback(null); }
    delete window[cbName];
    const s = document.getElementById(cbName + '_script');
    if (s) s.remove();
  };
  const script = document.createElement('script');
  script.id = cbName + '_script';
  script.src = url + (url.includes('?') ? '&' : '?') + 'cb=' + cbName;
  script.onerror = function() {
    callback(null);
    delete window[cbName];
    script.remove();
  };
  document.body.appendChild(script);
}

// ========== 市场前缀判断 ==========
function getMarketPrefix(code) {
  const c = code.trim();
  if (/^(6|9)\d{5}$/.test(c) || /^688\d{3}$/.test(c)) return { market: 1, suffix: 'SH', secucode: c + '.SH' };
  if (/^(0|2|3)\d{5}$/.test(c)) return { market: 0, suffix: 'SZ', secucode: c + '.SZ' };
  if (/^[48]\d{5}$/.test(c)) return { market: 0, suffix: 'BJ', secucode: c + '.BJ' };
  return { market: 1, suffix: 'SH', secucode: c + '.SH' };
}

// ========== 股票搜索 ==========
function searchStock() {
  const input = document.getElementById('stockCodeInput');
  let code = input.value.trim();
  if (!code) { alert('请输入股票代码'); return; }

  // 支持名称搜索的简单映射
  const nameMap = { '贵州茅台': '600519', '茅台': '600519', '比亚迪': '002594', '宁德时代': '300750', '中国平安': '601318', '招商银行': '600036', '腾讯': '00700' };
  if (nameMap[code]) code = nameMap[code];
  code = code.replace(/[^0-9]/g, '');
  if (code.length < 6) { alert('股票代码格式不对，请输入6位数字代码'); return; }

  document.getElementById('companyInfo').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">正在获取数据...</div>';
  const { market, suffix, secucode } = getMarketPrefix(code);

  // 同时请求行情和财务数据
  let quoteDone = false, finDone = false;

  // 1. 实时行情
  const quoteUrl = 'https://push2.eastmoney.com/api/qt/stock/get?secid=' + market + '.' + code +
    '&fields=f57,f58,f43,f44,f45,f46,f47,f48,f50,f55,f116,f117,f162,f163,f167,f168,f169,f170,f173,f178,f179,f184,f185,f186,f187,f164' +
    '&fltt=2';
  valJsonp(quoteUrl, function(res) {
    if (res && res.data) {
      VAL_STOCK_DATA = parseQuoteData(res.data, suffix);
    }
    quoteDone = true;
    if (quoteDone && finDone) onStockDataReady(code);
  });

  // 2. 财务业绩数据
  const finUrl = 'https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_LICO_FN_CPD' +
    '&columns=SECUCODE,SECURITY_CODE,SECURITY_NAME_ABBR,REPORT_DATE,REPORT_TYPE,TOTAL_OPERATE_INCOME,OPERATE_INCOME,PARENT_NETPROFIT,DEDUCT_PARENT_NETPROFIT,WEIGHTAVG_ROE,BPS,MGJYXJL,MGJLR,YSTZ,SJLTZ,ASSIGNANDPAY' +
    '&filter=(SECUCODE%3D%22' + secucode + '%22)&pageNumber=1&pageSize=8&sortColumns=REPORT_DATE&sortTypes=-1';
  valJsonp(finUrl, function(res) {
    if (res && res.result && res.result.data) {
      VAL_FINANCE_DATA = res.result.data;
    }
    finDone = true;
    if (quoteDone && finDone) onStockDataReady(code);
  });

  // 超时保护
  setTimeout(function() {
    if (!quoteDone || !finDone) {
      if (!VAL_STOCK_DATA) {
        VAL_STOCK_DATA = getManualData(code);
        quoteDone = true;
        if (finDone || !VAL_FINANCE_DATA) { finDone = true; onStockDataReady(code); }
      }
    }
  }, 5000);
}

function parseQuoteData(d, suffix) {
  return {
    code: d.f57,
    name: d.f58,
    price: d.f43,
    high: d.f44,
    low: d.f45,
    open: d.f46,
    volume: d.f47,
    turnover: d.f48,
    volumeRatio: d.f50,
    eps: d.f55,
    marketCap: d.f116,
    totalShares: d.f117,
    pe: d.f162,
    pb: d.f163,
    circMarketCap: d.f167,
    turnoverRate: d.f168,
    changePct: d.f169,
    change: d.f170,
    roe: d.f173,
    grossMargin: d.f178,
    netMargin: d.f179,
    revenuePS: d.f184,
    bps: d.f185,
    revenueYoY: d.f186,
    profitYoY: d.f187,
    dividendPS: d.f164,
    suffix: suffix,
  };
}

function getManualData(code) {
  return {
    code: code,
    name: code,
    price: 0,
    pe: 0, pb: 0, eps: 0, bps: 0,
    marketCap: 0, totalShares: 0,
    roe: 0, grossMargin: 0, netMargin: 0,
    revenuePS: 0, revenueYoY: 0, profitYoY: 0,
    dividendPS: 0, suffix: 'SH',
    manual: true,
  };
}

// ========== 数据就绪后初始化各模型 ==========
function onStockDataReady(code) {
  renderCompanyInfo();

  // 初始化所有模型参数和结果
  initDCF();
  initDDM();
  initRelativeValuation();
  initMonteCarlo();
  initRealOptions();

  // 默认显示DCF
  switchValuationTab('dcf');

  // 清空汇总
  VAL_RESULTS = {};
}

// ========== 公司信息渲染 ==========
function renderCompanyInfo() {
  const d = VAL_STOCK_DATA;
  if (!d) return;
  const el = document.getElementById('companyInfo');

  if (d.manual) {
    el.innerHTML = '<div style="padding:20px;color:var(--color-yellow)">未获取到实时数据，请手动输入参数。各模型参数均可编辑。</div>';
    return;
  }

  const marketCapYi = (d.marketCap / 1e8).toFixed(0);
  el.innerHTML = `
    <div class="company-info-grid">
      <div class="company-info-main">
        <span style="font-size:20px;font-weight:700">${d.name}</span>
        <span style="color:var(--text-muted);margin-left:8px">${d.code}.${d.suffix}</span>
      </div>
      <div class="company-info-row">
        <div class="ci-item"><span class="ci-label">现价</span><span class="ci-value">${d.price.toFixed(2)}</span></div>
        <div class="ci-item"><span class="ci-label">涨跌</span><span class="ci-value" style="color:var(--${d.changePct>=0?'color-up':'color-down'})">${d.changePct>=0?'+':''}${d.changePct.toFixed(2)}%</span></div>
        <div class="ci-item"><span class="ci-label">总市值</span><span class="ci-value">${marketCapYi}亿</span></div>
        <div class="ci-item"><span class="ci-label">PE(TTM)</span><span class="ci-value">${d.pe ? d.pe.toFixed(1) : '—'}</span></div>
        <div class="ci-item"><span class="ci-label">PB</span><span class="ci-value">${d.pb ? d.pb.toFixed(2) : '—'}</span></div>
        <div class="ci-item"><span class="ci-label">EPS</span><span class="ci-value">${d.eps ? d.eps.toFixed(2) : '—'}</span></div>
        <div class="ci-item"><span class="ci-label">BPS</span><span class="ci-value">${d.bps ? d.bps.toFixed(2) : '—'}</span></div>
        <div class="ci-item"><span class="ci-label">ROE</span><span class="ci-value">${d.roe ? d.roe.toFixed(1) + '%' : '—'}</span></div>
      </div>
    </div>`;
}

// ========== 标签页切换 ==========
function switchValuationTab(tab) {
  VAL_CURRENT_TAB = tab;
  document.querySelectorAll('.val-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.val-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.val-tab[data-model="' + tab + '"]').classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');

  if (tab === 'summary') renderSummary();
}

// ========== 参数输入构建器 ==========
function buildParamRow(id, label, value, unit, hint) {
  return `
    <div class="param-row">
      <label class="param-label">${label}</label>
      <div class="param-input-wrap">
        <input type="number" id="${id}" class="param-input" value="${value}" step="0.01"
          onchange="onParamChange('${id}')"
          oninput="onParamChange('${id}')">
        ${unit ? `<span class="param-unit">${unit}</span>` : ''}
      </div>
      ${hint ? `<div class="param-hint">${hint}</div>` : ''}
    </div>`;
}

function getParam(id, defaultVal) {
  const el = document.getElementById(id);
  if (!el || el.value === '') return defaultVal;
  return parseFloat(el.value);
}

function requireParams(ids, resultId) {
  const missing = ids.filter(id => {
    const el = document.getElementById(id);
    return !el || el.value.trim() === '' || !Number.isFinite(Number(el.value));
  });
  if (!missing.length) return true;
  const result = document.getElementById(resultId);
  if (result) result.innerHTML = '<div class="result-warning">关键参数缺失，暂不生成估值结果。请补充空白参数；系统不会用猜测值代替真实数据。</div>';
  return false;
}

function inputValue(value, scale = 1, decimals = 2) {
  return Number.isFinite(value) && value !== 0 ? (value / scale).toFixed(decimals) : '';
}

function onParamChange(id) {
  // 根据变化的参数重新计算对应模型
  if (id.startsWith('dcf_')) calcDCF();
  else if (id.startsWith('ddm_')) calcDDM();
  else if (id.startsWith('rel_')) calcRelative();
  else if (id.startsWith('mc_')) {}  // 蒙特卡洛需要手动触发
  else if (id.startsWith('ro_')) calcRealOptions();
}

// ========== DCF 现金流折现模型 ==========
function initDCF() {
  const d = VAL_STOCK_DATA;
  const f = VAL_FINANCE_DATA && VAL_FINANCE_DATA[0] ? VAL_FINANCE_DATA[0] : {};

  const revenueGrowth = Number.isFinite(d.revenueYoY) && d.revenueYoY !== 0 ? d.revenueYoY : (Number.isFinite(f.YSTZ) ? f.YSTZ / 100 : null);

  const paramsEl = document.getElementById('dcf-params');
  paramsEl.innerHTML = `
    ${buildParamRow('dcf_fcff', '当前FCFF（自由现金流）', '', '亿元',
      '当前接口未提供完整现金流量表，请按财报手工输入')}
    ${buildParamRow('dcf_growth1', '高增长期增长率', Number.isFinite(revenueGrowth) ? (revenueGrowth*100).toFixed(1) : '', '%',
      '来源：最新财报营收同比；为空时请手工输入模型假设')}
    ${buildParamRow('dcf_growth_years', '高增长期年数', '5', '年',
      '高增长持续的年数，通常3-10年')}
    ${buildParamRow('dcf_growth_terminal', '永续增长率', '3.0', '%',
      '高增长期后的稳定增长率，通常2-4%（接近GDP增速）')}
    ${buildParamRow('dcf_rf', '无风险利率', '2.5', '%',
      '10年期国债收益率，中国约2.5%')}
    ${buildParamRow('dcf_erp', '股权风险溢价', '5.5', '%',
      '中国股市ERP约5-6%')}
    ${buildParamRow('dcf_beta', 'Beta系数', '1.0', '',
      '个股相对市场波动的敏感度。>1高风险，<1低风险')}
    ${buildParamRow('dcf_debt', '有息负债', '', '亿元', '请按最新资产负债表手工输入')}
    ${buildParamRow('dcf_cash', '现金及等价物', '', '亿元', '请按最新资产负债表手工输入')}
    ${buildParamRow('dcf_tax', '税率', '25', '%',
      '企业所得税率')}
    ${buildParamRow('dcf_shares', '总股本', inputValue(d.totalShares, 1e8), '亿股', '来源：最新行情接口')}
  `;

  // 渲染公式说明
  document.getElementById('dcf-formula').innerHTML = `
    <div class="formula-block">
      <div class="formula-title">DCF 两阶段现金流折现模型</div>
      <div class="formula-line">企业价值 V = <span class="formula-sum">∑</span> FCFF<sub>t</sub> / (1+WACC)<sup>t</sup> + TV / (1+WACC)<sup>n</sup></div>
      <div class="formula-sub">其中：</div>
      <div class="formula-line formula-indent">FCFF = 净利润 + 折旧摊销 - 资本支出 - 营运资本变动</div>
      <div class="formula-line formula-indent">WACC = E/(D+E) × K<sub>e</sub> + D/(D+E) × K<sub>d</sub> × (1-税率)</div>
      <div class="formula-line formula-indent">K<sub>e</sub> = 无风险利率 + Beta × 股权风险溢价 <span class="formula-note">(CAPM)</span></div>
      <div class="formula-line formula-indent">TV = FCFF<sub>n+1</sub> / (WACC - g) <span class="formula-note">(终值)</span></div>
      <div class="formula-line formula-indent">每股价值 = (企业价值 - 负债 + 现金) / 总股本</div>
    </div>
    <div class="model-note">
      <strong>适用场景：</strong>适用于有稳定现金流、可预测增长周期的成熟企业。不适用于早期亏损公司、强周期股、金融股。
    </div>`;

  calcDCF();
}

function calcDCF() {
  if (!requireParams(['dcf_fcff','dcf_growth1','dcf_growth_years','dcf_growth_terminal','dcf_rf','dcf_erp','dcf_beta','dcf_debt','dcf_cash','dcf_tax','dcf_shares'], 'dcf-result')) return;
  const fcff = getParam('dcf_fcff', 100) * 1e8;
  const g1 = getParam('dcf_growth1', 10) / 100;
  const n = Math.round(getParam('dcf_growth_years', 5));
  const gT = getParam('dcf_growth_terminal', 3) / 100;
  const rf = getParam('dcf_rf', 2.5) / 100;
  const erp = getParam('dcf_erp', 5.5) / 100;
  const beta = getParam('dcf_beta', 1.0);
  const debt = getParam('dcf_debt', 0) * 1e8;
  const cash = getParam('dcf_cash', 0) * 1e8;
  const tax = getParam('dcf_tax', 25) / 100;
  const shares = getParam('dcf_shares', 1) * 1e8;

  // CAPM
  const ke = rf + beta * erp;

  // 简化WACC：假设全股权或负债占比小
  const equityVal = VAL_STOCK_DATA ? VAL_STOCK_DATA.marketCap : fcff * 15;
  const dRatio = debt / (equityVal + debt);
  const eRatio = equityVal / (equityVal + debt);
  const kd = rf + 0.02; // 债务成本 = 无风险利率 + 2%
  const wacc = eRatio * ke + dRatio * kd * (1 - tax);

  // 两阶段DCF
  let pvFCFF = 0;
  const steps = [];
  let currentFCFF = fcff;

  for (let t = 1; t <= n; t++) {
    currentFCFF *= (1 + g1);
    const discountFactor = Math.pow(1 + wacc, t);
    const pv = currentFCFF / discountFactor;
    pvFCFF += pv;
    steps.push({
      year: t,
      fcff: currentFCFF,
      discount: discountFactor,
      pv: pv,
    });
  }

  // 终值
  const terminalFCFF = currentFCFF * (1 + gT);
  const tv = terminalFCFF / (wacc - gT);
  const pvTV = tv / Math.pow(1 + wacc, n);

  // 企业价值
  const enterpriseVal = pvFCFF + pvTV;
  // 股权价值
  const equityValue = enterpriseVal - debt + cash;
  // 每股价值
  const perShare = shares > 0 ? equityValue / shares : 0;

  // 当前股价
  const currentPrice = VAL_STOCK_DATA ? VAL_STOCK_DATA.price : 0;
  const upside = currentPrice > 0 ? ((perShare - currentPrice) / currentPrice * 100) : 0;

  VAL_RESULTS.dcf = { value: perShare, enterpriseVal: enterpriseVal/1e8, equityVal: equityValue/1e8, wacc: wacc*100, upside: upside };

  // 渲染结果
  const el = document.getElementById('dcf-result');
  el.innerHTML = `
    <div class="calc-process">
      <div class="calc-step">
        <span class="calc-label">1. CAPM 股权成本</span>
        <span class="calc-formula">K<sub>e</sub> = ${rf*100}% + ${beta} × ${erp*100}% = <strong>${(ke*100).toFixed(2)}%</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">2. WACC 加权平均资本成本</span>
        <span class="calc-formula">股权占比 ${(eRatio*100).toFixed(0)}% × ${(ke*100).toFixed(2)}% + 负债占比 ${(dRatio*100).toFixed(0)}% × ${(kd*100).toFixed(2)}% × ${(1-tax)*100}% = <strong>${(wacc*100).toFixed(2)}%</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">3. 高增长期现值 (${n}年)</span>
        <table class="calc-table">
          <tr><th>年份</th><th>FCFF(亿)</th><th>折现因子</th><th>现值(亿)</th></tr>
          ${steps.map(s => `<tr><td>第${s.year}年</td><td>${(s.fcff/1e8).toFixed(1)}</td><td>${s.discount.toFixed(3)}</td><td>${(s.pv/1e8).toFixed(1)}</td></tr>`).join('')}
          <tr style="font-weight:600"><td>合计</td><td colspan="2"></td><td>${(pvFCFF/1e8).toFixed(1)}</td></tr>
        </table>
      </div>
      <div class="calc-step">
        <span class="calc-label">4. 终值</span>
        <span class="calc-formula">TV = ${terminalFCFF.toFixed(0)} / (${(wacc*100).toFixed(2)}% - ${gT*100}%) = ${(tv/1e8).toFixed(1)}亿 → 现值 ${(pvTV/1e8).toFixed(1)}亿</span>
      </div>
      <div class="calc-step">
        <span class="calc-label">5. 企业价值</span>
        <span class="calc-formula">${(pvFCFF/1e8).toFixed(1)} + ${(pvTV/1e8).toFixed(1)} = <strong>${(enterpriseVal/1e8).toFixed(1)}亿</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">6. 股权价值</span>
        <span class="calc-formula">${(enterpriseVal/1e8).toFixed(1)} - ${(debt/1e8).toFixed(0)} + ${(cash/1e8).toFixed(0)} = <strong>${(equityValue/1e8).toFixed(1)}亿</strong></span>
      </div>
    </div>
    <div class="result-box ${upside > 0 ? 'result-undervalued' : 'result-overvalued'}">
      <div class="result-label">DCF 估值结果</div>
      <div class="result-main">
        <span class="result-price">${perShare.toFixed(2)}</span>
        <span class="result-unit">元/股</span>
        ${currentPrice > 0 ? `<span class="result-vs">现价 ${currentPrice.toFixed(2)} → ${upside > 0 ? '低估' : '高估'} ${Math.abs(upside).toFixed(1)}%</span>` : ''}
      </div>
    </div>`;
}

// ========== DDM 股利折现模型 ==========
function initDDM() {
  const d = VAL_STOCK_DATA;
  const dividendPS = Number.isFinite(d.dividendPS) && d.dividendPS > 0 ? d.dividendPS : null;

  document.getElementById('ddm-params').innerHTML = `
    ${buildParamRow('ddm_d0', '当前每股股息', dividendPS === null ? '' : dividendPS.toFixed(2), '元', '来源：最新行情接口；为空时请按年报输入')}
    ${buildParamRow('ddm_growth1', '高增长期股息增长率', '', '%', '模型假设，请根据历史分红手工输入')}
    ${buildParamRow('ddm_growth_years', '高增长期年数', '5', '年',
      '高增长持续年数')}
    ${buildParamRow('ddm_growth_terminal', '永续股息增长率', '2.0', '%',
      '长期稳定分红增长率')}
    ${buildParamRow('ddm_rf', '无风险利率', '2.5', '%',
      '10年期国债收益率')}
    ${buildParamRow('ddm_erp', '股权风险溢价', '5.5', '%',
      '中国股市ERP')}
    ${buildParamRow('ddm_beta', 'Beta系数', '1.0', '',
      '个股Beta')}
  `;

  document.getElementById('ddm-formula').innerHTML = `
    <div class="formula-block">
      <div class="formula-title">DDM 两阶段股利折现模型</div>
      <div class="formula-line">P = <span class="formula-sum">∑</span> D<sub>t</sub> / (1+K<sub>e</sub>)<sup>t</sup> + [D<sub>n+1</sub> / (K<sub>e</sub> - g)] / (1+K<sub>e</sub>)<sup>n</sup></div>
      <div class="formula-sub">其中：</div>
      <div class="formula-line formula-indent">D<sub>t</sub> = 第t年每股股息</div>
      <div class="formula-line formula-indent">K<sub>e</sub> = 无风险利率 + Beta × ERP <span class="formula-note">(CAPM)</span></div>
      <div class="formula-line formula-indent">g = 永续股息增长率</div>
    </div>
    <div class="model-note">
      <strong>适用场景：</strong>适用于稳定分红、现金流可预测的成熟企业（如银行、公用事业、消费龙头）。不适用于不分红或分红不稳定的成长股。
    </div>`;

  calcDDM();
}

function calcDDM() {
  if (!requireParams(['ddm_d0','ddm_growth1','ddm_growth_years','ddm_growth_terminal','ddm_rf','ddm_erp','ddm_beta'], 'ddm-result')) return;
  const d0 = getParam('ddm_d0', 0);
  const g1 = getParam('ddm_growth1', 5) / 100;
  const n = Math.round(getParam('ddm_growth_years', 5));
  const gT = getParam('ddm_growth_terminal', 2) / 100;
  const rf = getParam('ddm_rf', 2.5) / 100;
  const erp = getParam('ddm_erp', 5.5) / 100;
  const beta = getParam('ddm_beta', 1.0);

  const ke = rf + beta * erp;

  if (d0 <= 0) {
    document.getElementById('ddm-result').innerHTML = '<div class="result-warning">该公司当前无分红数据，DDM模型不适用。可手动输入股息后计算。</div>';
    VAL_RESULTS.ddm = null;
    return;
  }

  // 两阶段DDM
  let pvDividends = 0;
  const steps = [];
  let currentDiv = d0;

  for (let t = 1; t <= n; t++) {
    currentDiv *= (1 + g1);
    const df = Math.pow(1 + ke, t);
    const pv = currentDiv / df;
    pvDividends += pv;
    steps.push({ year: t, div: currentDiv, df: df, pv: pv });
  }

  // 终值
  const terminalDiv = currentDiv * (1 + gT);
  const tv = terminalDiv / (ke - gT);
  const pvTV = tv / Math.pow(1 + ke, n);

  const value = pvDividends + pvTV;
  const currentPrice = VAL_STOCK_DATA ? VAL_STOCK_DATA.price : 0;
  const upside = currentPrice > 0 ? ((value - currentPrice) / currentPrice * 100) : 0;

  VAL_RESULTS.ddm = { value: value, upside: upside };

  document.getElementById('ddm-result').innerHTML = `
    <div class="calc-process">
      <div class="calc-step">
        <span class="calc-label">1. 股权成本 (CAPM)</span>
        <span class="calc-formula">K<sub>e</sub> = ${rf*100}% + ${beta} × ${erp*100}% = <strong>${(ke*100).toFixed(2)}%</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">2. 高增长期股息现值 (${n}年)</span>
        <table class="calc-table">
          <tr><th>年份</th><th>股息(元)</th><th>折现因子</th><th>现值(元)</th></tr>
          ${steps.map(s => `<tr><td>第${s.year}年</td><td>${s.div.toFixed(3)}</td><td>${s.df.toFixed(3)}</td><td>${s.pv.toFixed(3)}</td></tr>`).join('')}
          <tr style="font-weight:600"><td>合计</td><td colspan="2"></td><td>${pvDividends.toFixed(2)}</td></tr>
        </table>
      </div>
      <div class="calc-step">
        <span class="calc-label">3. 终值</span>
        <span class="calc-formula">TV = ${terminalDiv.toFixed(3)} / (${(ke*100).toFixed(2)}% - ${gT*100}%) = ${tv.toFixed(2)}元 → 现值 ${pvTV.toFixed(2)}元</span>
      </div>
      <div class="calc-step">
        <span class="calc-label">4. 每股内在价值</span>
        <span class="calc-formula">${pvDividends.toFixed(2)} + ${pvTV.toFixed(2)} = <strong>${value.toFixed(2)}元</strong></span>
      </div>
    </div>
    <div class="result-box ${upside > 0 ? 'result-undervalued' : 'result-overvalued'}">
      <div class="result-label">DDM 估值结果</div>
      <div class="result-main">
        <span class="result-price">${value.toFixed(2)}</span>
        <span class="result-unit">元/股</span>
        ${currentPrice > 0 ? `<span class="result-vs">现价 ${currentPrice.toFixed(2)} → ${upside > 0 ? '低估' : '高估'} ${Math.abs(upside).toFixed(1)}%</span>` : ''}
      </div>
    </div>`;
}

// ========== 相对估值法 ==========
function initRelativeValuation() {
  const d = VAL_STOCK_DATA;
  const f = VAL_FINANCE_DATA && VAL_FINANCE_DATA[0] ? VAL_FINANCE_DATA[0] : {};

  document.getElementById('rel-params').innerHTML = `
    <div class="param-group-title">公司数据（自动填充）</div>
    ${buildParamRow('rel_eps', '每股收益 EPS', inputValue(d.eps), '元', '来源：最新行情接口')}
    ${buildParamRow('rel_bps', '每股净资产 BPS', inputValue(d.bps), '元', '来源：最新行情接口')}
    ${buildParamRow('rel_revenuePS', '每股营收 SPS', inputValue(d.revenuePS), '元', '来源：最新行情接口')}
    ${buildParamRow('rel_ebitda', 'EBITDA', '', '亿元', '当前数据源未提供，请按财报输入')}
    ${buildParamRow('rel_debt', '净负债', '', '亿元', '请按最新财报输入')}
    ${buildParamRow('rel_cash', '现金', '', '亿元', '请按最新财报输入')}
    <div class="param-group-title" style="margin-top:16px">行业平均估值倍数（可调整）</div>
    ${buildParamRow('rel_indPE', '行业平均PE', '', '', '尚未接入可比公司数据，请手工输入')}
    ${buildParamRow('rel_indPB', '行业平均PB', '', '', '尚未接入可比公司数据，请手工输入')}
    ${buildParamRow('rel_indPS', '行业平均PS', '', '', '尚未接入可比公司数据，请手工输入')}
    ${buildParamRow('rel_indEV', '行业平均EV/EBITDA', '', '', '尚未接入可比公司数据，请手工输入')}
  `;

  document.getElementById('rel-formula').innerHTML = `
    <div class="formula-block">
      <div class="formula-title">相对估值法（乘数法）</div>
      <div class="formula-line"><strong>PE法：</strong>目标价 = 行业PE × 公司EPS</div>
      <div class="formula-line"><strong>PB法：</strong>目标价 = 行业PB × 公司BPS</div>
      <div class="formula-line"><strong>PS法：</strong>目标价 = 行业PS × 公司SPS</div>
      <div class="formula-line"><strong>EV/EBITDA法：</strong>企业价值 = 行业EV/EBITDA × 公司EBITDA</div>
      <div class="formula-line formula-indent">目标价 = (企业价值 + 现金 - 负债) / 总股本</div>
    </div>
    <div class="model-note">
      <strong>适用场景：</strong>适用于有可比同行、盈利稳定的公司。不同行业适用不同倍数：银行用PB，消费用PE，科技用PS/EV-EBITDA。需注意行业周期位置。
    </div>`;

  calcRelative();
}

function calcRelative() {
  if (!requireParams(['rel_eps','rel_bps','rel_revenuePS','rel_ebitda','rel_debt','rel_cash','rel_indPE','rel_indPB','rel_indPS','rel_indEV'], 'rel-result')) return;
  const eps = getParam('rel_eps', 0);
  const bps = getParam('rel_bps', 0);
  const sps = getParam('rel_revenuePS', 0);
  const ebitda = getParam('rel_ebitda', 0) * 1e8;
  const debt = getParam('rel_debt', 0) * 1e8;
  const cash = getParam('rel_cash', 0) * 1e8;
  const indPE = getParam('rel_indPE', 20);
  const indPB = getParam('rel_indPB', 2);
  const indPS = getParam('rel_indPS', 3);
  const indEV = getParam('rel_indEV', 12);
  const shares = VAL_STOCK_DATA ? VAL_STOCK_DATA.totalShares : 1e8;

  const pePrice = indPE * eps;
  const pbPrice = indPB * bps;
  const psPrice = indPS * sps;
  const evVal = indEV * ebitda;
  const equityVal = evVal + cash - debt;
  const evPrice = shares > 0 ? equityVal / shares : 0;

  const methods = [
    { name: 'PE法', price: pePrice, formula: `${indPE} × ${eps.toFixed(2)}` },
    { name: 'PB法', price: pbPrice, formula: `${indPB.toFixed(2)} × ${bps.toFixed(2)}` },
    { name: 'PS法', price: psPrice, formula: `${indPS.toFixed(1)} × ${sps.toFixed(2)}` },
    { name: 'EV/EBITDA法', price: evPrice, formula: `(${indEV.toFixed(1)} × ${(ebitda/1e8).toFixed(0)} + ${(cash/1e8).toFixed(0)} - ${(debt/1e8).toFixed(0)}) / ${(shares/1e8).toFixed(2)}` },
  ];

  const validPrices = methods.filter(m => m.price > 0).map(m => m.price);
  const avgPrice = validPrices.length > 0 ? validPrices.reduce((a,b) => a+b, 0) / validPrices.length : 0;
  const currentPrice = VAL_STOCK_DATA ? VAL_STOCK_DATA.price : 0;
  const upside = currentPrice > 0 ? ((avgPrice - currentPrice) / currentPrice * 100) : 0;

  VAL_RESULTS.relative = { value: avgPrice, upside: upside, methods: methods };

  document.getElementById('rel-result').innerHTML = `
    <div class="calc-process">
      <table class="calc-table" style="width:100%">
        <tr><th>估值方法</th><th>计算过程</th><th>目标价(元)</th></tr>
        ${methods.map(m => `<tr><td style="font-weight:600">${m.name}</td><td style="color:var(--text-secondary);font-size:12px">${m.formula}</td><td style="font-family:monospace;font-weight:600">${m.price > 0 ? m.price.toFixed(2) : '—'}</td></tr>`).join('')}
        <tr style="font-weight:600;border-top:2px solid var(--border-light)">
          <td colspan="2" style="text-align:right">四种方法平均值</td>
          <td style="font-family:monospace;font-size:16px;color:var(--accent-cyan)">${avgPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    <div class="result-box ${upside > 0 ? 'result-undervalued' : 'result-overvalued'}">
      <div class="result-label">相对估值结果（四法均值）</div>
      <div class="result-main">
        <span class="result-price">${avgPrice.toFixed(2)}</span>
        <span class="result-unit">元/股</span>
        ${currentPrice > 0 ? `<span class="result-vs">现价 ${currentPrice.toFixed(2)} → ${upside > 0 ? '低估' : '高估'} ${Math.abs(upside).toFixed(1)}%</span>` : ''}
      </div>
    </div>`;
}

// ========== 蒙特卡洛模拟 ==========
function initMonteCarlo() {
  const d = VAL_STOCK_DATA;
  const f = VAL_FINANCE_DATA && VAL_FINANCE_DATA[0] ? VAL_FINANCE_DATA[0] : {};
  const baseGrowth = Number.isFinite(d.profitYoY) && d.profitYoY !== 0 ? d.profitYoY : (Number.isFinite(f.SJLTZ) ? f.SJLTZ / 100 : null);

  document.getElementById('mc-params').innerHTML = `
    ${buildParamRow('mc_baseFCFF', '基础FCFF', '', '亿元', '当前接口未提供完整现金流量表，请按财报输入')}
    ${buildParamRow('mc_growthMean', '增长率均值', Number.isFinite(baseGrowth) ? (baseGrowth*100).toFixed(1) : '', '%', '来源：最新财报利润同比；也可作为模型假设调整')}
    ${buildParamRow('mc_growthStd', '增长率标准差', '5.0', '%', '越大波动越大')}
    ${buildParamRow('mc_years', '模拟年数', '10', '年', '模拟的时间跨度')}
    ${buildParamRow('mc_terminalG', '永续增长率', '3.0', '%', '期末稳定增长率')}
    ${buildParamRow('mc_waccMean', 'WACC均值', '8.0', '%', '折现率均值')}
    ${buildParamRow('mc_waccStd', 'WACC标准差', '1.0', '%', '折现率波动')}
    ${buildParamRow('mc_shares', '总股本', inputValue(d.totalShares, 1e8), '亿股', '来源：最新行情接口')}
    ${buildParamRow('mc_simulations', '模拟次数', '5000', '次', '运行次数越多结果越精确')}
  `;

  document.getElementById('mc-formula').innerHTML = `
    <div class="formula-block">
      <div class="formula-title">蒙特卡洛模拟</div>
      <div class="formula-line">对增长率和WACC进行随机采样，运行大量模拟：</div>
      <div class="formula-line formula-indent">g ~ Normal(μ<sub>g</sub>, σ<sub>g</sub>) <span class="formula-note">增长率服从正态分布</span></div>
      <div class="formula-line formula-indent">WACC ~ Normal(μ<sub>w</sub>, σ<sub>w</sub>) <span class="formula-note">折现率服从正态分布</span></div>
      <div class="formula-line">每次模拟计算一个DCF估值，N次模拟后得到估值分布：</div>
      <div class="formula-line formula-indent">P5（悲观） · P25 · P50（中位数） · P75 · P95（乐观）</div>
    </div>
    <div class="model-note">
      <strong>适用场景：</strong>适用于不确定性高、参数波动大的情况。通过概率分布展示估值区间而非单一数值，更真实反映不确定性。
    </div>`;

  document.getElementById('mc-result').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">点击下方按钮运行模拟</div>';
  VAL_RESULTS.montecarlo = null;
}

// Box-Muller 正态分布随机数
function normalRandom(mean, std) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

function runMonteCarlo() {
  if (!requireParams(['mc_baseFCFF','mc_growthMean','mc_growthStd','mc_years','mc_terminalG','mc_waccMean','mc_waccStd','mc_shares','mc_simulations'], 'mc-result')) return;
  const baseFCFF = getParam('mc_baseFCFF', 50) * 1e8;
  const gMean = getParam('mc_growthMean', 10) / 100;
  const gStd = getParam('mc_growthStd', 5) / 100;
  const years = Math.round(getParam('mc_years', 10));
  const gT = getParam('mc_terminalG', 3) / 100;
  const wMean = getParam('mc_waccMean', 8) / 100;
  const wStd = getParam('mc_waccStd', 1) / 100;
  const shares = getParam('mc_shares', 1) * 1e8;
  const sims = Math.min(Math.round(getParam('mc_simulations', 5000)), 20000);

  const results = [];
  for (let i = 0; i < sims; i++) {
    const g = normalRandom(gMean, gStd);
    const wacc = normalRandom(wMean, wStd);

    // 跳过不合理值
    if (wacc <= gT + 0.001 || wacc <= 0 || g < -0.5) continue;

    let pv = 0;
    let fcff = baseFCFF;
    for (let t = 1; t <= years; t++) {
      fcff *= (1 + g);
      pv += fcff / Math.pow(1 + wacc, t);
    }
    // 终值
    const tv = fcff * (1 + gT) / (wacc - gT);
    pv += tv / Math.pow(1 + wacc, years);

    const perShare = shares > 0 ? pv / shares : 0;
    if (perShare > 0 && perShare < 1e6) results.push(perShare);
  }

  results.sort((a, b) => a - b);
  const N = results.length;
  if (N < 100) {
    document.getElementById('mc-result').innerHTML = '<div class="result-warning">模拟有效结果不足，请检查参数。WACC必须大于永续增长率。</div>';
    return;
  }

  const percentiles = {
    p5: results[Math.floor(N * 0.05)],
    p25: results[Math.floor(N * 0.25)],
    p50: results[Math.floor(N * 0.50)],
    p75: results[Math.floor(N * 0.75)],
    p95: results[Math.floor(N * 0.95)],
  };
  const mean = results.reduce((a,b) => a+b, 0) / N;
  const currentPrice = VAL_STOCK_DATA ? VAL_STOCK_DATA.price : 0;
  const upside = currentPrice > 0 ? ((percentiles.p50 - currentPrice) / currentPrice * 100) : 0;

  VAL_RESULTS.montecarlo = { percentiles: percentiles, mean: mean, upside: upside, all: results };

  // 直方图
  const bins = 40;
  const min = results[0];
  const max = results[N - 1];
  const binSize = (max - min) / bins;
  const histogram = new Array(bins).fill(0);
  results.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binSize), bins - 1);
    histogram[idx]++;
  });
  const histLabels = histogram.map((_, i) => (min + i * binSize).toFixed(0));
  const histMax = Math.max(...histogram);

  document.getElementById('mc-result').innerHTML = `
    <div class="calc-process">
      <div class="calc-step">
        <span class="calc-label">模拟完成：${N.toLocaleString()} 次有效模拟</span>
      </div>
      <div class="calc-step">
        <table class="calc-table" style="width:100%">
          <tr><th>分位</th><th>估值(元)</th><th>含义</th></tr>
          <tr><td>P5（悲观）</td><td style="font-family:monospace;color:var(--color-down)">${percentiles.p5.toFixed(2)}</td><td style="color:var(--text-muted)">5%概率低于此价</td></tr>
          <tr><td>P25</td><td style="font-family:monospace">${percentiles.p25.toFixed(2)}</td><td style="color:var(--text-muted)">下四分位</td></tr>
          <tr style="font-weight:600"><td>P50（中位数）</td><td style="font-family:monospace;color:var(--accent-cyan)">${percentiles.p50.toFixed(2)}</td><td style="color:var(--text-muted)">最可能估值</td></tr>
          <tr><td>P75</td><td style="font-family:monospace">${percentiles.p75.toFixed(2)}</td><td style="color:var(--text-muted)">上四分位</td></tr>
          <tr><td>P95（乐观）</td><td style="font-family:monospace;color:var(--color-up)">${percentiles.p95.toFixed(2)}</td><td style="color:var(--text-muted)">5%概率高于此价</td></tr>
          <tr style="font-weight:600"><td>均值</td><td style="font-family:monospace">${mean.toFixed(2)}</td><td style="color:var(--text-muted)">所有模拟平均</td></tr>
        </table>
      </div>
      <div class="calc-step">
        <div id="mc-histogram" style="width:100%;height:200px"></div>
      </div>
    </div>
    <div class="result-box ${upside > 0 ? 'result-undervalued' : 'result-overvalued'}">
      <div class="result-label">蒙特卡洛中位数估值</div>
      <div class="result-main">
        <span class="result-price">${percentiles.p50.toFixed(2)}</span>
        <span class="result-unit">元/股</span>
        ${currentPrice > 0 ? `<span class="result-vs">现价 ${currentPrice.toFixed(2)} → ${upside > 0 ? '低估' : '高估'} ${Math.abs(upside).toFixed(1)}%</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px">合理区间：${percentiles.p25.toFixed(2)} ~ ${percentiles.p75.toFixed(2)} 元</div>
    </div>`;

  // 渲染直方图
  setTimeout(() => {
    const el = document.getElementById('mc-histogram');
    if (!el) return;
    if (charts['mc-histogram']) charts['mc-histogram'].dispose();
    const chart = echarts.init(el);
    charts['mc-histogram'] = chart;

    chart.setOption({
      ...CHART_THEME,
      grid: { top: 10, right: 10, bottom: 30, left: 40 },
      xAxis: { type: 'category', data: histLabels, axisLabel: { color: '#64748b', fontSize: 9, rotate: 30 }, axisLine: { lineStyle: { color: '#1e293b' } } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
      series: [{
        type: 'bar',
        data: histogram.map((v, i) => ({
          value: v,
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#06b6d4' },
            { offset: 1, color: 'rgba(6,182,212,0.2)' },
          ]) }
        })),
        barWidth: '90%',
      }],
    });
  }, 50);
}

// ========== 实物期权法 ==========
function initRealOptions() {
  const d = VAL_STOCK_DATA;

  document.getElementById('ro-params').innerHTML = `
    ${buildParamRow('ro_pvExpansion', '扩张期权标的现值', '', '亿元', '模型假设，请根据项目现金流手工输入')}
    ${buildParamRow('ro_investCost', '扩张所需投资', '', '亿元', '模型假设，请根据项目预算手工输入')}
    ${buildParamRow('ro_time', '期权到期时间', '5', '年',
      '决策窗口期')}
    ${buildParamRow('ro_rf', '无风险利率', '2.5', '%',
      '10年期国债收益率')}
    ${buildParamRow('ro_volatility', '标的波动率', '', '%', '模型假设，请根据项目价值波动输入')}
    ${buildParamRow('ro_shares', '总股本', inputValue(d.totalShares, 1e8), '亿股', '来源：最新行情接口')}
    ${buildParamRow('ro_navValue', '不扩张时的内在价值', '', '元', '请使用已完成的DCF估值，不以现价代替')}
  `;

  document.getElementById('ro-formula').innerHTML = `
    <div class="formula-block">
      <div class="formula-title">实物期权法（Black-Scholes 简化）</div>
      <div class="formula-line">总价值 = 内在价值（NAV） + 扩张期权价值</div>
      <div class="formula-sub">扩张期权用 Black-Scholes 模型计算：</div>
      <div class="formula-line formula-indent">期权价值 = S × N(d1) - K × e<sup>-rT</sup> × N(d2)</div>
      <div class="formula-line formula-indent">d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)</div>
      <div class="formula-line formula-indent">d2 = d1 - σ√T</div>
      <div class="formula-sub">其中：</div>
      <div class="formula-line formula-indent">S = 扩张带来的现值 · K = 投资成本 · r = 无风险利率</div>
      <div class="formula-line formula-indent">σ = 波动率 · T = 到期时间 · N() = 标准正态累积分布</div>
    </div>
    <div class="model-note">
      <strong>适用场景：</strong>适用于拥有成长期权的企业（如研发管线、新市场拓展、技术专利）。不适用于成熟稳定、无增长期权的公司。
    </div>`;

  calcRealOptions();
}

// 标准正态分布累积分布函数 (近似)
function normCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function calcRealOptions() {
  if (!requireParams(['ro_pvExpansion','ro_investCost','ro_time','ro_rf','ro_volatility','ro_shares','ro_navValue'], 'ro-result')) return;
  const S = getParam('ro_pvExpansion', 100) * 1e8;
  const K = getParam('ro_investCost', 80) * 1e8;
  const T = getParam('ro_time', 5);
  const r = getParam('ro_rf', 2.5) / 100;
  const sigma = getParam('ro_volatility', 35) / 100;
  const shares = getParam('ro_shares', 1) * 1e8;
  const navValue = getParam('ro_navValue', 0);

  // Black-Scholes
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const nD1 = normCDF(d1);
  const nD2 = normCDF(d2);

  const optionValue = S * nD1 - K * Math.exp(-r * T) * nD2;
  const optionPerShare = shares > 0 ? optionValue / shares : 0;

  const totalValue = navValue + optionPerShare;
  const currentPrice = VAL_STOCK_DATA ? VAL_STOCK_DATA.price : 0;
  const upside = currentPrice > 0 ? ((totalValue - currentPrice) / currentPrice * 100) : 0;

  VAL_RESULTS.realoptions = { value: totalValue, optionValue: optionPerShare, upside: upside };

  document.getElementById('ro-result').innerHTML = `
    <div class="calc-process">
      <div class="calc-step">
        <span class="calc-label">1. 计算 d1</span>
        <span class="calc-formula">d1 = [ln(${(S/1e8).toFixed(0)}/${(K/1e8).toFixed(0)}) + (${r*100}% + ${sigma*100}%²/2) × ${T}] / (${sigma*100}% × √${T})</span>
        <span class="calc-formula">d1 = <strong>${d1.toFixed(4)}</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">2. 计算 d2</span>
        <span class="calc-formula">d2 = ${d1.toFixed(4)} - ${sigma*100}% × √${T} = <strong>${d2.toFixed(4)}</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">3. 标准正态累积分布</span>
        <span class="calc-formula">N(d1) = <strong>${nD1.toFixed(4)}</strong> · N(d2) = <strong>${nD2.toFixed(4)}</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">4. 扩张期权价值</span>
        <span class="calc-formula">${(S/1e8).toFixed(0)} × ${nD1.toFixed(4)} - ${(K/1e8).toFixed(0)} × e<sup>${(-r*T).toFixed(4)}</sup> × ${nD2.toFixed(4)} = <strong>${(optionValue/1e8).toFixed(1)}亿</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">5. 每股期权价值</span>
        <span class="calc-formula">${(optionValue/1e8).toFixed(1)}亿 / ${(shares/1e8).toFixed(2)}亿股 = <strong>${optionPerShare.toFixed(2)}元</strong></span>
      </div>
      <div class="calc-step">
        <span class="calc-label">6. 总价值 = 内在价值 + 期权价值</span>
        <span class="calc-formula">${navValue.toFixed(2)} + ${optionPerShare.toFixed(2)} = <strong>${totalValue.toFixed(2)}元</strong></span>
      </div>
    </div>
    <div class="result-box ${upside > 0 ? 'result-undervalued' : 'result-overvalued'}">
      <div class="result-label">实物期权法估值结果</div>
      <div class="result-main">
        <span class="result-price">${totalValue.toFixed(2)}</span>
        <span class="result-unit">元/股</span>
        ${currentPrice > 0 ? `<span class="result-vs">现价 ${currentPrice.toFixed(2)} → ${upside > 0 ? '低估' : '高估'} ${Math.abs(upside).toFixed(1)}%</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px">其中：内在价值 ${navValue.toFixed(2)}元 + 扩张期权 ${optionPerShare.toFixed(2)}元</div>
    </div>`;
}

// ========== 估值汇总 ==========
function renderSummary() {
  const currentPrice = VAL_STOCK_DATA ? VAL_STOCK_DATA.price : 0;
  const models = [];

  if (VAL_RESULTS.dcf) models.push({ name: 'DCF 现金流折现', value: VAL_RESULTS.dcf.value, upside: VAL_RESULTS.dcf.upside, icon: '📊' });
  if (VAL_RESULTS.ddm) models.push({ name: 'DDM 股利折现', value: VAL_RESULTS.ddm.value, upside: VAL_RESULTS.ddm.upside, icon: '💰' });
  if (VAL_RESULTS.relative) models.push({ name: '相对估值法', value: VAL_RESULTS.relative.value, upside: VAL_RESULTS.relative.upside, icon: '📐' });
  if (VAL_RESULTS.montecarlo) models.push({ name: '蒙特卡洛中位数', value: VAL_RESULTS.montecarlo.percentiles.p50, upside: VAL_RESULTS.montecarlo.upside, icon: '🎲' });
  if (VAL_RESULTS.realoptions) models.push({ name: '实物期权法', value: VAL_RESULTS.realoptions.value, upside: VAL_RESULTS.realoptions.upside, icon: '🔮' });

  if (models.length === 0) {
    document.getElementById('summary-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">请先输入股票代码并运行各模型</div>';
    return;
  }

  const values = models.map(m => m.value);
  const avg = values.reduce((a,b) => a+b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avgUpside = currentPrice > 0 ? ((avg - currentPrice) / currentPrice * 100) : 0;

  // 对比表
  let tableHtml = `
    <table class="data-table" style="width:100%">
      <tr><th>估值模型</th><th>估值(元/股)</th><th>vs 现价</th><th>判断</th></tr>
      ${models.map(m => `
        <tr>
          <td><span style="margin-right:6px">${m.icon}</span>${m.name}</td>
          <td style="font-family:monospace;font-weight:600;font-size:15px">${m.value.toFixed(2)}</td>
          <td style="font-family:monospace;color:var(--${m.upside>=0?'color-up':'color-down'})">${m.upside>=0?'+':''}${m.upside.toFixed(1)}%</td>
          <td><span class="status-badge ${m.upside>10?'status-green':m.upside<-10?'status-red':'status-yellow'}">${m.upside>10?'低估':m.upside<-10?'高估':'合理'}</span></td>
        </tr>`).join('')}
      <tr style="font-weight:700;border-top:2px solid var(--border-light)">
        <td>综合估值（均值）</td>
        <td style="font-family:monospace;font-size:18px;color:var(--accent-cyan)">${avg.toFixed(2)}</td>
        <td style="font-family:monospace;color:var(--${avgUpside>=0?'color-up':'color-down'})">${avgUpside>=0?'+':''}${avgUpside.toFixed(1)}%</td>
        <td><span class="status-badge ${avgUpside>10?'status-green':avgUpside<-10?'status-red':'status-yellow'}">${avgUpside>10?'低估':avgUpside<-10?'高估':'合理'}</span></td>
      </tr>
    </table>
    <div style="margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:8px;font-size:13px;color:var(--text-secondary)">
      <strong>估值区间：</strong>${min.toFixed(2)} ~ ${max.toFixed(2)} 元
      ${currentPrice > 0 ? `<br><strong>当前股价：</strong>${currentPrice.toFixed(2)} 元` : ''}
      <br><strong>模型数量：</strong>${models.length} 个
    </div>`;

  document.getElementById('summary-content').innerHTML = tableHtml;

  // 估值区间图
  setTimeout(() => {
    const el = document.getElementById('summary-chart');
    if (!el) return;
    if (charts['summary-chart']) charts['summary-chart'].dispose();
    const chart = echarts.init(el);
    charts['summary-chart'] = chart;

    const modelNames = models.map(m => m.name);
    const modelValues = models.map(m => m.value);

    chart.setOption({
      ...CHART_THEME,
      grid: { top: 30, right: 30, bottom: 60, left: 60 },
      xAxis: { type: 'category', data: modelNames, axisLabel: { color: '#94a3b8', fontSize: 11, rotate: 15 }, axisLine: { lineStyle: { color: '#1e293b' } } },
      yAxis: { type: 'value', axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      series: [{
        type: 'bar',
        data: modelValues.map(v => ({
          value: v,
          itemStyle: { color: v > currentPrice ? '#ef4444' : '#22c55e' }
        })),
        label: { show: true, position: 'top', color: '#e2e8f0', fontSize: 12, fontWeight: 600, formatter: p => p.value.toFixed(2) },
        barWidth: '50%',
        markLine: {
          symbol: 'none',
          data: [
            currentPrice > 0 ? { yAxis: currentPrice, name: '现价' } : {},
            { type: 'average', name: '均值' },
          ],
          lineStyle: { color: '#eab308', type: 'dashed', width: 2 },
          label: { color: '#eab308', fontSize: 11, formatter: function(p) { return p.name + ': ' + p.value.toFixed(2); } },
        },
      }],
    });
  }, 50);
}
