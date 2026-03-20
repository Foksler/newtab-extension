function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Debounce for text inputs
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function renderSettingsPanel(settings, onSave) {
  const container = document.getElementById('settings-content');

  const bg = settings.background || {};

  container.innerHTML = `
    <div class="settings-sidebar">
      <div class="settings-section">
        <label>Background</label>
        <div class="settings-card">
          <select id="bg-type" data-bg-field="type">
            <option value="solid" ${bg.type === 'solid' ? 'selected' : ''}>Solid Colour</option>
            <option value="gradient" ${bg.type === 'gradient' ? 'selected' : ''}>Colour Gradient</option>
          </select>
          <div id="bg-options"></div>
        </div>
      </div>
      <div class="settings-section">
        <label>Clock</label>
        <div class="settings-card">
          <div class="settings-row">
            <label>Format</label>
            <select data-clock-field="format">
              <option value="24h" ${(settings.clock || {}).format === '24h' ? 'selected' : ''}>24h</option>
              <option value="12h" ${(settings.clock || {}).format === '12h' ? 'selected' : ''}>12h</option>
            </select>
          </div>
          <div class="settings-row">
            <label>Date</label>
            <input type="checkbox" data-clock-field="showDate" ${(settings.clock || {}).showDate ? 'checked' : ''}>
          </div>
          <div class="settings-row">
            <label>Position</label>
            <select data-clock-field="position">
              <option value="top-left" ${(settings.clock || {}).position === 'top-left' ? 'selected' : ''}>Top Left</option>
              <option value="top-center" ${(settings.clock || {}).position === 'top-center' ? 'selected' : ''}>Top Center</option>
              <option value="top-right" ${(settings.clock || {}).position === 'top-right' ? 'selected' : ''}>Top Right</option>
              <option value="bottom-left" ${(settings.clock || {}).position === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
              <option value="bottom-center" ${(settings.clock || {}).position === 'bottom-center' ? 'selected' : ''}>Bottom Center</option>
              <option value="bottom-right" ${(settings.clock || {}).position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
            </select>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <label>Grid Layout</label>
        <div class="settings-card">
          <div class="settings-row">
            <label for="grid-cols">Columns</label>
            <input type="number" id="grid-cols" min="1" max="6" value="${settings.gridColumns}" data-field="gridColumns">
          </div>
          <div class="settings-row">
            <label for="grid-rows">Rows</label>
            <input type="number" id="grid-rows" min="1" max="6" value="${settings.gridRows}" data-field="gridRows">
          </div>
        </div>
      </div>
    </div>
    <div class="settings-main">
      <div class="settings-section">
        <div class="settings-section-header">
          <label>Groups</label>
          <button class="btn btn-add btn-small" data-action="add-group">+ Add Group</button>
        </div>
        <div id="groups-list"></div>
      </div>
    </div>
  `;

  renderBgOptions(settings, onSave);

  const bgTypeSelect = container.querySelector('#bg-type');
  bgTypeSelect.addEventListener('change', () => {
    settings.background.type = bgTypeSelect.value;
    renderBgOptions(settings, onSave);
    onSave(settings);
  });

  container.querySelectorAll('[data-clock-field]').forEach(input => {
    const event = input.type === 'checkbox' ? 'change' : 'change';
    input.addEventListener(event, (e) => {
      if (!settings.clock) settings.clock = {};
      if (e.target.type === 'checkbox') {
        settings.clock[e.target.dataset.clockField] = e.target.checked;
      } else {
        settings.clock[e.target.dataset.clockField] = e.target.value;
      }
      onSave(settings);
    });
  });

  const groupsList = container.querySelector('#groups-list');

  settings.groups.forEach((group) => {
    groupsList.appendChild(renderGroupSettings(group));
  });

  // Event delegation
  const debouncedSave = debounce(() => onSave(settings), 300);

  container.addEventListener('input', (e) => {
    const el = e.target;

    // Grid layout fields
    if (el.dataset.field === 'gridColumns' || el.dataset.field === 'gridRows') {
      settings[el.dataset.field] = clampInt(el.value, 1, 6);
      onSave(settings);
      return;
    }

    // Group name
    if (el.dataset.groupField === 'name') {
      const group = findGroup(settings, el.dataset.groupId);
      if (group) { group.name = el.value; debouncedSave(); }
      return;
    }

    // Group number props
    if (el.dataset.groupField) {
      const group = findGroup(settings, el.dataset.groupId);
      if (group) {
        group[el.dataset.groupField] = clampInt(el.value, 1, parseInt(el.max) || 6);
        onSave(settings);
      }
      return;
    }

    // Link fields
    if (el.dataset.linkField) {
      const group = findGroup(settings, el.dataset.groupId);
      if (group) {
        const link = group.links.find(l => l.id === el.dataset.linkId);
        if (link) { link[el.dataset.linkField] = el.value; debouncedSave(); }
      }
      return;
    }
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'add-group') {
      const newGroup = {
        id: generateId('g'),
        name: 'New Group',
        columns: 2,
        gridRow: settings.groups.length + 1,
        gridColumn: 1,
        links: []
      };
      settings.groups.push(newGroup);
      groupsList.appendChild(renderGroupSettings(newGroup));
      onSave(settings);
      return;
    }

    if (action === 'add-link') {
      const group = findGroup(settings, btn.dataset.groupId);
      if (group) {
        const newLink = { id: generateId('l'), name: '', url: '' };
        group.links.push(newLink);
        const linksList = btn.closest('.group-settings').querySelector('.links-list');
        linksList.appendChild(renderLinkEntry(group.id, newLink));
        onSave(settings);
      }
      return;
    }

    if (action === 'delete-link') {
      const group = findGroup(settings, btn.dataset.groupId);
      if (group) {
        group.links = group.links.filter(l => l.id !== btn.dataset.linkId);
        btn.closest('.link-entry').remove();
        onSave(settings);
      }
      return;
    }

    if (action === 'delete-group') {
      const deleteBtn = btn.closest('.btn-delete-group') || btn;
      if (deleteBtn.classList.contains('confirm')) {
        settings.groups = settings.groups.filter(g => g.id !== deleteBtn.dataset.groupId);
        deleteBtn.closest('.group-settings').remove();
        onSave(settings);
      } else {
        deleteBtn.classList.add('confirm');
        deleteBtn.title = 'Click again to confirm';
        setTimeout(() => {
          deleteBtn.classList.remove('confirm');
          deleteBtn.title = 'Delete group';
        }, 2000);
      }
      return;
    }
  });
}

function renderGroupSettings(group) {
  const el = document.createElement('div');
  el.className = 'group-settings';
  el.innerHTML = `
    <div class="group-settings-header">
      <input type="text" value="${escapeAttr(group.name)}" data-group-id="${group.id}" data-group-field="name" placeholder="Group name">
      <button class="btn-delete-group" data-action="delete-group" data-group-id="${group.id}" title="Delete group">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334zM6.667 7.333v4M9.333 7.333v4"/></svg>
      </button>
    </div>
    <div class="group-settings-props">
      <label>Cols <input type="number" min="1" max="4" value="${group.columns}" data-group-id="${group.id}" data-group-field="columns"></label>
      <label>Row <input type="number" min="1" max="6" value="${group.gridRow}" data-group-id="${group.id}" data-group-field="gridRow"></label>
      <label>Col <input type="number" min="1" max="6" value="${group.gridColumn}" data-group-id="${group.id}" data-group-field="gridColumn"></label>
    </div>
    <div class="links-list"></div>
    <button class="btn btn-add btn-small" data-action="add-link" data-group-id="${group.id}" style="margin-top:6px">+ Add Link</button>
  `;

  const linksList = el.querySelector('.links-list');
  group.links.forEach(link => {
    linksList.appendChild(renderLinkEntry(group.id, link));
  });

  return el;
}

function renderLinkEntry(groupId, link) {
  const el = document.createElement('div');
  el.className = 'link-entry';
  el.innerHTML = `
    <input type="text" value="${escapeAttr(link.name)}" placeholder="Name" data-group-id="${groupId}" data-link-id="${link.id}" data-link-field="name">
    <input type="url" value="${escapeAttr(link.url)}" placeholder="https://..." data-group-id="${groupId}" data-link-id="${link.id}" data-link-field="url">
    <button class="btn-icon" data-action="delete-link" data-group-id="${groupId}" data-link-id="${link.id}" title="Remove">&times;</button>
  `;
  return el;
}

function findGroup(settings, id) {
  return settings.groups.find(g => g.id === id);
}

function clampInt(value, min, max) {
  const n = parseInt(value) || min;
  return Math.max(min, Math.min(max, n));
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderBgOptions(settings, onSave) {
  const container = document.getElementById('bg-options');
  const bg = settings.background;
  const debouncedBgSave = debounce(() => onSave(settings), 300);

  switch (bg.type) {
    case 'solid':
      container.innerHTML = `
        <div class="bg-type-options">
          <div class="settings-row">
            <label>Colour</label>
            <input type="color" value="${bg.color}" data-bg-field="color">
          </div>
        </div>
      `;
      container.querySelector('[data-bg-field="color"]').addEventListener('input', (e) => {
        bg.color = e.target.value;
        onSave(settings);
      });
      break;

    case 'gradient':
      container.innerHTML = `
        <div class="bg-type-options">
          <div class="settings-row">
            <label>From</label>
            <input type="color" value="${bg.gradientFrom}" data-bg-field="gradientFrom">
          </div>
          <div class="settings-row">
            <label>To</label>
            <input type="color" value="${bg.gradientTo}" data-bg-field="gradientTo">
          </div>
          <div class="settings-row">
            <label>Angle</label>
            <input type="range" min="0" max="360" value="${bg.gradientAngle}" data-bg-field="gradientAngle">
            <span data-angle-label>${bg.gradientAngle}°</span>
          </div>
          <div class="bg-preview" style="background:linear-gradient(${bg.gradientAngle}deg, ${bg.gradientFrom}, ${bg.gradientTo})"></div>
        </div>
      `;
      container.querySelectorAll('[data-bg-field]').forEach(input => {
        input.addEventListener('input', (e) => {
          if (e.target.type === 'color') {
            bg[e.target.dataset.bgField] = e.target.value;
          } else {
            bg.gradientAngle = parseInt(e.target.value);
            container.querySelector('[data-angle-label]').textContent = bg.gradientAngle + '°';
          }
          const preview = container.querySelector('.bg-preview');
          preview.style.background = `linear-gradient(${bg.gradientAngle}deg, ${bg.gradientFrom}, ${bg.gradientTo})`;
          onSave(settings);
        });
      });
      break;

  }
}
