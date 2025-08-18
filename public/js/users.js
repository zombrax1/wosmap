// ===== Model =====
let usersData = [];
let auditData = [];
let filteredAudit = [];

// Admin functionality
let isAdmin = false;
let currentUser = 'viewer';

// Mock users data
const mockUsersData = [
  {
    id: 1,
    username: 'admin',
    role: 'admin',
    status: 'active',
    lastLogin: new Date('2024-01-16T15:30:00'),
    createdAt: new Date('2024-01-01T00:00:00')
  },
  {
    id: 2,
    username: 'user1',
    role: 'user',
    status: 'active',
    lastLogin: new Date('2024-01-16T14:20:00'),
    createdAt: new Date('2024-01-05T00:00:00')
  },
  {
    id: 3,
    username: 'user2',
    role: 'user',
    status: 'active',
    lastLogin: new Date('2024-01-16T13:15:00'),
    createdAt: new Date('2024-01-10T00:00:00')
  },
  {
    id: 4,
    username: 'user3',
    role: 'user',
    status: 'inactive',
    lastLogin: new Date('2024-01-10T09:45:00'),
    createdAt: new Date('2024-01-12T00:00:00')
  },
  {
    id: 5,
    username: 'user4',
    role: 'user',
    status: 'active',
    lastLogin: new Date('2024-01-16T16:00:00'),
    createdAt: new Date('2024-01-15T00:00:00')
  }
];

// Mock audit data
const mockAuditData = [
  {
    id: 1,
    timestamp: new Date('2024-01-16T16:30:00'),
    user: 'admin',
    event: 'login',
    ipAddress: '192.168.1.100',
    details: 'Admin login successful'
  },
  {
    id: 2,
    timestamp: new Date('2024-01-16T16:25:00'),
    user: 'user1',
    event: 'create',
    ipAddress: '192.168.1.101',
    details: 'Created city "TestCity" at (5, 3)'
  },
  {
    id: 3,
    timestamp: new Date('2024-01-16T16:20:00'),
    user: 'user2',
    event: 'update',
    ipAddress: '192.168.1.102',
    details: 'Updated city "TestCity2" level from 10 to 15'
  },
  {
    id: 4,
    timestamp: new Date('2024-01-16T16:15:00'),
    user: 'admin',
    event: 'delete',
    ipAddress: '192.168.1.100',
    details: 'Deleted city "OldCity" from (0, 0)'
  },
  {
    id: 5,
    timestamp: new Date('2024-01-16T16:10:00'),
    user: 'user1',
    event: 'logout',
    ipAddress: '192.168.1.101',
    details: 'User logout'
  }
];

// ===== Elements =====
const userMode = document.getElementById('userMode');

// Tab elements
const usersTab = document.getElementById('usersTab');
const auditTab = document.getElementById('auditTab');
const usersSection = document.getElementById('usersSection');
const auditSection = document.getElementById('auditSection');

// Users elements
const usersTableBody = document.getElementById('usersTableBody');
const addUserBtn = document.getElementById('addUserBtn');

// Audit elements
const auditEventFilter = document.getElementById('auditEventFilter');
const auditUserFilter = document.getElementById('auditUserFilter');
const auditDateFilter = document.getElementById('auditDateFilter');
const clearAuditFilters = document.getElementById('clearAuditFilters');
const auditTableBody = document.getElementById('auditTableBody');

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

// Add user elements
const addUserModal = document.getElementById('addUserModal');
const addUserForm = document.getElementById('addUserForm');
const newUsername = document.getElementById('newUsername');
const newPassword = document.getElementById('newPassword');
const newUserRole = document.getElementById('newUserRole');
const closeAddUser = document.getElementById('closeAddUser');
const cancelAddUser = document.getElementById('cancelAddUser');

// ===== Admin Functions =====
function checkAdminStatus() {
  const storedUser = localStorage.getItem('wos-user');
  const storedAdminToken = localStorage.getItem('wos-admin-token');
  
  if (storedUser === 'admin' && storedAdminToken === 'authenticated') {
    isAdmin = true;
    currentUser = 'admin';
  } else {
    isAdmin = false;
    currentUser = 'viewer';
    localStorage.setItem('wos-user', 'viewer');
    localStorage.removeItem('wos-admin-token');
  }
  
  updateUIForUser();
  updateMenuUI();
}

function updateUIForUser() {
  if (isAdmin) {
    userMode.textContent = 'Admin';
    userMode.className = 'text-xs px-2 py-1 rounded bg-green-700 text-green-200';
    addUserBtn.style.display = 'block';
  } else {
    userMode.textContent = 'View Only';
    userMode.className = 'text-xs px-2 py-1 rounded bg-slate-700 text-slate-200';
    addUserBtn.style.display = 'none';
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

// ===== Users Functions =====
function loadUsersData() {
  usersData = [...mockUsersData];
  renderUsers();
}

function renderUsers() {
  usersTableBody.innerHTML = '';
  
  usersData.forEach(user => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-700';
    
    const statusColor = user.status === 'active' ? 'text-green-400' : 'text-red-400';
    const roleColor = user.role === 'admin' ? 'text-yellow-400' : 'text-slate-400';
    
    row.innerHTML = `
      <td class="px-4 py-3 text-sm text-slate-300">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          ${user.username}
        </div>
      </td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 rounded text-xs font-medium ${roleColor}">
          ${user.role.toUpperCase()}
        </span>
      </td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 rounded text-xs font-medium ${statusColor}">
          ${user.status.toUpperCase()}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-slate-300">
        ${user.lastLogin.toLocaleString()}
      </td>
      <td class="px-4 py-3 text-sm">
        <div class="flex gap-2">
          <button class="px-2 py-1 rounded text-xs bg-slate-600 hover:bg-slate-500">Edit</button>
          <button class="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-500">Delete</button>
        </div>
      </td>
    `;
    
    usersTableBody.appendChild(row);
  });
}

// ===== Audit Functions =====
function loadAuditData() {
  auditData = [...mockAuditData];
  filterAudit();
  renderAudit();
}

function filterAudit() {
  const eventValue = auditEventFilter.value;
  const userValue = auditUserFilter.value;
  const dateValue = auditDateFilter.value;
  
  filteredAudit = auditData.filter(entry => {
    // Event filter
    if (eventValue && entry.event !== eventValue) return false;
    
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

function renderAudit() {
  auditTableBody.innerHTML = '';
  
  if (filteredAudit.length === 0) {
    auditTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-slate-400">
          No audit entries found
        </td>
      </tr>
    `;
    return;
  }
  
  filteredAudit.forEach(entry => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-700';
    
    const eventColor = {
      login: 'text-green-400',
      logout: 'text-blue-400',
      create: 'text-green-400',
      update: 'text-yellow-400',
      delete: 'text-red-400'
    }[entry.event] || 'text-slate-400';
    
    row.innerHTML = `
      <td class="px-4 py-3 text-sm text-slate-300">
        ${entry.timestamp.toLocaleString()}
      </td>
      <td class="px-4 py-3 text-sm text-slate-300">
        ${entry.user}
      </td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 rounded text-xs font-medium ${eventColor}">
          ${entry.event.toUpperCase()}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-slate-300">
        ${entry.ipAddress}
      </td>
      <td class="px-4 py-3 text-sm text-slate-400">
        ${entry.details}
      </td>
    `;
    
    auditTableBody.appendChild(row);
  });
}

// ===== Tab Functions =====
function showUsersTab() {
  usersTab.classList.add('border-indigo-500', 'text-indigo-400');
  usersTab.classList.remove('text-slate-400');
  auditTab.classList.remove('border-indigo-500', 'text-indigo-400');
  auditTab.classList.add('text-slate-400');
  
  usersSection.classList.remove('hidden');
  auditSection.classList.add('hidden');
}

function showAuditTab() {
  auditTab.classList.add('border-indigo-500', 'text-indigo-400');
  auditTab.classList.remove('text-slate-400');
  usersTab.classList.remove('border-indigo-500', 'text-indigo-400');
  usersTab.classList.add('text-slate-400');
  
  auditSection.classList.remove('hidden');
  usersSection.classList.add('hidden');
}

// ===== Event Listeners =====
// Tab events
usersTab.addEventListener('click', showUsersTab);
auditTab.addEventListener('click', showAuditTab);

// Audit filter events
auditEventFilter.addEventListener('change', () => {
  filterAudit();
  renderAudit();
});

auditUserFilter.addEventListener('change', () => {
  filterAudit();
  renderAudit();
});

auditDateFilter.addEventListener('change', () => {
  filterAudit();
  renderAudit();
});

clearAuditFilters.addEventListener('click', () => {
  auditEventFilter.value = '';
  auditUserFilter.value = '';
  auditDateFilter.value = 'all';
  filterAudit();
  renderAudit();
});

// Add user events
addUserBtn.addEventListener('click', () => {
  if (!isAdmin) return;
  addUserModal.showModal();
});

closeAddUser.addEventListener('click', () => addUserModal.close());
cancelAddUser.addEventListener('click', () => addUserModal.close());

addUserForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const username = newUsername.value.trim();
  const password = newPassword.value;
  const role = newUserRole.value;
  
  if (username && password) {
    const newUser = {
      id: usersData.length + 1,
      username: username,
      role: role,
      status: 'active',
      lastLogin: new Date(),
      createdAt: new Date()
    };
    
    usersData.push(newUser);
    renderUsers();
    
    addUserModal.close();
    newUsername.value = '';
    newPassword.value = '';
    newUserRole.value = 'user';
    
    alert(`User "${username}" created successfully!`);
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

logoutBtn.addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  localStorage.removeItem('wos-user');
  localStorage.removeItem('wos-admin-token');
  checkAdminStatus();
  alert('Logged out successfully');
});

closeAdminLogin.addEventListener('click', () => adminLoginModal.close());
cancelAdminLogin.addEventListener('click', () => adminLoginModal.close());

adminLoginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const username = adminUsername.value.trim();
  const password = adminPassword.value;
  
  if (username === 'admin' && password === 'zombrox') {
    localStorage.setItem('wos-user', 'admin');
    localStorage.setItem('wos-admin-token', 'authenticated');
    adminLoginModal.close();
    adminUsername.value = '';
    adminPassword.value = '';
    checkAdminStatus();
    alert('Admin login successful!');
  } else {
    alert('Invalid username or password');
  }
});

// ===== Boot =====
checkAdminStatus();
loadUsersData();
loadAuditData();
