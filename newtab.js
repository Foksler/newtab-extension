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
    section.style.gridRow = group.gridRow;
    section.style.gridColumn = group.gridColumn;

    const title = document.createElement('h2');
    title.textContent = group.name;
    section.appendChild(title);

    const linksGrid = document.createElement('div');
    linksGrid.className = 'group-links';
    linksGrid.style.gridTemplateColumns = `repeat(${group.columns}, 1fr)`;

    group.links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.title = link.url;

      const span = document.createElement('span');
      span.textContent = link.name || link.url;
      a.appendChild(span);

      linksGrid.appendChild(a);
    });

    section.appendChild(linksGrid);
    grid.appendChild(section);
  });

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
