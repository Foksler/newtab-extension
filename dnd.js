// Drag-and-drop of link items: reorder within a list or move to another list.
// The dragged item follows the pointer live in the DOM; after a drop onMove
// gets its final position, otherwise onCancel lets the caller restore the DOM.
//   zone - element that accepts the drop (a whole group card, so empty groups work)
//   list - element inside the zone holding the items; carries data-group-id
//   item - a draggable item; carries data-link-id
function enableLinkDragAndDrop(container, { zone, list, item, onMove, onCancel }) {
  let dragging = null;
  let dropped = false;
  const clearHighlight = highlightDropTarget(container, (el) => dragging && el.closest(zone));

  container.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.(item);
    if (!el || !el.draggable) return;
    dragging = el;
    dropped = false;
    el.classList.add('dragging');
    // Keep copy/link allowed so a page link can still be dropped on the bookmarks bar
    e.dataTransfer.effectAllowed = 'all';
  });

  container.addEventListener('dragover', (e) => {
    if (!dragging) return;
    const zoneEl = e.target.closest(zone);
    if (!zoneEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const listEl = zoneEl.querySelector(list);
    const before = getInsertBefore(listEl, `${item}:not(.dragging)`, e.clientX, e.clientY);
    if (dragging.parentElement !== listEl || dragging.nextElementSibling !== before) {
      listEl.insertBefore(dragging, before);
    }
  });

  container.addEventListener('drop', (e) => {
    if (!dragging || !e.target.closest(zone)) return;
    // Stops the browser from navigating to a dropped link or typing it into an input
    e.preventDefault();
    dropped = true;
  });

  container.addEventListener('dragend', () => {
    if (!dragging) return;
    const el = dragging;
    dragging = null;
    el.classList.remove('dragging');
    clearHighlight();

    if (dropped) {
      onMove(el.dataset.linkId, el.parentElement.dataset.groupId, el.nextElementSibling?.dataset.linkId);
    } else {
      onCancel();
    }
  });
}

// Marks the drop target under the pointer with .drop-target. findTarget maps
// the hovered element to a target, or returns null when there is none (or no
// drag is active). Listens on document so the mark clears once the pointer
// leaves the container; returns a function that clears it explicitly.
function highlightDropTarget(container, findTarget) {
  let current = null;
  const set = (el) => {
    if (el === current) return;
    current?.classList.remove('drop-target');
    el?.classList.add('drop-target');
    current = el;
  };

  document.addEventListener('dragover', (e) => {
    set(container.contains(e.target) ? findTarget(e.target) || null : null);
  });
  return () => set(null);
}

// The item the dragged one should be inserted before, or null to append.
// A single-column list compares vertical midpoints; in a multi-column grid
// rows are compared vertically and items within a row horizontally.
function getInsertBefore(list, selector, x, y) {
  const multiColumn = getComputedStyle(list).gridTemplateColumns.split(' ').length > 1;
  for (const el of list.querySelectorAll(selector)) {
    const box = el.getBoundingClientRect();
    if (multiColumn) {
      if (y < box.top || (y <= box.bottom && x < box.left + box.width / 2)) return el;
    } else if (y < box.top + box.height / 2) {
      return el;
    }
  }
  return null;
}
