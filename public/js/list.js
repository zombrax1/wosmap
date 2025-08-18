// ===== Model =====
const GRID_CELLS = 41; // odd number so we have a single center cell
const CENTER = Math.floor(GRID_CELLS / 2);
const BEAR_TRAP_SIZE = 2;
const BEAR_TRAP_COUNT = 2;
let bearTraps = JSON.parse(localStorage.getItem('bearTraps') || '[]');
if (bearTraps.length < BEAR_TRAP_COUNT) {
  bearTraps = Array.from({ length: BEAR_TRAP_COUNT }, (_, i) => bearTraps[i] || null);
}

/** @type {Array<{id:string,name:string,level?:number,status:'occupied'|'reserved',x:number,y:number,notes?:string,color:string}>} */
let cities = [];
let filteredCities = [];

// Admin functionality
let isAdmin = false;
let currentUser = 'viewer';

async function checkAdminStatus() {
  const user = await Auth.fetchUser();
  isAdmin = Auth.isManager();
  currentUser = user ? user.username : 'viewer';
  updateUIForUser();
}

function updateUIForUser() {
  const addCityBtn = document.getElementById('addCityBtn');
  const autoInsertBtn = document.getElementById('autoInsertBtn');
  
  if (isAdmin) {
    addCityBtn.style.display = 'block';
    autoInsertBtn.style.display = 'block';
  } else {
    addCityBtn.style.display = 'none';
    autoInsertBtn.style.display = 'none';
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
const statusFilter = document.getElementById('statusFilter');
const levelFilter = document.getElementById('levelFilter');

const citiesList = document.getElementById('citiesList');
const totalCount = document.getElementById('totalCount');
const occupiedCount = document.getElementById('occupiedCount');
const reservedCount = document.getElementById('reservedCount');

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
    filterCities();
    renderMap();
    renderList();
    updateStats();
  } catch (error) {
    console.error('Error loading cities:', error);
    alert('Failed to load cities: ' + error.message);
  }
}

async function saveCity(cityData) {
  try {
    const method = cityData.id ? 'PUT' : 'POST';
    const url = cityData.id ? `/api/cities/${cityData.id}` : '/api/cities';
    
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

// ===== Filtering =====
function filterCities() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const statusTerm = statusFilter.value;
  const levelTerm = levelFilter.value;
  
  filteredCities = cities.filter(city => {
    // Search filter
    if (searchTerm && !city.name.toLowerCase().includes(searchTerm)) {
      return false;
    }
    
    // Status filter
    if (statusTerm && city.status !== statusTerm) {
      return false;
    }
    
    // Level filter
    if (levelTerm) {
      const level = city.level || 0;
      switch (levelTerm) {
        case '1-10': if (level < 1 || level > 10) return false; break;
        case '11-20': if (level < 11 || level > 20) return false; break;
        case '21-30': if (level < 21 || level > 30) return false; break;
        case '31-40': if (level < 31 || level > 40) return false; break;
        case '41-50': if (level < 41 || level > 50) return false; break;
        case '51+': if (level < 51) return false; break;
      }
    }
    
    return true;
  });
}

// ===== Map rendering =====
function isBearTrapCell(x, y) {
  return bearTraps.some(trap =>
    trap &&
    x >= trap.x && x < trap.x + BEAR_TRAP_SIZE &&
    y >= trap.y && y < trap.y + BEAR_TRAP_SIZE
  );
}

function buildGrid() {
  grid.style.setProperty('--cells', GRID_CELLS);
  grid.innerHTML = '';

  for (let row = 0; row < GRID_CELLS; row++) {
    for (let col = 0; col < GRID_CELLS; col++) {
      const x = col - CENTER;
      const y = row - CENTER;
      const cell = document.createElement('div');
      cell.className = 'relative select-none border border-slate-800/40';

      // Bear Trap 2x2 highlight
      if (isBearTrapCell(x, y)) {
        cell.classList.add('bear-trap-area');
      } else {
        cell.classList.add('bg-slate-900');
      }

      // Coord label (tiny)
      const label = document.createElement('div');
      label.className = 'absolute bottom-0.5 right-1 text-[10px] text-slate-500';
      label.textContent = `${x},${y}`;
      cell.appendChild(label);

      cell.dataset.x = x;
      cell.dataset.y = y;

      // Click to add / edit (admin only)
      cell.addEventListener('click', (e) => {
        const existing = cities.find(c => c.x === x && c.y === y);
        if (existing) {
          if (isAdmin) {
            openEdit(existing);
          } else {
            showCityInfo(existing);
          }
        } else {
          if (isAdmin) {
            openCreateAt(x, y);
          }
        }
      });

      grid.appendChild(cell);
    }
  }
}

function renderMap() {
  // Clear prior markers
  const cells = grid.children;
  for (const cell of cells) {
    const marker = cell.querySelector('.city');
    if (marker) marker.remove();
  }

  // Render all cities (not just filtered ones for map)
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

    // click -> edit (admin only) or view (viewer)
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isAdmin) {
        openEdit(c);
      } else {
        showCityInfo(c);
      }
    });

    cell.appendChild(btn);
  }
}

// ===== List rendering =====
function renderList() {
  citiesList.innerHTML = '';
  
  if (filteredCities.length === 0) {
    citiesList.innerHTML = '<div class="text-center text-slate-500 py-8">No cities found</div>';
    return;
  }
  
  filteredCities.forEach(city => {
    const item = document.createElement('div');
    item.className = 'city-list-item p-3 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer';
    item.dataset.cityId = city.id;
    
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded" style="background-color: ${city.color || '#ec4899'}"></div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${city.name}</div>
          <div class="text-xs text-slate-400">
            Lv ${city.level || '?'} • ${city.status} • (${city.x}, ${city.y})
          </div>
          ${city.notes ? `<div class="text-xs text-slate-500 mt-1">${city.notes}</div>` : ''}
        </div>
        <div class="text-xs text-slate-500">
          ${city.status === 'occupied' ? '🔴' : '🟡'}
        </div>
      </div>
    `;
    
    // Hover to highlight on map
    item.addEventListener('mouseenter', () => highlightCityOnMap(city));
    item.addEventListener('mouseleave', () => clearMapHighlight());
    
    // Click to edit (admin only) or view (viewer)
    item.addEventListener('click', () => {
      if (isAdmin) {
        openEdit(city);
      } else {
        showCityInfo(city);
      }
    });
    
    citiesList.appendChild(item);
  });
}

function highlightCityOnMap(city) {
  const cells = grid.children;
  const idx = (city.y + CENTER) * GRID_CELLS + (city.x + CENTER);
  const cell = cells[idx];
  if (cell) {
    cell.style.boxShadow = 'inset 0 0 0 3px #3b82f6';
    cell.style.zIndex = '10';
  }
}

function clearMapHighlight() {
  const cells = grid.children;
  for (const cell of cells) {
    cell.style.boxShadow = '';
    cell.style.zIndex = '';
  }
}

function updateStats() {
  totalCount.textContent = cities.length;
  occupiedCount.textContent = cities.filter(c => c.status === 'occupied').length;
  reservedCount.textContent = cities.filter(c => c.status === 'reserved').length;
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
  e.preventDefault();
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

  const success = await saveCity(payload);
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
  
  const success = await saveCity(cityData);
  if (success) {
    alert(`City "${name}" auto-inserted at (${x}, ${y})`);
  }
});

// Show city info (viewer mode)
function showCityInfo(city) {
  const info = `
City: ${city.name}
Level: ${city.level || 'Unknown'}
Status: ${city.status}
Position: (${city.x}, ${city.y})
${city.notes ? `Notes: ${city.notes}` : ''}
  `.trim();
  
  alert(info);
}

// Filter event listeners
searchInput.addEventListener('input', () => {
  filterCities();
  renderList();
});

statusFilter.addEventListener('change', () => {
  filterCities();
  renderList();
});

levelFilter.addEventListener('change', () => {
  filterCities();
  renderList();
});

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

// Center view on the grid at start
function centerView() {
  const cellSize = 42;
  const contentSize = GRID_CELLS * cellSize;
  scroller.scrollLeft = (contentSize - scroller.clientWidth) / 2;
  scroller.scrollTop = (contentSize - scroller.clientHeight) / 2;
}

// ===== Self-tests =====
function runTests() {
  console.log('Running list view self-tests...');
  
  // Test 1: Check if grid is built correctly
  const gridCells = grid.children.length;
  console.assert(gridCells === GRID_CELLS * GRID_CELLS, `Grid should have ${GRID_CELLS * GRID_CELLS} cells, got ${gridCells}`);
  
  // Test 2: Check if filtering works
  const originalLength = cities.length;
  searchInput.value = 'nonexistent';
  filterCities();
  console.assert(filteredCities.length === 0, 'Filtering should work correctly');
  searchInput.value = '';
  filterCities();
  console.assert(filteredCities.length === originalLength, 'Clearing filter should restore all cities');
  
  // Test 3: Check if stats update correctly
  updateStats();
  console.assert(totalCount.textContent === cities.length.toString(), 'Total count should match cities length');
  
  console.log('All list view self-tests passed!');
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
