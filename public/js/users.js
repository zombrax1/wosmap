const API_USERS = '/api/users';
const API_AUDIT = '/api/audit';

let usersData = [];
let auditData = [];
let isAdmin = false;
let currentUser = 'viewer';

const userMode = document.getElementById('userMode');

const usersTab = document.getElementById('usersTab');
const auditTab = document.getElementById('auditTab');
const usersSection = document.getElementById('usersSection');
const auditSection = document.getElementById('auditSection');

const usersTableBody = document.getElementById('usersTableBody');
const addUserBtn = document.getElementById('addUserBtn');

const auditTableBody = document.getElementById('auditTableBody');

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const adminLoginModal = document.getElementById('adminLoginModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');
const closeAdminLogin = document.getElementById('closeAdminLogin');
const cancelAdminLogin = document.getElementById('cancelAdminLogin');

const addUserModal = document.getElementById('addUserModal');
const addUserForm = document.getElementById('addUserForm');
const newUsername = document.getElementById('newUsername');
const newPassword = document.getElementById('newPassword');
const newUserRole = document.getElementById('newUserRole');
const closeAddUser = document.getElementById('closeAddUser');
const cancelAddUser = document.getElementById('cancelAddUser');

async function checkAdminStatus() {
  const user = await Auth.fetchUser();
  isAdmin = Auth.isManager();
  currentUser = user ? user.username : 'viewer';
  updateUIForUser();
  updateMenuUI();
  if (isAdmin) {
    await Promise.all([loadUsers(), loadAudit()]);
  } else {
    usersData = [];
    auditData = [];
    renderUsers();
    renderAudit();
  }
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

async function loadUsers() {
  try {
    const res = await fetch(API_USERS);
    if (!res.ok) throw new Error('Failed to load users');
    usersData = await res.json();
  } catch {
    usersData = [];
  }
  renderUsers();
}

function renderUsers() {
  usersTableBody.innerHTML = '';
  usersData.forEach((u) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-3">${u.username}</td>
      <td class="px-4 py-3">${u.role}</td>
      <td class="px-4 py-3"></td>
      <td class="px-4 py-3"></td>
      <td class="px-4 py-3">
        <button data-id="${u.id}" class="delete-user text-red-400">Delete</button>
      </td>`;
    usersTableBody.appendChild(row);
  });

  document.querySelectorAll('.delete-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`${API_USERS}/${btn.dataset.id}`, { method: 'DELETE' });
      await loadUsers();
    });
  });
}

async function loadAudit() {
  try {
    const res = await fetch(API_AUDIT);
    if (!res.ok) throw new Error('Failed to load audit');
    auditData = await res.json();
  } catch {
    auditData = [];
  }
  renderAudit();
}

function renderAudit() {
  auditTableBody.innerHTML = '';
  auditData.forEach((log) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-3">${log.timestamp}</td>
      <td class="px-4 py-3">${log.entity}</td>
      <td class="px-4 py-3">${log.action}</td>
      <td class="px-4 py-3">${log.entity_id || ''}</td>
      <td class="px-4 py-3">${log.user || ''}</td>`;
    auditTableBody.appendChild(row);
  });
}

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

usersTab.addEventListener('click', showUsersTab);
auditTab.addEventListener('click', showAuditTab);

menuBtn.addEventListener('click', () => {
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
    menuDropdown.classList.add('hidden');
  }
});

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
  } catch (err) {
    alert(err.message);
  }
});

addUserBtn.addEventListener('click', () => addUserModal.showModal());
closeAddUser.addEventListener('click', () => addUserModal.close());
cancelAddUser.addEventListener('click', () => addUserModal.close());

addUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    id: crypto.randomUUID(),
    username: newUsername.value.trim(),
    password: newPassword.value,
    role: newUserRole.value,
  };
  await fetch(API_USERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  addUserModal.close();
  newUsername.value = '';
  newPassword.value = '';
  newUserRole.value = 'user';
  await loadUsers();
});

checkAdminStatus();
showUsersTab();
