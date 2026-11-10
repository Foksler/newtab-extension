# Grouped Quick Links — New Tab Extension

A minimal Chrome extension that replaces the new tab page with a customizable grid of link groups.

**No dependencies. No build step. Pure HTML, CSS, and JavaScript.**

## Features

- Organize links into named groups arranged on a CSS Grid
- Drag-and-drop links to reorder them or move them to another group, on the page and in settings
- Drag a group card onto another group to swap them, or onto an empty grid cell to move it
- Configurable grid dimensions (columns × rows)
- Clock with 12h/24h format, optional date display, and 6 position options
- Background options: solid color or gradient
- Settings panel with an expanded full-screen mode
- Quick-actions palette on any page: press **right Option + /** to search your links and jump to them
  (Enter — current tab, ⌘Enter — new tab, Esc — close)
- Page actions: regex rules over the current URL that add context links to the palette
  (e.g. on any GitLab MR — "Group merge requests", "Project merge requests"); edit them in Settings → Page Actions
- On `chrome://` pages, where extensions can't inject scripts, click the toolbar icon (or bind a key to
  "Activate the extension" in `chrome://extensions/shortcuts`) to get the same palette as a popup

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the repository folder
5. Open a new tab
