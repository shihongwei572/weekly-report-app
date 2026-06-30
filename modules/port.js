var portWorkbook = null;
var portResult = null;

function parsePortNum(v) {
  var s = String(v || '').trim().replace(/,/g, '');
  if (!s || s === '-' || s === 'None') return 0;
  return parseFloat(s) || 0;
}

function handlePortFile(event) {
  var file = event.target.files[0];
  if (file) processPortFile(file);
}

function handlePortDrop(event) {
  event.preventDefault();
  document.getElementById('portUploadZone').classList.remove('drag');
  var file = event.dataTransfer.files[0];
  if (file) processPortFile(file);
}

function processPortFile(file) {
  setPortStatus('', '⏳ 正在解析文件...');
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, { type: 'array' });
      portWorkbook = wb;
      setPortStatus('ok', '✅ 文件已加载：' + file.name);
      refreshPortOutput();
    } catch (err) {
      setPortStatus('err', '❌ 解析失败：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function getPortSheetData(wb, sheetName) {
  if (!wb || !wb.Sheets[sheetName]) return [];
  var sheet = wb.Sheets[sheetName];
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  return rows.slice(1);
}

function findRowByDate(rows, dateColIdx, targetDate) {
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cellDate = parseExcelDate(row[dateColIdx]);
    if (cellDate && cellDate === targetDate) return row;
  }
  return null;
}

function findRowByDateAnyCol(rows, dateColIdx1, dateColIdx2, targetDate) {
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cellDate = parseExcelDate(row[dateColIdx1]);
    if (cellDate && cellDate === targetDate) return row;
    if (dateColIdx2 !== undefined) {
      cellDate = parseExcelDate(row[dateColIdx2]);
      if (cellDate && cellDate === targetDate) return row;
    }
  }
  return null;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    var d = new Date((val - 25569) * 86400 * 1000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  var s = String(val).trim();
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[1] + '-' + m[2];
  return null;
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function calcPortData() {
  if (!portWorkbook) return null;

  var socialStockRows = getPortSheetData(portWorkbook, '社会港存');
  var socialFlowRows = getPortSheetData(portWorkbook, '社会走货量');
  var ourStockRows = getPortSheetData(portWorkbook, '我司港存');
  var ourFlowRows = getPortSheetData(portWorkbook, '我司走货量');

  if (!socialStockRows.length) return null;

  // 从社会港存获取日期列表
  var dates = [];
  for (var i = 0; i < socialStockRows.length; i++) {
    var d = parseExcelDate(socialStockRows[i][0]);
    if (d) dates.push(d);
  }
  dates.sort();
  if (dates.length < 2) return null;

  var latestDate = dates[dates.length - 1];
  var prevDate = dates[dates.length - 2];

  // 查找对应行
  var socialStock = findRowByDate(socialStockRows, 0, latestDate);
  var socialStockPrev = findRowByDate(socialStockRows, 0, prevDate);

  // 社会走货量：日期在第1列
  var socialFlow = findRowByDate(socialFlowRows, 1, latestDate);
  var socialFlowPrev = findRowByDate(socialFlowRows, 1, prevDate);

  // 我司港存：日期在第0列
  var ourStock = findRowByDate(ourStockRows, 0, latestDate);
  var ourStockPrev = findRowByDate(ourStockRows, 0, prevDate);

  // 我司走货量：日期在第0列
  var ourFlow = findRowByDate(ourFlowRows, 0, latestDate);
  var ourFlowPrev = findRowByDate(ourFlowRows, 0, prevDate);

  if (!socialStock || !socialStockPrev || !socialFlow || !socialFlowPrev ||
      !ourStock || !ourStockPrev || !ourFlow || !ourFlowPrev) return null;

  // 读取数据（根据新的列索引）
  var socialStockVal = parsePortNum(socialStock[7]);
  var socialStockPrevVal = parsePortNum(socialStockPrev[7]);
  var socialCornStock = parsePortNum(socialStock[14]);
  var socialCornStockPrev = parsePortNum(socialStockPrev[14]);

  var socialFlowVal = parsePortNum(socialFlow[9]);
  var socialFlowPrevVal = parsePortNum(socialFlowPrev[9]);
  var socialCornFlow = parsePortNum(socialFlow[16]);
  var socialCornFlowPrev = parsePortNum(socialFlowPrev[16]);

  var ourStockVal = parsePortNum(ourStock[8]);
  var ourStockPrevVal = parsePortNum(ourStockPrev[8]);
  var ourCornStock = parsePortNum(ourStock[15]);
  var ourCornStockPrev = parsePortNum(ourStockPrev[15]);

  var ourFlowVal = parsePortNum(ourFlow[9]);
  var ourFlowPrevVal = parsePortNum(ourFlowPrev[9]);
  var ourCornFlow = parsePortNum(ourFlow[16]);
  var ourCornFlowPrev = parsePortNum(ourFlowPrev[16]);

  var socialDailyRate = socialFlowVal / 7;
  var socialDailyRatePrev = socialFlowPrevVal / 7;
  var socialCornDailyRate = socialCornFlow / 7;
  var socialCornDailyRatePrev = socialCornFlowPrev / 7;

  var ourDailyRate = ourFlowVal / 7;
  var ourDailyRatePrev = ourFlowPrevVal / 7;
  var ourCornDailyRate = ourCornFlow / 7;
  var ourCornDailyRatePrev = ourCornFlowPrev / 7;

  var val1 = round2(socialStockVal);
  var change1 = socialStockPrevVal > 0 ? round2((socialStockVal - socialStockPrevVal) / socialStockPrevVal * 100) : 0;
  var ratio = socialStockVal > 0 ? round2(ourStockVal / socialStockVal * 100) : 0;

  var days1 = ourDailyRate > 0 ? round2(ourStockVal / ourDailyRate) : 0;
  var days1Prev = ourDailyRatePrev > 0 ? round2(ourStockPrevVal / ourDailyRatePrev) : 0;
  var change2 = round2(days1 - days1Prev);

  var days2 = socialDailyRate > 0 ? round2(socialStockVal / socialDailyRate) : 0;

  var days3 = ourCornDailyRate > 0 ? round2(ourCornStock / ourCornDailyRate) : 0;
  var days3Prev = ourCornDailyRatePrev > 0 ? round2(ourCornStockPrev / ourCornDailyRatePrev) : 0;
  var change3 = round2(days3 - days3Prev);

  var days4 = socialCornDailyRate > 0 ? round2(socialCornStock / socialCornDailyRate) : 0;
  var diff = round2(days3 - days4);
  var daysDiff = round2(days1 - days2);
  var daysDiffStr = daysDiff >= 0 ? '+' + daysDiff : '' + daysDiff;
  var daysCompare = daysDiff >= 0 ? '高' + daysDiffStr + '天' : '低' + daysDiffStr.replace('-', '') + '天';

  var dateObj = new Date(latestDate + 'T00:00:00');
  var dateStr = (dateObj.getMonth() + 1) + '月' + dateObj.getDate() + '日';

  var change1Str = change1 >= 0 ? '+' + change1 : '' + change1;
  var change2Str = change2 >= 0 ? '+' + change2 : '' + change2;
  var change3Str = change3 >= 0 ? '+' + change3 : '' + change3;
  var diffStr = diff >= 0 ? '+' + diff : '' + diff;

  var text = '截至' + dateStr + '，沿海社会散粮港存' + val1 + '万吨（环比' + change1Str + '%），' +
    '我司散粮库存占社会港存比例' + ratio + '％。' +
    '按当前走货速度测算，我司整体散粮港存预计可用' + days1 + '天（环比' + change2Str + '天），' +
    '较社会整体散粮港存可用天数（' + days2 + '天）' + daysCompare + '，' +
    '其中内贸玉米港存预计可用' + days3 + '天（环比' + change3Str + '天），' +
    '较社会内贸玉米港存可用天数（' + days4 + '天）高' + diffStr + '天。';

  return {
    date: dateStr,
    val1: val1,
    change1: change1Str,
    ratio: ratio,
    days1: days1,
    change2: change2Str,
    days2: days2,
    days3: days3,
    change3: change3Str,
    days4: days4,
    diff: diffStr,
    text: text,
    raw: {
      socialStockVal: socialStockVal,
      socialStockPrevVal: socialStockPrevVal,
      socialCornStock: socialCornStock,
      socialCornStockPrev: socialCornStockPrev,
      socialFlowVal: socialFlowVal,
      socialCornFlow: socialCornFlow,
      ourStockVal: ourStockVal,
      ourCornStock: ourCornStock,
      ourFlowVal: ourFlowVal,
      ourCornFlow: ourCornFlow
    }
  };
}

function refreshPortOutput() {
  var data = calcPortData();
  if (!data) {
    setPortStatus('err', '❌ 无法计算，请确认文件包含所需数据（社会港存、社会走货量、我司港存、我司走货量）');
    return;
  }
  portResult = data;

  document.getElementById('portEmptyState').style.display = 'none';
  document.getElementById('portResultArea').style.display = 'block';

  var textEl = document.getElementById('portTextOutput');
  textEl.innerHTML = '<div class="text-para">' + data.text + '</div>';

  var tableEl = document.getElementById('portTable');
  var r = data.raw;
  var rows = [
    ['社会散粮港存（万吨）', round2(r.socialStockVal), round2(r.socialStockPrevVal)],
    ['社会散粮周走货量（万吨）', round2(r.socialFlowVal), ''],
    ['社会散粮日均走货（万吨/天）', round2(r.socialFlowVal / 7), ''],
    ['社会散粮可用天数', data.days2, ''],
    ['社会内贸玉米港存（万吨）', round2(r.socialCornStock), round2(r.socialCornStockPrev)],
    ['社会内贸玉米周走货量（万吨）', round2(r.socialCornFlow), ''],
    ['社会内贸玉米日均走货（万吨/天）', round2(r.socialCornFlow / 7), ''],
    ['社会内贸玉米可用天数', data.days4, ''],
    ['我司散粮港存（万吨）', round2(r.ourStockVal), round2(r.ourStockPrevVal || 0)],
    ['我司散粮周走货量（万吨）', round2(r.ourFlowVal), ''],
    ['我司散粮日均走货（万吨/天）', round2(r.ourFlowVal / 7), ''],
    ['我司散粮可用天数', data.days1, ''],
    ['我司内贸玉米港存（万吨）', round2(r.ourCornStock), round2(r.ourCornStockPrev || 0)],
    ['我司内贸玉米周走货量（万吨）', round2(r.ourCornFlow), ''],
    ['我司内贸玉米日均走货（万吨/天）', round2(r.ourCornFlow / 7), ''],
    ['我司内贸玉米可用天数', data.days3, ''],
    ['我司占比（%）', data.ratio, ''],
  ];

  var html = '<thead><tr><th>指标</th><th>本周</th><th>上周</th></tr></thead><tbody>';
  for (var i = 0; i < rows.length; i++) {
    var cls = i % 2 === 0 ? '' : 'tr-even';
    html += '<tr class="' + cls + '"><td>' + rows[i][0] + '</td><td class="td-num">' + rows[i][1] + '</td><td class="td-num">' + (rows[i][2] || '-') + '</td></tr>';
  }
  html += '</tbody>';
  tableEl.innerHTML = html;

  updateFlowSequence(3);
  setPortStatus('ok', '✅ 生成成功！截止日期：' + data.date);
}

function copyPortText() {
  var el = document.getElementById('portTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

function setPortStatus(type, msg) {
  var el = document.getElementById('portUploadStatus');
  if (!el) return;
  el.className = 'upload-status ' + (type === 'err' ? 'status-err' : type === 'ok' ? 'status-ok' : '');
  el.textContent = msg;
  el.style.display = 'block';
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

window.portWorkbook = portWorkbook;
window.handlePortFile = handlePortFile;
window.handlePortDrop = handlePortDrop;
window.refreshPortOutput = refreshPortOutput;
window.copyPortText = copyPortText;
window.calcPortData = calcPortData;
