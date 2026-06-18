const SETTLE_DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
let settleResult = null;

function parseNum(v) {
  const s = String(v || '').trim().replace(/,/g, '');
  if (!s || s === '-' || !/^\d+(\.\d+)?$/.test(s)) return 0;
  return parseFloat(s) || 0;
}

function handleDirectSettlePaste() {
  let text = document.getElementById('settlePasteArea')?.value || '';
  if (!text.trim()) {
    setStatus('err', '❌ 请先粘贴数据！');
    return;
  }

  text = text.replace(/  +/g, '\t').replace(/\t+/g, '\t');

  const deptData = {};
  SETTLE_DEPTS.forEach(d => {
    deptData[d] = { corn:0, sorghum:0, barley:0, cassava:0, sunflower:0, ddgs:0, wheat:0, rice:0, soybean:0 };
  });

  for (const d of SETTLE_DEPTS) {
    const idx = text.indexOf(d);
    if (idx < 0) continue;

    const subStr = text.slice(idx + d.length);
    let cells = subStr.split(/\t/).map(p => p.trim());

    const nums = [];
    for (const c of cells) {
      if (nums.length >= 9) break;
      const num = parseNum(c);
      nums.push(num);
    }

    if (nums.length >= 9) {
      deptData[d].corn      = nums[0];
      deptData[d].sorghum   = nums[1];
      deptData[d].barley    = nums[2];
      deptData[d].cassava   = nums[3];
      deptData[d].sunflower = nums[4];
      deptData[d].ddgs      = nums[5];
      deptData[d].wheat     = nums[6];
      deptData[d].rice      = nums[7];
      deptData[d].soybean   = nums[8];
    }
  }

  const totals = {
    corn: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].corn, 0),
    sorghum: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].sorghum, 0),
    barley: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].barley, 0),
    cassava: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].cassava, 0),
    sunflower: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].sunflower, 0),
    ddgs: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].ddgs, 0),
    wheat: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].wheat, 0),
    rice: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].rice, 0),
    soybean: SETTLE_DEPTS.reduce((s, d) => s + deptData[d].soybean, 0),
  };

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
  const colLabels = ['内贸玉米','进口高粱','进口大麦','进口木薯片','进口葵花籽粕','进口DDGS','小麦','食用稻谷','大豆'];

  let thead = '<thead><tr><th class="th-dept">经营部</th>';
  colLabels.forEach(l => { thead += `<th class="th-group">${l}</th>`; });
  thead += '<th class="th-group th-group-total">合计</th></tr></thead>';

  let tbody = '<tbody>';
  displayDepts.forEach((dept, rowIdx) => {
    const isTotal = (dept === '合计');
    const data = isTotal ? totals : deptData[dept];
    const trCls = isTotal ? 'tr-total' : (rowIdx % 2 === 1 ? 'tr-even' : '');

    const vals = [
      data.corn, data.sorghum, data.barley, data.cassava, data.sunflower,
      data.ddgs, data.wheat, data.rice, data.soybean
    ];

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
