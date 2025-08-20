// ===== Model =====
const GRID_CELLS = 41; // odd number so we have a single center cell
const CENTER = Math.floor(GRID_CELLS / 2);
const BEAR_TRAP_SIZE = 2;
const BEAR_TRAP_COUNT = 2;
const BEAR_TRAP_STORAGE_KEY = 'bearTraps';
const CITY_DRAG_TYPE = 'application/x-city-id';
const LONG_PRESS_MS = 700;
let bearTraps = JSON.parse(localStorage.getItem(BEAR_TRAP_STORAGE_KEY) || '[]');
if (bearTraps.length < BEAR_TRAP_COUNT) {
  bearTraps = Array.from({ length: BEAR_TRAP_COUNT }, (_, i) => bearTraps[i] || null);
}

/** @type {Array<{id:string,name:string,level?:number,status:'occupied'|'reserved',x:number,y:number,notes?:string,color:string}>} */
let cities = [];

// Admin functionality
let isAdmin = false;
let currentUser = 'viewer';

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
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const trapModal = document.getElementById('trapModal');
const closeTrapModal = document.getElementById('closeTrapModal');
const trapPlaceSection = document.getElementById('trapPlaceSection');
const trapDeleteSection = document.getElementById('trapDeleteSection');
const addCityOption = document.getElementById('addCityOption');
const trapOptionButtons = document.querySelectorAll('.trapOption');
const deleteTrapBtn = document.getElementById('deleteTrapBtn');
let pendingPlacement = null;

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

// ===== API Functions =====
async function loadCities() {
  try {
    const response = await fetch('/api/cities');
    if (!response.ok) throw new Error('Failed to load cities');
    cities = await response.json();
    render();
  } catch (error) {
    console.error('Error loading cities:', error);
    alert('Failed to load cities: ' + error.message);
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
    
    await loadCities();
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
    await loadCities();
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

function highlightBearTraps() {
  grid.querySelectorAll('.bear-trap-area').forEach(c => c.classList.remove('bear-trap-area'));
  for (const trap of bearTraps) {
    for (const { x, y } of getBearTrapCells(trap)) {
      const cell = grid.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (cell) cell.classList.add('bear-trap-area');
    }
  }
}

function setBearTrap(index, topLeft) {
  bearTraps[index] = topLeft;
  localStorage.setItem(BEAR_TRAP_STORAGE_KEY, JSON.stringify(bearTraps));
  highlightBearTraps();
}

function removeBearTrap(index) {
  bearTraps[index] = null;
  localStorage.setItem(BEAR_TRAP_STORAGE_KEY, JSON.stringify(bearTraps));
  highlightBearTraps();
}

function trapIndexAt(x, y) {
  return bearTraps.findIndex(trap =>
    getBearTrapCells(trap).some(c => c.x === x && c.y === y)
  );
}

function startBearTrapPlacement(x, y) {
  pendingPlacement = { x, y };
  trapPlaceSection.classList.remove('hidden');
  trapDeleteSection.classList.add('hidden');
  trapModal.showModal();
}

function handleCellDrop(e, x, y) {
  e.preventDefault();
  if (!isAdmin) return;
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
  grid.style.setProperty('--cells', GRID_CELLS);
  grid.innerHTML = '';

  for (let row = 0; row < GRID_CELLS; row++) {
    for (let col = 0; col < GRID_CELLS; col++) {
      const x = col - CENTER; // cartesian coords with 0,0 center
      const y = row - CENTER;
      const cell = document.createElement('div');
      cell.className = 'relative select-none border border-slate-800/40 bg-slate-900';

      // Coord label (tiny)
      const label = document.createElement('div');
      label.className = 'absolute bottom-0.5 right-1 text-[10px] text-slate-500';
      label.textContent = `${x},${y}`;
      cell.appendChild(label);

      cell.dataset.x = x;
      cell.dataset.y = y;

      // Click to show info or actions for this cell
      cell.addEventListener('click', () => {
        const trapIdx = trapIndexAt(x, y);
        if (trapIdx >= 0) {
          pendingPlacement = { index: trapIdx };
          trapPlaceSection.classList.add('hidden');
          trapDeleteSection.classList.remove('hidden');
          trapModal.showModal();
          return;
        }
        const existing = cities.find(c => c.x === x && c.y === y);
        showInfoPopup(existing, x, y);
      });

      // Support dropping a dragged city
      cell.addEventListener('dragover', (e) => e.preventDefault());
      cell.addEventListener('drop', (e) => handleCellDrop(e, x, y));

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
  }

  const q = searchInput.value.trim().toLowerCase();
  for (const c of cities) {
    const idx = (c.y + CENTER) * GRID_CELLS + (c.x + CENTER);
    const cell = cells[idx];
    if (!cell) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'city absolute inset-1 rounded-xl shadow ring-1 ring-white/10 flex items-center justify-center text-[11px] font-semibold truncate';
    btn.style.backgroundColor = c.color || '#ec4899';
    btn.style.color = c.status === 'reserved' ? '#1e293b' : 'white';
    btn.textContent = c.name?.slice(0, 8) || 'City';
    btn.title = `${c.name || 'City'} (Lv ${c.level || '?'})\n${c.status} @ (${c.x}, ${c.y})${c.notes ? `\n${c.notes}` : ''}`;
    btn.draggable = isAdmin;

    // Click to show info popup with optional actions
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showInfoPopup(c, c.x, c.y);
    });

    // long press -> toggle reserved/occupied (admin only)
    let pressTimer;
    if (isAdmin) {
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(CITY_DRAG_TYPE, c.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      btn.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => { toggleStatus(c.id); }, LONG_PRESS_MS);
      });
      btn.addEventListener('touchend', () => clearTimeout(pressTimer));
      btn.addEventListener('mousedown', () => { pressTimer = setTimeout(() => toggleStatus(c.id), LONG_PRESS_MS); });
      btn.addEventListener('mouseup', () => clearTimeout(pressTimer));
      btn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    }

    cell.appendChild(btn);

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
  colorEl.value = '#ec4899';
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
  colorEl.value = c.color || '#ec4899';
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

infoCloseBtn.addEventListener('click', () => infoPopup.close());

clearAllBtn.addEventListener('click', async () => {
  if (!isAdmin) return;
  
  if (confirm('Clear all data? This cannot be undone.')) {
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      });
      
      if (!response.ok) throw new Error('Clear failed');
      
      await loadCities();
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
  btn.addEventListener('click', () => {
    if (!pendingPlacement) return;
    const idx = Number(btn.dataset.index);
    setBearTrap(idx, pendingPlacement);
    pendingPlacement = null;
    trapModal.close();
  });
});

deleteTrapBtn.addEventListener('click', () => {
  if (!pendingPlacement) return;
  removeBearTrap(pendingPlacement.index);
  pendingPlacement = null;
  trapModal.close();
});

// Center view on the grid at start
function centerView() {
  const cellSize = 42 * (Number(zoom.value) / 100);
  const contentSize = GRID_CELLS * cellSize;
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
  console.assert(gridCells === GRID_CELLS * GRID_CELLS, `Grid should have ${GRID_CELLS * GRID_CELLS} cells, got ${gridCells}`);
  
  // Test 2: Check if center cell is at (0,0)
  const centerCell = grid.children[CENTER * GRID_CELLS + CENTER];
  console.assert(centerCell.dataset.x === '0' && centerCell.dataset.y === '0', 'Center cell should be at (0,0)');
  
  // Test 3: Check if bear trap area is highlighted
  bearTraps[0] = { x: 0, y: 0 };
  highlightBearTraps();
  const bearTrapCell = grid.querySelector('[data-x="0"][data-y="0"]');
  console.assert(bearTrapCell && bearTrapCell.classList.contains('bear-trap-area'), 'Bear trap cells should be highlighted');
  
  console.log('All self-tests passed!');
}

// ===== Boot =====
checkAdminStatus();
buildGrid();
loadCities();
requestAnimationFrame(centerView);

// Run tests if URL has #test
if (location.hash.slice(1) === 'test') {
  runTests();
}
