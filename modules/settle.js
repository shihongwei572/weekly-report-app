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

  const totalAll = round2(Object.values(totals).reduce((a, b) => a + b, 0));
  let text = `本年累计销售结算${totalAll}万吨。`;
  text += `其中内贸玉米${round2(totals['国产玉米'])}万吨，`;
  text += `进口高粱${round2(totals['进口高粱'])}万吨，`;
  text += `进口大麦${round2(totals['进口大麦'])}万吨，`;
  text += `进口木薯片${round2(totals['进口木薯片'])}万吨，`;
  text += `DDGS${round2(totals['DDGS'])}万吨，`;
  text += `小麦${round2(totals['小麦'])}万吨，稻谷${round2(totals['食用稻谷'])}万吨，大豆${round2(totals['大豆'])}万吨。`;

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
  updateFlowSequence(3);
  showToast('✅ 生成成功！');
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
