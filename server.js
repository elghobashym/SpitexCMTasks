const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDb, getEmployeesWithTasks, updateTaskStatus, createTask, getEmployeeByLoginName, initWeeklyTaskScheduler, createWeeklyTasks, createImmediateWeeklyTasks, deleteAllTasks } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'spitex-cura-mobile-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// Serve static files but exclude index.html (it requires auth)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false
}));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  return next();
}

function isDorothea(user) {
  return Boolean(user && user.name === 'Dorothea');
}

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const employee = await getEmployeeByLoginName(username, password);

    if (!employee) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.user = {
      id: employee.id,
      name: employee.name,
      initials: employee.initials,
      role: employee.role,
      variant: employee.variant
    };

    return res.json({ ok: true, user: req.session.user });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/employees', requireAuth, async (req, res) => {
  try {
    const employees = await getEmployeesWithTasks();
    if (isDorothea(req.session.user)) {
      return res.json(employees);
    }

    const ownEmployee = employees.filter((employee) => employee.id === req.session.user.id);
    return res.json(ownEmployee);
  } catch (error) {
    console.error('Failed to load employees:', error);
    res.status(500).json({ error: 'Failed to load employees' });
  }
});

app.put('/api/tasks/:id/status', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { employeeId, status } = req.body;

    if (!employeeId || !status) {
      return res.status(400).json({ error: 'employeeId and status are required' });
    }

    if (!isDorothea(req.session.user) && Number(employeeId) !== req.session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await updateTaskStatus(Number(employeeId), taskId, status);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { employeeId, title, description, status } = req.body;
    const targetEmployeeId = Number(employeeId);

    if (!isDorothea(req.session.user) && targetEmployeeId !== Number(req.session.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!employeeId || !title) {
      return res.status(400).json({ error: 'employeeId and title are required' });
    }

    const createdTask = await createTask({
      employeeId: targetEmployeeId,
      label: title,
      description: description || '',
      status: status || 'open'
    });

    res.status(201).json(createdTask);
  } catch (error) {
    console.error('Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.post('/api/generate-weekly-tasks', requireAuth, async (req, res) => {
  try {
    if (!isDorothea(req.session.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await createImmediateWeeklyTasks();
    res.json({ ok: true, message: 'Weekly tasks generated successfully for this week' });
  } catch (error) {
    console.error('Failed to generate weekly tasks:', error);
    res.status(500).json({ error: 'Failed to generate weekly tasks' });
  }
});

app.post('/api/tasks/reset-and-generate', requireAuth, async (req, res) => {
  try {
    if (!isDorothea(req.session.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await deleteAllTasks();
    await createImmediateWeeklyTasks();
    res.json({ ok: true, message: 'All tasks deleted and weekly tasks regenerated' });
  } catch (error) {
    console.error('Failed to reset and generate tasks:', error);
    res.status(500).json({ error: 'Failed to reset and generate tasks' });
  }
});

// Catch-all for SPA routing (protected by auth)
app.get('*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async () => {
  try {
    await initDb();
    initWeeklyTaskScheduler();
    app.listen(PORT, HOST, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`LAN access: http://${HOST === '0.0.0.0' ? 'YOUR_LOCAL_IP' : HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Database startup failed:', error);
    process.exit(1);
  }
})();
