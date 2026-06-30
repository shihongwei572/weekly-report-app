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

  var QUALITY_REASONS = ['杂质', '水分', '毒素', '霉变', '热损伤', '不完善粒', '容重', '短重'];
  var totalAmount = reasons.reduce(function(s, r) { return s + r.amount; }, 0);
  var qualityAmount = 0;
  var otherAmount = 0;
  for (var i = 0; i < reasons.length; i++) {
    if (QUALITY_REASONS.indexOf(reasons[i].name) >= 0) {
      qualityAmount += reasons[i].amount;
    } else {
      otherAmount += reasons[i].amount;
    }
  }
  var qualityRatio = totalAmount > 0 ? qualityAmount / totalAmount : 0;

  var qualityDesc;
  if (qualityRatio >= 0.95) {
    qualityDesc = '均为品质不达标或质量问题导致的扣款';
  } else if (qualityRatio >= 0.7) {
    qualityDesc = '主要为品质不达标或质量问题导致的扣款，另有少量其他费用';
  } else if (qualityRatio >= 0.3) {
    qualityDesc = '部分为品质不达标或质量问题导致的扣款，另有部分其他费用';
  } else {
    qualityDesc = '以其他费用为主，品质问题扣款占比较小';
  }

  var topN = reasons.length >= 4 ? 4 : reasons.length;
  var topReasons = reasons.slice(0, topN);
  var reasonParts = [];
  for (var i = 0; i < topReasons.length; i++) {
    var r = topReasons[i];
    reasonParts.push(reasonLabel(r.name) + '涉及金额' + round2(r.amount / 10000) + '万元，占比' + round2(r.ratio) + '％');
  }

  var dominantReason = '';
  if (topReasons.length > 0 && topReasons[0].ratio >= 50) {
    dominantReason = '，其中' + reasonLabel(topReasons[0].name) + '占比过半';
  }

  var deptNames = Object.keys(deptResult.deptData);

  var deptList = [];
  for (var i = 0; i < deptNames.length; i++) {
    var d = deptNames[i];
    var dd = deptResult.deptData[d];
    deptList.push({ name: d, perTon: dd.perTon, ratio: dd.ratio, tons: dd.tons, settleTotal: dd.settleTotal });
  }

  deptList.sort(function(a, b) { return b.perTon - a.perTon; });
  var highPerTonDepts = [];
  var lowPerTonDepts = [];
  for (var i = 0; i < deptList.length; i++) {
    if (deptList[i].tons > 0.3) {
      if (highPerTonDepts.length < 2) {
        highPerTonDepts.push(deptList[i]);
      }
    }
  }
  for (var i = deptList.length - 1; i >= 0; i--) {
    if (deptList[i].tons > 0.3) {
      if (lowPerTonDepts.length < 2) {
        lowPerTonDepts.push(deptList[i]);
      }
    }
  }

  deptList.sort(function(a, b) { return b.ratio - a.ratio; });
  var highRatioDepts = [];
  for (var i = 0; i < deptList.length; i++) {
    if (deptList[i].settleTotal > 10) {
      if (highRatioDepts.length < 2) {
        highRatioDepts.push(deptList[i]);
      }
    }
  }

  var highNames = [];
  var detail1 = [];
  var detail2 = [];
  for (var i = 0; i < highPerTonDepts.length; i++) {
    if (highNames.indexOf(highPerTonDepts[i].name) < 0) {
      highNames.push(highPerTonDepts[i].name);
    }
    detail1.push(highPerTonDepts[i].name + round2(highPerTonDepts[i].perTon) + '元/吨');
  }
  for (var i = 0; i < highRatioDepts.length; i++) {
    if (highNames.indexOf(highRatioDepts[i].name) < 0) {
      highNames.push(highRatioDepts[i].name);
    }
    detail2.push(highRatioDepts[i].name + '结算数量中' + round2(highRatioDepts[i].ratio) + '％涉及商扣');
  }

  var perTonMax = highPerTonDepts.length > 0 ? highPerTonDepts[0].perTon : 0;
  var perTonMin = lowPerTonDepts.length > 0 ? lowPerTonDepts[lowPerTonDepts.length - 1].perTon : 0;
  var perTonSpread = perTonMin > 0 ? perTonMax / perTonMin : 1;

  var deptSection = '';
  if (highNames.length === 0) {
    deptSection = '各经营部商扣水平较为均衡。';
  } else if (perTonSpread < 1.5) {
    deptSection = '各经营部商扣水平差异不大，' + highNames.join('、') + '相对略高（' + detail1.join('，') + '），商扣频率也略高（' + detail2.join('，') + '）。';
  } else {
    deptSection = '分经营部看，' + highNames.join('、') + '均摊(元/吨)较高（' + detail1.join('，') + '），商扣频率也较高（' + detail2.join('，') + '）。';
  }

  var changeComment = '';
  if (hasPrev) {
    if (changeBishu > 0 && changeAmount > 0) {
      changeComment = '环比有所增加，';
    } else if (changeBishu < 0 && changeAmount < 0) {
      changeComment = '环比有所下降，';
    } else if (changeBishu === 0 && changeAmount === 0) {
      changeComment = '环比基本持平，';
    }
  }

  var text = '截至' + dateStr + '，' + region + '本年累计销售商扣' + bishuPart + '，' +
    changeComment + '涉及扣款金额' + amountPart + '，' +
    '均摊至年度累计结算量的单吨商扣为' + perTonPart + '，' + qualityDesc + '。' +
    '其中' + reasonParts.join('；') + dominantReason + '。';

  text += deptSection;

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
