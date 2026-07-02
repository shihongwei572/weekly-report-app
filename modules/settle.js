const SETTLE_DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
const COL_MAP = [
  { name: '内贸玉米', key: '国产玉米' },
  { name: '进口高粱', key: '进口高粱' },
  { name: '进口大麦', key: '进口大麦' },
  { name: '进口木薯片', key: '进口木薯片' },
  { name: '进口葵花籽粕', key: '进口葵花籽粕' },
  { name: '进口DDGS', key: 'DDGS' },
  { name: '小麦', key: '小麦' },
  { name: '食用稻谷', key: '食用稻谷' },
  { name: '大豆', key: '大豆' }
];

const SETTLE_GROUPS = [
  { key: '国产玉米', label: '国产玉米', varieties: ['国产玉米'] },
  { key: '进口高粱组', label: '进口替代', varieties: ['进口高粱', '进口大麦', '进口木薯片', '进口葵花籽粕', 'DDGS'] },
  { key: '小麦', label: '小麦', varieties: ['小麦'] },
  { key: '稻谷', label: '稻谷', varieties: ['食用稻谷'] },
  { key: '进口大豆', label: '大豆', varieties: ['大豆'] }
];

var settleWorkbook = null;
let settleResult = null;

function parseNum(v) {
  const s = String(v || '').trim().replace(/,/g, '');
  if (!s || s === '-') return 0;
  return parseFloat(s) || 0;
}

function handleDirectSettlePaste() {
  let text = document.getElementById('settlePasteArea')?.value || '';
  if (!text.trim()) {
    setStatus('err', '❌ 请先粘贴数据！');
    return;
  }

  const allCells = text.replace(/[\r\n]+/g, '\t').split(/\t/).map(c => c.trim());
  if (allCells.length < 10) {
    setStatus('err', '❌ 数据不足！');
    return;
  }

  const colIndex = {};
  for (let i = 0; i < allCells.length; i++) {
    const cell = allCells[i];
    for (const col of COL_MAP) {
      if (cell.includes(col.name)) {
        colIndex[col.key] = i;
      }
    }
  }

  if (Object.keys(colIndex).length < 9) {
    setStatus('err', '❌ 找不到对应的品种列，请检查粘贴的数据！');
    return;
  }

  const headerFirstIdx = allCells.findIndex(c => c.includes('结算量') || c.includes('经营部'));

  const deptData = {};
  SETTLE_DEPTS.forEach(d => {
    deptData[d] = {};
    COL_MAP.forEach(c => { deptData[d][c.key] = 0; });
  });

  for (const d of SETTLE_DEPTS) {
    const deptIdx = allCells.indexOf(d);
    if (deptIdx < 0) continue;

    let nextIdx = allCells.length;
    for (const other of [...SETTLE_DEPTS, '合计']) {
      const idx = allCells.indexOf(other, deptIdx + 1);
      if (idx > deptIdx && idx < nextIdx) nextIdx = idx;
    }

    const rowCells = allCells.slice(deptIdx, nextIdx);
    if (rowCells.length < 2) continue;

    for (const col of COL_MAP) {
      const colOffset = colIndex[col.key] - headerFirstIdx;
      if (colOffset < 0 || colOffset >= rowCells.length) continue;
      deptData[d][col.key] = parseNum(rowCells[colOffset]);
    }
  }

  const totals = {};
  COL_MAP.forEach(col => {
    totals[col.key] = SETTLE_DEPTS.reduce((sum, d) => sum + deptData[d][col.key], 0);
  });

  settleResult = { deptData, totals };
  settleWorkbook = { __isPasteData: true };

  renderResult();
  setStatus('ok', '✅ 解析成功！');
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function renderResult() {
  if (!settleResult) return;
  const { deptData, totals } = settleResult;

  // 计算各组结算汇总
  const groupSettle = {};
  SETTLE_GROUPS.forEach(g => {
    groupSettle[g.key] = round2(g.varieties.reduce((s, v) => s + (totals[v] || 0), 0));
  });

  // 各经营部结算汇总
  const deptSettle = {};
  SETTLE_DEPTS.forEach(d => {
    const data = deptData[d];
    let sum = 0;
    for (const g of SETTLE_GROUPS) {
      for (const v of g.varieties) {
        sum += data[v] || 0;
      }
    }
    deptSettle[d] = round2(sum);
  });

  const totalAll = round2(Object.values(totals).reduce((a, b) => a + b, 0));

  // 总完成率
  const regionPlan = CONFIG.contractPlan['沿海大区'];
  const regionPlanTotal = regionPlan ? regionPlan['合计'] : 0;
  const regionRate = regionPlanTotal > 0 ? round2(totalAll / regionPlanTotal * 100) : 0;

  // 第一段：结算总量
  let text = `本年累计销售结算${totalAll}万吨。`;
  text += `其中内贸玉米${round2(totals['国产玉米'])}万吨，`;
  text += `进口高粱${round2(totals['进口高粱'])}万吨，`;
  text += `进口大麦${round2(totals['进口大麦'])}万吨，`;
  text += `进口木薯片${round2(totals['进口木薯片'])}万吨，`;
  text += `DDGS${round2(totals['DDGS'])}万吨，`;
  text += `小麦${round2(totals['小麦'])}万吨，稻谷${round2(totals['食用稻谷'])}万吨，大豆${round2(totals['大豆'])}万吨。`;

  // 第二段：各品种组完成比例
  let varietyParts = [];
  SETTLE_GROUPS.forEach(g => {
    const planVal = regionPlan ? (regionPlan[g.key] || 0) : 0;
    const settleVal = groupSettle[g.key];
    const rate = planVal > 0 ? round2(settleVal / planVal * 100) : 0;
    varietyParts.push(`${g.key === '进口大豆' ? '大豆' : (g.key === '进口高粱组' ? '进口替代' : g.key)}计划${planVal}万吨，结算${settleVal}万吨，完成${rate}%`);
  });
  text += `按品种看，${varietyParts.join('；')}。`;

  // 第三段：各经营部完成比例
  let deptParts = [];
  SETTLE_DEPTS.forEach(d => {
    const plan = CONFIG.contractPlan[d];
    const planTotal = plan ? plan['合计'] : 0;
    const settleVal = deptSettle[d];
    const rate = planTotal > 0 ? round2(settleVal / planTotal * 100) : 0;
    deptParts.push(`${d}计划${planTotal}万吨，结算${settleVal}万吨，完成${rate}%`);
  });
  text += `分经营部看，${deptParts.join('；')}。`;

  // 第四段：总结
  text += `沿海大区年度任务计划${regionPlanTotal}万吨，整体完成率${regionRate}%。`;

  document.getElementById('settleEmptyState').style.display = 'none';
  document.getElementById('settleResultArea').style.display = 'block';
  document.getElementById('settleTextOutput').innerHTML = `<div class="text-para">${text}</div>`;

  const table = document.getElementById('settleTable');
  const displayDepts = [...SETTLE_DEPTS, '合计'];
  const colLabels = COL_MAP.map(c => c.key);

  let thead = '<thead><tr><th class="th-dept">经营部</th>';
  colLabels.forEach(l => { thead += `<th class="th-group">${l}</th>`; });
  thead += '<th class="th-group th-group-total">合计</th></tr></thead>';

  let tbody = '<tbody>';
  displayDepts.forEach((dept, rowIdx) => {
    const isTotal = (dept === '合计');
    const data = isTotal ? totals : deptData[dept];
    const trCls = isTotal ? 'tr-total' : (rowIdx % 2 === 1 ? 'tr-even' : '');

    const vals = COL_MAP.map(col => data[col.key]);
    const rowSum = round2(vals.reduce((a, b) => a + b, 0));

    let tr = `<tr class="${trCls}"><td class="td-dept">${dept}</td>`;
    vals.forEach(v => {
      const val = round2(v);
      tr += `<td class="td-num">${val > 0 ? val : '-'}</td>`;
    });
    tr += `<td class="td-num td-total">${rowSum > 0 ? rowSum : '-'}</td>`;
    tr += '</tr>';
    tbody += tr;
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;

  renderPlanCompletionTable(deptData, totals);

  updateFlowSequence(3);
  showToast('✅ 生成成功！');
}

function renderPlanCompletionTable(deptData, totals) {
  const planTable = document.getElementById('settlePlanTable');
  if (!planTable) return;

  const displayDepts = [...SETTLE_DEPTS, '沿海大区'];

  const thead = '<thead><tr>' +
    '<th class="th-dept">经营部</th>' +
    '<th class="th-group">计划(万吨)</th>' +
    '<th class="th-group">结算(万吨)</th>' +
    '<th class="th-group">完成率</th>' +
    '</tr></thead>';

  let tbody = '<tbody>';
  displayDepts.forEach((dept, rowIdx) => {
    const isTotal = (dept === '沿海大区');
    const trCls = isTotal ? 'tr-total' : (rowIdx % 2 === 1 ? 'tr-even' : '');

    const plan = CONFIG.contractPlan[dept];
    const data = isTotal ? totals : deptData[dept];

    let settleSum = 0;
    for (const group of SETTLE_GROUPS) {
      for (const v of group.varieties) {
        settleSum += data[v] || 0;
      }
    }
    settleSum = round2(settleSum);

    const planTotal = plan['合计'] || 0;
    const rate = planTotal > 0 ? round2(settleSum / planTotal * 100) : 0;
    const rateCls = rate >= 80 ? 'rate-success' : rate >= 60 ? 'rate-warning' : 'rate-danger';

    tbody += `<tr class="${trCls}">` +
      `<td class="td-dept">${dept}</td>` +
      `<td class="td-num">${planTotal > 0 ? planTotal : '-'}</td>` +
      `<td class="td-num">${settleSum > 0 ? settleSum : '-'}</td>` +
      `<td class="td-rate ${rateCls}">${planTotal > 0 ? rate + '%' : '-'}</td>` +
      '</tr>';
  });
  tbody += '</tbody>';

  planTable.innerHTML = thead + tbody;
}

function calcSettleData() {
  return settleResult || null;
}

function setStatus(type, msg) {
  const el = document.getElementById('settlePasteStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'status-err' : 'status-ok');
  el.textContent = msg;
  el.style.display = 'block';
}

function copySettleText() {
  const el = document.getElementById('settleTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

window.settleWorkbook = settleWorkbook;
window.handleDirectSettlePaste = handleDirectSettlePaste;
window.copySettleText = copySettleText;
window.calcSettleData = calcSettleData;
