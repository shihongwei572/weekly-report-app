const SETTLE_DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
const COL_MAP = [
  { name: '内贸玉米', key: 'corn' },
  { name: '进口高粱', key: 'sorghum' },
  { name: '进口大麦', key: 'barley' },
  { name: '进口木薯片', key: 'cassava' },
  { name: '进口葵花籽粕', key: 'sunflower' },
  { name: '进口DDGS', key: 'ddgs' },
  { name: '小麦', key: 'wheat' },
  { name: '食用稻谷', key: 'rice' },
  { name: '大豆', key: 'soybean' }
];
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

  // 把所有换行换成制表符，然后拆分单元格
  const allCells = text.replace(/[\r\n]+/g, '\t').split(/\t/).map(c => c.trim());
  if (allCells.length < 10) {
    setStatus('err', '❌ 数据不足！');
    return;
  }

  // 先找表头里每个品种的列位置
  const colIndex = {};
  for (let i = 0; i < allCells.length; i++) {
    const cell = allCells[i];
    for (const col of COL_MAP) {
      if (cell.includes(col.name)) {
        colIndex[col.key] = i;
      }
    }
  }

  // 检查所有列都找到了？
  if (Object.keys(colIndex).length < 9) {
    setStatus('err', '❌ 找不到对应的品种列，请检查粘贴的数据！');
    return;
  }

  const deptData = {};
  SETTLE_DEPTS.forEach(d => {
    deptData[d] = { corn:0, sorghum:0, barley:0, cassava:0, sunflower:0, ddgs:0, wheat:0, rice:0, soybean:0 };
  });

  // 找每个经营部的位置
  for (const d of SETTLE_DEPTS) {
    const deptIdx = allCells.indexOf(d);
    if (deptIdx < 0) continue;

    // 计算这一行的第一个单元格到下一个经营部/合计的位置
    let nextIdx = allCells.length;
    for (const other of [...SETTLE_DEPTS, '合计']) {
      const idx = allCells.indexOf(other, deptIdx + 1);
      if (idx > deptIdx && idx < nextIdx) nextIdx = idx;
    }

    // 这一行的单元格是deptIdx 到 nextIdx - 之间
    const rowCells = allCells.slice(deptIdx, nextIdx);
    if (rowCells.length < 10) continue;

    // 按列位置取数
    for (const col of COL_MAP) {
      // 这个品种在表头的列索引是colIndex[col.key]
      // 相对这一行的偏移是 colIndex[col.key] - (第一列的索引？ 哦对！哦我之前没算偏移！
      // 表头第一个列是截止6.11结算量，索引是headerFirstIdx，所以列的偏移是 colIndex[col.key] - headerFirstIdx
      const headerFirstIdx = allCells.findIndex(c => c.includes('结算量') || c.includes('经营部'));
      const colOffset = colIndex[col.key] - headerFirstIdx;
      if (colOffset < 0 || colOffset >= rowCells.length) continue;
      deptData[d][col.key] = parseNum(rowCells[colOffset]);
    }
  }

  // 计算合计
  const totals = {};
  COL_MAP.forEach(col => {
    totals[col.key] = SETTLE_DEPTS.reduce((sum, d) => sum + deptData[d][col.key], 0);
  });

  settleResult = { deptData, totals };
  renderResult();
  setStatus('ok', '✅ 解析成功！');
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function renderResult() {
  if (!settleResult) return;
  const { deptData, totals } = settleResult;

  const totalAll = round2(Object.values(totals).reduce((a, b) => a + b, 0));
  let text = `本年累计销售结算${totalAll}万吨。`;
  text += `其中内贸玉米${round2(totals.corn)}万吨，`;
  text += `进口高粱${round2(totals.sorghum)}万吨，`;
  text += `进口大麦${round2(totals.barley)}万吨，`;
  text += `进口木薯片${round2(totals.cassava)}万吨，`;
  text += `DDGS${round2(totals.ddgs)}万吨，`;
  text += `小麦${round2(totals.wheat)}万吨，稻谷${round2(totals.rice)}万吨，大豆${round2(totals.soybean)}万吨。`;

  document.getElementById('settleEmptyState').style.display = 'none';
  document.getElementById('settleResultArea').style.display = 'block';
  document.getElementById('settleTextOutput').innerHTML = `<div class="text-para">${text}</div>`;

  const table = document.getElementById('settleTable');
  const displayDepts = [...SETTLE_DEPTS, '合计'];
  const colLabels = COL_MAP.map(c => c.name);

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
  updateFlowSequence(3);
  showToast('✅ 生成成功！');
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

window.handleDirectSettlePaste = handleDirectSettlePaste;
window.copySettleText = copySettleText;
