const DEFAULT_SETTINGS = {
  version: 1,
  gridColumns: 3,
  gridRows: 2,
  background: {
    type: 'solid',
    color: '#0f1114',
    gradientFrom: '#0f1114',
    gradientTo: '#1a2332',
    gradientAngle: 135,
  },
  clock: {
    format: '24h',
    showDate: false,
    position: 'top-center',
  },
  groups: []
};

let currentSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentSettings = await Storage.load();

  if (!currentSettings) {
    currentSettings = DEFAULT_SETTINGS;
    await Storage.save(currentSettings);
  }

  if (!currentSettings.background) {
    currentSettings.background = DEFAULT_SETTINGS.background;
  }
  if (!currentSettings.clock) {
    currentSettings.clock = DEFAULT_SETTINGS.clock;
  }
  await Storage.save(currentSettings);

  renderGroups(currentSettings);
  initLinkDragAndDrop();
  initGroupDragAndDrop();
  applyBackground(currentSettings);
  applyClock(currentSettings);
  startClock(currentSettings);
  initSettingsPanel();
});

function renderGroups(settings) {
  const grid = document.getElementById('groups-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${settings.gridColumns}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${settings.gridRows}, auto)`;

  settings.groups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'group';
    section.dataset.groupId = group.id;
    section.draggable = true;
    section.style.gridRow = group.gridRow;
    section.style.gridColumn = group.gridColumn;

    const title = document.createElement('h2');
    title.textContent = group.name;
    section.appendChild(title);

    const linksGrid = document.createElement('div');
    linksGrid.className = 'group-links';
    linksGrid.dataset.groupId = group.id;
    linksGrid.style.gridTemplateColumns = `repeat(${group.columns}, 1fr)`;

    group.links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.title = link.url;
      a.dataset.linkId = link.id;

      const span = document.createElement('span');
      span.textContent = link.name || link.url;
      a.appendChild(span);

      linksGrid.appendChild(a);
    });

    section.appendChild(linksGrid);
    grid.appendChild(section);
  });

}

// Drag links on the page to reorder them or move them to another group
function initLinkDragAndDrop() {
  enableLinkDragAndDrop(document.getElementById('groups-grid'), {
    zone: '.group',
    list: '.group-links',
    item: 'a',
    onMove: async (linkId, groupId, beforeId) => {
      moveLink(currentSettings, linkId, groupId, beforeId);
      await Storage.save(currentSettings);
      renderGroups(currentSettings);
      renderGroupsList(currentSettings);
    },
    onCancel: () => renderGroups(currentSettings),
  });
}

// Drag a group card onto another group to swap them, or onto an empty cell to move it.
// The whole card is the handle; links inside it start their own drag.
function initGroupDragAndDrop() {
  const grid = document.getElementById('groups-grid');
  let dragging = null;
  let dropped = false;

  const dropTarget = (el) => {
    const target = el.closest('.group, .grid-slot');
    return target !== dragging ? target : null;
  };
  const clearHighlight = highlightDropTarget(grid, (el) => dragging && dropTarget(el));

  grid.addEventListener('dragstart', (e) => {
    if (!e.target.classList?.contains('group')) return;
    dragging = e.target;
    dropped = false;
    e.dataTransfer.effectAllowed = 'move';
    // Deferred: Chrome takes the drag image after dragstart and can abort
    // the drag when the layout changes inside it
    requestAnimationFrame(() => {
      if (!dragging) return;
      dragging.classList.add('dragging');
      renderGridSlots(currentSettings);
    });
  });

  grid.addEventListener('dragover', (e) => {
    if (!dragging || !dropTarget(e.target)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  grid.addEventListener('drop', (e) => {
    const target = dragging && dropTarget(e.target);
    if (!target) return;
    e.preventDefault();
    dropped = true;

    const other = findGroup(currentSettings, target.dataset.groupId);
    moveGroup(currentSettings, dragging.dataset.groupId,
      other ? other.gridRow : Number(target.dataset.row),
      other ? other.gridColumn : Number(target.dataset.col));
  });

  grid.addEventListener('dragend', async () => {
    if (!dragging) return;
    dragging = null;
    clearHighlight();
    // Also removes the slots and restores the card after a cancelled drag
    renderGroups(currentSettings);
    if (dropped) {
      await Storage.save(currentSettings);
      renderGroupsList(currentSettings);
    }
  });
}

// Empty cells of the configured grid become drop slots while a group is dragged
function renderGridSlots(settings) {
  const grid = document.getElementById('groups-grid');
  const taken = new Set(settings.groups.map(g => `${g.gridRow}/${g.gridColumn}`));

  for (let row = 1; row <= settings.gridRows; row++) {
    for (let col = 1; col <= settings.gridColumns; col++) {
      if (taken.has(`${row}/${col}`)) continue;
      const slot = document.createElement('div');
      slot.className = 'grid-slot';
      slot.dataset.row = row;
      slot.dataset.col = col;
      slot.style.gridRow = row;
      slot.style.gridColumn = col;
      grid.appendChild(slot);
    }
  }
}

async function applyBackground(settings) {
  const bg = settings.background;
  const el = document.getElementById('background');

  el.style.backgroundImage = '';

  switch (bg.type) {
    case 'solid':
      el.style.background = bg.color;
      break;

    case 'gradient':
      el.style.background = `linear-gradient(${bg.gradientAngle}deg, ${bg.gradientFrom}, ${bg.gradientTo})`;
      break;

    default:
      el.style.background = '#0f1114';
  }
}

let clockInterval = null;

function applyClock(settings) {
  const el = document.getElementById('clock');
  const pos = settings.clock.position || 'top-center';
  el.dataset.position = pos;
}

function startClock(settings) {
  if (clockInterval) clearInterval(clockInterval);

  const el = document.getElementById('clock');

  function update() {
    const c = settings.clock;
    const now = new Date();
    const hour12 = c.format === '12h';

    const timeOpts = { hour: '2-digit', minute: '2-digit', hour12 };

    let text = now.toLocaleTimeString([], timeOpts);

    if (c.showDate) {
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      el.innerHTML = text + '<div class="clock-date">' + dateStr + '</div>';
    } else {
      el.textContent = text;
    }
  }

  update();
  clockInterval = setInterval(update, 60000);
}

function initSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  const overlay = document.getElementById('settings-overlay');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');
  const expand = document.getElementById('settings-expand');

  renderSettingsPanel(currentSettings, async (updated) => {
    currentSettings = updated;
    await Storage.save(currentSettings);
    renderGroups(currentSettings);
    applyBackground(currentSettings);
    applyClock(currentSettings);
    startClock(currentSettings);
  });

  function openPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open', 'expanded');
    overlay.classList.remove('open');
  }

  toggle.addEventListener('click', openPanel);
  close.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  expand.addEventListener('click', () => {
    panel.classList.toggle('expanded');
  });
}
