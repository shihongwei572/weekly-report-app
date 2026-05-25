function updateFlowSequence(step) {
  const steps = ['flow-step-1', 'flow-step-2', 'flow-step-3', 'flow-step-4'];
  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (i < step) {
      el.classList.add('done');
      el.classList.remove('active');
    } else if (i === step) {
      el.classList.add('active');
      el.classList.remove('done');
    } else {
      el.classList.remove('done', 'active');
    }
  });
}

function openSettings() {
  Settings.open();
}

document.addEventListener('DOMContentLoaded', () => {
  ['cfgDateStart', 'cfgDateEnd'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      onDateRangeChange();
      document.getElementById('cfgCutoffDate').value = document.getElementById('cfgDateEnd').value;
      if (workbook) refreshOutput();
    });
  });

  ['cfgWeek', 'cfgRegion', 'cfgYtdYoy', 'cfgCornYoy', 'cfgCutoffDate'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (workbook) refreshOutput();
    });
  });

  onDateRangeChange();
  switchTab('intent');

  Settings.init();
});

window.updateFlowSequence = updateFlowSequence;
window.openSettings = openSettings;