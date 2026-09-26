const statusOptions = [
  { value: 'open', label: 'Offen' },
  { value: 'in progress', label: 'In Bearbeitung' },
  { value: 'review', label: 'Review' },
  { value: 'closed', label: 'Geschlossen' }
];

const statusMap = Object.fromEntries(
  statusOptions.map((status) => [status.value, status.label])
);

const employeeGrid = document.getElementById('employeeGrid');
const taskTableBody = document.getElementById('taskTableBody');
const reviewChecklist = document.getElementById('reviewChecklist');
const summaryStatsBlock = document.getElementById('summaryStats');
const overviewLabel = document.getElementById('overviewLabel');
const overviewTitle = document.getElementById('overviewTitle');
const employeesHeading = document.getElementById('employeesHeading');
const tasksHeading = document.getElementById('tasksHeading');
const createTaskButton = document.getElementById('openCreateTaskModal');
const logoutButton = document.getElementById('logoutButton');
const employeeNameSelect = document.getElementById('employeeName');
const currentUserName = document.getElementById('currentUserName');
const currentUserRole = document.getElementById('currentUserRole');
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const closeTaskModalButton = document.getElementById('closeTaskModal');
const cancelTaskModalButton = document.getElementById('cancelTaskModal');
const reviewPanel = document.getElementById('reviews');
const taskPanel = document.getElementById('tasks');
const topnav = document.querySelector('.topnav');

let employees = [];
let currentUser = null;

function isDorotheaView() {
  return currentUser?.name === 'Dorothea';
}

function applyUserView() {
  if (currentUserName && currentUser) {
    currentUserName.textContent = currentUser.name;
  }

  if (currentUserRole && currentUser) {
    currentUserRole.textContent = currentUser.role;
  }

  if (isDorotheaView()) {
    document.body.classList.remove('employee-only-view');
    return;
  }

  document.body.classList.add('employee-only-view');

  if (overviewTitle) {
    overviewTitle.textContent = 'Hier sind deine aktuellen Aufgaben.';
  }

  if (employeesHeading) {
    employeesHeading.textContent = 'Meine Aufgaben';
  }
}

async function loadCurrentUser() {
  const response = await fetch('/api/me');
  if (!response.ok) {
    throw new Error('Current user lookup failed');
  }

  const data = await response.json();
  if (!data.user) {
    window.location.href = '/login';
    return;
  }

  currentUser = data.user;
  applyUserView();
}

function setOverviewLabel() {
  if (!overviewLabel) return;
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date());
  overviewLabel.textContent = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}sübersicht`;
}

function statusToClassName(status) {
  return String(status).trim().toLowerCase().replace(/\s+/g, '-');
}

function getSupabaseClient() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    throw new Error('Supabase-URL und anon-Key fehlen. Aktualisiere public/config.js mit deinen Projektwerten.');
  }

  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

function renderSummary() {
  if (!isDorotheaView()) {
    const totalTasks = employees.reduce((sum, employee) => sum + employee.tasks.length, 0);
    const reviewTasks = employees.reduce(
      (sum, employee) => sum + employee.tasks.filter((task) => task.status === 'review').length,
      0
    );

    summaryStatsBlock.innerHTML = `
      <div class="metric-card">
        <strong>${totalTasks}</strong>
        <span>Meine Aufgaben</span>
      </div>
      <div class="metric-card">
        <strong>${reviewTasks}</strong>
        <span>Im Review</span>
      </div>
    `;
    return;
  }

  const totalTasks = employees.reduce((sum, employee) => sum + employee.tasks.length, 0);
  const reviewTasks = employees.reduce(
    (sum, employee) => sum + employee.tasks.filter((task) => task.status === 'review').length,
    0
  );

  summaryStatsBlock.innerHTML = `
    <div class="metric-card">
      <strong>${Math.round((reviewTasks / totalTasks) * 100) || 0}%</strong>
      <span>Review</span>
    </div>
    <div class="metric-card">
      <strong>${totalTasks}</strong>
      <span>Aufgaben gesamt</span>
    </div>
    <div class="metric-card">
      <strong>${employees.length}</strong>
      <span>Mitarbeiter</span>
    </div>
  `;
}

function updateSectionHeadings() {
  if (!isDorotheaView()) {
    if (tasksHeading) {
      tasksHeading.textContent = 'Meine Aufgaben';
    }
    return;
  }

  if (employeesHeading) {
    employeesHeading.textContent = `${employees.length} Teammitglieder`;
  }

  if (tasksHeading) {
    const totalTasks = employees.reduce((sum, employee) => sum + employee.tasks.length, 0);
    tasksHeading.textContent = `${employees.length} Mitarbeiter • ${totalTasks} Aufgaben`;
  }
}

function updateEmployeeSelectOptions() {
  if (!employeeNameSelect) return;

  const options = ['<option value="">— Bitte wählen —</option>'];
  for (const employee of employees) {
    options.push(`<option value="${employee.name}">${employee.name}</option>`);
  }
  employeeNameSelect.innerHTML = options.join('');
}

function renderEmployeeCards() {
  employeeGrid.innerHTML = employees
    .map(
      (employee) => `
        <article class="employee-card">
          <div class="employee-top">
            <div class="profile-meta">
              <div class="avatar ${employee.variant}">${employee.initials}</div>
              <div>
                <strong>${employee.name}</strong>
                <small>${employee.role}</small>
              </div>
            </div>
            <span class="employee-chip">
              ${employee.tasks.filter((task) => task.status !== 'closed').length} Aufgaben
            </span>
          </div>

          <div class="employee-tasks">
            ${employee.tasks
              .filter((task) => task.status !== 'closed')
              .map(
                (task) => `
                  <div class="task-bullet">
                    <span class="task-bullet-copy">
                      <span>${task.label}</span>
                      ${task.description ? `<small>${task.description}</small>` : ''}
                      ${isDorotheaView() ? `<small style="display: block; margin-top: 6px; font-size: 0.7rem; color: var(--muted);">Zugewiesen an: <strong>${employee.name}</strong></small>` : ''}
                    </span>
                    <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                      <select class="task-status-select ${statusToClassName(task.status)}" data-employee-id="${employee.id}" data-task-id="${task.id}" aria-label="Status für ${task.label} ändern">
                        ${statusOptions
                          .map(
                            (option) => `
                              <option value="${option.value}" ${task.status === option.value ? 'selected' : ''}>
                                ${option.label}
                              </option>
                            `
                          )
                          .join('')}
                      </select>
                      ${isDorotheaView() ? `<select class="task-reassign-select" data-task-id="${task.id}" data-current-employee-id="${employee.id}" style="font-size: 0.72rem; min-width: 100px;" aria-label="Zuweisen an"><option value="">— Zuweisen —</option>${employees.map((emp) => `<option value="${emp.id}" ${emp.id === employee.id ? 'disabled' : ''}>${emp.name}</option>`).join('')}</select>` : ''}
                    </div>
                  </div>
                `
              )
              .join('')}
          </div>
        </article>
      `
    )
    .join('');
}

function renderReviewChecklist() {
  const reviewItems = employees.flatMap((employee) =>
    employee.tasks
      .filter((task) => task.status === 'review')
      .map((task) => ({
        employeeName: employee.name,
        taskLabel: task.label,
        variant: employee.variant
      }))
  );

  reviewChecklist.innerHTML = reviewItems.length
    ? reviewItems
        .map(
          (item) => `
            <div class="review-row-item review-task-row">
              <div class="review-row-main">
                <strong>${item.taskLabel}</strong>
                <span class="employee-review-badge ${item.variant}">${item.employeeName}</span>
              </div>
              <span class="review-pill review">Review</span>
            </div>
          `
        )
        .join('')
    : '<div class="review-empty">Keine Aufgaben zur Prüfung</div>';
}

function renderTaskBoard() {
  taskTableBody.innerHTML = employees
    .map(
      (employee) => `
        <tr>
          <td class="employee-name-cell">
            <div class="employee-lead">
              <div class="avatar ${employee.variant}">${employee.initials}</div>
              <div>
                <strong>${employee.name}</strong>
                <small>${employee.role}</small>
              </div>
            </div>
          </td>
          <td>
            <div class="board-task-list">
              ${employee.tasks
                .map(
                  (task) => `
                    <span class="task-pill ${statusToClassName(task.status)}">${task.label}</span>
                  `
                )
                .join('')}
            </div>
          </td>
          <td>
            <div class="review-check-list">
              <span class="review-check ${employee.reviewStatus === 'review' ? 'warning' : 'ok'}">
                ${employee.reviewStatus === 'review' ? 'Review' : 'Freigegeben'}
              </span>
              <span class="review-mini">Manager-Standard</span>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

function renderDashboard() {
  updateSectionHeadings();
  updateEmployeeSelectOptions();
  renderSummary();
  renderEmployeeCards();
  if (isDorotheaView()) {
    renderReviewChecklist();
    renderTaskBoard();
  }
}

function hasSupabaseConfig() {
  return Boolean(
    window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY &&
    window.SUPABASE_URL !== 'https://your-project-ref.supabase.co' &&
    window.SUPABASE_ANON_KEY !== 'your-anon-key'
  );
}

async function loadEmployeesFromLocalApi() {
  const response = await fetch('/api/employees');

  if (!response.ok) {
    throw new Error('Local API failed');
  }

  const data = await response.json();

  employees = (data || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    role: employee.role,
    initials: employee.initials,
    variant: employee.variant,
    reviewStatus: employee.reviewStatus || employee.review_status,
    tasks: (employee.tasks || []).map((task) => ({
      id: task.id,
      label: task.label,
      status: task.status,
      description: task.description || ''
    }))
  }));

  renderDashboard();
}

async function loadEmployees() {
  if (!hasSupabaseConfig()) {
    return loadEmployeesFromLocalApi();
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('employees')
    .select(`
      id,
      name,
      role,
      initials,
      variant,
      review_status,
      tasks:tasks(id, label, status)
    `)
    .order('id');

  if (error) {
    throw error;
  }

  employees = (data || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    role: employee.role,
    initials: employee.initials,
    variant: employee.variant,
    reviewStatus: employee.review_status,
    tasks: (employee.tasks || []).map((task) => ({
      id: task.id,
      label: task.label,
      status: task.status
    }))
  }));

  renderDashboard();
}

setOverviewLabel();

async function saveTaskStatusLocal(employeeId, taskId, selectedStatus) {
  const response = await fetch(`/api/tasks/${taskId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ employeeId, status: selectedStatus })
  });

  if (!response.ok) {
    throw new Error('Local status update failed');
  }
}

async function saveTaskStatusSupabase(employeeId, taskId, selectedStatus) {
  const supabase = getSupabaseClient();

  const { error: taskError } = await supabase
    .from('tasks')
    .update({ status: selectedStatus })
    .eq('id', taskId)
    .eq('employee_id', employeeId);

  if (taskError) {
    throw taskError;
  }

  if (selectedStatus === 'review') {
    const { error: reviewError } = await supabase
      .from('employees')
      .update({ review_status: 'review' })
      .eq('id', employeeId);

    if (reviewError) {
      throw reviewError;
    }
  }
}

async function updateTaskStatusInDatabase(employeeId, taskId, selectedStatus) {
  if (!hasSupabaseConfig()) {
    return saveTaskStatusLocal(employeeId, taskId, selectedStatus);
  }

  return saveTaskStatusSupabase(employeeId, taskId, selectedStatus);
}

function openTaskModal() {
  if (taskModal) {
    taskModal.classList.add('open');
  }
}

function closeTaskModal() {
  if (taskModal) {
    taskModal.classList.remove('open');
  }

  if (taskForm) {
    taskForm.reset();
  }
}

async function createTaskInLocalApi(employeeId, title, description, status) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      employeeId,
      title,
      description,
      status
    })
  });

  if (!response.ok) {
    throw new Error('Local task creation failed');
  }

  return response.json();
}

async function createTaskInSupabase(employeeId, title, description, status) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      employee_id: employeeId,
      label: title,
      description,
      status
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createTaskInDatabase(employeeId, title, description, status) {
  if (!hasSupabaseConfig()) {
    return createTaskInLocalApi(employeeId, title, description, status);
  }

  return createTaskInSupabase(employeeId, title, description, status);
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

createTaskButton?.addEventListener('click', openTaskModal);
logoutButton?.addEventListener('click', async () => {
  try {
    await logout();
  } catch (error) {
    console.error(error);
    alert('Abmeldung konnte nicht durchgeführt werden.');
  }
});
closeTaskModalButton?.addEventListener('click', closeTaskModal);
cancelTaskModalButton?.addEventListener('click', closeTaskModal);
taskModal?.addEventListener('click', (event) => {
  if (event.target === taskModal) {
    closeTaskModal();
  }
});

taskForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(taskForm);
  const title = String(formData.get('taskTitle') || '').trim();
  const employeeName = String(formData.get('employeeName') || '').trim();
  const status = String(formData.get('taskStatus') || 'open');
  const description = String(formData.get('taskDescription') || '').trim();

  if (!title || !employeeName) {
    alert('Bitte gib einen Titel und einen Mitarbeiter ein.');
    return;
  }

  const employee = employees.find((person) => person.name === employeeName);
  if (!employee) {
    alert('Mitarbeiter wurde nicht gefunden.');
    return;
  }

  try {
    await createTaskInDatabase(employee.id, title, description, status);
    await loadEmployees();
  } catch (error) {
    console.error(error);
    alert('Aufgabe konnte nicht erstellt werden. Prüfe die Datenbankverbindung.');
    return;
  }

  closeTaskModal();
});

document.addEventListener('change', async (event) => {
  if (!event.target.classList.contains('task-status-select')) {
    return;
  }

  try {
    const employeeId = Number(event.target.dataset.employeeId);
    const taskId = Number(event.target.dataset.taskId);
    const selectedStatus = event.target.value;

    await updateTaskStatusInDatabase(employeeId, taskId, selectedStatus);
    await loadEmployees();
  } catch (error) {
    console.error(error);
    alert('Aufgabenstatus konnte nicht aktualisiert werden. Prüfe deine Konfiguration und Datenbankverbindung.');
  }
});

document.addEventListener('change', async (event) => {
  if (!event.target.classList.contains('task-reassign-select')) {
    return;
  }

  const newEmployeeId = event.target.value;
  if (!newEmployeeId) return;

  try {
    const taskId = Number(event.target.dataset.taskId);
    const response = await fetch(`/api/tasks/${taskId}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmployeeId: Number(newEmployeeId) })
    });

    if (!response.ok) {
      throw new Error('Reassign failed');
    }

    await loadEmployees();
    event.target.value = '';
  } catch (error) {
    console.error(error);
    alert('Aufgabe konnte nicht zugewiesen werden.');
    event.target.value = '';
  }
});

(async () => {
  try {
    await loadCurrentUser();
    await loadEmployees();
  } catch (error) {
    console.error(error);
    summaryStatsBlock.innerHTML = `
      <div class="metric-card">
        <strong>!</strong>
        <span>Lokale DB nicht verbunden</span>
      </div>
    `;
    employeeGrid.innerHTML = `
      <div class="employee-card">
        <p>Bitte prüfe PostgreSQL und starte den lokalen Server.</p>
      </div>
    `;
  }
})();
