var settleWorkbook = null;

const SETTLE_VARIETY_MAP = getConfig('settleVarietyMap') || CONFIG.settleVarietyMap;

function mapSettleVariety(rawVariety) {
  const v = String(rawVariety || '');
  for (const g of SETTLE_VARIETY_MAP) {
    if (g.match.some(m => v.includes(m))) return g.key;
  }
  return null;
}

function setSettleStatus(type, msg) {
  const el = document.getElementById('settleUploadStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'status-err' : 'status-ok');
  el.textContent = msg;
}

function handleSettleDrop(e) {
  e.preventDefault();
  document.getElementById('settleUploadZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processSettleFile(file);
}

function handleSettleFile(e) {
  const file = e.target.files[0];
  if (file) processSettleFile(file);
}

function processSettleFile(file) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    setSettleStatus('err', '❌ 请上传 .xlsx 或 .xls 格式文件');
    return;
  }
  setSettleStatus('ok', '⏳ 正在解析...');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      settleWorkbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      setSettleStatus('ok', `✅ 已加载：${file.name}`);
      showToast('文件解析成功，正在计算...');
      refreshSettleOutput();
    } catch (err) {
      setSettleStatus('err', '❌ 解析失败：' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function calcSettleData() {
  if (!settleWorkbook) return null;

  if (settleWorkbook.__isOCRData) {
    return window.settleOCRData || parseSettleTableFromOCRManual();
  }

  const ws   = settleWorkbook.Sheets[settleWorkbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  if (rows.length < 2) return null;

  const header = rows[0].map(v => String(v ?? '').trim());
  const H = {};
  header.forEach((h, i) => { H[h] = i; });

  const iDate    = H['审批结束日期']   ?? -1;
  const iQty     = H['本次发货量(吨)'] ?? -1;
  const iVariety = H['品种']           ?? -1;
  const iGroup   = H['销售组']         ?? -1;

  if (iQty < 0 || iVariety < 0) {
    showToast('❌ 找不到「本次发货量(吨)」或「品种」列');
    return null;
  }

  const cutoffStr = document.getElementById('settleCutoffDate')?.value || '';

  const deptData = {};
  const DEPTS_SETTLE = ['珠三角', '粤西', '广西', '海南', '福建'];
  DEPTS_SETTLE.forEach(d => {
    deptData[d] = { '国产玉米': 0, '进口高粱组': 0, '小麦': 0, '稻谷': 0, '进口大豆': 0 };
  });

  let rowCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (cutoffStr && iDate >= 0) {
      const dateVal = String(row[iDate] ?? '').trim().slice(0, 10);
      if (dateVal && dateVal > cutoffStr) continue;
    }

    const qty = safeFloat(row[iQty]);
    if (qty <= 0) continue;

    const rawVariety = String(row[iVariety] ?? '').trim();
    const groupKey   = mapSettleVariety(rawVariety);
    if (!groupKey) continue;

    const salesGroup = String(row[iGroup] ?? '').trim();
    let dept = null;
    for (const d of DEPTS_SETTLE) {
      if (salesGroup.includes(d) && salesGroup.includes('经营部')) { dept = d; break; }
    }
    if (!dept) continue;

    deptData[dept][groupKey] += qty;
    rowCount++;
  }

  const total = { '国产玉米': 0, '进口高粱组': 0, '小麦': 0, '稻谷': 0, '进口大豆': 0 };
  DEPTS_SETTLE.forEach(d => {
    Object.keys(total).forEach(k => { total[k] += deptData[d][k]; });
  });

  return { deptData, total, rowCount };
}

function refreshSettleOutput() {
  try {
    const result = calcSettleData();
    if (!result) return;

    const { deptData, total, rowCount } = result;
    const region  = document.getElementById('settleRegion')?.value || '沿海大区';
    const cutoff  = document.getElementById('settleCutoffDate')?.value || '';
    const groups  = CONFIG.contractGroups;
    const DEPTS   = ['珠三角', '粤西', '广西', '海南', '福建'];
    const CONTRACT_PLAN_DATA = getConfig('contractPlan') || CONFIG.contractPlan;

    const toW = v => round2(v / 10000);

    const cutoffLabel = cutoff ? cutoff.replace(/^\d{4}-/, '').replace('-', '/') + '日，' : '';
    const totalByGroup = {};
    groups.forEach(g => { totalByGroup[g.key] = toW(total[g.key]); });
    const totalAll = round2(Object.values(totalByGroup).reduce((s, v) => s + v, 0));

    let textParts = [`截至${cutoffLabel}${region}本年累计销售结算${totalAll}万吨。`];

    textParts.push(`其中内贸玉米${totalByGroup['国产玉米']}万吨，`);
    textParts.push(`进口替代${totalByGroup['进口高粱组']}万吨`);
    textParts.push(`；小麦${totalByGroup['小麦']}万吨，稻谷${totalByGroup['稻谷']}万吨，大豆${totalByGroup['进口大豆']}万吨。`);

    const planTotal = (CONTRACT_PLAN_DATA[region] || CONTRACT_PLAN_DATA['沿海大区'] || {})['合计'] || 0;
    if (planTotal > 0) {
      const rate = round2(totalAll / planTotal * 100);
      let seqRate = '';
      if (cutoff) {
        const seq = Utils.calcSeqRate(cutoff);
        if (seq !== null) {
          const diff = round2(rate - seq);
          seqRate = `${region}年度任务完成率${rate}%（结算口径），较目前序时进度（${seq}%）${diff >= 0 ? '高' : '低'}${Math.abs(diff)}个百分点。`;
        }
      } else {
        seqRate = `${region}年度任务完成率${rate}%（结算口径）。`;
      }
      textParts.push(seqRate);
    }

    const settleText = textParts.join('');

    document.getElementById('settleEmptyState').style.display = 'none';
    document.getElementById('settleResultArea').style.display = 'block';
    document.getElementById('settleTextOutput').innerHTML = `<div class="text-para">${settleText}</div>`;

    renderSettleTable(deptData, total, groups, DEPTS, region, toW);

    updateFlowSequence(3);
    showToast(`✅ 计算完成，共解析 ${rowCount} 条记录`);

  } catch (err) {
    showToast('❌ 计算失败：' + err.message);
    console.error(err);
  }
}

function renderSettleTable(deptData, total, groups, depts, region, toW) {
  const table = document.getElementById('settleTable');
  const displayDepts = [...depts, region];
  const CONTRACT_PLAN_DATA = getConfig('contractPlan') || CONFIG.contractPlan;

  let tr1 = '<tr>';
  tr1 += '<th class="th-dept" rowspan="2">经营部</th>';
  groups.forEach(g => {
    tr1 += `<th colspan="3" class="th-group">${g.label}</th>`;
  });
  tr1 += '<th colspan="3" class="th-group th-group-total">合计</th>';
  tr1 += '</tr>';

  let tr2 = '<tr>';
  for (let i = 0; i < groups.length + 1; i++) {
    tr2 += '<th class="th-sub th-sub-signed">结算量</th>';
    tr2 += '<th class="th-sub th-sub-plan">计划量</th>';
    tr2 += '<th class="th-sub th-sub-rate">完成率</th>';
  }
  tr2 += '</tr>';

  const thead = `<thead>${tr1}${tr2}</thead>`;

  let tbody = '<tbody>';
  displayDepts.forEach((dept, rowIdx) => {
    const isTotal = (dept === region || dept === '沿海大区');
    const data    = isTotal ? total : (deptData[dept] || {});
    const planRow = CONTRACT_PLAN_DATA[dept] || CONTRACT_PLAN_DATA['沿海大区'] || {};
    const trCls   = isTotal ? 'tr-total' : (rowIdx % 2 === 1 ? 'tr-even' : '');

    let tr = `<tr class="${trCls}">`;
    tr += `<td class="td-dept">${dept}</td>`;

    let totalSettle = 0;
    let totalPlan   = 0;

    groups.forEach(g => {
      const sWan   = toW(data[g.key] || 0);
      const pWan   = planRow[g.key] || 0;
      const rate   = pWan > 0 ? round2(sWan / pWan * 100) : 0;
      const rateStr = pWan > 0 ? rate + '%' : '-';
      const rateCls = rate >= 80 ? 'rate-success' : rate >= 60 ? 'rate-warning' : (pWan > 0 ? 'rate-danger' : '');
      totalSettle += sWan;
      totalPlan   += pWan;

      tr += `<td class="td-num">${sWan > 0 ? sWan : '-'}</td>`;
      tr += `<td class="td-plan">${pWan > 0 ? pWan : '-'}</td>`;
      tr += `<td class="td-rate ${rateCls}">${rateStr}</td>`;
    });

    totalSettle = round2(totalSettle);
    totalPlan   = round2(totalPlan);
    const tRate    = totalPlan > 0 ? round2(totalSettle / totalPlan * 100) : 0;
    const tRateStr = totalPlan > 0 ? tRate + '%' : '-';
    const tRateCls = tRate >= 80 ? 'rate-success' : tRate >= 60 ? 'rate-warning' : (totalPlan > 0 ? 'rate-danger' : '');

    tr += `<td class="td-num">${totalSettle > 0 ? totalSettle : '-'}</td>`;
    tr += `<td class="td-plan">${totalPlan > 0 ? totalPlan : '-'}</td>`;
    tr += `<td class="td-rate ${tRateCls}">${tRateStr}</td>`;
    tr += '</tr>';
    tbody += tr;
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
}

function copySettleText() {
  const el = document.getElementById('settleTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

window.settleWorkbook = settleWorkbook;
window.handleSettleDrop = handleSettleDrop;
window.handleSettleFile = handleSettleFile;
window.processSettleFile = processSettleFile;
window.calcSettleData = calcSettleData;
window.refreshSettleOutput = refreshSettleOutput;
window.renderSettleTable = renderSettleTable;
window.copySettleText = copySettleText;
window.mapSettleVariety = mapSettleVariety;