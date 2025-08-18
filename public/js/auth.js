const Auth = (() => {
  const API_LOGIN = '/api/login';
  const API_LOGOUT = '/api/logout';
  const API_ME = '/api/me';

  let currentUser = null;

  async function fetchUser() {
    try {
      const res = await fetch(API_ME);
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json();
      currentUser = data.user;
    } catch {
      currentUser = null;
    }
    return currentUser;
  }

  async function login(username, password) {
    const res = await fetch(API_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data = await res.json();
    currentUser = data.user;
    return currentUser;
  }

  async function logout() {
    await fetch(API_LOGOUT, { method: 'POST' });
    currentUser = null;
  }

  function getUser() {
    return currentUser;
  }

  function isManager() {
    return currentUser && ['admin', 'moderator'].includes(currentUser.role);
  }

  return { fetchUser, login, logout, getUser, isManager };
})();
