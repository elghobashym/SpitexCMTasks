const { Pool } = require('pg');
const crypto = require('crypto');

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dorotheawork';

const isRemoteDatabase = Boolean(
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1')
);

const pool = new Pool({
  connectionString,
  ssl: isRemoteDatabase || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

const statusOptions = ['open', 'in progress', 'done', 'review', 'closed'];

const employeeSeed = [
  { name: 'Anita 1', role: 'Product Designer', initials: 'A1', variant: 'alt1', review_status: 'review' },
  { name: 'Anita 2', role: 'Frontend Engineer', initials: 'A2', variant: 'alt2', review_status: 'review' },
  { name: 'Anita 3', role: 'Operations Lead', initials: 'A3', variant: 'alt3', review_status: 'review' },
  { name: 'Anita 4', role: 'Marketing', initials: 'A4', variant: 'alt4', review_status: 'review' },
  { name: 'Anita 5', role: 'Customer Success', initials: 'A5', variant: 'alt5', review_status: 'review' }
];

const taskSeed = {
  'Anita 1': ['Landing page refresh', 'Homepage wireframe', 'Mobile icon pack', 'UX research summary', 'Feedback board clean-up', 'Color system pass', 'Prototype onboarding flow', 'A/B test variants', 'Content hierarchy update', 'Launch asset approval'],
  'Anita 2': ['Dashboard polish', 'Bug fix QA', 'Component library', 'Accessibility check', 'Performance audit', 'Responsive layout pass', 'Animation update', 'State management cleanup', 'Error handling pass', 'Release candidate check'],
  'Anita 3': ['Sprint planning', 'Vendor follow-ups', 'Budget review', 'Team capacity check', 'Roadmap alignment', 'Support escalation review', 'Hiring shortlist', 'Internal onboarding', 'Ops dashboard refresh', 'Quarterly forecast'],
  'Anita 4': ['Campaign assets', 'Launch checklist', 'Ad performance recap', 'Audience segmentation', 'Copy final pass', 'Brand guideline update', 'Social content plan', 'CRM newsletter', 'Landing page headline test', 'Launch campaign sync'],
  'Anita 5': ['Client onboarding', 'Retention notes', 'Renewal follow-up', 'Customer health scan', 'Success webinar prep', 'Feedback loop summary', 'Escalation handoff', 'Implementation checklist', 'Training deck refresh', 'Churn risk review']
};

const initialStatuses = ['done', 'in progress', 'review', 'done', 'open', 'done', 'in progress', 'review', 'closed', 'done'];

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT,
        initials TEXT,
        variant TEXT,
        review_status TEXT DEFAULT 'review',
        password_hash TEXT DEFAULT ''
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open'
      )
    `);

    const employeeCount = await client.query('SELECT COUNT(*) AS count FROM employees');
    if (Number(employeeCount.rows[0].count) === 0) {
      for (const employee of employeeSeed) {
        const employeeInsert = await client.query(
          `INSERT INTO employees (name, role, initials, variant, review_status, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [employee.name, employee.role, employee.initials, employee.variant, employee.review_status, hashPassword(buildDefaultEmployeePassword(employee.name))]
        );
        const employeeId = employeeInsert.rows[0].id;
        const taskNames = taskSeed[employee.name] || [];
        for (let index = 0; index < taskNames.length; index += 1) {
          const taskStatus = initialStatuses[index] || 'open';
          await client.query(
            `INSERT INTO tasks (employee_id, label, status) VALUES ($1, $2, $3)`,
            [employeeId, taskNames[index], taskStatus]
          );
        }
      }
    } else {
      const employeesWithoutPassword = await client.query(`SELECT id, name FROM employees WHERE password_hash IS NULL OR password_hash = ''`);
      for (const employee of employeesWithoutPassword.rows) {
        await client.query(`UPDATE employees SET password_hash = $1 WHERE id = $2`, [hashPassword(buildDefaultEmployeePassword(employee.name)), employee.id]);
      }
    }
  } finally {
    client.release();
  }
}

async function getEmployeesWithTasks() {
  const result = await pool.query(`
    SELECT e.id, e.name, e.role, e.initials, e.variant, e.review_status,
           t.id AS task_id, t.label AS task_label, t.description AS task_description, t.status AS task_status
    FROM employees e
    LEFT JOIN tasks t ON t.employee_id = e.id
    ORDER BY e.id, t.id
  `);
  const employeesMap = new Map();
  for (const row of result.rows) {
    if (!employeesMap.has(row.id)) {
      employeesMap.set(row.id, {
        id: row.id,
        name: row.name,
        role: row.role,
        initials: row.initials,
        variant: row.variant,
        reviewStatus: row.review_status,
        tasks: []
      });
    }
    if (row.task_id) {
      employeesMap.get(row.id).tasks.push({
        id: row.task_id,
        label: row.task_label,
        description: row.task_description || '',
        status: row.task_status
      });
    }
  }
  return Array.from(employeesMap.values());
}

async function updateTaskStatus(employeeId, taskId, newStatus) {
  if (!statusOptions.includes(newStatus)) throw new Error('Invalid status');
  const result = await pool.query(`UPDATE tasks SET status = $1 WHERE id = $2 AND employee_id = $3`, [newStatus, taskId, employeeId]);
  if (result.rowCount === 0) throw new Error('Task not found');
  if (newStatus === 'review') {
    await pool.query(`UPDATE employees SET review_status = $1 WHERE id = $2`, ['review', employeeId]);
  }
}

async function createTask({ employeeId, label, description = '', status = 'open' }) {
  if (!employeeId || !label) throw new Error('employeeId and label are required');
  if (!statusOptions.includes(status)) throw new Error('Invalid status');
  const result = await pool.query(
    `INSERT INTO tasks (employee_id, label, description, status) VALUES ($1, $2, $3, $4) RETURNING *`,
    [employeeId, label, description, status]
  );
  return result.rows[0];
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password).trim()).digest('hex');
}

function normalizeEmployeeName(name) {
  return String(name || '').trim().toLowerCase();
}

function buildDefaultEmployeePassword(name) {
  return normalizeEmployeeName(name).replace(/\s+/g, '');
}

async function getEmployeeByLoginName(loginName, password) {
  const normalizedLogin = normalizeEmployeeName(loginName);
  if (!normalizedLogin || !password) return null;
  const result = await pool.query(
    `SELECT * FROM employees WHERE LOWER(name) = $1 LIMIT 1`,
    [normalizedLogin]
  );
  if (result.rows.length === 0) return null;
  const employee = result.rows[0];
  const expectedHash = hashPassword(buildDefaultEmployeePassword(employee.name));
  if (hashPassword(password) !== expectedHash) return null;
  return employee;
}

module.exports = {
  initDb,
  getEmployeesWithTasks,
  updateTaskStatus,
  createTask,
  getEmployeeByLoginName,
  pool,
  statusOptions,
  hashPassword,
  normalizeEmployeeName,
  buildDefaultEmployeePassword
};

module.exports = {
  initDb,
  getEmployeesWithTasks,
  updateTaskStatus,
  createTask,
  getEmployeeByLoginName,
  pool,
  statusOptions,
  hashPassword,
  normalizeEmployeeName,
  buildDefaultEmployeePassword
};
