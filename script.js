const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'review', label: 'Review' },
  { value: 'closed', label: 'Closed' }
];

const statusMap = Object.fromEntries(
  statusOptions.map((status) => [status.value, status.label])
);

function statusToClassName(status) {
  return String(status).toLowerCase().replace(/\s+/g, '-');
}

let employees = [
  {
    name: 'Anita 1',
    role: 'Product Designer',
    status: 'On track',
    initials: 'A1',
    variant: 'alt1',
    reviewStatus: 'review',
    tasks: [
      { label: 'Landing page refresh', status: 'done' },
      { label: 'Homepage wireframe', status: 'in progress' },
      { label: 'Mobile icon pack', status: 'review' },
      { label: 'UX research summary', status: 'done' },
      { label: 'Feedback board clean-up', status: 'open' },
      { label: 'Color system pass', status: 'done' },
      { label: 'Prototype onboarding flow', status: 'in progress' },
      { label: 'A/B test variants', status: 'review' },
      { label: 'Content hierarchy update', status: 'closed' },
      { label: 'Launch asset approval', status: 'done' }
    ]
  },
  {
    name: 'Anita 2',
    role: 'Frontend Engineer',
    status: 'Review',
    initials: 'A2',
    variant: 'alt2',
    reviewStatus: 'review',
    tasks: [
      { label: 'Dashboard polish', status: 'done' },
      { label: 'Bug fix QA', status: 'in progress' },
      { label: 'Component library', status: 'review' },
      { label: 'Accessibility check', status: 'open' },
      { label: 'Performance audit', status: 'done' },
      { label: 'Responsive layout pass', status: 'in progress' },
      { label: 'Animation update', status: 'review' },
      { label: 'State management cleanup', status: 'done' },
      { label: 'Error handling pass', status: 'closed' },
      { label: 'Release candidate check', status: 'done' }
    ]
  },
  {
    name: 'Anita 3',
    role: 'Operations Lead',
    status: 'On track',
    initials: 'A3',
    variant: 'alt3',
    reviewStatus: 'review',
    tasks: [
      { label: 'Sprint planning', status: 'done' },
      { label: 'Vendor follow-ups', status: 'in progress' },
      { label: 'Budget review', status: 'review' },
      { label: 'Team capacity check', status: 'open' },
      { label: 'Roadmap alignment', status: 'done' },
      { label: 'Support escalation review', status: 'in progress' },
      { label: 'Hiring shortlist', status: 'done' },
      { label: 'Internal onboarding', status: 'review' },
      { label: 'Ops dashboard refresh', status: 'closed' },
      { label: 'Quarterly forecast', status: 'done' }
    ]
  },
  {
    name: 'Anita 4',
    role: 'Marketing',
    status: 'Review',
    initials: 'A4',
    variant: 'alt4',
    reviewStatus: 'review',
    tasks: [
      { label: 'Campaign assets', status: 'in progress' },
      { label: 'Launch checklist', status: 'done' },
      { label: 'Ad performance recap', status: 'review' },
      { label: 'Audience segmentation', status: 'open' },
      { label: 'Copy final pass', status: 'done' },
      { label: 'Brand guideline update', status: 'in progress' },
      { label: 'Social content plan', status: 'review' },
      { label: 'CRM newsletter', status: 'done' },
      { label: 'Landing page headline test', status: 'closed' },
      { label: 'Launch campaign sync', status: 'done' }
    ]
  },
  {
    name: 'Anita 5',
    role: 'Customer Success',
    status: 'On track',
    initials: 'A5',
    variant: 'alt5',
    reviewStatus: 'review',
    tasks: [
      { label: 'Client onboarding', status: 'done' },
      { label: 'Retention notes', status: 'in progress' },
      { label: 'Renewal follow-up', status: 'review' },
      { label: 'Customer health scan', status: 'done' },
      { label: 'Success webinar prep', status: 'open' },
      { label: 'Feedback loop summary', status: 'done' },
      { label: 'Escalation handoff', status: 'in progress' },
      { label: 'Implementation checklist', status: 'review' },
      { label: 'Training deck refresh', status: 'done' },
      { label: 'Churn risk review', status: 'closed' }
    ]
  }
];

const summaryStats = [
  { value: '92%', label: 'completion' },
  { value: '50', label: 'total tasks' },
  { value: '5', label: 'employees' }
];

const employeeGrid = document.getElementById('employeeGrid');
const taskTableBody = document.getElementById('taskTableBody');
const reviewChecklist = document.getElementById('reviewChecklist');
const summaryStatsBlock = document.getElementById('summaryStats');
const createTaskButton = document.getElementById('openCreateTaskModal');
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const closeTaskModalButton = document.getElementById('closeTaskModal');
const cancelTaskModalButton = document.getElementById('cancelTaskModal');

function renderSummary() {
  summaryStatsBlock.innerHTML = summaryStats
    .map(
      (metric) => `
        <div class="metric-card">
          <strong>${metric.value}</strong>
          <span>${metric.label}</span>
        </div>
      `
    )
    .join('');
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
            <span class="employee-chip ${employee.status === 'Review' ? 'pending' : ''}">${employee.status}</span>
          </div>

          <div class="employee-tasks">
            ${employee.tasks
              .map(
                (task) => `
                  <div class="task-bullet">
                    <span class="task-bullet-copy">
                      <span>${task.label}</span>
                      ${task.description ? `<small>${task.description}</small>` : ''}
                    </span>
                    <select class="task-status-select ${statusToClassName(task.status)}" data-employee="${employee.name}" data-task-index="${employee.tasks.indexOf(task)}" aria-label="Change status for ${task.label}">
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

  const pendingCount = reviewItems.length;
  const reviewPendingCount = document.getElementById('reviewPendingCount');

  if (reviewPendingCount) {
    reviewPendingCount.textContent = `${pendingCount} ausstehend`;
  }

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
                ${statusMap[employee.reviewStatus]}
              </span>
              <span class="review-mini">Manager default</span>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

function renderDashboard() {
  renderSummary();
  renderEmployeeCards();
  renderReviewChecklist();
  renderTaskBoard();
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

function addTaskToEmployee(employeeName, title, description, status) {
  const employee = employees.find((person) => person.name === employeeName);

  if (!employee) {
    return;
  }

  employee.tasks.push({
    label: title,
    description: description || '',
    status: status || 'open'
  });

  if (status === 'review') {
    employee.reviewStatus = 'review';
  }
}

document.addEventListener('change', (event) => {
  if (!event.target.classList.contains('task-status-select')) {
    return;
  }

  const employeeName = event.target.dataset.employee;
  const taskIndex = Number(event.target.dataset.taskIndex);
  const selectedStatus = event.target.value;

  const employee = employees.find((person) => person.name === employeeName);

  if (!employee || Number.isNaN(taskIndex)) {
    return;
  }

  employee.tasks[taskIndex].status = selectedStatus;

  if (selectedStatus === 'review') {
    employee.reviewStatus = 'review';
  }

  renderDashboard();
});

createTaskButton?.addEventListener('click', openTaskModal);
closeTaskModalButton?.addEventListener('click', closeTaskModal);
cancelTaskModalButton?.addEventListener('click', closeTaskModal);

taskModal?.addEventListener('click', (event) => {
  if (event.target === taskModal) {
    closeTaskModal();
  }
});

taskForm?.addEventListener('submit', (event) => {
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

  addTaskToEmployee(employeeName, title, description, status);
  renderDashboard();
  closeTaskModal();
});

renderDashboard();
