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

menuBtn.addEventListener('click', () => {
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
    menuDropdown.classList.add('hidden');
  }
});

adminLoginBtn.addEventListener('click', () => {
  adminLoginModal.showModal();
});

closeAdminLogin.addEventListener('click', () => adminLoginModal.close());
cancelAdminLogin.addEventListener('click', () => adminLoginModal.close());

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const success = await Auth.login(adminUsername.value, adminPassword.value);
  if (success) {
    adminLoginModal.close();
    menuDropdown.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    adminLoginBtn.classList.add('hidden');
  }
});

logoutBtn.addEventListener('click', async () => {
  await Auth.logout();
  logoutBtn.classList.add('hidden');
  adminLoginBtn.classList.remove('hidden');
});

(async function init() {
  const user = await Auth.fetchUser();
  if (user) {
    adminLoginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  }
})();
