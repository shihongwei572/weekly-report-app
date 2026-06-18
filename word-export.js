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
    H_BG: '1E40AF', H_FG: 'FFFFFF',
    SUB_SIGN: '1E3A8A', SUB_PLAN: '2563EB', SUB_RATE: '3B82F6',
    DEPT_BG: 'DBEAFE', DEPT_FG: '1E40AF',
    ODD: 'FFFFFF', EVEN: 'EFF6FF',
    PLAN_CELL: 'F0F9FF', PLAN_FG: '1E40AF',
    RATE_CELL: 'F0F9FF',
    TOTAL_BG: 'BFDBFE', TOTAL_FG: '1E40AF',
    TOTAL_PLAN: 'BFDBFE', TOTAL_RATE: 'BFDBFE',
    RED: 'DC2626', ORANGE: 'D97706', GREEN: '059669',
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
  const pageWidthDxa = 14400;
  
  const columnWidths = [1100];
  for (let i = 0; i < groups.length; i++) {
    columnWidths.push(750, 700, 750);
  }
  columnWidths.push(800, 750, 800);

  return new Table({
    rows: [headerRow1, headerRow2, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
  });
}

function buildSettleWordTable(docx, data) {
  const { Table, TableRow, TableCell, TextRun, Paragraph, AlignmentType, BorderStyle, WidthType, VerticalAlign } = docx;
  const displayDepts = ['珠三角', '粤西', '广西', '福建', '海南', '合计'];
  const columns = ['国产玉米', '进口高粱', '进口大麦', '进口木薯片', '进口葵花籽粕', 'DDGS', '小麦', '食用稻谷', '大豆'];

  const C = {
    H_BG: '1E40AF', H_FG: 'FFFFFF',
    DEPT_BG: 'DBEAFE', DEPT_FG: '1E40AF',
    ODD: 'FFFFFF', EVEN: 'EFF6FF',
    TOTAL_BG: 'BFDBFE', TOTAL_FG: '1E40AF',
  };

  const thin = (color = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 4, color });
  const b = (color = 'CBD5E1') => ({ top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) });

   function makeCell(text, opts = {}) {
    const {
      bold = false, colSpan = 1,
      align = AlignmentType.CENTER,
      bg = 'FFFFFF', fg = '1A1A1A',
      size = 18, borders = b(),
    } = opts;
    const cellProps = { borders, shading: { fill: bg }, verticalAlign: VerticalAlign.CENTER };
    if (colSpan > 1) cellProps.columnSpan = colSpan;
    return new TableCell({
      ...cellProps,
      children: [new Paragraph({
        children: [new TextRun({ text: String(text), bold, size, font: { name: '宋体' }, color: fg })],
        alignment: align,
        spacing: { before: 60, after: 60 },
      })],
    });
  }

  const headerCells = [makeCell('经营部', { bold: true, bg: C.H_BG, fg: C.H_FG, size: 18 })];
  columns.forEach(c => {
    headerCells.push(makeCell(c, { bold: true, bg: C.H_BG, fg: C.H_FG, size: 16 }));
  });
  headerCells.push(makeCell('合计', { bold: true, bg: C.H_BG, fg: C.H_FG, size: 18 }));
  const headerRow = new TableRow({ children: headerCells, tableHeader: true });

  const { deptData, total } = data;
  const dataRows = displayDepts.map((dept, rowIdx) => {
    const isTotal = dept === '合计';
    const rowBg = isTotal ? C.TOTAL_BG : (rowIdx % 2 === 0 ? C.ODD : C.EVEN);
    const dataRow = isTotal ? total : (deptData[dept] || {});

    const cells = [makeCell(dept, { bold: true, bg: isTotal ? C.TOTAL_BG : C.DEPT_BG, fg: isTotal ? C.TOTAL_FG : C.DEPT_FG, size: 18 })];

    let rowSum = 0;
    columns.forEach(c => {
      const val = round2(dataRow[c] || 0);
      rowSum += val;
      cells.push(makeCell(val > 0 ? val : '-', { bold: isTotal, align: AlignmentType.RIGHT, bg: rowBg, size: 18 }));
    });

    rowSum = round2(rowSum);
    cells.push(makeCell(rowSum > 0 ? rowSum : '-', { bold: true, align: AlignmentType.RIGHT, bg: isTotal ? C.TOTAL_BG : rowBg, fg: isTotal ? C.TOTAL_FG : 'C0392B', size: 18 }));

    return new TableRow({ children: cells });
  });

  const totalCols = 1 + columns.length + 1;
  const columnWidths = [1200, ...Array(totalCols - 2).fill(900), 900];

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
  });
}

function buildLastmileWordTable(docx, data) {
  const { Table, TableRow, TableCell, TextRun, Paragraph, AlignmentType, BorderStyle, WidthType, VerticalAlign } = docx;
  const DEPTS = ['珠三角', '粤西', '广西', '海南', '福建'];
  
  const C = {
    H_BG: '1E40AF', H_FG: 'FFFFFF',
    ODD: 'FFFFFF', EVEN: 'EFF6FF',
    TOTAL_BG: 'BFDBFE', TOTAL_FG: '1E40AF',
    RED: 'DC2626', ORANGE: 'D97706', GREEN: '059669',
  };

  const thin = (color = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 4, color });
  const b = (color = 'CBD5E1') => ({ top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) });

  function makeCell(text, opts = {}) {
    const {
      bold = false,
      align = AlignmentType.CENTER,
      bg = 'FFFFFF', fg = '1A1A1A',
      size = 18, borders = b(),
      vAlign,
    } = opts;
    const cellProps = { borders, shading: { fill: bg }, verticalAlign: vAlign || VerticalAlign.CENTER };
    return new TableCell({
      ...cellProps,
      children: [new Paragraph({
        children: [new TextRun({ text: String(text), bold, size, font: { name: '宋体' }, color: fg })],
        alignment: align,
        spacing: { before: 30, after: 30 },
      })],
    });
  }

  const headerCells = [
    makeCell('经营部', { bold: true, bg: C.H_BG, fg: C.H_FG }),
    makeCell('预算指标', { bold: true, bg: C.H_BG, fg: C.H_FG }),
    makeCell('最后一公里签约(万吨)', { bold: true, bg: C.H_BG, fg: C.H_FG }),
    makeCell('占比', { bold: true, bg: C.H_BG, fg: C.H_FG }),
  ];
  const headerRow = new TableRow({ children: headerCells, tableHeader: true });

  const displayDepts = [...DEPTS, '沿海大区'];
  const dataRows = displayDepts.map((dept, idx) => {
    const isTotal = dept === '沿海大区';
    const d = isTotal ? 
      { total: round2(data.totalAll || 0), lastmile: round2(data.lastmileAll || 0) } :
      (data.deptData[dept] || { total: 0, lastmile: 0 });
    
    const rowBg = isTotal ? C.TOTAL_BG : (idx % 2 === 0 ? C.ODD : C.EVEN);
    const planRate = LASTMILE_DEPT_PLAN[dept] ?? (isTotal ? 28 : 30);
    const rate = d.total > 0 ? round2(d.lastmile / d.total * 100) : 0;
    const rateStr = d.total > 0 ? rate + '%' : '-';
    const rateFg = rate >= planRate ? C.GREEN : rate >= planRate * 0.8 ? C.ORANGE : C.RED;

    return new TableRow({ children: [
      makeCell(dept, { bold: true, bg: isTotal ? C.TOTAL_BG : 'DBEAFE', fg: isTotal ? C.TOTAL_FG : '1E40AF' }),
      makeCell(planRate + '%', { bg: rowBg, fg: '475569' }),
      makeCell(d.lastmile > 0 ? d.lastmile : '-', { align: AlignmentType.RIGHT, bg: rowBg, fg: '1E40AF' }),
      makeCell(rateStr, { bold: true, bg: rowBg, fg: isTotal ? '14532D' : rateFg }),
    ]});
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2500, 2000, 3000, 2000],
  });
}

function buildContainerWordTable(docx, data) {
  const { Table, TableRow, TableCell, TextRun, Paragraph, AlignmentType, BorderStyle, WidthType, VerticalAlign } = docx;
  const DEPTS = ['珠三角', '粤西', '广西', '海南', '福建'];
  
  const C = {
    H_BG: '1E40AF', H_FG: 'FFFFFF',
    ODD: 'FFFFFF', EVEN: 'EFF6FF',
    TOTAL_BG: 'BFDBFE', TOTAL_FG: '1E40AF',
    RED: 'DC2626', ORANGE: 'D97706', GREEN: '059669',
  };

  const thin = (color = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 4, color });
  const b = (color = 'CBD5E1') => ({ top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) });

  function makeCell(text, opts = {}) {
    const {
      bold = false,
      align = AlignmentType.CENTER,
      bg = 'FFFFFF', fg = '1A1A1A',
      size = 18, borders = b(),
      vAlign,
    } = opts;
    const cellProps = { borders, shading: { fill: bg }, verticalAlign: vAlign || VerticalAlign.CENTER };
    return new TableCell({
      ...cellProps,
      children: [new Paragraph({
        children: [new TextRun({ text: String(text), bold, size, font: { name: '宋体' }, color: fg })],
        alignment: align,
        spacing: { before: 30, after: 30 },
      })],
    });
  }

  const headerCells = [
    makeCell('经营部', { bold: true, bg: C.H_BG, fg: C.H_FG }),
    makeCell('预算指标', { bold: true, bg: C.H_BG, fg: C.H_FG }),
    makeCell('销售签约量(万吨)', { bold: true, bg: C.H_BG, fg: C.H_FG }),
    makeCell('完成率', { bold: true, bg: C.H_BG, fg: C.H_FG }),
  ];
  const headerRow = new TableRow({ children: headerCells, tableHeader: true });

  const displayDepts = [...DEPTS, '沿海大区'];
  const dataRows = displayDepts.map((dept, idx) => {
    const isTotal = dept === '沿海大区';
    const d = isTotal ?
      { total: round2(data.totalAll || 0), plan: DEPTS.reduce((s, d) => s + (CONTAINER_PLAN[d] || 0), 0) } :
      (data.deptData[dept] || { total: 0, container: 0, railway: 0 });
    
    const rowBg = isTotal ? C.TOTAL_BG : (idx % 2 === 0 ? C.ODD : C.EVEN);
    const plan = isTotal ? d.plan : (CONTAINER_PLAN[dept] || 0);
    const total = d.total;
    const rate = plan > 0 ? round2(total / plan * 100) : 0;
    const rateStr = plan > 0 ? rate + '%' : '-';
    const rateFg = rate >= 80 ? C.GREEN : rate >= 60 ? C.ORANGE : C.RED;

    return new TableRow({ children: [
      makeCell(dept, { bold: true, bg: isTotal ? C.TOTAL_BG : 'DBEAFE', fg: isTotal ? C.TOTAL_FG : '1E40AF' }),
      makeCell(plan > 0 ? plan : '-', { bg: rowBg, fg: '475569' }),
      makeCell(total > 0 ? total : '-', { align: AlignmentType.RIGHT, bg: rowBg, fg: '1E40AF' }),
      makeCell(rateStr, { bold: true, bg: rowBg, fg: isTotal ? '14532D' : rateFg }),
    ]});
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2500, 2200, 2800, 2200],
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
  const region = document.getElementById('settleRegion')?.value
    || document.getElementById('contractRegion')?.value
    || document.getElementById('lastmileRegion')?.value
    || document.getElementById('containerRegion')?.value
    || '沿海大区';

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

  const settleEl = document.getElementById('settleTextOutput');
  if (settleWorkbook && settleEl && settleEl.textContent.trim()) {
    if (!filename) filename = `${region}运营周报-销售结算`;

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '', size: 8 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'BDC3C7', space: 4 } },
      spacing: { before: 320, after: 320 },
    }));

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '三、销售结算情况', size: SIZE_HEADING, font: { name: FONT_HEADING }, color: COLOR_HEAD, bold: true })],
      spacing: { line: 360, lineRule: 'auto', before: 0, after: 160 },
    }));

    const settleParas = Array.from(settleEl.querySelectorAll('.text-para')).map(p => p.innerHTML);
    docChildren.push(...settleParas.map(html => new Paragraph({
      children: buildParagraphRuns(html, window.docx),
      alignment: AlignmentType.BOTH,
      indent: { firstLine: 480 },
      spacing: { line: 360, lineRule: 'auto', after: 80 },
    })));

    try {
      const settleData = calcSettleData();
      if (settleData && settleData.deptData) {
        docChildren.push(new Paragraph({ children: [], spacing: { before: 240 } }));
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: '表：各经营部本年结算量汇总（万吨）', size: SIZE_CAPTION, font: { name: FONT_MAIN }, color: COLOR_CAPTION, italics: true })],
          alignment: AlignmentType.LEFT,
          spacing: { after: 100 },
        }));
        docChildren.push(buildSettleWordTable(window.docx, settleData));
      }
    } catch (e) {
      console.warn('销售结算表格生成失败:', e);
    }
  }

  const lastmileEl = document.getElementById('lastmileTextOutput');
  if (lastmileWorkbook && lastmileEl && lastmileEl.textContent.trim()) {
    if (!filename) filename = `${region}运营周报-最后一公里`;

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '', size: 8 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'BDC3C7', space: 4 } },
      spacing: { before: 320, after: 320 },
    }));

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '四、最后一公里销售情况', size: SIZE_HEADING, font: { name: FONT_HEADING }, color: COLOR_HEAD, bold: true })],
      spacing: { line: 360, lineRule: 'auto', before: 0, after: 160 },
    }));

    const lastmileParas = Array.from(lastmileEl.querySelectorAll('.text-para')).map(p => p.innerHTML);
    docChildren.push(...lastmileParas.map(html => new Paragraph({
      children: buildParagraphRuns(html, window.docx),
      alignment: AlignmentType.BOTH,
      indent: { firstLine: 480 },
      spacing: { line: 360, lineRule: 'auto', after: 80 },
    })));

    try {
      const lastmileData = calcLastmileData();
      if (lastmileData) {
        docChildren.push(new Paragraph({ children: [], spacing: { before: 240 } }));
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: '表：各经营部最后一公里签约情况（万吨）', size: SIZE_CAPTION, font: { name: FONT_MAIN }, color: COLOR_CAPTION, italics: true })],
          alignment: AlignmentType.LEFT,
          spacing: { after: 100 },
        }));
        docChildren.push(buildLastmileWordTable(window.docx, lastmileData));
      }
    } catch (e) {
      console.warn('最后一公里表格生成失败:', e);
    }
  }

  const containerEl = document.getElementById('containerTextOutput');
  if (containerWorkbook && containerEl && containerEl.textContent.trim()) {
    if (!filename) filename = `${region}运营周报-集装箱玉米`;

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '', size: 8 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'BDC3C7', space: 4 } },
      spacing: { before: 320, after: 320 },
    }));

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: '五、集装箱玉米销售情况', size: SIZE_HEADING, font: { name: FONT_HEADING }, color: COLOR_HEAD, bold: true })],
      spacing: { line: 360, lineRule: 'auto', before: 0, after: 160 },
    }));

    const containerParas = Array.from(containerEl.querySelectorAll('.text-para')).map(p => p.innerHTML);
    docChildren.push(...containerParas.map(html => new Paragraph({
      children: buildParagraphRuns(html, window.docx),
      alignment: AlignmentType.BOTH,
      indent: { firstLine: 480 },
      spacing: { line: 360, lineRule: 'auto', after: 80 },
    })));

    try {
      const containerData = calcContainerData();
      if (containerData) {
        docChildren.push(new Paragraph({ children: [], spacing: { before: 240 } }));
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: '表：各经营部集装箱玉米签约情况（万吨）', size: SIZE_CAPTION, font: { name: FONT_MAIN }, color: COLOR_CAPTION, italics: true })],
          alignment: AlignmentType.LEFT,
          spacing: { after: 100 },
        }));
        docChildren.push(buildContainerWordTable(window.docx, containerData));
      }
    } catch (e) {
      console.warn('集装箱表格生成失败:', e);
    }

    if (containerChartInstance) {
      try {
        const canvas = document.getElementById('containerChart');
        if (canvas) {
          const imgBase64 = canvas.toDataURL('image/png');
          if (imgBase64) {
            const imgData = base64ToUint8Array(imgBase64);
            const aspectRatio = canvas.height / canvas.width;
            const imgWidthEmu = 5486400;
            const imgHeightEmu = Math.round(imgWidthEmu * aspectRatio);
            const imgWidthPx = Math.round(imgWidthEmu / 9144);
            const imgHeightPx = Math.round(imgHeightEmu / 9144);
            docChildren.push(
              new Paragraph({ children: [], spacing: { before: 200 } }),
              new Paragraph({
                children: [new ImageRun({ data: imgData, transformation: { width: imgWidthPx, height: imgHeightPx } })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: '图：集装箱（含铁路）内贸玉米月度销售趋势', size: SIZE_CAPTION, font: { name: FONT_MAIN }, color: COLOR_CAPTION, italics: true })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 320 },
              }),
            );
          }
        }
      } catch (imgErr) {
        console.warn('集装箱图表嵌入失败：', imgErr);
      }
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
window.buildSettleWordTable = buildSettleWordTable;
window.buildLastmileWordTable = buildLastmileWordTable;
window.buildContainerWordTable = buildContainerWordTable;
window.exportWord = exportWord;