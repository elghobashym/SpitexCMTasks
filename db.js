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
  { name: 'Ewelina', role: 'Pfleger/in', initials: 'EW', variant: 'alt1', review_status: 'review' },
  { name: 'Selma', role: 'Pfleger/in', initials: 'SE', variant: 'alt2', review_status: 'review' },
  { name: 'Praktikantin', role: 'Praktikant/in', initials: 'PR', variant: 'alt3', review_status: 'review' },
  { name: 'Dorothea', role: 'Manager', initials: 'DO', variant: 'alt4', review_status: 'review' }
];

const taskSeed = {
  'Ewelina': ['Patient morning care', 'Medical documentation', 'Medication delivery', 'Wound care check', 'Patient communication', 'Equipment maintenance', 'Team handover notes', 'Care plan review', 'Follow-up calls', 'End of shift report'],
  'Selma': ['Patient evening care', 'Vitals monitoring', 'Appointment scheduling', 'Supply order', 'Staff coordination', 'Patient comfort check', 'Health assessment', 'Family communication', 'Quality assurance', 'Shift summary'],
  'Praktikantin': ['Assist with patient care', 'Clean and organize', 'Shadow experienced staff', 'Administrative support', 'Documentation training', 'Patient observation', 'Equipment cleaning', 'Database updates', 'General support', 'Knowledge gathering'],
  'Dorothea': ['Manage patient caseload', 'Staff scheduling', 'Quality oversight', 'Budget planning', 'Staff meetings coordination', 'Compliance review', 'Training organization', 'Client communication', 'Strategic planning', 'Performance review']
};

const initialStatuses = ['done', 'in progress', 'review', 'done', 'open', 'done', 'in progress', 'review', 'closed', 'done'];

async function initDb() {
  const client = await pool.connect();
  try {
    // Drop existing tables to reinitialize with new seed data
    await client.query('DROP TABLE IF EXISTS tasks CASCADE');
    await client.query('DROP TABLE IF EXISTS employees CASCADE');

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

async function deleteClosedTasks() {
  try {
    await pool.query('DELETE FROM tasks WHERE status = $1', ['closed']);
    console.log('Cleaned up closed tasks');
  } catch (error) {
    console.error('Failed to delete closed tasks:', error);
  }
}

async function createWeeklyTasks() {
  try {
    // Delete closed tasks first
    await deleteClosedTasks();

    // Get all employees
    const employeesResult = await pool.query('SELECT id, name FROM employees');
    const employees = employeesResult.rows;

    // Calculate next week's dates (Monday to Friday)
    const today = new Date();
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - today.getDay()));
    
    // Start from Monday of the next week
    const mondayDate = new Date(nextSunday);
    mondayDate.setDate(nextSunday.getDate() + 1);

    const weekDays = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(mondayDate);
      date.setDate(mondayDate.getDate() + i);
      weekDays.push(date);
    }

    // Create tasks for each employee for each weekday
    for (const employee of employees) {
      for (const date of weekDays) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const taskLabel = `${day}.${month} - ${employee.name}`;

        await pool.query(
          `INSERT INTO tasks (employee_id, label, status) VALUES ($1, $2, $3)`,
          [employee.id, taskLabel, 'open']
        );
      }
    }

    console.log(`Weekly tasks created for ${employees.length} employees`);
  } catch (error) {
    console.error('Failed to create weekly tasks:', error);
  }
}

// Initialize weekly task scheduler
function initWeeklyTaskScheduler() {
  const schedule = require('node-schedule');
  
  // Schedule for every Sunday at 22:00 (10 PM)
  const job = schedule.scheduleJob('0 22 * * 0', async () => {
    console.log('Running weekly task creation...');
    await createWeeklyTasks();
  });

  console.log('Weekly task scheduler initialized (runs every Sunday at 10 PM)');
  return job;
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
  buildDefaultEmployeePassword,
  createWeeklyTasks,
  deleteClosedTasks,
  initWeeklyTaskScheduler
};
