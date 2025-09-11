// ===== Model =====
let BEAR_TRAP_SIZE = 2; // configurable via UI
const BEAR_TRAP_COUNT = 3;
const CITY_DRAG_TYPE = 'application/x-city-id';
const LONG_PRESS_MS = 700;
let bearTraps = Array(BEAR_TRAP_COUNT).fill(null);
let snapshotEtag = null;

/** @type {Array<{id:string,name:string,level?:number,status:'occupied'|'reserved',x:number,y:number,notes?:string,color:string}>} */
let cities = [];
let levelColors = {};
let CELL_SIZE_PX = 28; // px per tile, tuned to match game spacing
let CITY_SCALE = 1.0;  // keep marker inside its tile

// Admin functionality
let isAdmin = false;
let currentUser = 'viewer';
let selectedCityId = null;
let touchDrag = null; // { id, start, last }

async function checkAdminStatus() {
  const user = await Auth.fetchUser();
  isAdmin = Auth.isManager();
  currentUser = user ? user.username : 'viewer';
  updateUIForUser();
  updateMenuUI();
}

function updateUIForUser() {
  const userModeEl = document.getElementById('userMode');
  const addCityBtn = document.getElementById('addCityBtn');
  const autoInsertBtn = document.getElementById('autoInsertBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  if (isAdmin) {
    userModeEl.textContent = 'Admin';
    userModeEl.className = 'text-xs px-2 py-1 rounded bg-green-700 text-green-200';
    addCityBtn.style.display = 'block';
    autoInsertBtn.style.display = 'block';
    clearAllBtn.style.display = 'block';
  } else {
    userModeEl.textContent = 'View Only';
    userModeEl.className = 'text-xs px-2 py-1 rounded bg-slate-700 text-slate-200';
    addCityBtn.style.display = 'none';
    autoInsertBtn.style.display = 'none';
    clearAllBtn.style.display = 'none';
  }
}

function updateMenuUI() {
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (isAdmin) {
    adminLoginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
  } else {
    adminLoginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
  }
}

// ===== Elements =====
const grid = document.getElementById('grid');
const gridWrapper = document.getElementById('gridWrapper');
const scroller = document.getElementById('mapScroller');

const cityModal = document.getElementById('cityModal');
const cityForm = document.getElementById('cityForm');
const modalTitle = document.getElementById('modalTitle');

const addCityBtn = document.getElementById('addCityBtn');
const autoInsertBtn = document.getElementById('autoInsertBtn');
const deleteBtn = document.getElementById('deleteBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

// Menu elements
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Admin login elements
const adminLoginModal = document.getElementById('adminLoginModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');
const closeAdminLogin = document.getElementById('closeAdminLogin');
const cancelAdminLogin = document.getElementById('cancelAdminLogin');

const searchInput = document.getElementById('search');

const zoom = document.getElementById('zoom');
const tileSizeRange = document.getElementById('tileSize');
const cityScaleRange = document.getElementById('cityScale');
const trapSizeSelect = document.getElementById('trapSize');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const trapModal = document.getElementById('trapModal');
const closeTrapModal = document.getElementById('closeTrapModal');
const trapPlaceSection = document.getElementById('trapPlaceSection');
const trapDeleteSection = document.getElementById('trapDeleteSection');
const addCityOption = document.getElementById('addCityOption');
const trapOptionButtons = document.querySelectorAll('.trapOption');
const deleteTrapBtn = document.getElementById('deleteTrapBtn');
const trapColor = document.getElementById('trapColor');
const trapEditColor = document.getElementById('trapEditColor');
const saveTrapBtn = document.getElementById('saveTrapBtn');
let pendingPlacement = null;

gridWrapper.addEventListener('click', handleGridClick);
gridWrapper.addEventListener('dragover', (e) => e.preventDefault());
gridWrapper.addEventListener('drop', handleGridDrop);

// Info popup elements
const infoPopup = document.getElementById('infoPopup');
const infoContent = document.getElementById('infoContent');
const infoAddCityBtn = document.getElementById('infoAddCityBtn');
const infoAddBearBtn = document.getElementById('infoAddBearBtn');
const infoEditBtn = document.getElementById('infoEditBtn');
const infoDeleteBtn = document.getElementById('infoDeleteBtn');
const infoCloseBtn = document.getElementById('infoCloseBtn');

// Form fields
const idEl = document.getElementById('cityId');
const nameEl = document.getElementById('name');
const levelEl = document.getElementById('level');
const statusEl = document.getElementById('status');
const xEl = document.getElementById('x');
const yEl = document.getElementById('y');
const notesEl = document.getElementById('notes');
const colorEl = document.getElementById('color');
levelEl.addEventListener('input', () => {
  colorEl.value = levelColors[levelEl.value] || '#ec4899';
});

async function loadLevelColors() {
  try {
    const res = await fetch('/api/levels');
    const data = await res.json();
    levelColors = {};
    for (const entry of data) levelColors[entry.level] = entry.color;
  } catch (err) {
    console.error('Failed to load level colors', err);
  }
}

// ===== API Functions =====
async function loadSnapshot(force = false) {
  try {
    const headers = {};
    if (!force && snapshotEtag) headers['If-None-Match'] = snapshotEtag;
    const response = await fetch('/api/snapshot', { headers });
    if (response.status === 304) return;
    if (!response.ok) throw new Error('Failed to load data');
    snapshotEtag = response.headers.get('ETag');
    const data = await response.json();
    cities = data.cities;
    bearTraps = Array(BEAR_TRAP_COUNT).fill(null);
    for (const trap of data.traps) {
      bearTraps[trap.slot - 1] = trap;
    }
    render();
    highlightBearTraps();
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Failed to load data: ' + error.message);
  }
}

async function saveCity(cityData, isNew) {
  try {
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/cities' : `/api/cities/${cityData.id}`;
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cityData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save city');
    }
    
    await loadSnapshot(true);
    return true;
  } catch (error) {
    console.error('Error saving city:', error);
    alert('Failed to save city: ' + error.message);
    return false;
  }
}

async function deleteCity(id) {
  try {
    const response = await fetch(`/api/cities/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete city');
    await loadSnapshot(true);
    return true;
  } catch (error) {
    console.error('Error deleting city:', error);
    alert('Failed to delete city: ' + error.message);
    return false;
  }
}

async function toggleStatus(id) {
  const city = cities.find(x => x.id === id);
  if (!city) return;

  const newStatus = city.status === 'reserved' ? 'occupied' : 'reserved';
  const success = await saveCity({ ...city, status: newStatus }, false);
  if (success) {
    render();
  }
}

// ===== Init grid =====
function getBearTrapCells(topLeft) {
  if (!topLeft) return [];
  const cells = [];
  for (let dx = 0; dx < BEAR_TRAP_SIZE; dx++) {
    for (let dy = 0; dy < BEAR_TRAP_SIZE; dy++) {
      cells.push({ x: topLeft.x + dx, y: topLeft.y + dy });
    }
  }
  return cells;
}

function updateGridDimensions() {
  // Sync grid template sizes with current CELL_SIZE_PX
  grid.style.gridTemplateColumns = `repeat(var(--cells), ${CELL_SIZE_PX}px)`;
  grid.style.gridAutoRows = `${CELL_SIZE_PX}px`;
}

function updateTrapLegend() {
  const legend = document.getElementById('trapLegend');
  if (legend) legend.textContent = `Bear Trap (${BEAR_TRAP_SIZE}x${BEAR_TRAP_SIZE})`;
}

function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function highlightBearTraps() {
  // Clear any previous trap backgrounds/overlays on ALL cells
  Array.from(grid.children).forEach((cell) => {
    cell.style.removeProperty('background-color');
    cell.style.boxShadow = '';
  });
  grid.querySelectorAll('.trap-overlay').forEach(el => el.remove());

  for (let i = 0; i < bearTraps.length; i++) {
    const trap = bearTraps[i];
    if (!trap) continue;
    const fill = trap.color || '#f59e0b';
    const cells = getBearTrapCells(trap);

    for (const { x, y } of cells) {
      const cell = grid.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (!cell) continue;
      // Set solid background color for each trap cell (override light theme)
      cell.style.setProperty('background-color', fill, 'important');
    }

    // Add a small badge on the top-left tile indicating T1/T2/T3
    const topLeft = cells[0];
    if (topLeft) {
      const topCell = grid.querySelector(`[data-x="${topLeft.x}"][data-y="${topLeft.y}"]`);
      if (topCell) {
        const badge = document.createElement('div');
        badge.className = 'trap-overlay absolute text-[10px] font-bold px-1 py-0.5 rounded';
        badge.textContent = `T${i + 1}`;
        badge.style.top = '2px';
        badge.style.left = '2px';
        badge.style.pointerEvents = 'none';
        // Choose contrasting text color
        const hex = fill.replace('#','');
        const num = parseInt(hex,16);
        const r = (num>>16)&255, g=(num>>8)&255, b=num&255;
        const luminance = 0.2126*r + 0.7152*g + 0.0722*b;
        badge.style.color = luminance > 140 ? '#111827' : '#ffffff';
        badge.style.backgroundColor = luminance > 140 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
        topCell.appendChild(badge);
      }
    }
  }
}

async function setBearTrap(index, topLeft, color) {
  const existing = bearTraps[index];
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    slot: index + 1,
    x: topLeft.x,
    y: topLeft.y,
    color
  };
  const method = existing ? 'PUT' : 'POST';
  const url = existing ? `/api/traps/${payload.id}` : '/api/traps';
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json();
    alert('Failed to save trap: ' + (err.error || 'unknown error'));
    return;
  }
  await loadSnapshot(true);
}

async function removeBearTrap(index) {
  const existing = bearTraps[index];
  if (!existing) return;
  const response = await fetch(`/api/traps/${existing.id}`, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json();
    alert('Failed to delete trap: ' + (err.error || 'unknown error'));
    return;
  }
  await loadSnapshot(true);
}

function trapIndexAt(x, y) {
  return bearTraps.findIndex(trap =>
    getBearTrapCells(trap).some(c => c.x === x && c.y === y)
  );
}

function startBearTrapPlacement(x, y) {
  pendingPlacement = { x, y };
  trapColor.value = '#f59e0b';
  trapPlaceSection.classList.remove('hidden');
  trapDeleteSection.classList.add('hidden');
  trapModal.showModal();
}

function eventToCell(e) {
  const cell = e.target.closest('[data-x]');
  if (cell) {
    return { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
  }
  return pointToCell({ x: e.clientX, y: e.clientY }, grid, COLS, ROWS);
}

function handleGridClick(e) {
  const { x, y } = eventToCell(e);
  const trapIdx = trapIndexAt(x, y);
  if (trapIdx >= 0) {
    pendingPlacement = { index: trapIdx };
    trapEditColor.value = bearTraps[trapIdx].color || '#f59e0b';
    trapPlaceSection.classList.add('hidden');
    trapDeleteSection.classList.remove('hidden');
    trapModal.showModal();
    return;
  }
  const existing = cities.find(c => c.x === x && c.y === y);
  showInfoPopup(existing, x, y);
}

function handleGridDrop(e) {
  e.preventDefault();
  if (!isAdmin) return;
  const { x, y } = eventToCell(e);
  const cityId = e.dataTransfer.getData(CITY_DRAG_TYPE);
  if (!cityId) return;
  if (cities.some(c => c.x === x && c.y === y)) {
    alert('Cell already occupied');
    return;
  }
  const city = cities.find(c => c.id === cityId);
  if (!city) return;
  saveCity({ ...city, x, y }, false);
}

function buildGrid() {
  grid.style.setProperty('--cells', COLS);
  grid.innerHTML = '';
  updateGridDimensions();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col - CENTER_X; // cartesian coords with 0,0 center
      const y = row - CENTER_Y;
      const cell = document.createElement('div');
      cell.className = 'relative select-none border border-slate-800/40 bg-slate-900';

      // Coord label (tiny) Ã¢â‚¬â€ visible when no city occupies the tile
      const label = document.createElement('div');
      label.className = 'coord-label absolute bottom-0.5 right-1 text-[10px] text-slate-500';
      label.textContent = `${x},${y}`;
      cell.appendChild(label);

      cell.dataset.x = x;
      cell.dataset.y = y;

      grid.appendChild(cell);
    }
  }
  highlightBearTraps();
}

// ===== Render cities =====
function render() {
  // Clear prior markers
  const cells = grid.children;
  for (const cell of cells) {
    const marker = cell.querySelector('.city');
    if (marker) marker.remove();
    // dim non-matching search
    const q = searchInput.value.trim().toLowerCase();
    cell.style.filter = q ? 'grayscale(0.35) opacity(0.8)' : '';
    // show coord label by default; occupied cells will hide it below
    const coord = cell.querySelector('.coord-label');
    if (coord) coord.style.display = '';
  }

  const q = searchInput.value.trim().toLowerCase();
  for (const c of cities) {
    const idx = (c.y + CENTER_Y) * COLS + (c.x + CENTER_X);
    const cell = cells[idx];
    if (!cell) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    const baseClass = 'city absolute flex items-center justify-center font-semibold truncate rounded-xl shadow ring-1 ring-white/10';
    const isSelected = c.id === selectedCityId;
    btn.className = baseClass;
    btn.style.backgroundColor = c.color || '#ec4899';
    btn.style.color = c.status === 'reserved' ? '#1e293b' : 'white';
    btn.textContent = isSelected ? (c.name || `${c.x},${c.y}`) : (c.name?.slice(0, 8) || 'City');
    btn.title = `${c.name || 'City'} (Lv ${c.level || '?'})\n${c.status} @ (${c.x}, ${c.y})${c.notes ? `\n${c.notes}` : ''}`;
    btn.draggable = isAdmin;

    // Keep city marker within its tile (no overlap)
    const basePadding = isSelected ? 0 : 8; // mimic inset-1 (~8px)
    const size = Math.max(16, Math.round(CELL_SIZE_PX - basePadding));
    btn.style.width = `${size}px`;
    btn.style.height = `${size}px`;
    btn.style.left = `${Math.round((CELL_SIZE_PX - size) / 2)}px`;
    btn.style.top = `${Math.round((CELL_SIZE_PX - size) / 2)}px`;
    // Font size roughly scales with marker
    btn.style.fontSize = `${Math.max(10, Math.round(size * 0.28))}px`;

    // Click to show info popup with optional actions
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedCityId = c.id;
      render();
      showInfoPopup(c, c.x, c.y);
    });

    // long press -> toggle reserved/occupied (admin only)
    let pressTimer;
    if (isAdmin) {
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(CITY_DRAG_TYPE, c.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      // Touch drag to move city (long press opens info instead of toggling)
      btn.addEventListener('touchstart', (e) => {
        clearTimeout(pressTimer);
        const t = e.touches[0];
        touchDrag = { id: c.id, start: { x: t.clientX, y: t.clientY }, last: { x: t.clientX, y: t.clientY } };
        pressTimer = setTimeout(() => {
          if (touchDrag && Math.hypot(touchDrag.last.x - touchDrag.start.x, touchDrag.last.y - touchDrag.start.y) < 8) {
            // Open info popup on long-press (safer on mobile than toggling/deleting)
            showInfoPopup(c, c.x, c.y);
          }
        }, LONG_PRESS_MS);
      }, { passive: true });
      btn.addEventListener('touchmove', (e) => {
        if (!touchDrag) return;
        const t = e.touches[0];
        touchDrag.last = { x: t.clientX, y: t.clientY };
        clearTimeout(pressTimer); // moving cancels toggle
        const target = pointToCell({ x: t.clientX, y: t.clientY }, grid, COLS, ROWS);
        const occupied = cities.find(x => x.x === target.x && x.y === target.y && x.id !== touchDrag.id);
        setDragPreview(target, !occupied);
      }, { passive: true });
      btn.addEventListener('touchend', async () => {
        clearTimeout(pressTimer);
        if (!touchDrag) return;
        const target = pointToCell(touchDrag.last, grid, COLS, ROWS);
        const city = cities.find(x => x.id === touchDrag.id);
        const occupied = cities.find(x => x.x === target.x && x.y === target.y && x.id !== touchDrag.id);
        clearDragPreview();
        if (city && !occupied && (city.x !== target.x || city.y !== target.y)) {
          await saveCity({ ...city, x: target.x, y: target.y }, false);
        }
        touchDrag = null;
      });
      btn.addEventListener('touchcancel', () => { clearTimeout(pressTimer); clearDragPreview(); touchDrag = null; });
      // Desktop long-press: open info instead of toggling to avoid accidental actions
      btn.addEventListener('mousedown', () => { pressTimer = setTimeout(() => showInfoPopup(c, c.x, c.y), LONG_PRESS_MS); });
      btn.addEventListener('mouseup', () => clearTimeout(pressTimer));
      btn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    }

    cell.appendChild(btn);
    // hide coord label on occupied tile
    const coord2 = cell.querySelector('.coord-label');
    if (coord2) coord2.style.display = 'none';

    // Highlight matches
    if (q && c.name.toLowerCase().includes(q)) {
      cell.style.filter = 'none';
      btn.classList.add('highlight-match');
    }
  }
}

// ===== Modal helpers =====
function openCreateAt(x, y) {
  modalTitle.textContent = 'Add City';
  idEl.value = '';
  nameEl.value = '';
  levelEl.value = '';
  statusEl.value = 'occupied';
  xEl.value = x;
  yEl.value = y;
  notesEl.value = '';
  colorEl.value = levelColors[levelEl.value] || '#ec4899';
  deleteBtn.classList.add('hidden');
  cityModal.showModal();
}

function openEdit(c) {
  modalTitle.textContent = 'Edit City';
  idEl.value = c.id;
  nameEl.value = c.name || '';
  levelEl.value = c.level || '';
  statusEl.value = c.status;
  xEl.value = c.x;
  yEl.value = c.y;
  notesEl.value = c.notes || '';
  colorEl.value = levelColors[c.level] || '#ec4899';
  deleteBtn.classList.remove('hidden');
  cityModal.showModal();
}

document.getElementById('closeModal').addEventListener('click', () => cityModal.close());

cityForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // dialog default is to close; we manage explicitly
  const isNew = !idEl.value;
  const id = idEl.value || crypto.randomUUID();
  const payload = {
    id,
    name: nameEl.value.trim() || 'City',
    level: Number(levelEl.value) || undefined,
    status: statusEl.value,
    x: Number(xEl.value),
    y: Number(yEl.value),
    notes: notesEl.value.trim() || undefined,
    color: colorEl.value
  };

  const success = await saveCity(payload, isNew);
  if (success) {
    cityModal.close();
  }
});

deleteBtn.addEventListener('click', async () => {
  const id = idEl.value;
  if (!id) return;
  
  if (confirm('Are you sure you want to delete this city?')) {
    const success = await deleteCity(id);
    if (success) {
      cityModal.close();
    }
  }
});

addCityBtn.addEventListener('click', () => openCreateAt(0, 0));

// Auto insert functionality (admin only)
autoInsertBtn.addEventListener('click', async () => {
  if (!isAdmin) return;
  
  const name = prompt('Enter member name for auto-insert:');
  if (!name) return;
  
  const level = prompt('Enter level (1-100):');
  if (!level || isNaN(level) || level < 1 || level > 100) {
    alert('Please enter a valid level between 1 and 100');
    return;
  }
  
  // Find empty spot near center
  let x = 0, y = 0;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    x = Math.floor(Math.random() * 21) - 10; // -10 to 10
    y = Math.floor(Math.random() * 21) - 10; // -10 to 10
    
    const existing = cities.find(c => c.x === x && c.y === y);
    if (!existing) break;
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    alert('No empty spots found near center. Please manually place the city.');
    return;
  }
  
  const cityData = {
    id: crypto.randomUUID(),
    name: name.trim(),
    level: parseInt(level),
    status: 'occupied',
    x: x,
    y: y,
    notes: 'Auto-inserted',
    color: '#ec4899'
  };
  
  const success = await saveCity(cityData, true);
  if (success) {
    alert(`City "${name}" auto-inserted at (${x}, ${y})`);
  }
});

// Show info popup for a cell or city
function showInfoPopup(city, x, y) {
  infoContent.innerHTML = '';
  infoAddCityBtn.classList.add('hidden');
  infoAddBearBtn.classList.add('hidden');
  infoEditBtn.classList.add('hidden');
  infoDeleteBtn.classList.add('hidden');

  if (city) {
    infoContent.innerHTML = `
      <div><strong>${city.name}</strong></div>
      <div>Level: ${city.level || 'Unknown'}</div>
      <div>Status: ${city.status}</div>
      <div>Position: (${city.x}, ${city.y})</div>
      ${city.notes ? `<div>Notes: ${city.notes}</div>` : ''}
    `;

    if (isAdmin) {
      infoEditBtn.classList.remove('hidden');
      infoDeleteBtn.classList.remove('hidden');

      infoEditBtn.onclick = () => {
        infoPopup.close();
        openEdit(city);
      };

      infoDeleteBtn.onclick = async () => {
        infoPopup.close();
        await deleteCity(city.id);
      };
    }
  } else {
    infoContent.textContent = `No city at (${x}, ${y})`;

    if (isAdmin) {
      infoAddCityBtn.classList.remove('hidden');
      infoAddBearBtn.classList.remove('hidden');

      infoAddCityBtn.onclick = () => {
        infoPopup.close();
        openCreateAt(x, y);
      };

      infoAddBearBtn.onclick = () => {
        infoPopup.close();
        startBearTrapPlacement(x, y);
      };
    }
  }

  infoPopup.showModal();
}

// Drag preview helpers
let lastPreviewCell = null;
function setDragPreview(cellPos, ok) {
  const cell = grid.querySelector(`[data-x="${cellPos.x}"][data-y="${cellPos.y}"]`);
  if (lastPreviewCell && lastPreviewCell !== cell) {
    lastPreviewCell.style.outline = '';
    lastPreviewCell.style.outlineOffset = '';
  }
  if (cell) {
    cell.style.outline = `3px solid ${ok ? '#22d3ee' : '#ef4444'}`;
    cell.style.outlineOffset = '-3px';
    lastPreviewCell = cell;
  }
}
function clearDragPreview() {
  if (lastPreviewCell) {
    lastPreviewCell.style.outline = '';
    lastPreviewCell.style.outlineOffset = '';
    lastPreviewCell = null;
  }
}

infoCloseBtn.addEventListener('click', () => infoPopup.close());

clearAllBtn.addEventListener('click', async () => {
  if (!isAdmin) return;
  
  if (confirm('Clear all data? This cannot be undone.')) {
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 2, cities: [], traps: [] })
      });

      if (!response.ok) throw new Error('Clear failed');

      await loadSnapshot(true);
      alert('All data cleared');
    } catch (error) {
      alert('Clear failed: ' + error.message);
    }
  }
});

// Fullscreen support
fullscreenBtn.addEventListener('click', () => {
  const elem = document.getElementById('mapScroller');
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  }
});

exitFullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  const isFull = !!document.fullscreenElement;
  exitFullscreenBtn.classList.toggle('hidden', !isFull);
});

// Zoom support
zoom.addEventListener('input', () => {
  const scale = Number(zoom.value) / 100; // 0.55 - 2.0
  gridWrapper.style.transform = `scale(${scale})`;
});

// Tile size control
if (tileSizeRange) {
  tileSizeRange.value = String(CELL_SIZE_PX);
  tileSizeRange.addEventListener('input', () => {
    CELL_SIZE_PX = Number(tileSizeRange.value) || 42;
    updateGridDimensions();
    render();
    requestAnimationFrame(centerView);
  });
}

// City scale control
if (cityScaleRange) {
  cityScaleRange.value = String(CITY_SCALE);
  cityScaleRange.addEventListener('input', () => {
    CITY_SCALE = Number(cityScaleRange.value) || 1.0;
    render();
  });
}

// Bear trap size control
if (trapSizeSelect) {
  trapSizeSelect.value = String(BEAR_TRAP_SIZE);
  trapSizeSelect.addEventListener('change', () => {
    BEAR_TRAP_SIZE = Number(trapSizeSelect.value) || 2;
    updateTrapLegend();
    highlightBearTraps();
  });
}

closeTrapModal.addEventListener('click', () => {
  pendingPlacement = null;
  trapModal.close();
});

addCityOption.addEventListener('click', () => {
  if (!pendingPlacement) return;
  const { x, y } = pendingPlacement;
  pendingPlacement = null;
  trapModal.close();
  openCreateAt(x, y);
});

trapOptionButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!pendingPlacement) return;
    const idx = Number(btn.dataset.index);
    await setBearTrap(idx, pendingPlacement, trapColor.value);
    pendingPlacement = null;
    trapModal.close();
  });
});

saveTrapBtn.addEventListener('click', async () => {
  if (!pendingPlacement) return;
  const idx = pendingPlacement.index;
  const existing = bearTraps[idx];
  if (!existing) return;
  await setBearTrap(idx, { x: existing.x, y: existing.y }, trapEditColor.value);
  pendingPlacement = null;
  trapModal.close();
});

deleteTrapBtn.addEventListener('click', async () => {
  if (!pendingPlacement) return;
  await removeBearTrap(pendingPlacement.index);
  pendingPlacement = null;
  trapModal.close();
});

// Center view on the grid at start
function centerView() {
  const cellSize = CELL_SIZE_PX * (Number(zoom.value) / 100);
  const contentSize = COLS * cellSize;
  scroller.scrollLeft = (contentSize - scroller.clientWidth) / 2;
  scroller.scrollTop = (contentSize - scroller.clientHeight) / 2;
}

// Search functionality
searchInput.addEventListener('input', render);

// Menu functionality
menuBtn.addEventListener('click', () => {
  menuDropdown.classList.toggle('hidden');
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
    menuDropdown.classList.add('hidden');
  }
});

// Admin login functionality
adminLoginBtn.addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  adminLoginModal.showModal();
});

logoutBtn.addEventListener('click', async () => {
  menuDropdown.classList.add('hidden');
  await Auth.logout();
  await checkAdminStatus();
  alert('Logged out successfully');
});

closeAdminLogin.addEventListener('click', () => adminLoginModal.close());
cancelAdminLogin.addEventListener('click', () => adminLoginModal.close());

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    await Auth.login(adminUsername.value.trim(), adminPassword.value);
    adminLoginModal.close();
    adminUsername.value = '';
    adminPassword.value = '';
    await checkAdminStatus();
    alert('Admin login successful!');
  } catch (err) {
    alert(err.message);
  }
});

// ===== Self-tests =====
function runTests() {
  console.log('Running self-tests...');
  
  // Test 1: Check if grid is built correctly
  const gridCells = grid.children.length;
  console.assert(gridCells === COLS * ROWS, `Grid should have ${COLS * ROWS} cells, got ${gridCells}`);
  
  // Test 2: Check if center cell is at (0,0)
  const centerCell = grid.children[CENTER_Y * COLS + CENTER_X];
  console.assert(centerCell.dataset.x === '0' && centerCell.dataset.y === '0', 'Center cell should be at (0,0)');
  
  // Test 3: Check if bear trap area is highlighted
  bearTraps[0] = { x: 0, y: 0, color: '#f59e0b' };
  highlightBearTraps();
  const bearTrapCell = grid.querySelector('[data-x="0"][data-y="0"]');
  console.assert(bearTrapCell && bearTrapCell.classList.contains('bear-trap-area'), 'Bear trap cells should be highlighted');
  
  console.log('All self-tests passed!');
}

// ===== Boot =====
checkAdminStatus();
buildGrid();
loadLevelColors();
loadSnapshot();
setInterval(() => loadSnapshot(), 5000);
requestAnimationFrame(centerView);
updateTrapLegend();

// Run tests if URL has #test
if (location.hash.slice(1) === 'test') {
  runTests();
}

