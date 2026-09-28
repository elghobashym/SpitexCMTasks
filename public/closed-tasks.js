const closedTaskTableBody = document.getElementById('closedTaskTableBody');
const closedTaskList = document.getElementById('closedTaskList');
const taskSearch = document.getElementById('taskSearch');
const backToDashboard = document.getElementById('backToDashboard');
const logoutButton = document.getElementById('logoutButton');

let searchDebounce = null;

function formatClosedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function renderRows(tasks) {
  if (!tasks.length) {
    if (closedTaskList) {
      closedTaskList.innerHTML = '<div class="employee-card closed-task-empty"><p>Keine geschlossenen Aufgaben in den letzten 30 Tagen gefunden.</p></div>';
    }
    closedTaskTableBody.innerHTML = '';
    return;
  }

  if (closedTaskList) {
    closedTaskList.innerHTML = tasks
      .map(
        (task) => `
          <article class="employee-card closed-task-card">
            <div class="employee-top">
              <div class="profile-meta">
                <div class="avatar alt4">${task.employee_name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>${task.employee_name}</strong>
                  <small>Geschlossen: ${formatClosedAt(task.closed_at)}</small>
                </div>
              </div>
              <span class="employee-chip">Geschlossen</span>
            </div>
            <div class="employee-tasks">
              <div class="task-bullet">
                <span class="task-bullet-copy">
                  <span>${task.label}</span>
                  ${task.description ? `<small>${task.description}</small>` : ''}
                </span>
                <span class="task-pill closed">Geschlossen</span>
              </div>
            </div>
          </article>
        `
      )
      .join('');
  }

  closedTaskTableBody.innerHTML = tasks
    .map(
      (task) => `
        <tr>
          <td>${formatClosedAt(task.closed_at)}</td>
          <td>${task.label}</td>
          <td>${task.employee_name}</td>
        </tr>
      `
    )
    .join('');
}

async function loadClosedTasks(search = '') {
  const query = new URLSearchParams({ search });
  const response = await fetch(`/api/tasks/closed?${query.toString()}`);

  if (response.status === 403) {
    window.location.href = '/dashboard';
    return;
  }

  if (!response.ok) {
    throw new Error('Failed to load closed tasks');
  }

  const tasks = await response.json();
  renderRows(tasks || []);
}

async function validateManagerAccess() {
  const response = await fetch('/api/me');
  if (!response.ok) {
    window.location.href = '/login';
    return false;
  }

  const data = await response.json();
  const userName = data?.user?.name;
  if (!userName || !['Dorothea', 'Yolanta'].includes(userName)) {
    window.location.href = '/dashboard';
    return false;
  }

  return true;
}

async function logout() {
  const response = await fetch('/api/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }

  window.location.href = '/login';
}

taskSearch?.addEventListener('input', () => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    loadClosedTasks(taskSearch.value.trim()).catch((error) => {
      console.error(error);
    });
  }, 250);
});

backToDashboard?.addEventListener('click', () => {
  window.location.href = '/dashboard';
});

logoutButton?.addEventListener('click', async () => {
  try {
    await logout();
  } catch (error) {
    console.error(error);
    alert('Abmeldung konnte nicht durchgeführt werden.');
  }
});

(async () => {
  try {
    const hasAccess = await validateManagerAccess();
    if (!hasAccess) return;
    await loadClosedTasks('');
  } catch (error) {
    console.error(error);
    if (closedTaskList) {
      closedTaskList.innerHTML = '<div class="employee-card closed-task-empty"><p>Geschlossene Aufgaben konnten nicht geladen werden.</p></div>';
    }
    closedTaskTableBody.innerHTML = '';
  }
})();
