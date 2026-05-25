function buildParagraphRuns(htmlStr, docx) {
  const { TextRun } = docx;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlStr;
  const runs = [];
  tempDiv.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        runs.push(new TextRun({
          text: node.textContent,
          size: 24,
          font: { name: '仿宋_GB2312' },
          color: '1A1A1A',
        }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      runs.push(new TextRun({
        text: node.textContent,
        bold: true,
        size: 24,
        font: { name: '仿宋_GB2312' },
        color: 'C0392B',
      }));
    }
  });
  return runs;
}

function buildContractWordTable(docx, detailData, totalSigned, factor) {
  const { Table, TableRow, TableCell, TextRun, Paragraph, AlignmentType, BorderStyle, WidthType, VerticalAlign } = docx;
  const subDepts     = ['珠三角', '粤西', '广西', '海南', '福建'];
  const displayDepts = [...subDepts, '沿海大区'];
  const groups       = CONTRACT_TABLE_GROUPS;

  const C = {
    H_BG: '1E293B', H_FG: 'FFFFFF',
    SUB_SIGN: '334155', SUB_PLAN: '475569', SUB_RATE: '475569',
    DEPT_BG: 'F1F5F9', DEPT_FG: '1E293B',
    ODD: 'FFFFFF', EVEN: 'F8FAFC',
    PLAN_CELL: 'FFFFFF', PLAN_FG: '475569',
    RATE_CELL: 'FFFFFF',
    TOTAL_BG: 'E2E8F0', TOTAL_FG: '1E293B',
    TOTAL_PLAN: 'E2E8F0', TOTAL_RATE: 'E2E8F0',
    RED: 'DC2626', ORANGE: 'D97706', GREEN: '16A34A',
  };

  const thin = (color = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 4, color });
  const b    = (color = 'CBD5E1') => ({ top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) });

  function makeCell(text, opts = {}) {
    const {
      bold = false, colSpan = 1, rowSpan = 1,
      align = AlignmentType.CENTER,
      bg = 'FFFFFF', fg = '1A1A1A',
      size = 18, borders = b(),
      vAlign,
    } = opts;
    const cellProps = { borders, shading: { fill: bg }, verticalAlign: vAlign || VerticalAlign.CENTER };
    if (colSpan > 1) cellProps.columnSpan = colSpan;
    if (rowSpan > 1) cellProps.rowSpan = rowSpan;
    return new TableCell({
      ...cellProps,
      children: [new Paragraph({
        children: [new TextRun({ text: String(text), bold, size, font: { name: '宋体' }, color: fg })],
        alignment: align,
        spacing: { before: 30, after: 30 },
      })],
    });
  }

  const row1Cells = [makeCell('经营部', { bold: true, rowSpan: 2, bg: C.H_BG, fg: C.H_FG, size: 18, vAlign: VerticalAlign.CENTER })];
  groups.forEach(g => {
    row1Cells.push(makeCell(g.label, { bold: true, colSpan: 3, bg: C.H_BG, fg: C.H_FG, size: 18 }));
  });
  row1Cells.push(makeCell('合计', { bold: true, colSpan: 3, bg: C.H_BG, fg: C.H_FG, size: 18 }));
  const headerRow1 = new TableRow({ children: row1Cells, tableHeader: true });

  const row2Cells = [];
  const colCount = groups.length + 1;
  for (let i = 0; i < colCount; i++) {
    row2Cells.push(makeCell('签约量', { bold: true, bg: C.SUB_SIGN, fg: C.H_FG, size: 16 }));
    row2Cells.push(makeCell('计划量', { bold: true, bg: C.SUB_PLAN, fg: C.H_FG, size: 16 }));
    row2Cells.push(makeCell('完成率', { bold: true, bg: C.SUB_RATE, fg: C.H_FG, size: 16 }));
  }
  const headerRow2 = new TableRow({ children: row2Cells, tableHeader: true });

  const dataRows = displayDepts.map((dept, rowIdx) => {
    const isTotal = dept === '沿海大区';
    const rowBg   = isTotal ? C.TOTAL_BG : (rowIdx % 2 === 0 ? C.ODD : C.EVEN);
    const deptFg  = isTotal ? C.TOTAL_FG : C.DEPT_FG;

    const cells = [makeCell(dept, { bold: true, bg: isTotal ? C.TOTAL_BG : C.DEPT_BG, fg: deptFg, size: 18 })];

    let deptMap;
    if (isTotal) {
      deptMap = {};
      CONTRACT_TABLE_VARIETIES.forEach(v => { deptMap[v.key] = 0; });
      subDepts.forEach(sd => {
        const sdMap = mapDetailToVarietyColumns(detailData[sd]);
        CONTRACT_TABLE_VARIETIES.forEach(v => { deptMap[v.key] += sdMap[v.key]; });
      });
    } else {
      deptMap = mapDetailToVarietyColumns(detailData[dept]);
    }

    const groupSigned = calcGroupSigned(deptMap);
    let totalSignedRaw = 0;

    groups.forEach(g => {
      const sRaw = groupSigned[g.key] || 0;
      const sWan = sRaw / factor;
      const pWan = CONTRACT_PLAN_DATA[dept] ? (CONTRACT_PLAN_DATA[dept][g.key] || 0) : 0;
      const rateVal = pWan > 0 ? sWan / pWan * 100 : 0;
      const rateStr = pWan > 0 ? round2(rateVal) + '%' : '-';
      const rateFg  = rateVal >= 80 ? C.GREEN : rateVal >= 60 ? C.ORANGE : C.RED;
      totalSignedRaw += sRaw;

      cells.push(makeCell(sWan > 0 ? round2(sWan) : '-', { bold: isTotal, align: AlignmentType.RIGHT, bg: rowBg, fg: isTotal ? C.TOTAL_FG : '1E40AF', size: 18 }));
      cells.push(makeCell(pWan > 0 ? pWan : '-', { bold: isTotal, align: AlignmentType.RIGHT, bg: isTotal ? C.TOTAL_PLAN : C.PLAN_CELL, fg: C.PLAN_FG, size: 18 }));
      cells.push(makeCell(rateStr, { bold: true, align: AlignmentType.CENTER, bg: isTotal ? C.TOTAL_RATE : C.RATE_CELL, fg: isTotal ? '14532D' : rateFg, size: 18 }));
    });

    const tSignedWan = totalSignedRaw / factor;
    const tPlanWan   = CONTRACT_PLAN_DATA[dept] ? (CONTRACT_PLAN_DATA[dept]['合计'] || 0) : 0;
    const tRate      = tPlanWan > 0 ? tSignedWan / tPlanWan * 100 : 0;
    const tRateStr   = tPlanWan > 0 ? round2(tRate) + '%' : '-';
    const tRateFg    = tRate >= 80 ? C.GREEN : tRate >= 60 ? C.ORANGE : C.RED;

    cells.push(makeCell(round2(tSignedWan), { bold: true, align: AlignmentType.RIGHT, bg: isTotal ? C.TOTAL_BG : rowBg, fg: isTotal ? C.TOTAL_FG : 'C0392B', size: 18 }));
    cells.push(makeCell(tPlanWan > 0 ? tPlanWan : '-', { bold: true, align: AlignmentType.RIGHT, bg: isTotal ? C.TOTAL_PLAN : C.PLAN_CELL, fg: C.PLAN_FG, size: 18 }));
    cells.push(makeCell(tRateStr, { bold: true, align: AlignmentType.CENTER, bg: isTotal ? C.TOTAL_RATE : C.RATE_CELL, fg: isTotal ? '14532D' : tRateFg, size: 18 }));

    return new TableRow({ children: cells });
  });

  const totalCols = 1 + groups.length * 3 + 3;
  const pageWidthDxa = 9360;
  const colW = Math.floor(pageWidthDxa / totalCols);
  const columnWidths = Array(totalCols).fill(colW);

  return new Table({
    rows: [headerRow1, headerRow2, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
  });
}

async function exportWord() {
  if (typeof window.docx === 'undefined') {
    showToast('❌ docx库未加载，请检查网络连接后刷新');
    return;
  }

  const {
    Document, Packer, Paragraph, TextRun,
    AlignmentType, ImageRun, WidthType,
    Table, TableRow, TableCell, BorderStyle,
    VerticalAlign, UnderlineType,
  } = window.docx;

  const FONT_MAIN    = '仿宋_GB2312';
  const FONT_TITLE   = '方正小标宋简体';
  const FONT_HEADING = '黑体';
  const SIZE_TITLE   = 44;
  const SIZE_SUBTITLE= 32;
  const SIZE_HEADING = 28;
  const SIZE_BODY    = 24;
  const SIZE_CAPTION = 20;
  const COLOR_TITLE  = '1F3864';
  const COLOR_HEAD   = '1F4E79';
  const COLOR_BODY   = '1A1A1A';
  const COLOR_CAPTION= '7F8C8D';

  const docChildren = [];
  let filename = '';

  const intentEl = document.getElementById('textOutput');
  if (workbook && intentEl && intentEl.textContent.trim()) {
    const cfg = getIntentConfig();
    let dateRangeStr;
    if (cfg.dateStart && cfg.dateEnd) {
      const ws = new Date(cfg.dateStart);
      const we = new Date(cfg.dateEnd);
      dateRangeStr = `${ws.getMonth()+1}月${ws.getDate()}日-${we.getMonth()+1}月${we.getDate()}日`;
    } else {
      const weekRange = getWeekDateRange(cfg.year, cfg.week);
      const ws = weekRange.start;
      const we = weekRange.end;
      dateRangeStr = `${ws.getMonth()+1}月${ws.getDate()}日-${we.getMonth()+1}月${we.getDate()}日`;
    }
    filename = `${cfg.region}运营周报-${cfg.year}年第${cfg.week}周`;

    const parasHtml = Array.from(intentEl.querySelectorAll('.text-para')).map(p => p.innerHTML);

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `${cfg.region}运营周报`, size: SIZE_TITLE, font: { name: FONT_TITLE }, color: COLOR_TITLE, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, line: 400, lineRule: 'auto', after: 0 },
    }));
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `（${cfg.year}年第${cfg.week}周  ${dateRangeStr}）`, size: SIZE_SUBTITLE, font: { name: FONT_TITLE }, color: COLOR_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { line: 400, lineRule: 'auto', after: 0 },
    }));
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '', size: 8 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '1F4E79', space: 4 } },
      spacing: { before: 120, after: 360 },
    }));

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '一、总体销售及任务完成情况', size: SIZE_HEADING, font: { name: FONT_HEADING }, color: COLOR_HEAD, bold: true })],
      spacing: { line: 360, lineRule: 'auto', before: 120, after: 160 },
    }));

    docChildren.push(...parasHtml.map(html => new Paragraph({
      children: buildParagraphRuns(html, window.docx),
      alignment: AlignmentType.BOTH,
      indent: { firstLine: 480 },
      spacing: { line: 360, lineRule: 'auto', after: 80 },
    })));

    if (chartInstance) {
      try {
        const imgBase64 = getChartImageBase64();
        if (imgBase64) {
          const imgData = base64ToUint8Array(imgBase64);
          const canvas = document.getElementById('deptChart');
          const aspectRatio = canvas.height / canvas.width;
          const imgWidthEmu = 5486400;
          const imgHeightEmu = Math.round(imgWidthEmu * aspectRatio);
          const imgWidthPx  = Math.round(imgWidthEmu / 9144);
          const imgHeightPx = Math.round(imgHeightEmu / 9144);
          docChildren.push(
            new Paragraph({ children: [], spacing: { before: 200 } }),
            new Paragraph({
              children: [new ImageRun({ data: imgData, transformation: { width: imgWidthPx, height: imgHeightPx } })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: '图：本周各经营部意向销售量及环比变化情况', size: SIZE_CAPTION, font: { name: FONT_MAIN }, color: COLOR_CAPTION, italics: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 320 },
            }),
          );
        }
      } catch (imgErr) {
        console.warn('图表嵌入失败，跳过图片：', imgErr);
      }
    }
  }

  const contractEl = document.getElementById('contractTextOutput');
  if (contractWorkbook && contractEl && contractEl.textContent.trim()) {
    const cutoffDate = document.getElementById('contractCutoffDate').value;
    const region = document.getElementById('contractRegion').value || '沿海大区';

    if (!filename) filename = `${region}运营周报-销售签约`;
    else filename += '-完整版';

    const result = calcContractData();
    if (result) {
      const { detailData } = result;
      const subDepts = ['珠三角', '粤西', '广西', '海南', '福建'];

      let totalSigned = 0;
      subDepts.forEach(dept => {
        const deptMap = mapDetailToVarietyColumns(detailData[dept]);
        Object.values(deptMap).forEach(v => { totalSigned += v; });
      });

      docChildren.push(new Paragraph({
        children: [new TextRun({ text: '', size: 8 })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'BDC3C7', space: 4 } },
        spacing: { before: 320, after: 320 },
      }));

      docChildren.push(new Paragraph({
        children: [new TextRun({ text: '二、销售签约及任务完成情况', size: SIZE_HEADING, font: { name: FONT_HEADING }, color: COLOR_HEAD, bold: true })],
        spacing: { line: 360, lineRule: 'auto', before: 0, after: 160 },
      }));

      const contractParas = Array.from(contractEl.querySelectorAll('.text-para')).map(p => p.innerHTML);
      docChildren.push(...contractParas.map(html => new Paragraph({
        children: buildParagraphRuns(html, window.docx),
        alignment: AlignmentType.BOTH,
        indent: { firstLine: 480 },
        spacing: { line: 360, lineRule: 'auto', after: 80 },
      })));

      docChildren.push(new Paragraph({ children: [], spacing: { before: 240 } }));
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: '表：各经营部本年度签约量汇总（万吨）', size: SIZE_CAPTION, font: { name: FONT_MAIN }, color: COLOR_CAPTION, italics: true })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 100 },
      }));
      docChildren.push(buildContractWordTable(window.docx, detailData, totalSigned, contractUnitFactor));
    }
  }

  if (docChildren.length === 0) {
    showToast('⚠️ 请先生成意向销售或销售签约数据');
    return;
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: { name: FONT_MAIN }, size: SIZE_BODY, color: COLOR_BODY },
          paragraph: { spacing: { line: 360, lineRule: 'auto' } },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1800, right: 1440, bottom: 1800, left: 1800 } },
      },
      children: docChildren,
    }],
  });

  try {
    const blob = await Packer.toBlob(doc);
    if (typeof saveAs === 'function') {
      saveAs(blob, `${filename}.docx`);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    showToast('✅ Word文件已下载');
    updateFlowSequence(4);
  } catch (err) {
    console.error('Word导出错误:', err);
    showToast('❌ 导出失败：' + err.message);
  }
}

window.buildParagraphRuns = buildParagraphRuns;
window.buildContractWordTable = buildContractWordTable;
window.exportWord = exportWord;