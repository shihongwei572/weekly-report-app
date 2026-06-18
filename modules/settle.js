var settleWorkbook = null;
var settleParsedData = null;

const SETTLE_COLUMNS = [
  { key: '国产玉米',    match: ['内贸玉米', '国产玉米'] },
  { key: '进口高粱',    match: ['进口高粱'] },
  { key: '进口大麦',    match: ['进口大麦'] },
  { key: '进口木薯片',  match: ['进口木薯片'] },
  { key: '进口葵花籽粕', match: ['进口葵花籽粕'] },
  { key: 'DDGS',       match: ['DDGS', 'ddgs', '进口 DDGS', '进口DDGS'] },
  { key: '小麦',       match: ['小麦'] },
  { key: '食用稻谷',    match: ['食用稻谷', '稻谷'] },
  { key: '大豆',       match: ['大豆'] },
];

const SETTLE_DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];

function setSettleStatus(type, msg) {
  const el = document.getElementById('settlePasteStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'status-err' : 'status-ok');
  el.textContent = msg;
  el.style.display = 'block';
}

function setDebugInfo(text) {
  const el = document.getElementById('settleDebugInfo');
  if (el) {
    el.style.display = 'block';
    el.textContent = text;
  }
}

function handleSettlePaste() {
  const text = document.getElementById('settlePasteArea')?.value || '';
  if (!text.trim()) {
    setSettleStatus('err', '❌ 请先粘贴结算数据');
    return;
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    setSettleStatus('err', '❌ 数据不足，至少需要表头+1行数据');
    return;
  }

  const headerCells = lines[0].split(/\t/).map(c => c.trim());
  const colMap = [];
  let deptIdx = -1;

  for (let i = 0; i < headerCells.length; i++) {
    const h = headerCells[i];
    
    if (deptIdx < 0) {
      for (let j = 1; j < lines.length; j++) {
        const rowCells = lines[j].split(/\t/).map(c => c.trim());
        const cellVal = rowCells[i] || '';
        if (SETTLE_DEPTS.some(d => cellVal.includes(d))) {
          deptIdx = i;
          break;
        }
      }
    }

    for (const col of SETTLE_COLUMNS) {
      if (col.match.some(m => h.includes(m))) {
        colMap.push({ idx: i, key: col.key });
        break;
      }
    }
  }

  if (deptIdx < 0) deptIdx = 0;

  const deptData = {};
  SETTLE_DEPTS.forEach(d => {
    deptData[d] = {};
    SETTLE_COLUMNS.forEach(c => { deptData[d][c.key] = 0; });
  });

  let rowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(/\t/).map(c => c.trim());
    const deptName = cells[deptIdx] || '';

    if (deptName.includes('合计')) continue;

    let matchedDept = null;
    for (const d of SETTLE_DEPTS) {
      if (deptName.includes(d)) { matchedDept = d; break; }
    }
    if (!matchedDept) continue;

    colMap.forEach(cm => {
      const rawVal = (cells[cm.idx] || '').trim();
      let val = 0;
      if (rawVal && rawVal !== '-') {
        val = parseFloat(rawVal.replace(/,/g, '')) || 0;
      }
      deptData[matchedDept][cm.key] += val;
    });
    rowCount++;
  }

  const total = {};
  SETTLE_COLUMNS.forEach(c => {
    total[c.key] = SETTLE_DEPTS.reduce((s, d) => s + (deptData[d][c.key] || 0), 0);
  });

  settleParsedData = { deptData, total, rowCount };
  settleWorkbook = { __isPasteData: true };

  setSettleStatus('ok', `✅ 解析完成，共 ${rowCount} 个经营部`);

  refreshSettleOutputFromPaste();
}

function refreshSettleOutputFromPaste() {
  if (!settleParsedData) return;

  try {
    const { deptData, total, rowCount } = settleParsedData;
    const toW = v => round2(v);

    let totalAll = 0;
    Object.keys(total).forEach(k => { totalAll += total[k]; });
    totalAll = round2(totalAll);

    let textParts = [`本年累计销售结算${totalAll}万吨。`];
    textParts.push(`其中内贸玉米${toW(total['国产玉米'])}万吨，`);
    textParts.push(`进口高粱${toW(total['进口高粱'])}万吨，`);
    textParts.push(`进口大麦${toW(total['进口大麦'])}万吨，`);
    textParts.push(`进口木薯片${toW(total['进口木薯片'])}万吨，`);
    textParts.push(`DDGS${toW(total['DDGS'])}万吨，`);
    textParts.push(`小麦${toW(total['小麦'])}万吨，稻谷${toW(total['食用稻谷'])}万吨，大豆${toW(total['大豆'])}万吨。`);

    const settleText = textParts.join('');

    document.getElementById('settleEmptyState').style.display = 'none';
    document.getElementById('settleResultArea').style.display = 'block';
    document.getElementById('settleTextOutput').innerHTML = `<div class="text-para">${settleText}</div>`;

    renderSettleTable(deptData, total);

    updateFlowSequence(3);
    showToast(`✅ 计算完成，共 ${rowCount} 个经营部`);

  } catch (err) {
    showToast('❌ 处理失败：' + err.message);
    console.error(err);
  }
}

function renderSettleTable(deptData, total) {
  const table = document.getElementById('settleTable');
  const displayDepts = [...SETTLE_DEPTS, '合计'];
  const columns = SETTLE_COLUMNS.map(c => c.key);

  let tr1 = '<tr><th class="th-dept">经营部</th>';
  columns.forEach(c => { tr1 += `<th class="th-group">${c}</th>`; });
  tr1 += '<th class="th-group th-group-total">合计</th></tr>';
  const thead = `<thead>${tr1}</thead>`;

  let tbody = '<tbody>';
  displayDepts.forEach((dept, rowIdx) => {
    const isTotal = (dept === '合计');
    const data = isTotal ? total : (deptData[dept] || {});
    const trCls = isTotal ? 'tr-total' : (rowIdx % 2 === 1 ? 'tr-even' : '');

    let tr = `<tr class="${trCls}"><td class="td-dept">${dept}</td>`;
    let rowSum = 0;

    columns.forEach(c => {
      const val = round2(data[c] || 0);
      rowSum += val;
      tr += `<td class="td-num">${val > 0 ? val : '-'}</td>`;
    });

    rowSum = round2(rowSum);
    tr += `<td class="td-num td-total">${rowSum > 0 ? rowSum : '-'}</td>`;
    tr += '</tr>';
    tbody += tr;
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
}

function calcSettleData() {
  return settleParsedData || null;
}

function refreshSettleOutput() {
  refreshSettleOutputFromPaste();
}

function copySettleText() {
  const el = document.getElementById('settleTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

window.settleWorkbook = settleWorkbook;
window.handleSettlePaste = handleSettlePaste;
window.refreshSettleOutput = refreshSettleOutput;
window.renderSettleTable = renderSettleTable;
window.copySettleText = copySettleText;
window.calcSettleData = calcSettleData;
