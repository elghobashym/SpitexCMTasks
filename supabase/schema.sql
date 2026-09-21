-- 1) Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  initials TEXT,
  variant TEXT,
  review_status TEXT DEFAULT 'review'
);

-- 2) Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

-- 3) Seed employees
INSERT INTO employees (name, role, initials, variant, review_status)
VALUES
  ('Anita 1', 'Product Designer', 'A1', 'alt1', 'review'),
  ('Anita 2', 'Frontend Engineer', 'A2', 'alt2', 'review'),
  ('Anita 3', 'Operations Lead', 'A3', 'alt3', 'review'),
  ('Anita 4', 'Marketing', 'A4', 'alt4', 'review'),
  ('Anita 5', 'Customer Success', 'A5', 'alt5', 'review');

-- 4) Seed tasks
INSERT INTO tasks (employee_id, label, status)
SELECT e.id, task.label, task.status
FROM employees e
JOIN (
  VALUES
    ('Anita 1', 'Landing page refresh', 'done'),
    ('Anita 1', 'Homepage wireframe', 'in progress'),
    ('Anita 1', 'Mobile icon pack', 'review'),
    ('Anita 1', 'UX research summary', 'done'),
    ('Anita 1', 'Feedback board clean-up', 'open'),
    ('Anita 1', 'Color system pass', 'done'),
    ('Anita 1', 'Prototype onboarding flow', 'in progress'),
    ('Anita 1', 'A/B test variants', 'review'),
    ('Anita 1', 'Content hierarchy update', 'closed'),
    ('Anita 1', 'Launch asset approval', 'done'),

    ('Anita 2', 'Dashboard polish', 'done'),
    ('Anita 2', 'Bug fix QA', 'in progress'),
    ('Anita 2', 'Component library', 'review'),
    ('Anita 2', 'Accessibility check', 'open'),
    ('Anita 2', 'Performance audit', 'done'),
    ('Anita 2', 'Responsive layout pass', 'in progress'),
    ('Anita 2', 'Animation update', 'review'),
    ('Anita 2', 'State management cleanup', 'done'),
    ('Anita 2', 'Error handling pass', 'closed'),
    ('Anita 2', 'Release candidate check', 'done'),

    ('Anita 3', 'Sprint planning', 'done'),
    ('Anita 3', 'Vendor follow-ups', 'in progress'),
    ('Anita 3', 'Budget review', 'review'),
    ('Anita 3', 'Team capacity check', 'open'),
    ('Anita 3', 'Roadmap alignment', 'done'),
    ('Anita 3', 'Support escalation review', 'in progress'),
    ('Anita 3', 'Hiring shortlist', 'done'),
    ('Anita 3', 'Internal onboarding', 'review'),
    ('Anita 3', 'Ops dashboard refresh', 'closed'),
    ('Anita 3', 'Quarterly forecast', 'done'),

    ('Anita 4', 'Campaign assets', 'in progress'),
    ('Anita 4', 'Launch checklist', 'done'),
    ('Anita 4', 'Ad performance recap', 'review'),
    ('Anita 4', 'Audience segmentation', 'open'),
    ('Anita 4', 'Copy final pass', 'done'),
    ('Anita 4', 'Brand guideline update', 'in progress'),
    ('Anita 4', 'Social content plan', 'review'),
    ('Anita 4', 'CRM newsletter', 'done'),
    ('Anita 4', 'Landing page headline test', 'closed'),
    ('Anita 4', 'Launch campaign sync', 'done'),

    ('Anita 5', 'Client onboarding', 'done'),
    ('Anita 5', 'Retention notes', 'in progress'),
    ('Anita 5', 'Renewal follow-up', 'review'),
    ('Anita 5', 'Customer health scan', 'done'),
    ('Anita 5', 'Success webinar prep', 'open'),
    ('Anita 5', 'Feedback loop summary', 'done'),
    ('Anita 5', 'Escalation handoff', 'in progress'),
    ('Anita 5', 'Implementation checklist', 'review'),
    ('Anita 5', 'Training deck refresh', 'done'),
    ('Anita 5', 'Churn risk review', 'closed')
) AS task(name, label, status)
ON e.name = task.name;

-- 5) Row-level policies for demo project (allow public access)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees are viewable by everyone"
ON employees FOR SELECT
USING (true);

CREATE POLICY "Employees are editable by everyone"
ON employees FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Tasks are viewable by everyone"
ON tasks FOR SELECT
USING (true);

CREATE POLICY "Tasks are editable by everyone"
ON tasks FOR UPDATE
USING (true)
WITH CHECK (true);
