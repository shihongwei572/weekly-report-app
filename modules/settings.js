const Settings = {
  modalEl: null,
  activeTab: 'depts',

  init() {
    this.createModal();
  },

  createModal() {
    const div = document.createElement('div');
    div.id = 'settingsModal';
    div.className = 'modal-overlay';
    div.style.display = 'none';
    div.innerHTML = this.getModalHTML();
    document.body.appendChild(div);
    this.modalEl = div;
    this.bindEvents();
  },

  getModalHTML() {
    return `
      <div class="modal-dialog modal-lg">
        <div class="modal-header">
          <h3>⚙️ 系统配置</h3>
          <button class="modal-close" onclick="Settings.close()">&times;</button>
        </div>
        <div class="modal-tabs">
          <button class="mtab active" data-tab="depts" onclick="Settings.switchTab('depts')">经营部</button>
          <button class="mtab" data-tab="plan" onclick="Settings.switchTab('plan')">签约计划量</button>
          <button class="mtab" data-tab="budget" onclick="Settings.switchTab('budget')">预算指标</button>
          <button class="mtab" data-tab="varieties" onclick="Settings.switchTab('varieties')">品种映射</button>
        </div>
        <div class="modal-body" id="settingsBody">
        </div>
        <div class="modal-footer">
          <span class="modal-hint">配置将保存到浏览器本地，刷新后仍然保留</span>
          <div>
            <button class="btn btn-ghost btn-sm" onclick="Settings.resetAll()">↩️ 恢复默认</button>
            <button class="btn btn-primary btn-sm" onclick="Settings.save()">💾 保存配置</button>
          </div>
        </div>
      </div>`;
  },

  bindEvents() {
    this.modalEl.addEventListener('click', function (e) {
      if (e.target === this) Settings.close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && Settings.modalEl.style.display !== 'none') Settings.close();
    });
  },

  open() {
    this.loadCurrentConfig();
    this.modalEl.style.display = 'flex';
    this.switchTab(this.activeTab);
  },

  close() {
    this.modalEl.style.display = 'none';
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('#settingsModal .mtab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const body = document.getElementById('settingsBody');
    if (tab === 'depts') this.renderDeptsTab(body);
    else if (tab === 'plan') this.renderPlanTab(body);
    else if (tab === 'budget') this.renderBudgetTab(body);
    else if (tab === 'varieties') this.renderVarietiesTab(body);
  },

  getCurrentCfg() {
    const saved = localStorage.getItem('weekly_report_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {};
  },

  saveToStorage(data) {
    localStorage.setItem('weekly_report_config', JSON.stringify(data));
  },

  loadCurrentConfig() {
    this.currentCfg = this.getCurrentCfg();
  },

  renderDeptsTab(container) {
    const depts = this.currentCfg.depts || CONFIG.depts;
    let html = '<div class="settings-section"><h4>经营部列表</h4><p class="settings-desc">配置各经营部名称，将影响所有模块的展示</p>';
    html += '<div class="settings-dept-list" id="settingsDeptList">';
    depts.forEach((d, i) => {
      html += `<div class="settings-dept-row">
        <input type="text" class="settings-input" value="${d}" data-idx="${i}" />
        <button class="btn btn-sm btn-ghost" onclick="Settings.removeDept(${i})" ${depts.length <= 1 ? 'disabled' : ''}>✕</button>
      </div>`;
    });
    html += '</div>';
    html += `<button class="btn btn-sm btn-outline" onclick="Settings.addDept()" style="margin-top:8px">+ 添加经营部</button>`;
    html += '</div>';
    container.innerHTML = html;
  },

  addDept() {
    const list = document.getElementById('settingsDeptList');
    const row = document.createElement('div');
    row.className = 'settings-dept-row';
    const idx = list.children.length;
    row.innerHTML = `<input type="text" class="settings-input" value="新经营部" data-idx="${idx}" /><button class="btn btn-sm btn-ghost" onclick="Settings.removeDept(${idx})">✕</button>`;
    list.appendChild(row);
  },

  removeDept(idx) {
    const rows = document.querySelectorAll('#settingsDeptList .settings-dept-row');
    if (rows.length <= 1) return;
    rows[idx].remove();
  },

  renderPlanTab(container) {
    const plan = this.currentCfg.contractPlan || CONFIG.contractPlan;
    const depts = ['珠三角', '粤西', '广西', '福建', '海南', '沿海大区'];
    const groups = CONFIG.contractGroups;
    const cols = [...groups.map(g => g.key), '合计'];

    let html = '<div class="settings-section"><h4>签约计划量配置（万吨）</h4><p class="settings-desc">修改各经营部各品种的年度计划量</p>';
    html += '<div class="settings-table-wrap"><table class="settings-table">';
    html += '<thead><tr><th>经营部</th>';
    cols.forEach(c => { html += `<th>${c}</th>`; });
    html += '</tr></thead><tbody>';

    depts.forEach(dept => {
      const row = plan[dept] || {};
      html += '<tr>';
      html += `<td class="settings-td-label">${dept}</td>`;
      cols.forEach(c => {
        const val = row[c] || 0;
        html += `<td><input type="number" class="settings-input settings-input-num" value="${val}" step="0.1" data-dept="${dept}" data-col="${c}" /></td>`;
      });
      html += '</tr>';
      if (dept === '沿海大区') html += '<tr class="settings-tr-spacer"><td colspan="7"></td></tr>';
    });

    html += '</tbody></table></div></div>';
    container.innerHTML = html;
  },

  renderBudgetTab(container) {
    const lmPlan = this.currentCfg.lastmileDeptPlan || CONFIG.lastmileDeptPlan;
    const conPlan = this.currentCfg.containerPlan || CONFIG.containerPlan;
    const depts = ['珠三角', '粤西', '广西', '福建', '海南'];
    const lmVarPlan = this.currentCfg.lastmileVarietyPlan || CONFIG.lastmileVarietyPlan;

    let html = '<div class="settings-section"><h4>最后一公里预算指标（占比%）</h4>';
    html += '<div class="settings-dept-list">';
    Object.entries(lmPlan).forEach(([dept, val]) => {
      html += `<div class="settings-dept-row">
        <span class="settings-label">${dept}</span>
        <input type="number" class="settings-input settings-input-num" value="${val}" step="0.1" data-budget="lastmile" data-dept="${dept}" />
        <span>%</span>
      </div>`;
    });
    html += '</div></div>';

    html += '<div class="settings-section"><h4>集装箱玉米预算指标（万吨）</h4>';
    html += '<div class="settings-dept-list">';
    Object.entries(conPlan).forEach(([dept, val]) => {
      html += `<div class="settings-dept-row">
        <span class="settings-label">${dept}</span>
        <input type="number" class="settings-input settings-input-num" value="${val}" step="0.1" data-budget="container" data-dept="${dept}" />
        <span>万吨</span>
      </div>`;
    });
    html += '</div></div>';

    html += '<div class="settings-section"><h4>最后一公里品种预算指标（占比%）</h4>';
    html += '<div class="settings-dept-list">';
    Object.entries(lmVarPlan).forEach(([variety, val]) => {
      html += `<div class="settings-dept-row">
        <span class="settings-label">${variety}</span>
        <input type="number" class="settings-input settings-input-num" value="${val}" step="0.1" data-budget="lmVariety" data-variety="${variety}" />
        <span>%</span>
      </div>`;
    });
    html += '</div></div>';

    container.innerHTML = html;
  },

  renderVarietiesTab(container) {
    const varieties = this.currentCfg.contractVarieties || CONFIG.contractVarieties;

    let html = '<div class="settings-section"><h4>品种映射配置</h4><p class="settings-desc">配置Excel中的品种名称如何映射到标准品种分类</p>';
    html += '<div class="settings-table-wrap"><table class="settings-table">';
    html += '<thead><tr><th>标准品种</th><th>匹配关键词（逗号分隔）</th></tr></thead><tbody>';

    varieties.forEach((v, i) => {
      html += '<tr>';
      html += `<td class="settings-td-label">${v.key}</td>`;
      html += `<td><input type="text" class="settings-input" value="${v.match.join('，')}" data-var-idx="${i}" /></td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div></div>';
    container.innerHTML = html;
  },

  collectData() {
    const cfg = {};

    const deptInputs = document.querySelectorAll('#settingsDeptList .settings-input');
    if (deptInputs.length > 0) {
      cfg.depts = Array.from(deptInputs).map(inp => inp.value.trim()).filter(Boolean);
    }

    const planInputs = document.querySelectorAll('#settingsBody input[data-dept][data-col]');
    if (planInputs.length > 0) {
      const plan = {};
      planInputs.forEach(inp => {
        const dept = inp.dataset.dept;
        const col = inp.dataset.col;
        if (!plan[dept]) plan[dept] = {};
        plan[dept][col] = parseFloat(inp.value) || 0;
      });
      cfg.contractPlan = plan;
    }

    const lastmileInputs = document.querySelectorAll('#settingsBody input[data-budget="lastmile"]');
    if (lastmileInputs.length > 0) {
      const lmPlan = {};
      lastmileInputs.forEach(inp => { lmPlan[inp.dataset.dept] = parseFloat(inp.value) || 0; });
      cfg.lastmileDeptPlan = lmPlan;
    }

    const containerInputs = document.querySelectorAll('#settingsBody input[data-budget="container"]');
    if (containerInputs.length > 0) {
      const conPlan = {};
      containerInputs.forEach(inp => { conPlan[inp.dataset.dept] = parseFloat(inp.value) || 0; });
      cfg.containerPlan = conPlan;
    }

    const lmVarInputs = document.querySelectorAll('#settingsBody input[data-budget="lmVariety"]');
    if (lmVarInputs.length > 0) {
      const lmVarPlan = {};
      lmVarInputs.forEach(inp => { lmVarPlan[inp.dataset.variety] = parseFloat(inp.value) || 0; });
      cfg.lastmileVarietyPlan = lmVarPlan;
    }

    const varInputs = document.querySelectorAll('#settingsBody input[data-var-idx]');
    if (varInputs.length > 0) {
      const baseVarieties = CONFIG.contractVarieties;
      const varieties = [];
      varInputs.forEach(inp => {
        const idx = parseInt(inp.dataset.varIdx);
        const base = baseVarieties[idx];
        if (base) {
          varieties.push({
            key: base.key,
            match: inp.value.split(/[，,]/).map(s => s.trim()).filter(Boolean),
          });
        }
      });
      if (varieties.length > 0) cfg.contractVarieties = varieties;
    }

    return cfg;
  },

  save() {
    const data = this.collectData();
    this.saveToStorage(data);
    Utils.showToast('✅ 配置已保存');
    this.close();
    if (typeof refreshOutput === 'function') refreshOutput();
    if (typeof refreshContractOutput === 'function' && contractWorkbook) refreshContractOutput();
    if (typeof refreshSettleOutput === 'function' && settleWorkbook) refreshSettleOutput();
    if (typeof refreshLastmileOutput === 'function') refreshLastmileOutput();
    if (typeof refreshContainerOutput === 'function') refreshContainerOutput();
  },

  resetAll() {
    if (!confirm('确定要恢复所有配置为默认值吗？')) return;
    localStorage.removeItem('weekly_report_config');
    Utils.showToast('✅ 已恢复默认配置');
    this.close();
    location.reload();
  },
};

window.Settings = Settings;