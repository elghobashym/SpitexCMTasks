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

const statusOptions = ['open', 'in progress', 'review', 'closed'];

const employeeSeed = [
  { name: 'Ewelina', role: 'Pfleger/in', initials: 'EW', variant: 'alt1', review_status: 'review' },
  { name: 'Selma', role: 'Pfleger/in', initials: 'SE', variant: 'alt2', review_status: 'review' },
  { name: 'Dorothea', role: 'Manager', initials: 'DO', variant: 'alt4', review_status: 'review' }
];

const taskSeed = {
  'Ewelina': ['Patient morning care', 'Medical documentation', 'Medication delivery', 'Wound care check', 'Patient communication', 'Equipment maintenance', 'Team handover notes', 'Care plan review', 'Follow-up calls', 'End of shift report'],
  'Selma': ['Patient evening care', 'Vitals monitoring', 'Appointment scheduling', 'Supply order', 'Staff coordination', 'Patient comfort check', 'Health assessment', 'Family communication', 'Quality assurance', 'Shift summary'],
  'Dorothea': ['Manage patient caseload', 'Staff scheduling', 'Quality oversight', 'Budget planning', 'Staff meetings coordination', 'Compliance review', 'Training organization', 'Client communication', 'Strategic planning', 'Performance review']
};

const initialStatuses = ['open', 'in progress', 'review', 'open', 'open', 'in progress', 'review', 'open', 'open', 'open'];

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
    }

    await client.query(
      `UPDATE employees SET role = 'Admin' WHERE name = ANY($1::text[])`,
      [['Ewelina', 'Selma']]
    );

    // Remove deprecated account and cascade-delete its task list.
    await client.query(`DELETE FROM employees WHERE name = 'Praktikantin'`);

    await client.query(`DELETE FROM tasks WHERE status = 'closed'`);

    await client.query(
      `UPDATE tasks
       SET label = REPLACE(REPLACE(label, 'B�ro', 'Büro'), 'BÃ¼ro', 'Büro')
       WHERE label LIKE '%B�ro%' OR label LIKE '%BÃ¼ro%'`
    );

    // Cleanup for updated weekly generation rules:
    // 1) Dorothea should not have auto-generated weekly tasks.
    await client.query(
      `DELETE FROM tasks t
       USING employees e
       WHERE t.employee_id = e.id
         AND e.name = 'Dorothea'
         AND split_part(t.label, ' - ', 2) = ANY($1::text[])`,
      [weeklyTaskTitles]
    );

    // 2) Ewelina should never receive these auto-generated tasks.
    await client.query(
      `DELETE FROM tasks t
       USING employees e
       WHERE t.employee_id = e.id
         AND e.name = 'Ewelina'
         AND split_part(t.label, ' - ', 2) = ANY($1::text[])`,
      [[
        'Pflegeberichte WE kontr. - Rückmeldung Dora',
        'Pflegeberichte kontr. - Rückmeldung Dora',
        'Apothekenbestellung'
      ]]
    );

    // 3) Ewelina: "Dienstplan Kontrolle vor dem WE" only on Friday.
    await client.query(
      `DELETE FROM tasks t
       USING employees e
       WHERE t.employee_id = e.id
         AND e.name = 'Ewelina'
         AND split_part(t.label, ' - ', 2) = 'Dienstplan Kontrolle vor dem WE'
         AND split_part(t.label, ' - ', 1) ~ '^[0-9]{2}\.[0-9]{2}$'
         AND EXTRACT(DOW FROM to_date(split_part(t.label, ' - ', 1) || '.' || EXTRACT(YEAR FROM CURRENT_DATE)::text, 'DD.MM.YYYY')) <> 5`
    );

    // 4) Ewelina: "Dienstplan Kontrolle" on working days except Friday.
    await client.query(
      `DELETE FROM tasks t
       USING employees e
       WHERE t.employee_id = e.id
         AND e.name = 'Ewelina'
         AND split_part(t.label, ' - ', 2) = 'Dienstplan Kontrolle'
         AND split_part(t.label, ' - ', 1) ~ '^[0-9]{2}\.[0-9]{2}$'
         AND EXTRACT(DOW FROM to_date(split_part(t.label, ' - ', 1) || '.' || EXTRACT(YEAR FROM CURRENT_DATE)::text, 'DD.MM.YYYY')) = 5`
    );

    const dorotheaResult = await client.query(`SELECT id FROM employees WHERE name = $1 LIMIT 1`, ['Dorothea']);
    if (dorotheaResult.rows.length > 0) {
      const dorotheaId = dorotheaResult.rows[0].id;
      await client.query(
        `UPDATE tasks SET employee_id = $1 WHERE status = 'review' AND employee_id <> $1`,
        [dorotheaId]
      );
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
    WHERE t.id IS NULL OR t.status <> 'closed'
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
  if (newStatus === 'closed') {
    const deleteResult = await pool.query(`DELETE FROM tasks WHERE id = $1 AND employee_id = $2`, [taskId, employeeId]);
    if (deleteResult.rowCount === 0) throw new Error('Task not found');
    return;
  }
  if (newStatus === 'review') {
    const dorotheaResult = await pool.query(`SELECT id FROM employees WHERE name = $1 LIMIT 1`, ['Dorothea']);
    if (dorotheaResult.rows.length === 0) throw new Error('Dorothea not found');
    const dorotheaId = dorotheaResult.rows[0].id;
    const result = await pool.query(
      `UPDATE tasks SET status = $1, employee_id = $4 WHERE id = $2 AND employee_id = $3`,
      [newStatus, taskId, employeeId, dorotheaId]
    );
    if (result.rowCount === 0) throw new Error('Task not found');
    await pool.query(`UPDATE employees SET review_status = $1 WHERE id = $2`, ['review', dorotheaId]);
    return;
  }
  const result = await pool.query(`UPDATE tasks SET status = $1 WHERE id = $2 AND employee_id = $3`, [newStatus, taskId, employeeId]);
  if (result.rowCount === 0) throw new Error('Task not found');
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

const weeklyTaskTitles = [
  'Pflegeberichte WE kontr. - Rückmeldung Dora',
  'Pflegeberichte kontr. - Rückmeldung Dora',
  'Kunden Termine eintragen',
  'Apothekenbestellung',
  'Dienstplan Kontrolle vor dem WE',
  'Dienstplan Kontrolle'
];

function getWeeklyTaskTitlesForEmployeeDate(employeeName, date) {
  const dayOfWeek = date.getDay();

  // Dorothea should not receive auto-generated weekly tasks.
  if (employeeName === 'Dorothea') {
    return [];
  }

  // Ewelina has custom weekday rules.
  if (employeeName === 'Ewelina') {
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      return ['Kunden Termine eintragen', 'Dienstplan Kontrolle'];
    }
    if (dayOfWeek === 5) {
      return ['Kunden Termine eintragen', 'Dienstplan Kontrolle vor dem WE'];
    }
    return [];
  }

  return weeklyTaskTitles;
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

    // Create tasks for each employee, each weekday, and each task title
    for (const employee of employees) {
      for (const date of weekDays) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        const taskTitlesForDay = getWeeklyTaskTitlesForEmployeeDate(employee.name, date);
        for (const taskTitle of taskTitlesForDay) {
          const taskLabel = `${day}.${month} - ${taskTitle}`;

          await pool.query(
            `INSERT INTO tasks (employee_id, label, status) VALUES ($1, $2, $3)`,
            [employee.id, taskLabel, 'open']
          );
        }
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

async function createImmediateWeeklyTasks() {
  try {
    // Delete closed tasks first
    await deleteClosedTasks();

    // Get all employees
    const employeesResult = await pool.query('SELECT id, name FROM employees');
    const employees = employeesResult.rows;

    // Calculate current week's dates (Monday to Friday starting from today or next Monday)
    const today = new Date();
    let startDate = new Date(today);
    
    // If today is not Monday (0=Sunday, 1=Monday...), move to Monday
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
      // Sunday - start from tomorrow (Monday)
      startDate.setDate(today.getDate() + 1);
    } else if (dayOfWeek !== 1) {
      // Not Monday/Sunday - move back to Monday of this week
      startDate.setDate(today.getDate() - (dayOfWeek - 1));
    }

    const weekDays = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDays.push(date);
    }

    // Create tasks for each employee, each weekday, and each task title
    for (const employee of employees) {
      for (const date of weekDays) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        const taskTitlesForDay = getWeeklyTaskTitlesForEmployeeDate(employee.name, date);
        for (const taskTitle of taskTitlesForDay) {
          const taskLabel = `${day}.${month} - ${taskTitle}`;

          await pool.query(
            `INSERT INTO tasks (employee_id, label, status) VALUES ($1, $2, $3)`,
            [employee.id, taskLabel, 'open']
          );
        }
      }
    }

    console.log(`Immediate weekly tasks created for ${employees.length} employees`);
  } catch (error) {
    console.error('Failed to create immediate weekly tasks:', error);
  }
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
  initWeeklyTaskScheduler,
  createImmediateWeeklyTasks
};
