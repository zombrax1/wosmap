// ===== Model =====
let historyData = [];
let filteredHistory = [];
let currentPage = 1;
const itemsPerPage = 10;

// Admin functionality
let isAdmin = false;
let currentUser = 'viewer';

// Mock history data
const mockHistoryData = [
  {
    id: 1,
    timestamp: new Date('2024-01-15T10:30:00'),
    action: 'create',
    cityName: 'TestCity1',
    cityId: 'city-1',
    user: 'admin',
    details: 'Created new city at position (5, 3)',
    coordinates: { x: 5, y: 3 }
  },
  {
    id: 2,
    timestamp: new Date('2024-01-15T11:15:00'),
    action: 'update',
    cityName: 'TestCity1',
    cityId: 'city-1',
    user: 'admin',
    details: 'Updated level from 10 to 15',
    coordinates: { x: 5, y: 3 }
  },
  {
    id: 3,
    timestamp: new Date('2024-01-15T14:20:00'),
    action: 'create',
    cityName: 'TestCity2',
    cityId: 'city-2',
    user: 'user1',
    details: 'Created new city at position (-2, 1)',
    coordinates: { x: -2, y: 1 }
  },
  {
    id: 4,
    timestamp: new Date('2024-01-16T09:45:00'),
    action: 'delete',
    cityName: 'TestCity1',
    cityId: 'city-1',
    user: 'admin',
    details: 'Deleted city from position (5, 3)',
    coordinates: { x: 5, y: 3 }
  },
  {
    id: 5,
    timestamp: new Date('2024-01-16T16:30:00'),
    action: 'update',
    cityName: 'TestCity2',
    cityId: 'city-2',
    user: 'user1',
    details: 'Changed status from occupied to reserved',
    coordinates: { x: -2, y: 1 }
  }
];

// ===== Elements =====
const userMode = document.getElementById('userMode');
const actionFilter = document.getElementById('actionFilter');
const dateFilter = document.getElementById('dateFilter');
const userFilter = document.getElementById('userFilter');
const clearFilters = document.getElementById('clearFilters');
const historyTableBody = document.getElementById('historyTableBody');
const showingStart = document.getElementById('showingStart');
const showingEnd = document.getElementById('showingEnd');
const totalEntries = document.getElementById('totalEntries');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');

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

// ===== Admin Functions =====
async function checkAdminStatus() {
  const user = await Auth.fetchUser();
  isAdmin = Auth.isManager();
  currentUser = user ? user.username : 'viewer';
  updateUIForUser();
  updateMenuUI();
}

function updateUIForUser() {
  if (isAdmin) {
    userMode.textContent = 'Admin';
    userMode.className = 'text-xs px-2 py-1 rounded bg-green-700 text-green-200';
  } else {
    userMode.textContent = 'View Only';
    userMode.className = 'text-xs px-2 py-1 rounded bg-slate-700 text-slate-200';
  }
}

function updateMenuUI() {
  if (isAdmin) {
    adminLoginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
  } else {
    adminLoginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
  }
}

// ===== History Functions =====
function loadHistoryData() {
  // In a real app, this would fetch from the server
  historyData = [...mockHistoryData];
  filterHistory();
  renderHistory();
  updatePagination();
}

function filterHistory() {
  const actionValue = actionFilter.value;
  const dateValue = dateFilter.value;
  const userValue = userFilter.value;
  
  filteredHistory = historyData.filter(entry => {
    // Action filter
    if (actionValue && entry.action !== actionValue) return false;
    
    // User filter
    if (userValue && entry.user !== userValue) return false;
    
    // Date filter
    if (dateValue) {
      const entryDate = new Date(entry.timestamp);
      const now = new Date();
      
      switch (dateValue) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (entryDate < today) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (entryDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          if (entryDate < monthAgo) return false;
          break;
      }
    }
    
    return true;
  });
}

function renderHistory() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filteredHistory.slice(startIndex, endIndex);
  
  historyTableBody.innerHTML = '';
  
  if (pageData.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-slate-400">
          No history entries found
        </td>
      </tr>
    `;
    return;
  }
  
  pageData.forEach(entry => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-700';
    
    const actionColor = {
      create: 'text-green-400',
      update: 'text-yellow-400',
      delete: 'text-red-400'
    }[entry.action] || 'text-slate-400';
    
    row.innerHTML = `
      <td class="px-4 py-3 text-sm text-slate-300">
        ${entry.timestamp.toLocaleString()}
      </td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 rounded text-xs font-medium ${actionColor}">
          ${entry.action.toUpperCase()}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-slate-300">
        ${entry.cityName} (${entry.coordinates.x}, ${entry.coordinates.y})
      </td>
      <td class="px-4 py-3 text-sm text-slate-300">
        ${entry.user}
      </td>
      <td class="px-4 py-3 text-sm text-slate-400">
        ${entry.details}
      </td>
    `;
    
    historyTableBody.appendChild(row);
  });
}

function updatePagination() {
  const total = filteredHistory.length;
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, total);
  
  showingStart.textContent = total > 0 ? start : 0;
  showingEnd.textContent = end;
  totalEntries.textContent = total;
  
  prevPage.disabled = currentPage === 1;
  nextPage.disabled = end >= total;
}

// ===== Event Listeners =====
// Filter events
actionFilter.addEventListener('change', () => {
  currentPage = 1;
  filterHistory();
  renderHistory();
  updatePagination();
});

dateFilter.addEventListener('change', () => {
  currentPage = 1;
  filterHistory();
  renderHistory();
  updatePagination();
});

userFilter.addEventListener('change', () => {
  currentPage = 1;
  filterHistory();
  renderHistory();
  updatePagination();
});

clearFilters.addEventListener('click', () => {
  actionFilter.value = '';
  dateFilter.value = 'all';
  userFilter.value = '';
  currentPage = 1;
  filterHistory();
  renderHistory();
  updatePagination();
});

// Pagination events
prevPage.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderHistory();
    updatePagination();
  }
});

nextPage.addEventListener('click', () => {
  const total = filteredHistory.length;
  const maxPage = Math.ceil(total / itemsPerPage);
  if (currentPage < maxPage) {
    currentPage++;
    renderHistory();
    updatePagination();
  }
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

// ===== Boot =====
checkAdminStatus();
loadHistoryData();
