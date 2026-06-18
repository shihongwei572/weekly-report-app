var workbook = null;

const DEPTS = CONFIG.depts;
const ALL_VARIETIES = CONFIG.intentVarieties;

function safeFloat(v, def) { return Utils.safeFloat(v, def); }
function round2(v) { return Utils.round2(v); }
function round4(v) { return Utils.round4(v); }
function toWan(tons) { return Utils.toWan(tons); }
function showToast(msg, duration) { return Utils.showToast(msg, duration); }

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFile(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    setStatus('err', '❌ 请上传 .xlsx 或 .xls 格式文件');
    return;
  }
  setStatus('ok', '⏳ 正在解析...');

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      setStatus('ok', `✅ 已加载：${file.name}`);
      showToast('文件解析成功，正在计算...');
      refreshOutput();
    } catch (err) {
      setStatus('err', '❌ 解析失败：' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function setStatus(type, msg) {
  const el = document.getElementById('uploadStatus');
  el.className = 'upload-status ' + type;
  el.textContent = msg;
}

function getIntentConfig() {
  const startDateStr = document.getElementById('cfgDateStart').value;
  const endDateStr = document.getElementById('cfgDateEnd').value;
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const year = startDate.getFullYear();

  return {
    year,
    week: parseInt(document.getElementById('cfgWeek').value) || 20,
    region: document.getElementById('cfgRegion').value || '沿海大区',
    ytdYoy: parseFloat(document.getElementById('cfgYtdYoy').value) || 0,
    cornYoy: parseFloat(document.getElementById('cfgCornYoy').value) || 0,
    cutoffDate: document.getElementById('cfgCutoffDate').value || '',
    dateStart: startDateStr,
    dateEnd: endDateStr,
  };
}

function onDateRangeChange() {
  const startStr = document.getElementById('cfgDateStart').value;
  if (!startStr) return;

  const startDate = new Date(startStr);
  const year = startDate.getFullYear();

  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  let daysToSat;
  if (jan1Day === 6) daysToSat = 0;
  else if (jan1Day === 0) daysToSat = 6;
  else daysToSat = 6 - jan1Day;
  const firstSat = new Date(year, 0, 1 + daysToSat);

  const diffMs = startDate.getTime() - firstSat.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  let guessWeek = Math.floor(diffDays / 7) + 1;
  if (guessWeek < 1) guessWeek = 1;
  if (guessWeek > 53) guessWeek = 53;

  const badge = document.getElementById('weekHintBadge');
  if (badge) badge.textContent = `第${guessWeek}周`;

  const weekInput = document.getElementById('cfgWeek');
  if (weekInput) weekInput.value = guessWeek;
}

function getWeekDateRange(year, week) {
  return Utils.getWeekDateRange(year, week);
}

function calcWeekData(dateFrom, dateTo) {
  if (!workbook) return null;

  const ws = workbook.Sheets['台账'];
  if (!ws) throw new Error('未找到「台账」工作表');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  if (rows.length < 2) throw new Error('台账数据为空');

  let headerRow = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i] && rows[i].indexOf('经营部') !== -1) { headerRow = i; break; }
  }
  const header = rows[headerRow];
  const H = {};
  header.forEach((h, i) => { if (h) H[h.trim()] = i; });

  const required = ['经营部', '意向日期', '品种', '意向数量'];
  for (const col of required) {
    if (H[col] === undefined) throw new Error(`表头缺少「${col}」列`);
  }

  const by_dept = {};
  DEPTS.forEach(d => {
    by_dept[d] = {};
    ALL_VARIETIES.forEach(v => by_dept[d][v] = 0);
  });

  const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
  const toTs   = dateTo   ? new Date(dateTo.getFullYear(),   dateTo.getMonth(),   dateTo.getDate()).getTime()   : null;

  let rowCount = 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const dept = String(row[H['经营部']] || '').trim();
    if (!DEPTS.includes(dept)) continue;

    const dateRaw = row[H['意向日期']];
    if (!dateRaw) continue;
    let rowDate;
    if (dateRaw instanceof Date) {
      rowDate = new Date(dateRaw.getFullYear(), dateRaw.getMonth(), dateRaw.getDate());
    } else {
      const d = new Date(dateRaw);
      if (isNaN(d)) continue;
      rowDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const rowTs = rowDate.getTime();
    if (fromTs !== null && rowTs < fromTs) continue;
    if (toTs   !== null && rowTs > toTs)   continue;

    const variety = String(row[H['品种']] || '').trim();
    const qty = safeFloat(row[H['意向数量']]);
    if (qty <= 0) continue;

    if (by_dept[dept]) {
      if (!(variety in by_dept[dept])) {
        by_dept[dept][variety] = 0;
      }
      by_dept[dept][variety] += qty;
    }
    rowCount++;
  }

  return { by_dept, rowCount };
}

function calcRangeTotals(dateFrom, dateTo) {
  const res = calcWeekData(dateFrom, dateTo);
  if (!res) return {};
  const totals = {};
  DEPTS.forEach(dept => {
    totals[dept] = Object.values(res.by_dept[dept]).reduce((a, b) => a + b, 0);
  });
  return totals;
}

function calcYtdTotal(year, dateTo) {
  const yearStart = new Date(year, 0, 1);
  const res = calcWeekData(yearStart, dateTo);
  if (!res) return 0;
  let total = 0;
  DEPTS.forEach(dept => {
    total += Object.values(res.by_dept[dept]).reduce((a, b) => a + b, 0);
  });
  return total;
}

var _lastDeptTotals = {};
var _lastMomData = [];

function refreshOutput() {
  if (!workbook) return;

  const cfg = getIntentConfig();

  try {
    const dateStart = cfg.dateStart ? new Date(cfg.dateStart) : null;
    const dateEnd   = cfg.dateEnd   ? new Date(cfg.dateEnd)   : null;
    if (!dateStart || !dateEnd) {
      showToast('⚠️ 请先选择报告周期日期');
      return;
    }

    const thisWeek = calcWeekData(dateStart, dateEnd);
    if (!thisWeek) return;

    const prevEnd   = new Date(dateStart.getTime() - 86400000);
    const prevStart = new Date(dateStart.getTime() - 7 * 86400000);
    const prevTotals = calcRangeTotals(prevStart, prevEnd);

    const grand = {};
    ALL_VARIETIES.forEach(v => grand[v] = 0);
    const deptTotals = {};
    DEPTS.forEach(dept => {
      let t = 0;
      Object.entries(thisWeek.by_dept[dept]).forEach(([v, q]) => {
        if (!(v in grand)) grand[v] = 0;
        grand[v] += q;
        t += q;
      });
      deptTotals[dept] = t;
    });

    const grandTotal = Object.values(grand).reduce((a, b) => a + b, 0);
    const prevTotal = Object.values(prevTotals).reduce((a, b) => a + b, 0);
    const weekChange = grandTotal - prevTotal;

    const ytdTons = calcYtdTotal(cfg.year, dateEnd);
    const ytdWan = toWan(ytdTons);
    const ytdEl = document.getElementById('ytdAutoValue');
    if (ytdEl) ytdEl.textContent = `${ytdWan} 万吨`;

    const weekNum = cfg.week;
    let dateRangeStr;
    if (cfg.dateStart && cfg.dateEnd) {
      const ws = new Date(cfg.dateStart);
      const we = new Date(cfg.dateEnd);
      dateRangeStr = `${ws.getMonth()+1}月${ws.getDate()}日-${we.getMonth()+1}月${we.getDate()}日`;
    } else {
      const weekRange = getWeekDateRange(cfg.year, weekNum);
      const ws = weekRange.start;
      const we = weekRange.end;
      dateRangeStr = `${ws.getMonth()+1}月${ws.getDate()}日-${we.getMonth()+1}月${we.getDate()}日`;
    }

    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('weekBadge').textContent = `${cfg.year}年 第${weekNum}周`;

    _renderKPI(grand, grandTotal, weekChange);
    _renderText(cfg, grand, grandTotal, weekChange, dateRangeStr, ytdWan);
    renderChart(thisWeek.by_dept, prevTotals, deptTotals);
    _renderTable(thisWeek.by_dept, deptTotals, grand, grandTotal, prevTotals);

    showToast(`✅ 计算完成，共解析 ${thisWeek.rowCount} 条记录`);

  } catch (err) {
    showToast('❌ 计算失败：' + err.message);
    console.error(err);
  }
}

function _renderKPI(grand, grandTotal, weekChange) {
  const changeSign = weekChange >= 0 ? '+' : '';
  const changeCls = weekChange > 0 ? 'up' : weekChange < 0 ? 'down' : 'flat';

  const items = [
    { label: '本周总意向', value: toWan(grandTotal), unit: '万吨',
      change: `环比 ${changeSign}${toWan(weekChange)} 万吨`, cls: changeCls },
  ];

  ALL_VARIETIES.forEach(v => {
    if ((grand[v] || 0) > 0) {
      items.push({ label: v, value: toWan(grand[v] || 0), unit: '万吨', change: '', cls: '' });
    }
  });

  document.getElementById('kpiGrid').innerHTML = items.map(item => `
    <div class="kpi-card">
      <div class="kpi-label">${item.label}</div>
      <div class="kpi-value">${item.value}<span class="unit">${item.unit}</span></div>
      ${item.change ? `<div class="kpi-change ${item.cls}">${item.change}</div>` : ''}
    </div>
  `).join('');
}

function _renderText(cfg, grand, grandTotal, weekChange, dateRangeStr, ytdWan) {
  const totalWan = toWan(grandTotal);
  const changeWan = Math.abs(toWan(weekChange));
  const changeTxt = weekChange >= 0
    ? `环比增加<span class="highlight">${changeWan}</span>万吨`
    : `环比减少<span class="highlight">${changeWan}</span>万吨`;

  const varietyParts = ALL_VARIETIES.filter(v => (grand[v] || 0) > 0).map(v => {
    return `${v}<span class="highlight">${toWan(grand[v] || 0)}</span>万吨`;
  });

  let cutoffStr = '';
  if (cfg.cutoffDate) {
    const d = new Date(cfg.cutoffDate);
    cutoffStr = `${d.getMonth()+1}月${d.getDate()}日`;
  }

  const ytdYoyAbs = Math.abs(cfg.ytdYoy);
  const ytdYoyTxt = cfg.ytdYoy >= 0
    ? `同比增加<span class="highlight">${ytdYoyAbs}</span>万吨`
    : `同比减少<span class="highlight">${ytdYoyAbs}</span>万吨`;

  const cornYoyAbs = Math.abs(cfg.cornYoy);
  const cornYoyTxt = cfg.cornYoy >= 0
    ? `同比增加${cornYoyAbs}万吨`
    : `同比减少${cornYoyAbs}万吨`;

  const para1 = `本周意向销售<span class="highlight">${totalWan}</span>万吨（${changeTxt}）。其中${varietyParts.join('，')}。`;

  const para2 = (cutoffStr && ytdWan)
    ? `截至${cutoffStr}，${cfg.region}本年累计意向销售<span class="highlight">${ytdWan}</span>万吨（${ytdYoyTxt}），主要为内贸玉米减量（${cornYoyTxt}）。`
    : '';

  document.getElementById('textOutput').innerHTML = `
    <div class="text-para">${para1}</div>
    ${para2 ? `<div class="text-para">${para2}</div>` : ''}
  `;
}

function _renderTable(by_dept, deptTotals, grand, grandTotal, prevTotals) {
  const headers = ['经营部', ...ALL_VARIETIES, '合计', '环比'];

  let html = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';

  DEPTS.forEach(dept => {
    const curr = deptTotals[dept];
    const prev = prevTotals[dept] || 0;
    let momTxt = 'N/A';
    if (prev > 0) {
      const pct = round2((curr - prev) / prev * 100);
      const sign = pct >= 0 ? '+' : '';
      const color = pct >= 0 ? '#c0392b' : '#18a058';
      momTxt = `<span style="color:${color};font-weight:700">${sign}${pct}%</span>`;
    }

    html += `<tr>
      <td>${dept}</td>
      ${ALL_VARIETIES.map(v => `<td>${toWan(by_dept[dept][v]).toFixed(2)}</td>`).join('')}
      <td><strong>${toWan(curr).toFixed(2)}</strong></td>
      <td>${momTxt}</td>
    </tr>`;
  });

  const prevGrandTotal = Object.values(prevTotals).reduce((a, b) => a + b, 0);
  const totalMom = prevGrandTotal > 0 ? round2((grandTotal - prevGrandTotal) / prevGrandTotal * 100) : null;
  const totalMomTxt = totalMom !== null
    ? `<span style="color:${totalMom>=0?'#c0392b':'#18a058'};font-weight:700">${totalMom>=0?'+':''}${totalMom}%</span>`
    : 'N/A';

  html += `</tbody><tfoot><tr>
    <td>合计</td>
    ${ALL_VARIETIES.map(v => `<td>${toWan(grand[v]).toFixed(2)}</td>`).join('')}
    <td>${toWan(grandTotal).toFixed(2)}</td>
    <td>${totalMomTxt}</td>
  </tr></tfoot>`;

  document.getElementById('detailTable').innerHTML = html;
}

function copyText() {
  const isContract = document.querySelector('.tab-btn[data-tab="contract"]').classList.contains('active');
  const elId = isContract ? 'contractTextOutput' : 'textOutput';
  const el = document.getElementById(elId);
  if (!el || !el.textContent.trim()) {
    showToast('⚠️ 请先上传文件并生成内容');
    return;
  }
  Utils.copyToClipboard(el.innerText || el.textContent);
}

function downloadChart() {
  if (!chartInstance) {
    showToast('⚠️ 请先上传文件生成图表');
    return;
  }
  const cfg = getIntentConfig();
  const canvas = document.getElementById('deptChart');

  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const offCtx = offscreen.getContext('2d');
  offCtx.fillStyle = '#ffffff';
  offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
  offCtx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  link.download = `${cfg.region}意向销售-${cfg.year}年第${cfg.week}周.png`;
  link.href = offscreen.toDataURL('image/png');
  link.click();
  showToast('✅ 图表已下载');
}

function getChartImageBase64() {
  const canvas = document.getElementById('deptChart');
  if (!canvas) return null;
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const offCtx = offscreen.getContext('2d');
  offCtx.fillStyle = '#ffffff';
  offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
  offCtx.drawImage(canvas, 0, 0);
  return offscreen.toDataURL('image/png').split(',')[1];
}

window.DEPTS = DEPTS;
window.ALL_VARIETIES = ALL_VARIETIES;
window.handleDrop = handleDrop;
window.handleFile = handleFile;
window.processFile = processFile;
window.getIntentConfig = getIntentConfig;
window.onDateRangeChange = onDateRangeChange;
window.getWeekDateRange = getWeekDateRange;
window.calcWeekData = calcWeekData;
window.calcRangeTotals = calcRangeTotals;
window.calcYtdTotal = calcYtdTotal;
window.refreshOutput = refreshOutput;
window.copyText = copyText;
window.downloadChart = downloadChart;
window.getChartImageBase64 = getChartImageBase64;
window._lastDeptTotals = _lastDeptTotals;
window._lastMomData = _lastMomData;