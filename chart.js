var chartInstance = null;
const CHART_COLORS = getConfig('chartColorMap') || CONFIG.chartColorMap;

function renderChart(by_dept, prevTotals, deptTotals) {
  _lastDeptTotals = deptTotals;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const labels = DEPTS;

  const activeVarieties = ALL_VARIETIES.filter(v => {
    return DEPTS.some(dept => (by_dept[dept][v] || 0) > 0);
  });
  const varieties = activeVarieties;

  const barDatasets = varieties.map(v => ({
    type: 'bar',
    label: (CHART_COLORS[v] || {}).label || v,
    data: DEPTS.map(dept => round4(by_dept[dept][v] / 10000)),
    backgroundColor: (CHART_COLORS[v] || {}).bg || '#2563eb',
    stack: 'stack',
    yAxisID: 'y',
    borderRadius: 2,
    borderSkipped: false,
  }));

  const momData = DEPTS.map(dept => {
    const curr = deptTotals[dept] || 0;
    const prev = prevTotals[dept] || 0;
    if (prev === 0) return null;
    return round2((curr - prev) / prev * 100);
  });
  _lastMomData = momData;

  const validMom = momData.filter(v => v !== null && v !== undefined);
  let y2Min = -50, y2Max = 100;
  if (validMom.length > 0) {
    const sorted = [...validMom].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.ceil(sorted.length * 0.75) - 1] ?? sorted[sorted.length - 1];
    const iqr = q3 - q1;
    const fence = iqr * 1.5;
    const inliers = validMom.filter(v => v >= q1 - fence && v <= q3 + fence);
    const rangeMin = inliers.length > 0 ? Math.min(...inliers) : Math.min(...validMom);
    const rangeMax = inliers.length > 0 ? Math.max(...inliers) : Math.max(...validMom);
    const pad = Math.max((rangeMax - rangeMin) * 0.2, 20);
    y2Min = Math.floor((Math.min(rangeMin, 0) - pad) / 10) * 10;
    y2Max = Math.ceil((Math.max(rangeMax, 0) + pad) / 10) * 10;
  }

  const maxBarVal = Math.max(...DEPTS.map(dept => (deptTotals[dept] || 0) / 10000));
  const y1Max = maxBarVal > 0 ? Math.ceil(maxBarVal * 1.25 * 10) / 10 : 10;

  const lineDataset = {
    type: 'line',
    label: '环比(%)',
    data: momData,
    yAxisID: 'y2',
    borderColor: '#1e40af',
    backgroundColor: 'rgba(30, 64, 175, 0.12)',
    pointBackgroundColor: momData.map(v => (v !== null && (v > y2Max || v < y2Min)) ? '#dc2626' : '#1e40af'),
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    pointRadius: momData.map(v => (v !== null && (v > y2Max || v < y2Min)) ? 0 : 6),
    pointHoverRadius: 8,
    borderWidth: 2.5,
    tension: 0.3,
    fill: false,
    clip: true,
    order: 0,
  };

  const ctx = document.getElementById('deptChart').getContext('2d');

  const datalabelsPlugin = {
    id: 'customLabels',
    afterDraw(chart) {
      const { ctx: c, scales } = chart;

      const lineMeta = chart.getDatasetMeta(0);
      const linePoints = lineMeta ? lineMeta.data.map(p => ({ x: p.x, y: p.y })) : [];

      DEPTS.forEach((dept, i) => {
        const totalTons = deptTotals[dept];
        if (!totalTons) return;
        const totalWanVal = totalTons / 10000;

        const lastBarMeta = chart.getDatasetMeta(varieties.length);
        if (!lastBarMeta || !lastBarMeta.data[i]) return;
        const x = lastBarMeta.data[i].x;

        const barTopPx = scales.y.getPixelForValue(totalWanVal);

        let totalLabelY = barTopPx - 14;

        const linePoint = linePoints[i];
        if (linePoint) {
          const lineLabelY = linePoint.y - 8;
          if (Math.abs(totalLabelY - lineLabelY) < 22) {
            totalLabelY = Math.min(totalLabelY, lineLabelY - 22);
          }
        }

        c.save();
        c.fillStyle = '#1e40af';
        c.font = 'bold 12px "Microsoft YaHei", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'bottom';
        c.fillText(totalWanVal.toFixed(2), x, totalLabelY);
        c.restore();
      });

      if (!lineMeta) return;
      lineMeta.data.forEach((point, i) => {
        const v = momData[i];
        if (v === null || v === undefined) return;
        const label = (v >= 0 ? '+' : '') + v + '%';
        const isOutlier = v > y2Max || v < y2Min;

        c.save();
        c.fillStyle = isOutlier ? '#dc2626' : '#1e40af';
        c.font = `bold 11px "Microsoft YaHei", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'bottom';

        if (isOutlier) {
          const clampY = v > y2Max
            ? scales.y2.getPixelForValue(y2Max) + 4
            : scales.y2.getPixelForValue(y2Min) - 4;
          const arrow = v > y2Max ? '▲' : '▼';
          c.fillText(arrow, point.x, clampY);
          c.fillText(label, point.x, clampY - 14);
        } else {
          c.fillText(label, point.x, point.y - 8);
        }
        c.restore();
      });
    }
  };

  chartInstance = new Chart(ctx, {
    data: {
      labels,
      datasets: [lineDataset, ...barDatasets],
    },
    plugins: [datalabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        onComplete: function() {
          chartInstance._animDone = true;
        }
      },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: {
          display: true,
          text: '本周各经营部意向销售及环比情况',
          font: { size: 18, weight: 'bold', family: '"Microsoft YaHei", sans-serif' },
          padding: { top: 6, bottom: 18 },
          color: '#1a202c',
        },
        legend: {
          position: 'bottom',
          labels: { font: { family: '"Microsoft YaHei", sans-serif' }, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              if (ctx.dataset.yAxisID === 'y2') {
                const v = ctx.parsed.y;
                return `环比: ${v !== null ? (v >= 0 ? '+' : '') + v + '%' : 'N/A'}`;
              }
              return `${ctx.dataset.label}: ${ctx.parsed.y} 万吨`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: '"Microsoft YaHei", sans-serif', size: 13, weight: 'bold' } },
        },
        y: {
          position: 'left',
          stacked: true,
          min: 0,
          max: y1Max,
          title: { display: true, text: '意向量（万吨）', font: { family: '"Microsoft YaHei", sans-serif' } },
          grid: { color: '#e8edf5' },
          ticks: { font: { family: '"Microsoft YaHei", sans-serif' } },
          afterFit(scale) {
            scale.paddingTop = 30;
          },
        },
        y2: {
          position: 'right',
          min: y2Min,
          max: y2Max,
          title: { display: true, text: '环比（%）', font: { family: '"Microsoft YaHei", sans-serif' } },
          grid: { drawOnChartArea: false },
          ticks: {
            font: { family: '"Microsoft YaHei", sans-serif' },
            callback: v => v + '%'
          },
        },
      }
    }
  });
}

window.renderChart = renderChart;