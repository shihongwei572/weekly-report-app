var containerWorkbook = null;
var containerChartInstance = null;

const CONTAINER_PLAN = (function() {
  const cfg = getConfig && getConfig('containerPlan');
  if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
    return cfg;
  }
  return CONFIG.containerPlan;
})();

function setContainerStatus(type, msg) {
  const el = document.getElementById('containerUploadStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'status-err' : 'status-ok');
  el.textContent = msg;
}

function handleContainerDrop(e) {
  e.preventDefault();
  document.getElementById('containerUploadZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processContainerFile(file);
}

function handleContainerFile(e) {
  const file = e.target.files[0];
  if (file) processContainerFile(file);
}

function processContainerFile(file) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    setContainerStatus('err', '❌ 请上传 .xlsx 或 .xls 格式文件');
    return;
  }
  setContainerStatus('ok', '⏳ 正在解析...');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      containerWorkbook = XLSX.read(e.target.result, { type: 'array', cellDates: false });
      setContainerStatus('ok', '✅ 已加载：' + file.name);
      showToast('文件解析成功，正在计算...');
      updateFlowSequence(1);
      refreshContainerOutput();
    } catch(err) {
      setContainerStatus('err', '❌ 读取失败：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function getContainerWorkbook() {
  if (containerWorkbook) return containerWorkbook;
  if (lastmileWorkbook) return lastmileWorkbook;
  if (contractWorkbook) return contractWorkbook;
  return null;
}

function calcContainerData() {
  const wb = getContainerWorkbook();
  if (!wb) return null;

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) return null;

  const header = rows[0];
  const idx = {};
  const NEED = ['纳入签约量统计', '提交时间/签约时间', '合同签订量-万吨', '品种', '经营部', '包装方式'];
  NEED.forEach(k => { idx[k] = header.indexOf(k); });

  for (const k of NEED) {
    if (idx[k] < 0) throw new Error('找不到列：' + k);
  }

  const startStr  = document.getElementById('containerStartDate')?.value || '';
  const cutoffStr = document.getElementById('containerCutoffDate')?.value || '';

  // 获取选中的包装方式
  const packGroup = document.getElementById('containerPackGroup');
  const checkedPacks = [];
  if (packGroup) {
    packGroup.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      checkedPacks.push(cb.value);
    });
  }
  // 默认全选
  if (checkedPacks.length === 0) {
    checkedPacks.push('集装箱', '铁路');
  }

  const DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];

  const deptData = {};
  DEPTS.forEach(d => { deptData[d] = { container: 0, railway: 0, total: 0 }; });

  const monthlyData = {};

  const cutoffYear = cutoffStr ? parseInt(cutoffStr.split('-')[0]) : new Date().getFullYear();
  const earliestYear = cutoffYear - 2;

  let rowCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (String(row[idx['纳入签约量统计']] ?? '').trim() !== '是') continue;

    const variety = String(row[idx['品种']] ?? '').trim();
    if (!variety.includes('玉米') || variety.includes('进口')) continue;

    let dateStr = '';
    let rowYear = null, rowMonth = null;
    const dateRaw = row[idx['提交时间/签约时间']];
    if (dateRaw) {
      dateStr = String(dateRaw).trim().slice(0, 10);
      if (/^\d{5}$/.test(String(dateRaw))) {
        const code = Number(dateRaw);
        const d = XLSX.SSF.parse_date_code(code);
        dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      }
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        rowYear = parseInt(parts[0]);
        rowMonth = parseInt(parts[1]);
      }
    }

    const pack = String(row[idx['包装方式']] ?? '').trim();

    // 检查包装方式是否匹配任一选中项
    let packMatch = false;
    for (const p of checkedPacks) {
      if (pack.includes(p)) {
        packMatch = true;
        break;
      }
    }
    if (!packMatch) continue;

    const dept = String(row[idx['经营部']] ?? '').trim();
    if (!DEPTS.includes(dept)) continue;

    const qty = safeFloat(row[idx['合同签订量-万吨']]);
    if (qty <= 0) continue;

    const isRailway = pack.includes('铁路');

    const inDateRange = (!startStr || !dateStr || dateStr >= startStr) &&
                        (!cutoffStr || !dateStr || dateStr <= cutoffStr);
    if (inDateRange) {
      deptData[dept].total += qty;
      if (isRailway) deptData[dept].railway += qty;
      else deptData[dept].container += qty;
      rowCount++;
    }

    if (rowYear && rowMonth && rowYear >= earliestYear && rowYear <= cutoffYear) {
      if (!monthlyData[rowYear]) monthlyData[rowYear] = {};
      if (!monthlyData[rowYear][rowMonth]) monthlyData[rowYear][rowMonth] = { total: 0 };
      monthlyData[rowYear][rowMonth].total += qty;
    }
  }

  const totalAll = round2(Object.values(deptData).reduce((s, v) => s + v.total, 0));
  const railwayAll = round2(Object.values(deptData).reduce((s, v) => s + v.railway, 0));

  return { deptData, monthlyData, totalAll, railwayAll, rowCount };
}

function refreshContainerOutput() {
  try {
    const result = calcContainerData();
    if (!result) return;

    const { deptData, monthlyData, totalAll, railwayAll, rowCount } = result;
    const region  = document.getElementById('containerRegion')?.value || '沿海大区';
    const cutoff  = document.getElementById('containerCutoffDate')?.value || '';
    const DEPTS   = ['珠三角', '粤西', '广西', '福建', '海南'];

    const cutoffLabel = cutoff ? cutoff.replace(/^\d{4}-/, '').replace('-', '/') + '日' : '';

    const planTotal = DEPTS.reduce((s, d) => s + (CONTAINER_PLAN[d] || 0), 0);
    const totalRate = planTotal > 0 ? round2(totalAll / planTotal * 100) : 0;

    let seqText = '';
    if (cutoff) {
      const seq = Utils.calcSeqRate(cutoff);
      if (seq !== null) {
        const diff = round2(totalRate - seq);
        seqText = `，较序时进度（${seq}%）${diff >= 0 ? '高' : '低'}${Math.abs(diff)}个百分点`;
      }
    }

    const currentYear = cutoff ? parseInt(cutoff.split('-')[0]) : new Date().getFullYear();
    let avgMonthly = 0;
    let monthCount = 0;
    if (monthlyData[currentYear]) {
      const months = Object.keys(monthlyData[currentYear]).map(Number).sort((a, b) => a - b);
      const cutoffMonth = cutoff ? parseInt(cutoff.split('-')[1]) : 12;
      const relevantMonths = months.filter(m => m <= cutoffMonth);
      if (relevantMonths.length > 0) {
        const sum = relevantMonths.reduce((s, m) => s + monthlyData[currentYear][m].total, 0);
        avgMonthly = round2(sum / relevantMonths.length);
        monthCount = relevantMonths.length;
      }
    }

    let text = `截至${cutoffLabel}，${region}内贸玉米集装箱销售签约${totalAll}万吨`;
    if (railwayAll > 0) {
      text += `（含铁路${railwayAll}万吨）`;
    }
    text += `，年度任务完成率${totalRate}%${seqText}。`;
    if (monthCount > 0 && avgMonthly > 0) {
      text += `前${monthCount}个月平均每月销售${avgMonthly}万吨，离月均8-9万吨的目标仍有一定距离。`;
    }

    document.getElementById('containerEmptyState').style.display = 'none';
    document.getElementById('containerResultArea').style.display = 'block';
    document.getElementById('containerTextOutput').innerHTML = `<div class="text-para">${text}</div>`;

    renderContainerTable(deptData, DEPTS, region);
    renderContainerChart(monthlyData);
    renderContainerMonthlyTable(monthlyData);

    updateFlowSequence(3);
    showToast('✅ 计算完成，共解析 ' + rowCount + ' 条记录');

  } catch(err) {
    showToast('❌ 计算失败：' + err.message);
    console.error(err);
  }
}

function renderContainerTable(deptData, depts, region) {
  const table = document.getElementById('containerTable');
  const displayDepts = [...depts, region];

  const thead = `<thead><tr>
    <th class="th-dept" style="background:#1254cc">经营部</th>
    <th style="background:#1254cc">预算指标</th>
    <th style="background:#1a6ef5">集装箱</th>
    <th style="background:#1a6ef5">铁路</th>
    <th style="background:#1a6ef5">合计</th>
    <th style="background:#1a6ef5">完成率</th>
  </tr></thead>`;

  const totalRow = { total: 0, container: 0, railway: 0, plan: 0 };
  depts.forEach(d => {
    totalRow.total += deptData[d].total;
    totalRow.container += deptData[d].container;
    totalRow.railway += deptData[d].railway;
    totalRow.plan  += CONTAINER_PLAN[d] || 0;
  });
  totalRow.total = round2(totalRow.total);
  totalRow.container = round2(totalRow.container);
  totalRow.railway = round2(totalRow.railway);

  let tbody = '<tbody>';
  displayDepts.forEach((dept, idx) => {
    const isTotal = (dept === region || dept === '沿海大区');
    const data = isTotal ? totalRow : deptData[dept];
    const plan = isTotal ? totalRow.plan : (CONTAINER_PLAN[dept] || 0);
    const rate = plan > 0 ? round2(data.total / plan * 100) : 0;
    const rateStr = plan > 0 ? rate + '%' : '-';
    const rateCls = rate >= 80 ? 'rate-success' : rate >= 60 ? 'rate-warning' : 'rate-danger';
    const trCls = isTotal ? 'tr-total' : (idx % 2 === 1 ? 'tr-even' : '');

    tbody += `<tr class="${trCls}">
      <td class="td-dept">${dept}</td>
      <td class="td-plan" style="text-align:center">${plan > 0 ? plan : '-'}</td>
      <td class="td-num">${data.container > 0 ? round2(data.container) : '-'}</td>
      <td class="td-num">${data.railway > 0 ? round2(data.railway) : '-'}</td>
      <td class="td-num"><b>${data.total > 0 ? round2(data.total) : '-'}</b></td>
      <td class="td-rate ${rateCls}">${rateStr}</td>
    </tr>`;
  });
  tbody += '</tbody>';
  table.innerHTML = thead + tbody;
}

function renderContainerMonthlyTable(monthlyData) {
  const table = document.getElementById('containerMonthlyTable');
  if (!table) return;

  const years = Object.keys(monthlyData).map(Number).sort((a, b) => a - b);
  if (years.length === 0) {
    table.innerHTML = '<tr><td colspan="13" style="text-align:center;color:#999">暂无数据</td></tr>';
    return;
  }

  const labels = ['月份', '1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  let thead = '<thead><tr>';
  labels.forEach(l => {
    thead += `<th style="background:#1254cc;color:#fff;padding:8px 6px;text-align:center;font-size:12px">${l}</th>`;
  });
  thead += '</tr></thead>';

  const yearColors = {
    '2024': '#2563eb',
    '2025': '#16a34a',
    '2026': '#dc2626',
  };

  let tbody = '<tbody>';
  years.forEach(year => {
    tbody += `<tr style="border-bottom:1px solid #e8e8e8">`;
    tbody += `<td style="background:#f8fafc;font-weight:700;color:${yearColors[year] || '#666'}">${year}年</td>`;
    for (let m = 1; m <= 12; m++) {
      const v = monthlyData[year]?.[m]?.total;
      const val = v !== undefined && v > 0 ? round2(v) : '-';
      tbody += `<td style="text-align:right;padding:6px 8px;font-size:12px;color:#333">${val}</td>`;
    }
    const total = Object.values(monthlyData[year] || {}).reduce((sum, m) => sum + (m?.total || 0), 0);
    tbody += `</tr>`;
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
}

function renderContainerChart(monthlyData) {
  const ctx = document.getElementById('containerChart');
  if (!ctx) return;

  if (containerChartInstance) {
    containerChartInstance.destroy();
    containerChartInstance = null;
  }

  const years = Object.keys(monthlyData).map(Number).sort((a, b) => a - b);
  if (years.length === 0) {
    ctx.style.display = 'none';
    return;
  }
  ctx.style.display = '';

  const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const datasets = [];
  const yearColors = {
    '2024': { border: '#2563eb', bg: 'rgba(37,99,235,0.1)', name: '2024年' },
    '2025': { border: '#16a34a', bg: 'rgba(22,163,74,0.1)', name: '2025年' },
    '2026': { border: '#dc2626', bg: 'rgba(220,38,38,0.1)', name: '2026年' },
  };

  years.forEach((year) => {
    const data = [];
    for (let m = 1; m <= 12; m++) {
      const v = monthlyData[year]?.[m]?.total;
      data.push(v !== undefined ? round2(v) : null);
    }
    const c = yearColors[year] || { border: '#6b7280', bg: 'rgba(107,114,128,0.1)', name: year + '年' };
    datasets.push({
      label: c.name,
      data,
      borderColor: c.border,
      backgroundColor: c.bg,
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
      spanGaps: false,
    });
  });

  containerChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: false },
        legend: { position: 'bottom', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y + ' 万吨';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: '万吨' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function downloadContainerChart() {
  const canvas = document.getElementById('containerChart');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = '集装箱玉米月度趋势.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function copyContainerText() {
  const el = document.getElementById('containerTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

window.containerWorkbook = containerWorkbook;
window.containerChartInstance = containerChartInstance;
window.CONTAINER_PLAN = CONTAINER_PLAN;
window.handleContainerDrop = handleContainerDrop;
window.handleContainerFile = handleContainerFile;
window.processContainerFile = processContainerFile;
window.getContainerWorkbook = getContainerWorkbook;
window.calcContainerData = calcContainerData;
window.refreshContainerOutput = refreshContainerOutput;
window.renderContainerTable = renderContainerTable;
window.renderContainerChart = renderContainerChart;
window.downloadContainerChart = downloadContainerChart;
window.copyContainerText = copyContainerText;