var lastmileWorkbook = null;

const LASTMILE_DEPT_PLAN = getConfig('lastmileDeptPlan') || CONFIG.lastmileDeptPlan;
const LASTMILE_VARIETY_PLAN = getConfig('lastmileVarietyPlan') || CONFIG.lastmileVarietyPlan;

function mapLastmileVariety(raw) {
  const v = String(raw || '');
  if (v.includes('玉米')) return '国产玉米';
  if (v.includes('麦'))   return '小麦';
  if (v.includes('稻谷') || v.includes('籼') || v.includes('粳')) return '稻谷';
  if (v.includes('大豆') || v.includes('塔豆')) return '大豆';
  return null;
}

function setLastmileStatus(type, msg) {
  const el = document.getElementById('lastmileUploadStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'err' : 'ok');
  el.textContent = msg;
}

function handleLastmileDrop(e) {
  e.preventDefault();
  document.getElementById('lastmileUploadZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processLastmileFile(file);
}

function handleLastmileFile(e) {
  const file = e.target.files[0];
  if (file) processLastmileFile(file);
}

function processLastmileFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      lastmileWorkbook = XLSX.read(e.target.result, { type: 'array', cellDates: false });
      setLastmileStatus('ok', '✅ 已加载：' + file.name);
      const zone = document.getElementById('lastmileUploadZone');
      const placeholder = zone.querySelector('.upload-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `<div class="upload-icon">✅</div>
          <p style="color:var(--success)">${file.name}</p>
          <small>点击重新上传</small>`;
        placeholder.onclick = () => document.getElementById('lastmileFileInput').click();
      }
      updateFlowSequence(1);
      refreshLastmileOutput();
    } catch(err) {
      setLastmileStatus('err', '❌ 读取失败：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function calcLastmileData() {
  const wb = getLastmileWorkbook();
  if (!wb) return null;

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) return null;

  const header = rows[0];
  const idx = {};
  const NEED = ['纳入签约量统计', '提交时间/签约时间', '合同签订量-万吨', '品种', '经营部', '提货方式'];
  NEED.forEach(k => { idx[k] = header.indexOf(k); });

  for (const k of NEED) {
    if (idx[k] < 0) throw new Error('找不到列：' + k);
  }

  const startStr  = document.getElementById('lastmileStartDate')?.value || '';
  const cutoffStr = document.getElementById('lastmileCutoffDate')?.value || '';
  const DEPTS    = ['珠三角', '粤西', '广西', '海南', '福建'];
  const VARIETIES = ['国产玉米', '小麦', '稻谷', '大豆'];

  const deptData = {};
  DEPTS.forEach(d => { deptData[d] = { total: 0, lastmile: 0 }; });

  const varietyData = {};
  VARIETIES.forEach(v => { varietyData[v] = { total: 0, lastmile: 0 }; });

  let rowCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (String(row[idx['纳入签约量统计']] ?? '').trim() !== '是') continue;

    let dateStr = '';
    const dateRaw = row[idx['提交时间/签约时间']];
    if (dateRaw) {
      dateStr = String(dateRaw).trim().slice(0, 10);
      if (/^\d{5}$/.test(String(dateRaw))) {
        const code = Number(dateRaw);
        const d = XLSX.SSF.parse_date_code(code);
        dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      }
    }
    if (startStr && dateStr && dateStr < startStr) continue;
    if (cutoffStr && dateStr && dateStr > cutoffStr) continue;

    const qty = safeFloat(row[idx['合同签订量-万吨']]);
    if (qty <= 0) continue;

    const dept = String(row[idx['经营部']] ?? '').trim();
    if (!DEPTS.includes(dept)) continue;

    const rawVariety = String(row[idx['品种']] ?? '').trim();
    const variety = mapLastmileVariety(rawVariety);
    if (!variety) continue;

    const lastmileMode = (document.getElementById('lastmileTihuoMode')?.value || '配送').trim();
    const tihuo = String(row[idx['提货方式']] ?? '').trim();
    const isLastmile = (tihuo === lastmileMode);

    deptData[dept].total    += qty;
    varietyData[variety].total += qty;
    if (isLastmile) {
      deptData[dept].lastmile    += qty;
      varietyData[variety].lastmile += qty;
    }
    rowCount++;
  }

  const totalAll    = round2(Object.values(deptData).reduce((s, v) => s + v.total, 0));
  const lastmileAll = round2(Object.values(deptData).reduce((s, v) => s + v.lastmile, 0));

  return { deptData, varietyData, totalAll, lastmileAll, rowCount };
}

function refreshLastmileOutput() {
  try {
    const result = calcLastmileData();
    if (!result) return;

    const { deptData, varietyData, totalAll, lastmileAll, rowCount } = result;
    const region   = document.getElementById('lastmileRegion')?.value || '沿海大区';
    const cutoff   = document.getElementById('lastmileCutoffDate')?.value || '';
    const DEPTS    = ['珠三角', '粤西', '广西', '海南', '福建'];
    const VARIETIES = ['国产玉米', '小麦', '稻谷', '大豆'];

    const cutoffLabel = cutoff ? cutoff.replace(/^\d{4}-/, '').replace('-', '/') + '日，' : '';
    const totalRate = totalAll > 0 ? round2(lastmileAll / totalAll * 100) : 0;
    const planRate  = LASTMILE_DEPT_PLAN[region] || 28;
    const achieved  = totalRate >= planRate;

    let minDept = '', minRate = Infinity;
    DEPTS.forEach(d => {
      const t = deptData[d].total;
      const r = t > 0 ? round2(deptData[d].lastmile / t * 100) : 0;
      const p = LASTMILE_DEPT_PLAN[d] || 30;
      if (r < p && r < minRate) { minRate = r; minDept = d; }
    });

    let text = `截至${cutoffLabel}${region}本年最后一公里销售签约${lastmileAll}万吨，签约占比${totalRate}%，`;
    text += achieved ? '已达成大区任务目标。' : `尚未达成大区任务目标（目标${planRate}%）。`;
    if (minDept) {
      text += `其中${minDept}最后一公里销售签约占比仅${minRate}%，需重点抓最后一公里销售。`;
    }

    document.getElementById('lastmileEmptyState').style.display = 'none';
    document.getElementById('lastmileResultArea').style.display = 'block';
    document.getElementById('lastmileTextOutput').innerHTML = `<div class="text-para">${text}</div>`;

    renderLastmileDeptTable(deptData, DEPTS, region);
    renderLastmileVarietyTable(varietyData, VARIETIES);

    updateFlowSequence(3);
    showToast('✅ 计算完成，共解析 ' + rowCount + ' 条记录');

  } catch(err) {
    showToast('❌ 计算失败：' + err.message);
    console.error(err);
  }
}

function renderLastmileDeptTable(deptData, depts, region) {
  const table = document.getElementById('lastmileDeptTable');
  const displayDepts = [...depts, region];

  const thead = `<thead><tr>
    <th class="th-dept" style="background:#1254cc">经营部</th>
    <th style="background:#1254cc">预算指标</th>
    <th style="background:#1a6ef5">最后一公里签约(万吨)</th>
    <th style="background:#1a6ef5">最后一公里占比</th>
  </tr></thead>`;

  const totalRow = { total: 0, lastmile: 0 };
  depts.forEach(d => {
    totalRow.total    += deptData[d].total;
    totalRow.lastmile += deptData[d].lastmile;
  });
  totalRow.total    = round2(totalRow.total);
  totalRow.lastmile = round2(totalRow.lastmile);

  let tbody = '<tbody>';
  displayDepts.forEach((dept, idx) => {
    const isTotal = (dept === region || dept === '沿海大区');
    const data = isTotal ? totalRow : (deptData[dept] || { total: 0, lastmile: 0 });
    const planRate = LASTMILE_DEPT_PLAN[dept] ?? (isTotal ? 28 : 30);
    const lmRate   = data.total > 0 ? round2(data.lastmile / data.total * 100) : 0;
    const rateCls  = lmRate >= planRate ? 'rate-success' : lmRate >= planRate * 0.8 ? 'rate-warning' : 'rate-danger';
    const trCls    = isTotal ? 'tr-total' : (idx % 2 === 1 ? 'tr-even' : '');

    tbody += `<tr class="${trCls}">
      <td class="td-dept">${dept}</td>
      <td class="td-plan" style="text-align:center">${planRate}%</td>
      <td class="td-num">${data.lastmile > 0 ? round2(data.lastmile) : '-'}</td>
      <td class="td-rate ${rateCls}">${data.total > 0 ? lmRate + '%' : '-'}</td>
    </tr>`;
  });
  tbody += '</tbody>';
  table.innerHTML = thead + tbody;
}

function renderLastmileVarietyTable(varietyData, varieties) {
  const table = document.getElementById('lastmileVarietyTable');

  const thead = `<thead><tr>
    <th class="th-dept" style="background:#1254cc">品种</th>
    <th style="background:#1254cc">预算指标</th>
    <th style="background:#1a6ef5">最后一公里签约(万吨)</th>
    <th style="background:#1a6ef5">最后一公里占比</th>
  </tr></thead>`;

  const totalRow = { total: 0, lastmile: 0 };
  varieties.forEach(v => {
    totalRow.total    += varietyData[v]?.total || 0;
    totalRow.lastmile += varietyData[v]?.lastmile || 0;
  });
  totalRow.total    = round2(totalRow.total);
  totalRow.lastmile = round2(totalRow.lastmile);

  let tbody = '<tbody>';
  varieties.forEach((variety, idx) => {
    const data = varietyData[variety] || { total: 0, lastmile: 0 };
    const planRate = LASTMILE_VARIETY_PLAN[variety] || 30;
    const lmRate   = data.total > 0 ? round2(data.lastmile / data.total * 100) : 0;
    const rateCls  = lmRate >= planRate ? 'rate-success' : lmRate >= planRate * 0.8 ? 'rate-warning' : 'rate-danger';
    const trCls    = idx % 2 === 1 ? 'tr-even' : '';

    tbody += `<tr class="${trCls}">
      <td class="td-dept">${variety}</td>
      <td class="td-plan" style="text-align:center">${planRate}%</td>
      <td class="td-num">${data.lastmile > 0 ? round2(data.lastmile) : '-'}</td>
      <td class="td-rate ${rateCls}">${data.total > 0 ? lmRate + '%' : '-'}</td>
    </tr>`;
  });

  const totalPlan = LASTMILE_DEPT_PLAN['沿海大区'] || 28;
  const totalRate = totalRow.total > 0 ? round2(totalRow.lastmile / totalRow.total * 100) : 0;
  const totalRateCls = totalRate >= totalPlan ? 'rate-success' : totalRate >= totalPlan * 0.8 ? 'rate-warning' : 'rate-danger';
  tbody += `<tr class="tr-total">
    <td class="td-dept">总计</td>
    <td class="td-plan" style="text-align:center">${totalPlan}%</td>
    <td class="td-num">${totalRow.lastmile > 0 ? totalRow.lastmile : '-'}</td>
    <td class="td-rate ${totalRateCls}">${totalRow.total > 0 ? totalRate + '%' : '-'}</td>
  </tr>`;
  tbody += '</tbody>';
  table.innerHTML = thead + tbody;
}

function copyLastmileText() {
  const el = document.getElementById('lastmileTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

function getLastmileWorkbook() {
  if (lastmileWorkbook) return lastmileWorkbook;
  if (containerWorkbook) return containerWorkbook;
  return null;
}

window.lastmileWorkbook = lastmileWorkbook;
window.LASTMILE_DEPT_PLAN = LASTMILE_DEPT_PLAN;
window.LASTMILE_VARIETY_PLAN = LASTMILE_VARIETY_PLAN;
window.handleLastmileDrop = handleLastmileDrop;
window.handleLastmileFile = handleLastmileFile;
window.processLastmileFile = processLastmileFile;
window.calcLastmileData = calcLastmileData;
window.refreshLastmileOutput = refreshLastmileOutput;
window.renderLastmileDeptTable = renderLastmileDeptTable;
window.renderLastmileVarietyTable = renderLastmileVarietyTable;
window.copyLastmileText = copyLastmileText;
window.getLastmileWorkbook = getLastmileWorkbook;
window.mapLastmileVariety = mapLastmileVariety;