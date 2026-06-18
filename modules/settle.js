const SETTLE_DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
const SETTLE_COLS = [
  { key: 'corn', label: '内贸玉米' },
  { key: 'sorghum', label: '进口高粱' },
  { key: 'barley', label: '进口大麦' },
  { key: 'cassava', label: '进口木薯片' },
  { key: 'sunflower', label: '进口葵花籽粕' },
  { key: 'ddgs', label: '进口DDGS' },
  { key: 'wheat', label: '小麦' },
  { key: 'rice', label: '食用稻谷' },
  { key: 'soybean', label: '大豆' }
];

let settleTableData = {};
SETTLE_DEPTS.forEach(d => {
  settleTableData[d] = {};
  SETTLE_COLS.forEach(c => { settleTableData[d][c.key] = 0; });
});

function initSettleInputTable() {
  const table = document.getElementById('settleInputTable');
  if (!table) return;

  let thead = '<thead style="position:sticky;top:0;z-index:10;background:#fff;"><tr>';
  thead += '<th style="background:#f1f5f9;position:sticky;left:0;z-index:11;border:1px solid #e2e8f0;padding:6px 8px;font-size:12px;font-weight:600;width:70px;">经营部</th>';
  SETTLE_COLS.forEach(c => {
    thead += `<th style="background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 4px;font-size:11px;font-weight:600;min-width:70px;text-align:center;">${c.label}</th>`;
  });
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  SETTLE_DEPTS.forEach(d => {
    tbody += `<tr style="height:32px;">`;
    tbody += `<td style="background:#f8fafc;position:sticky;left:0;z-index:9;border:1px solid #e2e8f0;padding:6px 8px;font-size:12px;font-weight:600;">${d}</td>`;
    SETTLE_COLS.forEach((c, ci) => {
      const inputId = `settle-input-${d}-${c.key}`;
      tbody += `<td style="border:1px solid #e2e8f0;padding:0;">`;
      tbody += `<input id="${inputId}" type="text" inputmode="decimal" value="0"
        data-dept="${d}" data-col="${c.key}" data-col-idx="${ci}"
        style="width:100%;height:32px;border:none;outline:none;padding:0 6px;font-size:12px;text-align:right;"
        onchange="updateSettleData('${d}','${c.key}',this.value)" />`;
      tbody += `</td>`;
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;

  table.addEventListener('paste', handleTablePaste);
}

function handleTablePaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text.trim()) return;

  const rows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r.length > 0);
  if (rows.length === 0) return;

  let pasteStartDept = null;
  let pasteStartCol = null;

  const activeEl = document.activeElement;
  if (activeEl && activeEl.dataset && activeEl.dataset.dept) {
    pasteStartDept = activeEl.dataset.dept;
    pasteStartCol = parseInt(activeEl.dataset.colIdx) || 0;
  }

  let filledCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].split(/\t/).map(c => c.trim());
    let targetDept = null;

    if (pasteStartDept) {
      const startIdx = SETTLE_DEPTS.indexOf(pasteStartDept);
      if (startIdx >= 0 && startIdx + i < SETTLE_DEPTS.length) {
        targetDept = SETTLE_DEPTS[startIdx + i];
      }
    }

    if (!targetDept) {
      const firstCell = cells[0];
      for (const d of SETTLE_DEPTS) {
        if (firstCell.includes(d)) {
          targetDept = d;
          break;
        }
      }
    }

    if (!targetDept) continue;

    let startCol = pasteStartDept ? pasteStartCol : 0;

    for (let j = 0; j < cells.length; j++) {
      const cellVal = cells[j];
      const colIdx = startCol + j;

      if (colIdx >= SETTLE_COLS.length) continue;

      let num = 0;
      const cleaned = cellVal.replace(/,/g, '').replace('-', '0').trim();
      if (cleaned) num = parseFloat(cleaned) || 0;

      const col = SETTLE_COLS[colIdx];
      settleTableData[targetDept][col.key] = num;

      const inputEl = document.getElementById(`settle-input-${targetDept}-${col.key}`);
      if (inputEl) {
        inputEl.value = num > 0 ? num : '0';
      }

      filledCount++;
    }
  }

  showToast(`✅ 已粘贴 ${filledCount} 个数据！`);
}

function updateSettleData(dept, col, value) {
  const cleaned = String(value).replace(/,/g, '').trim();
  settleTableData[dept][col] = parseFloat(cleaned) || 0;
}

function generateSettleFromTable() {
  const totals = {};
  SETTLE_COLS.forEach(c => {
    totals[c.key] = SETTLE_DEPTS.reduce((s, d) => s + (settleTableData[d][c.key] || 0), 0);
  });

  const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
  const round2 = v => Math.round(v * 100) / 100;

  let text = `本年累计销售结算${round2(totalAll)}万吨。`;
  text += `其中内贸玉米${round2(totals.corn)}万吨，`;
  text += `进口高粱${round2(totals.sorghum)}万吨，`;
  text += `进口大麦${round2(totals.barley)}万吨，`;
  text += `进口木薯片${round2(totals.cassava)}万吨，`;
  text += `DDGS${round2(totals.ddgs)}万吨，`;
  text += `小麦${round2(totals.wheat)}万吨，稻谷${round2(totals.rice)}万吨，大豆${round2(totals.soybean)}万吨。`;

  document.getElementById('settleEmptyState').style.display = 'none';
  document.getElementById('settleResultArea').style.display = 'block';
  document.getElementById('settleTextOutput').innerHTML = `<div class="text-para">${text}</div>`;

  renderSettleResultTable(totals);
  updateFlowSequence(3);
  showToast('✅ 生成成功！');
}

function renderSettleResultTable(totals) {
  const table = document.getElementById('settleTable');
  const displayDepts = [...SETTLE_DEPTS, '合计'];
  const round2 = v => Math.round(v * 100) / 100;

  let thead = '<thead><tr><th class="th-dept">经营部</th>';
  SETTLE_COLS.forEach(c => { thead += `<th class="th-group">${c.label}</th>`; });
  thead += '<th class="th-group th-group-total">合计</th></tr></thead>';

  let tbody = '<tbody>';
  displayDepts.forEach((dept, rowIdx) => {
    const isTotal = (dept === '合计');
    const data = isTotal ? totals : settleTableData[dept];
    const trCls = isTotal ? 'tr-total' : (rowIdx % 2 === 1 ? 'tr-even' : '');
    let rowSum = 0;

    let tr = `<tr class="${trCls}"><td class="td-dept">${dept}</td>`;
    SETTLE_COLS.forEach(c => {
      const val = round2(data[c.key] || 0);
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

function copySettleText() {
  const el = document.getElementById('settleTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initSettleInputTable, 100);
});

window.generateSettleFromTable = generateSettleFromTable;
window.copySettleText = copySettleText;
window.updateSettleData = updateSettleData;
