let isAdmin = false;

async function checkAdmin() {
  const user = await Auth.fetchUser();
  isAdmin = Auth.isManager();
  const saveBtn = document.getElementById('saveBtn');
  if (!isAdmin) saveBtn.style.display = 'none';
}

async function loadLevels() {
  try {
    const res = await fetch('/api/levels');
    const data = await res.json();
    for (const { level, color } of data) {
      const input = document.getElementById(`level-${level}`);
      if (input) input.value = color;
    }
  } catch (err) {
    console.error('Failed to load level colors', err);
  }
}

async function saveLevels() {
  try {
    for (let i = 1; i <= 5; i++) {
      const color = document.getElementById(`level-${i}`).value;
      await fetch('/api/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: i, color })
      });
    }
    alert('Level colors saved');
  } catch (err) {
    alert('Failed to save: ' + err.message);
  }
}

document.getElementById('saveBtn').addEventListener('click', (e) => {
  e.preventDefault();
  saveLevels();
});

checkAdmin();
loadLevels();
