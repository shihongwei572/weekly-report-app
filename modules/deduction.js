var deductionResult = null;

function parseDeductionNum(v) {
  var s = String(v || '').trim().replace(/,/g, '').replace(/%/g, '');
  if (!s || s === '-' || s === 'None') return 0;
  return parseFloat(s) || 0;
}

function parseDeductionRatio(v) {
  var s = String(v || '').trim().replace(/%/g, '');
  return parseFloat(s) || 0;
}

function parseDeptTable(text) {
  var lines = text.split(/[\r\n]+/).filter(function(l) { return l.trim(); });
  var dataLines = lines.slice(1);
  var deptData = {};
  var totalData = null;

  for (var i = 0; i < dataLines.length; i++) {
    var cells = dataLines[i].split('\t');
    if (cells.length < 8) continue;
    var name = cells[0].trim();

    if (name === '总计') {
      totalData = {
        bishu: parseDeductionNum(cells[1]),
        amount: parseDeductionNum(cells[2]),
        tons: parseDeductionNum(cells[3]),
        perTon: parseDeductionNum(cells[4]),
        settleTotal: parseDeductionNum(cells[5]),
        avgToSettle: parseDeductionNum(cells[6]),
        ratio: parseDeductionRatio(cells[7])
      };
    } else if (name) {
      deptData[name] = {
        bishu: parseDeductionNum(cells[1]),
        amount: parseDeductionNum(cells[2]),
        tons: parseDeductionNum(cells[3]),
        perTon: parseDeductionNum(cells[4]),
        settleTotal: parseDeductionNum(cells[5]),
        avgToSettle: parseDeductionNum(cells[6]),
        ratio: parseDeductionRatio(cells[7])
      };
    }
  }

  return { deptData: deptData, total: totalData };
}

function parseReasonTable(text) {
  var lines = text.split(/[\r\n]+/).filter(function(l) { return l.trim(); });
  var dataLines = lines.slice(1);
  var reasons = [];

  for (var i = 0; i < dataLines.length; i++) {
    var cells = dataLines[i].split('\t');
    if (cells.length < 3) continue;
    var name = cells[0].trim();
    if (name === '总计') continue;
    if (name) {
      reasons.push({
        name: name,
        amount: parseDeductionNum(cells[1]),
        ratio: parseDeductionRatio(cells[2])
      });
    }
  }

  reasons.sort(function(a, b) { return b.amount - a.amount; });
  return reasons;
}

var REASON_LABEL = {
  '水分': '水分超标',
  '杂质': '杂质超标',
  '毒素': '毒素超标',
  '霉变': '发生霉变'
};

function reasonLabel(name) {
  return REASON_LABEL[name] || name;
}

function loadPrevDeduction() {
  try {
    var raw = localStorage.getItem('deduction_prev_data');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function savePrevDeduction(total) {
  try {
    localStorage.setItem('deduction_prev_data', JSON.stringify({
      bishu: total.bishu,
      amount: total.amount,
      tons: total.tons,
      perTon: total.perTon
    }));
  } catch(e) {}
}

function handleDeductionParse() {
  var deptText = (document.getElementById('deductionDeptPaste') || {}).value || '';
  var reasonText = (document.getElementById('deductionReasonPaste') || {}).value || '';

  if (!deptText.trim() || !reasonText.trim()) {
    setDeductionStatus('err', '❌ 请粘贴两个表格的数据！');
    return;
  }

  var deptResult = parseDeptTable(deptText);
  var reasons = parseReasonTable(reasonText);

  if (!deptResult.total || Object.keys(deptResult.deptData).length === 0) {
    setDeductionStatus('err', '❌ 经营部表格解析失败，请检查格式！');
    return;
  }

  if (reasons.length === 0) {
    setDeductionStatus('err', '❌ 扣款原因表格解析失败，请检查格式！');
    return;
  }

  var prevData = loadPrevDeduction();
  savePrevDeduction(deptResult.total);

  var hasPrev = !!prevData;
  var changeBishu = hasPrev ? (deptResult.total.bishu - prevData.bishu) : 0;
  var changeAmount = hasPrev ? round2(deptResult.total.amount - prevData.amount) : 0;
  var changePerTon = hasPrev ? round2(deptResult.total.perTon - prevData.perTon) : 0;

  var dateEl = document.getElementById('deductionCutoffDate');
  var dateVal = dateEl ? dateEl.value : '';
  var dateObj = new Date(dateVal + 'T00:00:00');
  var dateStr = (dateObj.getMonth() + 1) + '月' + dateObj.getDate() + '日';

  var regionEl = document.getElementById('deductionRegion');
  var region = regionEl ? regionEl.value : '沿海大区';

  var t = deptResult.total;

  var bishuPart = t.bishu + '笔';
  if (hasPrev && changeBishu !== 0) {
    bishuPart += '（环比' + (changeBishu >= 0 ? '增加' : '减少') + Math.abs(changeBishu) + '笔）';
  }

  var amountPart = round2(t.amount) + '万元';
  if (hasPrev && changeAmount !== 0) {
    amountPart += '（环比' + (changeAmount >= 0 ? '增加' : '减少') + Math.abs(changeAmount) + '万元）';
  }

  var perTonPart = round2(t.perTon) + '元';
  if (hasPrev && changePerTon !== 0) {
    perTonPart += '（环比' + (changePerTon >= 0 ? '增加' : '减少') + Math.abs(changePerTon) + '元/吨）';
  }

  var top4 = reasons.slice(0, 4);
  var reasonParts = [];
  for (var i = 0; i < top4.length; i++) {
    var r = top4[i];
    reasonParts.push(reasonLabel(r.name) + '涉及金额' + round2(r.amount / 10000) + '万元，占比' + round2(r.ratio) + '％');
  }

  var deptNames = Object.keys(deptResult.deptData);

  var deptList = [];
  for (var i = 0; i < deptNames.length; i++) {
    var d = deptNames[i];
    var dd = deptResult.deptData[d];
    deptList.push({ name: d, perTon: dd.perTon, ratio: dd.ratio, tons: dd.tons, settleTotal: dd.settleTotal });
  }

  deptList.sort(function(a, b) { return b.perTon - a.perTon; });
  var highNames = [];
  for (var i = 0; i < deptList.length && highNames.length < 2; i++) {
    if (deptList[i].tons > 0.3) {
      highNames.push(deptList[i].name);
    }
  }

  var highPerTonDepts = [];
  var highRatioDepts = [];
  for (var i = 0; i < highNames.length; i++) {
    var dd = deptResult.deptData[highNames[i]];
    highPerTonDepts.push({ name: highNames[i], value: round2(dd.perTon) });
    highRatioDepts.push({ name: highNames[i], value: round2(dd.ratio) });
  }

  var highNames = [];
  var detail1 = [];
  var detail2 = [];

  for (var i = 0; i < highPerTonDepts.length; i++) {
    if (highNames.indexOf(highPerTonDepts[i].name) < 0) {
      highNames.push(highPerTonDepts[i].name);
    }
    detail1.push(highPerTonDepts[i].name + round2(highPerTonDepts[i].value) + '元/吨');
  }
  for (var i = 0; i < highRatioDepts.length; i++) {
    if (highNames.indexOf(highRatioDepts[i].name) < 0) {
      highNames.push(highRatioDepts[i].name);
    }
    detail2.push(highRatioDepts[i].name + '结算数量中' + round2(highRatioDepts[i].value) + '％涉及商扣');
  }

  var text = '截至' + dateStr + '，' + region + '本年累计销售商扣' + bishuPart + '，' +
    '基本为饲料原料品种扣款，涉及扣款金额' + amountPart + '，' +
    '平均单吨扣款' + perTonPart + '，均为品质不达标或质量问题导致的扣款。' +
    '其中' + reasonParts.join('；') + '。';

  if (highNames.length > 0) {
    text += '分经营部看，' + highNames.join('、') + '单吨商扣较高（' + detail1.join('，') + '），' +
      '商扣频率也较高（' + detail2.join('，') + '）。';
  }

  deductionResult = {
    deptData: deptResult.deptData,
    total: deptResult.total,
    reasons: reasons,
    text: text
  };

  renderDeductionResult();
  setDeductionStatus('ok', '✅ 解析成功！');
}

function renderDeductionResult() {
  if (!deductionResult) return;

  document.getElementById('deductionEmptyState').style.display = 'none';
  document.getElementById('deductionResultArea').style.display = 'block';

  document.getElementById('deductionTextOutput').innerHTML =
    '<div class="text-para">' + deductionResult.text + '</div>';

  var deptTable = document.getElementById('deductionDeptTable');
  var deptNames = Object.keys(deductionResult.deptData);
  var cols = ['商扣笔数', '商扣金额(万元)', '商扣吨数(万吨)', '单吨商扣(元/吨)', '累计结算量(万吨)', '均摊(元/吨)', '占比'];

  var thead = '<thead><tr><th class="th-dept">经营部</th>';
  for (var i = 0; i < cols.length; i++) {
    thead += '<th class="th-group">' + cols[i] + '</th>';
  }
  thead += '</tr></thead>';

  var tbody = '<tbody>';
  var allNames = deptNames.concat(['总计']);
  for (var i = 0; i < allNames.length; i++) {
    var name = allNames[i];
    var isTotal = name === '总计';
    var d = isTotal ? deductionResult.total : deductionResult.deptData[name];
    var cls = isTotal ? 'tr-total' : (i % 2 === 1 ? 'tr-even' : '');

    tbody += '<tr class="' + cls + '"><td class="td-dept">' + name + '</td>';
    tbody += '<td class="td-num">' + d.bishu + '</td>';
    tbody += '<td class="td-num">' + round2(d.amount) + '</td>';
    tbody += '<td class="td-num">' + round2(d.tons) + '</td>';
    tbody += '<td class="td-num">' + round2(d.perTon) + '</td>';
    tbody += '<td class="td-num">' + round2(d.settleTotal) + '</td>';
    tbody += '<td class="td-num">' + round2(d.avgToSettle) + '</td>';
    tbody += '<td class="td-num">' + round2(d.ratio) + '%</td>';
    tbody += '</tr>';
  }
  tbody += '</tbody>';
  deptTable.innerHTML = thead + tbody;

  var reasonTable = document.getElementById('deductionReasonTable');
  var reasonThead = '<thead><tr><th>扣款原因</th><th>扣款金额(元)</th><th>占比</th></tr></thead>';
  var reasonTbody = '<tbody>';
  for (var i = 0; i < deductionResult.reasons.length; i++) {
    var r = deductionResult.reasons[i];
    var cls = i % 2 === 1 ? 'tr-even' : '';
    reasonTbody += '<tr class="' + cls + '"><td>' + r.name + '</td>' +
      '<td class="td-num">' + round2(r.amount) + '</td>' +
      '<td class="td-num">' + round2(r.ratio) + '%</td></tr>';
  }
  reasonTbody += '</tbody>';
  reasonTable.innerHTML = reasonThead + reasonTbody;

  updateFlowSequence(3);
}

function copyDeductionText() {
  var el = document.getElementById('deductionTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

function setDeductionStatus(type, msg) {
  var el = document.getElementById('deductionStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'status-err' : type === 'ok' ? 'status-ok' : '');
  el.textContent = msg;
  el.style.display = 'block';
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

window.deductionResult = deductionResult;
window.handleDeductionParse = handleDeductionParse;
window.copyDeductionText = copyDeductionText;
window.calcDeductionData = function() { return deductionResult; };
