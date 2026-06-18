var ocrRecognizing = false;

async function recognizeTableImage(imageFile) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract.js 未加载，请检查网络连接');
  }

  const result = await Tesseract.recognize(
    imageFile,
    'chi_sim+eng',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          const percent = Math.round(m.progress * 100);
          document.getElementById('ocrPercent').textContent = percent;
          document.getElementById('ocrProgressBar').style.width = percent + '%';
        }
      }
    }
  );

  const text = result.data.text;
  console.log('OCR识别原始文本:', text);
  return text;
}

function parseSettleTableFromOCR(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 2);
  console.log('OCR识别行:', lines);

  const DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
  const GROUPS = ['国产玉米', '进口高粱组', '小麦', '稻谷', '进口大豆'];

  const deptData = {};
  DEPTS.forEach(d => { deptData[d] = {}; });

  let foundTableStart = false;
  let headerColumns = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('经营部') || line.includes('合计') || line.includes('结算量')) {
      foundTableStart = true;
      headerColumns = line.split(/\s+/);
      continue;
    }

    if (!foundTableStart) continue;

    let matchDept = null;
    for (const dept of DEPTS) {
      if (line.includes(dept)) {
        matchDept = dept;
        break;
      }
    }

    if (matchDept) {
      const numbers = line.match(/[\d,.]+/g) || [];
      const numValues = numbers.map(n => parseFloat(n.replace(/,/g, '')) || 0);

      if (numValues.length >= 5) {
        GROUPS.forEach((group, idx) => {
          if (idx < numValues.length) {
            deptData[matchDept][group] = numValues[idx] * 10000;
          }
        });
      }
    }
  }

  const total = {};
  GROUPS.forEach(group => {
    total[group] = 0;
    DEPTS.forEach(dept => {
      total[group] += deptData[dept][group] || 0;
    });
  });

  return { deptData, total, rowCount: Object.keys(deptData).length };
}

function parseSettleTableFromOCRManual() {
  const DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
  const GROUPS = ['国产玉米', '进口高粱组', '小麦', '稻谷', '进口大豆'];

  const deptData = {};
  DEPTS.forEach(d => {
    deptData[d] = {};
    GROUPS.forEach(g => {
      deptData[d][g] = 0;
    });
  });

  const total = {};
  GROUPS.forEach(g => { total[g] = 0; });

  return { deptData, total, rowCount: 0 };
}

function processSettleOCRResult(text) {
  const result = parseSettleTableFromOCRManual();
  const DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];
  const GROUPS = ['国产玉米', '进口高粱组', '小麦', '稻谷', '进口大豆'];

  const lines = text.split('\n').filter(line => line.trim().length > 2);
  let currentDept = null;
  let numBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const numbers = line.match(/\d+[,.]\d*|\d+/g) || [];
    const nums = numbers.map(n => parseFloat(n.replace(/,/g, '')) || 0);
    numBuffer = numBuffer.concat(nums);

    for (const dept of DEPTS) {
      if (line.includes(dept)) {
        if (currentDept && numBuffer.length >= 5) {
          GROUPS.forEach((g, idx) => {
            if (idx < numBuffer.length) {
              result.deptData[currentDept][g] = numBuffer[idx] * 10000;
            }
          });
        }
        currentDept = dept;
        numBuffer = nums.slice(nums.length > 5 ? -5 : 0);
        break;
      }
    }
  }

  if (currentDept && numBuffer.length >= 5) {
    GROUPS.forEach((g, idx) => {
      if (idx < numBuffer.length) {
        result.deptData[currentDept][g] = numBuffer[idx] * 10000;
      }
    });
  }

  GROUPS.forEach(g => {
    result.total[g] = DEPTS.reduce((sum, d) => sum + (result.deptData[d][g] || 0), 0);
  });

  result.rowCount = DEPTS.filter(d => Object.values(result.deptData[d]).some(v => v > 0)).length;

  return result;
}

async function handleSettleImageFile(file) {
  if (!file) return;

  if (ocrRecognizing) {
    showToast('⚠️ 正在识别中，请稍候...');
    return;
  }

  const statusEl = document.getElementById('settleImageUploadStatus');
  const progressEl = document.getElementById('ocrProgress');

  try {
    ocrRecognizing = true;
    statusEl.className = 'upload-status ok';
    statusEl.textContent = '⏳ 正在加载OCR引擎...';
    statusEl.style.display = 'block';
    progressEl.style.display = 'block';
    document.getElementById('ocrPercent').textContent = '0';
    document.getElementById('ocrProgressBar').style.width = '0%';

    const text = await recognizeTableImage(file);
    statusEl.textContent = '✅ 识别完成，正在解析表格...';

    await new Promise(resolve => setTimeout(resolve, 500));

    const result = processSettleOCRResult(text);

    if (result.rowCount === 0) {
      statusEl.className = 'upload-status err';
      statusEl.textContent = '⚠️ 未识别到有效数据，请手动确认识别结果';
      showOCRPreview(text);
      return;
    }

    statusEl.textContent = `✅ 识别完成，共 ${result.rowCount} 条数据`;

    window.settleOCRData = result;
    settleWorkbook = { __isOCRData: true };

    refreshSettleOutputFromOCR(result);

  } catch (err) {
    statusEl.className = 'upload-status err';
    statusEl.textContent = '❌ 识别失败：' + err.message;
    console.error('OCR Error:', err);
    showToast('❌ OCR识别失败: ' + err.message);
  } finally {
    ocrRecognizing = false;
    progressEl.style.display = 'none';
  }
}

function showOCRPreview(rawText) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:12px;max-width:600px;width:90%;max-height:80vh;overflow:auto;">
      <h3 style="margin-bottom:16px;">🔍 OCR识别结果</h3>
      <textarea id="ocrEditArea" style="width:100%;height:300px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre;">${rawText}</textarea>
      <div style="margin-top:16px;display:flex;gap:12px;justify-content:flex-end;">
        <button onclick="this.closest('div').parentNode.remove()" style="padding:8px 16px;background:#e2e8f0;border:none;border-radius:6px;cursor:pointer;">取消</button>
        <button onclick="applyOCREdit()" style="padding:8px 16px;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer;">确认使用</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function applyOCREdit() {
  const text = document.getElementById('ocrEditArea').value;
  const result = processSettleOCRResult(text);

  window.settleOCRData = result;
  settleWorkbook = { __isOCRData: true };

  document.querySelector('#ocrEditArea').closest('div[style*=fixed]').remove();

  if (result.rowCount > 0) {
    refreshSettleOutputFromOCR(result);
    showToast(`✅ 已应用，共 ${result.rowCount} 条数据`);
  } else {
    showToast('⚠️ 未识别到有效数据');
  }
}

function handleSettleImageDrop(e) {
  e.preventDefault();
  document.getElementById('settleImageUploadZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleSettleImageFile(file);
  } else if (file) {
    showToast('⚠️ 请上传图片文件');
  }
}

function handleSettleImageFileEvent(e) {
  const file = e.target.files[0];
  if (file) {
    handleSettleImageFile(file);
  }
}

function refreshSettleOutputFromOCR(ocrData) {
  try {
    const { deptData, total } = ocrData;
    const region = document.getElementById('settleRegion')?.value || '沿海大区';
    const groups = CONFIG.contractGroups;
    const DEPTS = ['珠三角', '粤西', '广西', '福建', '海南'];

    const toW = v => round2(v / 10000);

    let totalAll = 0;
    groups.forEach(g => {
      totalAll += toW(total[g.key]);
    });
    totalAll = round2(totalAll);

    let textParts = [`本年累计销售结算${totalAll}万吨。`];
    textParts.push(`其中内贸玉米${toW(total['国产玉米'])}万吨，`);
    textParts.push(`进口替代${toW(total['进口高粱组'])}万吨`);
    textParts.push(`；小麦${toW(total['小麦'])}万吨，稻谷${toW(total['稻谷'])}万吨，大豆${toW(total['进口大豆'])}万吨。`);

    const settleText = textParts.join('');

    document.getElementById('settleEmptyState').style.display = 'none';
    document.getElementById('settleResultArea').style.display = 'block';
    document.getElementById('settleTextOutput').innerHTML = `<div class="text-para">${settleText}</div>`;

    renderSettleTable(deptData, total, groups, DEPTS, region, toW);

    updateFlowSequence(3);
    showToast(`✅ OCR数据已加载，共识别 ${ocrData.rowCount} 条数据`);

  } catch (err) {
    showToast('❌ 处理失败：' + err.message);
    console.error(err);
  }
}

window.handleSettleImageDrop = handleSettleImageDrop;
window.handleSettleImageFile = handleSettleImageFileEvent;
window.refreshSettleOutputFromOCR = refreshSettleOutputFromOCR;
window.applyOCREdit = applyOCREdit;
