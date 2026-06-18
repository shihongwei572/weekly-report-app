const Utils = {
  safeFloat(v, def) {
    if (v === null || v === undefined || v === '') return def || 0;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? (def || 0) : n;
  },

  round2(v) { return Math.round(v * 100) / 100; },

  round4(v) { return Math.round(v * 10000) / 10000; },

  toWan(tons) { return this.round2(tons / 10000); },

  showToast(msg, duration) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration || 2800);
  },

  base64ToUint8Array(base64) {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('✅ 文字已复制到剪贴板');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast('✅ 文字已复制');
    });
  },

  getWeekDateRange(year, week) {
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    let daysToSat;
    if (jan1Day === 6) daysToSat = 0;
    else if (jan1Day === 0) daysToSat = 6;
    else daysToSat = 6 - jan1Day;
    const firstSat = new Date(year, 0, 1 + daysToSat);
    const start = new Date(firstSat.getTime() + (week - 1) * 7 * 86400000);
    const end = new Date(start.getTime() + 6 * 86400000);
    return { start, end };
  },

  parseDateString(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d) ? null : d;
  },

  truncateToDay(date) {
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  },

  formatDateLabel(date) {
    if (!date) return '';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  makeDateRangeLabel(start, end) {
    if (!start || !end) return '';
    return `${this.formatDateLabel(start)}-${this.formatDateLabel(end)}`;
  },

  getDayTs(date) {
    if (!date) return null;
    const d = this.truncateToDay(date);
    return d ? d.getTime() : null;
  },

  getCutoffLabel(dateStr) {
    if (!dateStr) return '';
    return dateStr.replace(/^\d{4}-/, '').replace('-', '/') + '日';
  },

  getChineseCutoff(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  },

  calcSeqRate(cutoffStr) {
    if (!cutoffStr) return null;
    const parts = cutoffStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const yearEnd = new Date(d.getFullYear() + 1, 0, 1);
    return this.round2((d - yearStart) / (yearEnd - yearStart) * 100);
  },
};

window.Utils = Utils;
window.base64ToUint8Array = Utils.base64ToUint8Array.bind(Utils);