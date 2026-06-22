var contractWorkbook = null;
const CONTRACT_DEPTS = CONFIG.regions;
const CONTRACT_PRODUCTS = [
  { key: '内贸玉米', label: '内贸玉米' },
  { key: '进口高粱', label: '进口高粱（含进口玉米、进口大麦、进口木薯片、进口葵花籽粕、进口DDGS（蛋白））' },
  { key: '进口玉米', label: '进口玉米' },
  { key: '进口大麦', label: '进口大麦' },
  { key: '进口木薯片', label: '进口木薯片' },
  { key: '进口葵花籽粕', label: '进口葵花籽粕' },
  { key: '进口DDGS（蛋白）', label: '进口DDGS（蛋白）' },
  { key: '小麦', label: '小麦' },
  { key: '稻谷', label: '稻谷' },
  { key: '国产大豆', label: '大豆' },
];

const CONTRACT_TABLE_VARIETIES = getConfig('contractVarieties') || CONFIG.contractVarieties;
const CONTRACT_TEXT_ORDER = getConfig('contractTextOrder') || CONFIG.contractTextOrder;
const CONTRACT_PLAN_DATA = getConfig('contractPlan') || CONFIG.contractPlan;
const CONTRACT_TABLE_GROUPS = getConfig('contractGroups') || CONFIG.contractGroups;
const CONTRACT_CATEGORIES = getConfig('contractCategories') || CONFIG.contractCategories;

let contractUnitFactor = 1;
let contractFilterColName = '26年纳入签约合同';

function getContractWorkbook() {
  if (contractWorkbook) return contractWorkbook;
  if (lastmileWorkbook) return lastmileWorkbook;
  if (containerWorkbook) return containerWorkbook;
  return null;
}

function mapDetailToVarietyColumns(deptData) {
  const result = {};
  CONTRACT_TABLE_VARIETIES.forEach(v => result[v.key] = 0);

  Object.entries(deptData || {}).forEach(([rawVariety, vals]) => {
    for (const v of CONTRACT_TABLE_VARIETIES) {
      const matched = v.match.some(m => rawVariety.includes(m) || m.includes(rawVariety));
      if (matched) {
        result[v.key] += vals.signed;
        break;
      }
    }
  });

  return result;
}

function detectUnitFactor(rawValues) {
  const maxVal = Math.max(...rawValues.filter(v => v > 0));
  if (maxVal > 5000) return 10000;
  if (maxVal < 200) return 1;
  return 10000;
}

function formatContractValue(val, factor) {
  if (factor === 1) return round2(val);
  return toWan(val);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');

  const chartBtn = document.querySelector('button[onclick="downloadChart()"]');
  const layout = document.querySelector('.layout');

  ['intent', 'contract', 'settle', 'lastmile', 'container', 'port'].forEach(t => {
    const sb = document.getElementById(`tab-${t}-sidebar`);
    const ct = document.getElementById(`tab-${t}-content`);
    if (sb) sb.style.display = 'none';
    if (ct) ct.style.display = 'none';
  });

  const sb = document.getElementById(`tab-${tab}-sidebar`);
  const ct = document.getElementById(`tab-${tab}-content`);
  if (sb) sb.style.display = '';
  if (ct) ct.style.display = '';

  if (tab === 'intent') {
    if (chartBtn) chartBtn.style.display = '';
    if (layout) layout.classList.add('with-flow');
    const resultArea = document.getElementById('resultArea');
    const hasResult = resultArea && resultArea.style.display !== 'none';
    updateFlowSequence(workbook ? (hasResult ? 3 : 1) : 0);
    updateTabWorkbookStatus('intent', !!workbook, '1-意向统计.xlsx');
  } else if (tab === 'contract') {
    if (chartBtn) chartBtn.style.display = 'none';
    if (layout) layout.classList.add('with-flow');
    const filterGroup = document.getElementById('contractFilter');
    const selected = Array.from(filterGroup.querySelectorAll('input:checked')).map(o => o.value);
    const hasFilter = selected.length > 0;
    const resultArea = document.getElementById('contractResultArea');
    const hasResult = resultArea && resultArea.style.display !== 'none';
    const hasBook = getContractWorkbook();
    const isReused = hasBook && !contractWorkbook && (!!lastmileWorkbook || !!containerWorkbook);
    const reuseSource = lastmileWorkbook ? '最后一公里' : (containerWorkbook ? '集装箱玉米' : null);
    if (hasBook) {
      if (hasResult) updateFlowSequence(3);
      else if (hasFilter) updateFlowSequence(2);
      else updateFlowSequence(1);
    } else {
      updateFlowSequence(0);
    }
    updateTabWorkbookStatus('contract', hasBook, '销售运营台账贴表.xlsx', isReused ? reuseSource : null);
  } else if (tab === 'settle') {
    if (chartBtn) chartBtn.style.display = 'none';
    if (layout) layout.classList.add('with-flow');
    const resultArea = document.getElementById('settleResultArea');
    const hasResult = resultArea && resultArea.style.display !== 'none';
    updateFlowSequence(settleWorkbook ? (hasResult ? 3 : 1) : 0);
    updateTabWorkbookStatus('settle', !!settleWorkbook, '销售发货清单.xlsx');
  } else if (tab === 'lastmile') {
    if (chartBtn) chartBtn.style.display = 'none';
    if (layout) layout.classList.add('with-flow');
    const resultArea = document.getElementById('lastmileResultArea');
    const hasResult = resultArea && resultArea.style.display !== 'none';
    const hasBook = getLastmileWorkbook();
    let reuseSource = null;
    if (hasBook && !lastmileWorkbook) {
      if (containerWorkbook) reuseSource = '集装箱玉米';
      else if (contractWorkbook) reuseSource = '销售签约';
    }
    updateFlowSequence(hasBook ? (hasResult ? 3 : 1) : 0);
    updateTabWorkbookStatus('lastmile', hasBook, '销售运营台账.xlsx', reuseSource);
  } else if (tab === 'container') {
    if (chartBtn) chartBtn.style.display = '';
    if (layout) layout.classList.add('with-flow');
    const resultArea = document.getElementById('containerResultArea');
    const hasResult = resultArea && resultArea.style.display !== 'none';
    const hasBook = getContainerWorkbook();
    let reuseSource = null;
    if (hasBook && !containerWorkbook) {
      if (lastmileWorkbook) reuseSource = '最后一公里';
      else if (contractWorkbook) reuseSource = '销售签约';
    }
    const reuseHint = document.getElementById('containerReuseHint');
    if (reuseHint) {
      reuseHint.style.display = reuseSource ? '' : 'none';
    }
    updateFlowSequence(hasBook ? (hasResult ? 3 : 1) : 0);
    updateTabWorkbookStatus('container', hasBook, '销售运营台账.xlsx', reuseSource);
  } else if (tab === 'port') {
    if (chartBtn) chartBtn.style.display = 'none';
    if (layout) layout.classList.add('with-flow');
    var portResultArea = document.getElementById('portResultArea');
    var hasPortResult = portResultArea && portResultArea.style.display !== 'none';
    updateFlowSequence(portWorkbook ? (hasPortResult ? 3 : 1) : 0);
    updateTabWorkbookStatus('port', !!portWorkbook, '3-沿海饲料原料数据核对-*.xlsx');
  }
}

function updateTabWorkbookStatus(tab, hasBook, fileName, reuseFrom) {
  const emptyState = document.getElementById(`${tab}EmptyState`);
  if (emptyState) {
    const p = emptyState.querySelector('p');
    const small = emptyState.querySelector('small');
    if (hasBook) {
      const reuseLabel = reuseFrom ? `（复用自${reuseFrom}）` : '';
      if (p) p.innerHTML = `✅ 数据已就绪（${fileName}）${reuseLabel}`;
      if (small) small.textContent = '点击左侧「刷新输出」即可生成数据';
    } else {
      if (p) p.innerHTML = `请在左侧上传「${fileName}」`;
      if (small) small.textContent = '上传后自动计算数据';
    }
  }
  const uploadZoneSmall = document.querySelector(`#${tab}UploadZone small`);
  if (uploadZoneSmall) {
    if (hasBook) {
      uploadZoneSmall.textContent = reuseFrom ? `✅ 已复用${reuseFrom}数据，可直接刷新输出` : '✅ 已加载，可直接刷新输出';
    } else {
      uploadZoneSmall.textContent = fileName;
    }
  }
}

function handleContractDrop(e) {
  e.preventDefault();
  document.getElementById('contractUploadZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processContractFile(file);
}

function handleContractFile(e) {
  const file = e.target.files[0];
  if (file) processContractFile(file);
}

function processContractFile(file) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    setContractStatus('err', '❌ 请上传 .xlsx 或 .xls 格式文件');
    return;
  }
  setContractStatus('ok', '⏳ 正在解析...');

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      contractWorkbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      setContractStatus('ok', `✅ 已加载：${file.name}`);
      autoPopulateContractOptions();
      showToast('文件解析成功，正在计算...');
      refreshContractOutput();
    } catch (err) {
      setContractStatus('err', '❌ 解析失败：' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function onContractFilterChange() {
  updateFlowSequence(2);
}

function autoPopulateContractOptions() {
  const wb = getContractWorkbook();
  if (!wb) return;
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

  let headerRow = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i] && rows[i].some(h => h && String(h).includes('经营部'))) { headerRow = i; break; }
  }
  const header = rows[headerRow] || [];

  const valueColSelect = document.getElementById('contractValueCol');
  valueColSelect.innerHTML = '';
  const numericCandidates = [];
  header.forEach(h => {
    if (!h) return;
    const name = String(h).trim();
    if (name.includes('签约') || name.includes('合同') || name.includes('量') || name.includes('吨')) {
      numericCandidates.push(name);
    }
  });
  if (numericCandidates.length === 0) {
    header.forEach(h => { if (h) numericCandidates.push(String(h).trim()); });
  }
  numericCandidates.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name.includes('26年合同量') && name.includes('签约')) opt.selected = true;
    valueColSelect.appendChild(opt);
  });

  const filterGroup = document.getElementById('contractFilter');
  let filterColIdx = header.findIndex(h => h && String(h).trim() === '26年纳入签约合同');
  if (filterColIdx < 0) {
    filterColIdx = header.findIndex(h => h && (String(h).includes('纳入') || String(h).includes('签约合同')));
  }
  if (filterColIdx >= 0) {
    contractFilterColName = String(header[filterColIdx]).trim();
    const uniqueValues = new Set();
    for (let i = headerRow + 1; i < rows.length; i++) {
      const val = rows[i] ? String(rows[i][filterColIdx] || '').trim() : '';
      if (val) uniqueValues.add(val);
    }
    filterGroup.innerHTML = '';
    uniqueValues.forEach(val => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = val;
      if (val === '是') input.checked = true;
      const span = document.createElement('span');
      span.textContent = val;
      label.appendChild(input);
      label.appendChild(span);
      filterGroup.appendChild(label);
    });
  }

  updateFlowSequence(1);
}

function setContractStatus(type, msg) {
  const el = document.getElementById('contractUploadStatus');
  el.className = 'upload-status ' + type;
  el.textContent = msg;
}

function calcContractData() {
  const wb = getContractWorkbook();
  if (!wb) return null;

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('未找到工作表');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  if (rows.length < 2) throw new Error('台账数据为空');

  let headerRow = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i] && rows[i].some(h => h && String(h).includes('经营部'))) { headerRow = i; break; }
  }
  const header = rows[headerRow];
  const H = {};
  header.forEach((h, i) => { if (h) H[String(h).trim()] = i; });

  const filterGroup = document.getElementById('contractFilter');
  const selectedFilters = Array.from(filterGroup.querySelectorAll('input:checked')).map(o => o.value);

  const valueColName = document.getElementById('contractValueCol').value;

  const dateColCandidates = ['日期', '签约日期', '合同日期', '统计日期', '截止日期', '发生日期'];
  let dateColIdx = -1;
  for (const cand of dateColCandidates) {
    if (H[cand] !== undefined) { dateColIdx = H[cand]; break; }
  }
  if (dateColIdx < 0) {
    for (let i = 0; i < header.length; i++) {
      const h = String(header[i] || '').trim();
      if (/日期|时间|date/i.test(h)) { dateColIdx = i; break; }
    }
  }

  const cutoffDateStr = document.getElementById('contractCutoffDate')?.value;
  let cutoffTs = null;
  if (cutoffDateStr && dateColIdx >= 0) {
    const d = new Date(cutoffDateStr);
    if (!isNaN(d)) cutoffTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  const rawValues = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const v = safeFloat(row[H[valueColName]]);
    if (v > 0) rawValues.push(v);
  }
  if (rawValues.length > 0) {
    const manualUnit = document.getElementById('contractUnit')?.value;
    if (manualUnit === 'ton') contractUnitFactor = 10000;
    else if (manualUnit === 'wan') contractUnitFactor = 1;
    else contractUnitFactor = detectUnitFactor(rawValues);
  }

  const data = {};
  CONTRACT_DEPTS.forEach(d => {
    data[d] = {};
    CONTRACT_TABLE_GROUPS.forEach(g => {
      data[d][g.key] = { signed: 0 };
    });
    data[d]['合计'] = { signed: 0 };
  });

  const detailData = {};
  CONTRACT_DEPTS.forEach(d => {
    detailData[d] = {};
  });

  let rowCount = 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const dept = String(row[H['经营部']] || '').trim();
    if (!CONTRACT_DEPTS.includes(dept)) continue;

    if (dateColIdx >= 0 && cutoffTs !== null) {
      const dateRaw = row[dateColIdx];
      if (dateRaw) {
        let rowDate;
        if (dateRaw instanceof Date) {
          rowDate = new Date(dateRaw.getFullYear(), dateRaw.getMonth(), dateRaw.getDate());
        } else {
          const d = new Date(dateRaw);
          if (!isNaN(d)) rowDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
        if (rowDate && rowDate.getTime() > cutoffTs) continue;
      }
    }

    const filterVal = String(row[H[contractFilterColName]] || '').trim();
    if (selectedFilters.length > 0 && !selectedFilters.includes(filterVal)) continue;

    const variety = String(row[H['品种']] || '').trim();
    const signedQty = safeFloat(row[H[valueColName]]);
    if (signedQty <= 0) continue;

    let groupKey = null;
    for (const g of CONTRACT_TABLE_GROUPS) {
      if (g.products.some(p => variety.includes(p) || p.includes(variety))) {
        groupKey = g.key;
        break;
      }
    }
    if (!groupKey) {
      if (variety.includes('玉米') && !variety.includes('进口')) groupKey = '国产玉米';
      else if (variety.includes('高粱') || variety.includes('大麦') || variety.includes('木薯') || variety.includes('葵花') || variety.includes('DDGS')) groupKey = '进口高粱组';
      else if (variety.includes('小麦')) groupKey = '小麦';
      else if (variety.includes('稻谷') || variety.includes('稻')) groupKey = '稻谷';
      else if (variety.includes('大豆') || variety.includes('豆')) groupKey = '进口大豆';
    }

    if (groupKey) {
      data[dept][groupKey].signed += signedQty;
      data[dept]['合计'].signed += signedQty;
    }

    if (!detailData[dept][variety]) detailData[dept][variety] = { signed: 0 };
    detailData[dept][variety].signed += signedQty;

    rowCount++;
  }

  return { data, detailData, rowCount, valueColName };
}

function calcGroupSigned(deptMap) {
  const result = {};
  CONTRACT_TABLE_GROUPS.forEach(g => { result[g.key] = 0; });
  result['国产玉米']   = (deptMap['国产玉米'] || 0);
  result['进口高粱组'] = (deptMap['进口玉米'] || 0) + (deptMap['进口大麦'] || 0)
    + (deptMap['进口高粱'] || 0) + (deptMap['进口木薯片'] || 0)
    + (deptMap['进口葵花籽粕'] || 0) + (deptMap['DDGS'] || 0);
  result['小麦']       = (deptMap['小麦'] || 0);
  result['稻谷']       = (deptMap['稻谷'] || 0);
  result['进口大豆']   = (deptMap['国产大豆'] || 0);
  return result;
}

function calcCarryoverOnly(region, cutoffStr) {
  const wb = getContractWorkbook();
  if (!wb) return null;
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    let headerRow = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if (rows[i] && rows[i].some(h => h && String(h).includes('经营部'))) { headerRow = i; break; }
    }
    const header = rows[headerRow];
    const H = {};
    header.forEach((h, i) => { if (h) H[String(h).trim()] = i; });

    const valueColName = document.getElementById('contractValueCol').value;
    let carryover = 0;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const dept = String(row[H['经营部']] || '').trim();
      if (!CONTRACT_DEPTS.includes(dept) || dept === '沿海大区') continue;
      const filterVal = String(row[H[contractFilterColName]] || '').trim();
      if (filterVal !== '25年结转') continue;
      const qty = safeFloat(row[H[valueColName]]);
      if (qty > 0) carryover += qty;
    }
    return { carryover };
  } catch (e) {
    return null;
  }
}

function refreshContractOutput() {
  if (!getContractWorkbook()) return;

  try {
    const result = calcContractData();
    if (!result) return;
    const { data, detailData, rowCount } = result;

    const cutoffDate = document.getElementById('contractCutoffDate').value;
    const region = document.getElementById('contractRegion').value || '沿海大区';
    const factor = contractUnitFactor;

    const subDepts = ['珠三角', '粤西', '广西', '海南', '福建'];

    const subDeptMaps = {};
    subDepts.forEach(dept => {
      subDeptMaps[dept] = mapDetailToVarietyColumns(detailData[dept]);
    });

    let totalSigned = 0;
    let totalPlan = 0;

    subDepts.forEach(dept => {
      Object.values(subDeptMaps[dept]).forEach(v => totalSigned += v);
      totalPlan += CONTRACT_PLAN_DATA[dept]['合计'] || 0;
    });

    CONTRACT_TABLE_GROUPS.forEach(g => {
      let gSigned = 0;
      subDepts.forEach(dept => {
        gSigned += data[dept][g.key].signed;
      });
      data['沿海大区'][g.key] = { signed: gSigned };
    });
    data['沿海大区']['合计'] = { signed: totalSigned };

    const totalSignedWan = totalSigned / factor;
    const totalRate = totalPlan > 0 ? round2((totalSignedWan / totalPlan) * 100) : 0;

    const cutoffStr = cutoffDate
      ? `${parseInt(cutoffDate.split('-')[1])}月${parseInt(cutoffDate.split('-')[2])}日`
      : '';

    const textParts = [];
    const totalWan = formatContractValue(totalSigned, factor);
    textParts.push(`截至${cutoffStr}，${region}本年累计销售签约<span class="highlight">${totalWan}</span>万吨`);

    const carryoverData = calcCarryoverOnly(region, cutoffStr);
    if (carryoverData && carryoverData.carryover > 0) {
      const coWan = formatContractValue(carryoverData.carryover, factor);
      textParts[0] += `（含结转<span class="highlight">${coWan}</span>万吨）`;
    } else {
      textParts[0] += `。`;
    }

    const allVarietyTotals = {};
    CONTRACT_TABLE_VARIETIES.forEach(v => { allVarietyTotals[v.key] = 0; });
    subDepts.forEach(dept => {
      CONTRACT_TABLE_VARIETIES.forEach(v => {
        allVarietyTotals[v.key] += subDeptMaps[dept][v.key];
      });
    });

    const detailItems = [];
    CONTRACT_TABLE_VARIETIES.forEach(v => {
      const signed = allVarietyTotals[v.key];
      if (signed > 0) {
        detailItems.push(`${v.key}<span class="highlight">${formatContractValue(signed, factor)}</span>万吨`);
      }
    });

    if (detailItems.length > 0) {
      textParts.push(`其中${detailItems.join('，')}。`);
    }

    textParts.push(`${region}年度任务完成率<span class="highlight">${totalRate}</span>％（签约口径）`);

    const deptRates = [];
    subDepts.forEach(dept => {
      const dSigned = Object.values(subDeptMaps[dept]).reduce((a, b) => a + b, 0) / factor;
      const dPlan = CONTRACT_PLAN_DATA[dept]['合计'] || 0;
      const rate = dPlan > 0 ? round2((dSigned / dPlan) * 100) : 0;
      deptRates.push({ dept, rate });
    });

    const belowAvg = deptRates.filter(d => d.rate < totalRate);
    if (belowAvg.length > 0) {
      const names = belowAvg.map(d => d.dept).join('、');
      textParts.push(`，其中${names}完成率低于大区平均水平`);
      const lowestDept = belowAvg[0].dept;
      let lowestGroup = '';
      let lowestRateVal = Infinity;

      const groupToVarietyKeys = getConfig('groupToVarietyKeys') || CONFIG.groupToVarietyKeys;

      const lowestDeptMap = subDeptMaps[lowestDept];
      CONTRACT_TABLE_GROUPS.forEach(g => {
        const planWan = CONTRACT_PLAN_DATA[lowestDept][g.key] || 0;
        if (planWan <= 0) return;
        const varKeys = groupToVarietyKeys[g.key] || [];
        const signedRaw = varKeys.reduce((sum, k) => sum + (lowestDeptMap[k] || 0), 0);
        const signedWan = signedRaw / factor;
        const r = (signedWan / planWan) * 100;
        if (r < lowestRateVal) {
          lowestRateVal = r;
          lowestGroup = g.key;
        }
      });
      if (lowestGroup) {
        textParts.push(`，主要为${lowestGroup}完成率偏低`);
      }
      textParts.push('。');
    } else {
      textParts.push('。');
    }

    const contractText = textParts.join('');

    document.getElementById('contractEmptyState').style.display = 'none';
    document.getElementById('contractResultArea').style.display = 'block';

    document.getElementById('contractTextOutput').innerHTML = `<div class="text-para">${contractText}</div>`;

     renderContractTable(detailData, totalSigned, factor, subDeptMaps);

     if (lastmileWorkbook === null) {
       lastmileWorkbook = contractWorkbook;
       updateTabWorkbookStatus('lastmile', true, '销售运营台账.xlsx');
     }
     if (containerWorkbook === null) {
       containerWorkbook = contractWorkbook;
       updateTabWorkbookStatus('container', true, '销售运营台账.xlsx');
       const reuseHint = document.getElementById('containerReuseHint');
       if (reuseHint) reuseHint.style.display = '';
     }

     updateFlowSequence(3);

     showToast(`✅ 计算完成，共解析 ${rowCount} 条记录（单位：${factor === 1 ? '万吨' : '吨→万吨'}）`);

  } catch (err) {
    showToast('❌ 计算失败：' + err.message);
    console.error(err);
  }
}

function renderContractTable(detailData, totalSigned, factor, cachedDeptMaps) {
  const table = document.getElementById('contractTable');
  const subDepts  = ['珠三角', '粤西', '广西', '海南', '福建'];
  const displayDepts = [...subDepts, '沿海大区'];
  const groups = CONTRACT_TABLE_GROUPS;

  let tr1 = '<tr>';
  tr1 += '<th class="th-dept" rowspan="2">经营部</th>';
  groups.forEach(g => {
    tr1 += `<th colspan="3" class="th-group th-group-${g.key.replace(/[^a-z0-9]/gi, '')}">${g.label}</th>`;
  });
  tr1 += '<th colspan="3" class="th-group th-group-total">合计</th>';
  tr1 += '</tr>';

  let tr2 = '<tr>';
  const subCols = ['签约量', '计划量', '完成率'];
  const colCount = groups.length + 1;
  for (let i = 0; i < colCount; i++) {
    subCols.forEach((c, ci) => {
      const cls = ci === 0 ? 'th-sub th-sub-signed' : ci === 1 ? 'th-sub th-sub-plan' : 'th-sub th-sub-rate';
      tr2 += `<th class="${cls}">${c}</th>`;
    });
  }
  tr2 += '</tr>';

  let thead = `<thead>${tr1}${tr2}</thead>`;

  let tbody = '<tbody>';
  displayDepts.forEach(dept => {
    const isTotal = dept === '沿海大区';
    tbody += `<tr class="${isTotal ? 'tr-total' : ''}">`;
    tbody += `<td class="td-dept">${dept}</td>`;

    let deptMap;
    if (isTotal) {
      deptMap = {};
      CONTRACT_TABLE_VARIETIES.forEach(v => { deptMap[v.key] = 0; });
      subDepts.forEach(sd => {
        const sdMap = cachedDeptMaps ? cachedDeptMaps[sd] : mapDetailToVarietyColumns(detailData[sd]);
        CONTRACT_TABLE_VARIETIES.forEach(v => { deptMap[v.key] += sdMap[v.key]; });
      });
    } else {
      deptMap = cachedDeptMaps ? cachedDeptMaps[dept] : mapDetailToVarietyColumns(detailData[dept]);
    }

    const groupSigned = calcGroupSigned(deptMap);
    let totalSignedRaw = 0;

    groups.forEach(g => {
      const sRaw  = groupSigned[g.key] || 0;
      const sWan  = sRaw / factor;
      const pWan  = CONTRACT_PLAN_DATA[dept] ? (CONTRACT_PLAN_DATA[dept][g.key] || 0) : 0;
      const rateVal = pWan > 0 ? sWan / pWan * 100 : 0;
      const rateStr = pWan > 0 ? round2(rateVal) + '%' : '-';
      const rateClass = rateVal >= 80 ? 'rate-success' : rateVal >= 60 ? 'rate-warning' : 'rate-danger';
      totalSignedRaw += sRaw;

      tbody += `<td class="td-num">${sWan > 0 ? round2(sWan) : '-'}</td>`;
      tbody += `<td class="td-plan">${pWan > 0 ? pWan : '-'}</td>`;
      tbody += `<td class="td-rate ${rateClass}">${rateStr}</td>`;
    });

    const totalSignedWan = totalSignedRaw / factor;
    const totalPlanWan   = CONTRACT_PLAN_DATA[dept] ? (CONTRACT_PLAN_DATA[dept]['合计'] || 0) : 0;
    const totalRate      = totalPlanWan > 0 ? totalSignedWan / totalPlanWan * 100 : 0;
    const totalRateStr   = totalPlanWan > 0 ? round2(totalRate) + '%' : '-';
    const totalRateClass = totalRate >= 80 ? 'rate-success' : totalRate >= 60 ? 'rate-warning' : 'rate-danger';

    tbody += `<td class="td-num td-total-num"><strong>${round2(totalSignedWan)}</strong></td>`;
    tbody += `<td class="td-plan td-total-plan"><strong>${totalPlanWan > 0 ? totalPlanWan : '-'}</strong></td>`;
    tbody += `<td class="td-rate td-total-rate ${totalRateClass}"><strong>${totalRateStr}</strong></td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
}

function copyContractText() {
  const el = document.getElementById('contractTextOutput');
  if (!el) return;
  Utils.copyToClipboard(el.innerText);
}

window.contractWorkbook = contractWorkbook;
window.CONTRACT_DEPTS = CONTRACT_DEPTS;
window.CONTRACT_PRODUCTS = CONTRACT_PRODUCTS;
window.CONTRACT_TABLE_VARIETIES = CONTRACT_TABLE_VARIETIES;
window.CONTRACT_TEXT_ORDER = CONTRACT_TEXT_ORDER;
window.CONTRACT_PLAN_DATA = CONTRACT_PLAN_DATA;
window.CONTRACT_TABLE_GROUPS = CONTRACT_TABLE_GROUPS;
window.CONTRACT_CATEGORIES = CONTRACT_CATEGORIES;
window.contractUnitFactor = contractUnitFactor;
window.contractFilterColName = contractFilterColName;
window.getContractWorkbook = getContractWorkbook;
window.handleContractDrop = handleContractDrop;
window.handleContractFile = handleContractFile;
window.processContractFile = processContractFile;
window.onContractFilterChange = onContractFilterChange;
window.autoPopulateContractOptions = autoPopulateContractOptions;
window.calcContractData = calcContractData;
window.calcGroupSigned = calcGroupSigned;
window.calcCarryoverOnly = calcCarryoverOnly;
window.refreshContractOutput = refreshContractOutput;
window.renderContractTable = renderContractTable;
window.copyContractText = copyContractText;
window.mapDetailToVarietyColumns = mapDetailToVarietyColumns;
window.detectUnitFactor = detectUnitFactor;
window.formatContractValue = formatContractValue;