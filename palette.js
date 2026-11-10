// Command palette: a quick-actions modal over any page.
// Runs in three places (always after storage.js):
//   - content script on regular pages (opened with right Option + /)
//   - the new tab page (same shortcut)
//   - the toolbar popup (fallback for chrome:// pages, where content scripts can't run)
// It lists the actions of the URL rules matching the current page first,
// then every quick link from the new tab settings.
(() => {
  if (window.__quickPalette) return;
  window.__quickPalette = true;

  // Shortcut: right Option (AltRight) + the physical "/" key.
  // e.code is layout-independent, so it works on the Russian layout too.
  const SHORTCUT_CODE = 'Slash';

  // Actions for the URL: one per rule whose regex matches it.
  function contextActions(rules, pageUrl) {
    const actions = [];
    for (const rule of rules) {
      if (!rule.match || !rule.url) continue;
      let m;
      try { m = pageUrl.match(new RegExp(rule.match)); } catch { continue; }
      if (!m) continue;
      const url = rule.url.replace(/\$(\d+)/g, (_, i) => m[Number(i)] ?? '');
      if (url === pageUrl) continue;
      actions.push({ name: rule.name || url, url, section: 'This page', context: true });
    }
    return actions;
  }

  function linkActions(groups) {
    return groups.flatMap(group => (group.links || [])
      .filter(link => link.url)
      .map(link => ({ name: link.name || link.url, url: link.url, section: group.name })));
  }

  // Lower is better; null means no match. Name prefix > word prefix > substring > subsequence.
  function score(action, query) {
    if (!query) return 0;
    const name = action.name.toLowerCase();
    const hay = `${name} ${action.section.toLowerCase()} ${action.url.toLowerCase()}`;
    if (name.startsWith(query)) return 0;
    if (name.split(/[\s\-_/.]+/).some(w => w.startsWith(query))) return 1;
    if (name.includes(query)) return 2;
    if (hay.includes(query)) return 3;
    let i = 0;
    for (const ch of name) if (ch === query[i]) i++;
    return i === query.length ? 4 : null;
  }

  // Theme mirrors the new tab page tokens (newtab.css), which aren't loaded on other pages
  const STYLE = `
    :host {
      all: initial;
      --bg: #12151a; --border: #2a2e37; --text: #d1d5db; --text-strong: #e5e7eb;
      --muted: #6b7280; --dim: #4b5563; --hover: #22262e; --accent: #93c5fd;
    }
    .overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0, 0, 0, 0.45);
      display: flex; justify-content: center; align-items: flex-start;
      padding-top: 14vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    :host(.popup) .overlay { position: static; background: none; padding: 0; }
    .box {
      width: min(640px, calc(100vw - 32px));
      background: var(--bg); color: var(--text);
      border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    :host(.popup) .box { width: 560px; border: none; border-radius: 0; box-shadow: none; }
    input {
      all: unset; box-sizing: border-box; display: block; width: 100%;
      padding: 16px 18px; font-size: 16px; color: var(--text-strong);
      border-bottom: 1px solid var(--border);
    }
    input::placeholder { color: var(--muted); }
    /* No top padding: sticky headers stick to the very top edge of the scroll area */
    .list { margin: 0; padding: 0 6px 6px; max-height: 56vh; overflow-y: auto; }
    :host(.popup) .list { max-height: 420px; }
    .section-header {
      position: sticky; top: 0; z-index: 1;
      padding: 10px 12px 6px; background: var(--bg);
      color: var(--muted); font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .item {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;
      scroll-margin-top: 32px; /* keep the active item clear of the sticky header */
    }
    .item.active { background: var(--hover); }
    .context .section-header, .context .name { color: var(--accent); }
    .name { flex: 0 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .url { flex: 1 1 0; min-width: 0; color: var(--dim); font-size: 12px;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { padding: 14px 18px; color: var(--muted); font-size: 13px; }
    .footer { display: flex; gap: 16px; padding: 8px 18px; border-top: 1px solid var(--border);
              color: var(--muted); font-size: 11px; }
    kbd { font-family: inherit; color: #9ca3af; }
  `;

  const MARKUP = `
    <div class="overlay">
      <div class="box">
        <input type="text" placeholder="Go to…" spellcheck="false" autocomplete="off">
        <div class="list"></div>
        <div class="footer">
          <span><kbd>↵</kbd> open</span>
          <span><kbd>⌘↵</kbd> new tab</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>`;

  let sheet = null;

  // Options:
  //   className       - extra class on the host (styles via :host(.name))
  //   closeOnBackdrop - a click outside the box closes the palette
  //   mountIn()       - element the shadow host is appended to
  //   getPageUrl()    - URL the rules are matched against
  //   navigate(url, newTab)
  //   onClose()       - called after the palette closes
  function createPalette({ className, closeOnBackdrop, mountIn, getPageUrl, navigate, onClose }) {
    let host = null;
    let state = null;
    let opening = false;

    async function open() {
      if (host || opening) return;
      opening = true;
      try { await build(); } finally { opening = false; }
    }

    async function build() {
      const [settings, pageUrl] = await Promise.all([Storage.load(), getPageUrl()]);
      state = { all: [...contextActions(settings.rules, pageUrl), ...linkActions(settings.groups)] };

      const el = document.createElement('div');
      if (className) el.className = className;
      const root = el.attachShadow({ mode: 'open' });
      // Constructed stylesheet: not blocked by strict page CSPs (style-src) like an inline <style>
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(STYLE);
      }
      root.adoptedStyleSheets = [sheet];
      root.innerHTML = MARKUP;
      state.input = root.querySelector('input');
      state.list = root.querySelector('.list');

      root.querySelector('.overlay').addEventListener('mousedown', (e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) close();
      });
      state.input.addEventListener('input', render);
      state.list.addEventListener('mousemove', (e) => {
        const item = e.target.closest('.item');
        if (item && Number(item.dataset.i) !== state.active) { state.active = Number(item.dataset.i); highlight(false); }
      });
      state.list.addEventListener('click', (e) => {
        const item = e.target.closest('.item');
        if (item) go(state.shown[Number(item.dataset.i)], e.metaKey || e.ctrlKey);
      });

      host = el;
      mountIn().appendChild(host);
      render();
      state.input.focus();
    }

    function close() {
      if (!host) return;
      host.remove();
      host = null;
      state = null;
      onClose?.();
    }

    // Items are shown in sections ("This page", then the new tab groups).
    // While searching, sections are ordered by their best match and items by score,
    // so Enter still picks the best match overall. Sorts are stable, so ties keep
    // the original order.
    function render() {
      const q = state.input.value.trim().toLowerCase();
      const sections = new Map();
      for (const a of state.all) {
        const s = score(a, q);
        if (s === null) continue;
        if (!sections.has(a.section)) sections.set(a.section, { name: a.section, context: a.context, best: s, items: [] });
        const section = sections.get(a.section);
        section.best = Math.min(section.best, s);
        section.items.push({ a, s });
      }
      const ordered = [...sections.values()].sort((x, y) => x.best - y.best);
      for (const section of ordered) section.items.sort((x, y) => x.s - y.s);
      state.shown = ordered.flatMap(section => section.items.map(x => x.a));
      state.active = 0;

      let index = 0;
      state.list.replaceChildren(...ordered.map(section => {
        const el = document.createElement('div');
        el.className = section.context ? 'section context' : 'section';
        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = section.name;
        el.appendChild(header);
        for (const { a } of section.items) {
          const item = document.createElement('div');
          item.className = 'item';
          item.dataset.i = index++;
          for (const [cls, text] of [['name', a.name], ['url', a.url]]) {
            const span = document.createElement('span');
            span.className = cls;
            span.textContent = text;
            item.appendChild(span);
          }
          el.appendChild(item);
        }
        return el;
      }));
      if (!state.shown.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Nothing found';
        state.list.appendChild(empty);
      }
      highlight();
    }

    // scroll=false on mouse hover, so the list doesn't jump under the pointer
    function highlight(scroll = true) {
      const items = state.list.querySelectorAll('.item');
      items.forEach((item, i) => item.classList.toggle('active', i === state.active));
      if (scroll) items[state.active]?.scrollIntoView({ block: 'nearest' });
    }

    function go(action, newTab) {
      if (!action) return;
      navigate(action.url, newTab);
      close();
    }

    // Returns true when the key was consumed by the palette.
    function handleKey(e) {
      if (!host) return false;
      const n = state.shown.length;
      switch (e.key) {
        case 'Escape': close(); break;
        case 'ArrowDown': if (n) { state.active = (state.active + 1) % n; highlight(); } break;
        case 'ArrowUp': if (n) { state.active = (state.active - 1 + n) % n; highlight(); } break;
        case 'Enter': go(state.shown[state.active], e.metaKey || e.ctrlKey); break;
        default: return false;
      }
      e.preventDefault();
      return true;
    }

    return {
      open,
      toggle: () => (host ? close() : open()),
      handleKey,
      contains: (e) => host && e.composedPath().includes(host),
    };
  }

  // Page / new tab: listen for right Option + "/" and own the keyboard while open.
  function initPageMode() {
    const palette = createPalette({
      closeOnBackdrop: true,
      mountIn: () => document.documentElement,
      getPageUrl: async () => location.href,
      navigate: (url, newTab) => {
        if (newTab) window.open(url, '_blank', 'noopener');
        else location.href = url;
      },
    });

    let rightAlt = false;

    // Capture phase on window, registered at document_start, so this runs before
    // site shortcuts (GitLab, Jira…) and they never see keys typed into the palette.
    const onKey = (e) => {
      if (e.code === 'AltRight') rightAlt = e.type === 'keydown';

      if (e.type === 'keydown' && e.code === SHORTCUT_CODE && e.altKey && rightAlt
          && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); // otherwise Option+/ types "÷" into the focused field
        e.stopImmediatePropagation();
        palette.toggle();
        return;
      }

      if (palette.contains(e)) {
        if (e.type === 'keydown') palette.handleKey(e);
        e.stopImmediatePropagation();
      } else if (e.type === 'keydown' && e.key === 'Escape') {
        palette.handleKey(e);
      }
    };
    for (const type of ['keydown', 'keyup', 'keypress']) window.addEventListener(type, onKey, true);
    window.addEventListener('blur', () => { rightAlt = false; });
  }

  async function initPopupMode() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const palette = createPalette({
      className: 'popup',
      mountIn: () => document.body,
      getPageUrl: async () => tab?.url || '',
      navigate: (url, newTab) => {
        if (newTab) chrome.tabs.create({ url, index: tab ? tab.index + 1 : undefined });
        else chrome.tabs.update(tab.id, { url });
      },
      onClose: () => window.close(),
    });
    document.addEventListener('keydown', palette.handleKey);
    palette.open();
  }

  if (document.documentElement.dataset.palette === 'popup') initPopupMode();
  else initPageMode();
})();
