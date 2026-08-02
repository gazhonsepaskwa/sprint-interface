import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// PostgreSQL configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'sprint_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Initialize Database Tables
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sprints (
        id SERIAL PRIMARY KEY,
        name TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add name column if it doesn't exist (for existing databases)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sprints' AND column_name='name') THEN
          ALTER TABLE sprints ADD COLUMN name TEXT;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        login TEXT UNIQUE NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_objectives (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        sprint_id INTEGER REFERENCES sprints(id),
        date DATE NOT NULL,
        objective TEXT,
        is_done BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, sprint_id, date)
      );

      -- Add unique constraint if it doesn't exist (for existing databases)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_objectives_student_id_sprint_id_date_key') THEN
          ALTER TABLE daily_objectives ADD CONSTRAINT daily_objectives_student_id_sprint_id_date_key UNIQUE (student_id, sprint_id, date);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS sprint_students (
        sprint_id INTEGER REFERENCES sprints(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        PRIMARY KEY (sprint_id, student_id)
      );

      -- Add project_id column if it doesn't exist
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sprint_students' AND column_name='project_id') THEN
          ALTER TABLE sprint_students ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDb();

app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      message: 'Backend is running',
      database: 'Connected',
      time: dbResult.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 'Error',
      message: 'Backend is running, but database connection failed',
      error: (err as Error).message
    });
  }
});

// Sprint Routes
app.post('/api/sprints', async (req, res) => {
  const { name, startDate, endDate } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO sprints (name, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
      [name, startDate, endDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/sprints', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sprints ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/sprints/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete associated sprint_students and daily_objectives first if not using CASCADE
    // But we defined sprint_students with ON DELETE CASCADE in my previous update.
    // Let's ensure daily_objectives is also handled or has CASCADE.
    await pool.query('DELETE FROM daily_objectives WHERE sprint_id = $1', [id]);
    await pool.query('DELETE FROM sprints WHERE id = $1', [id]);
    res.json({ message: 'Sprint deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Student Routes
app.post('/api/students', async (req, res) => {
  const { name, login, imageUrl } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO students (name, login, image_url) VALUES ($1, $2, $3) RETURNING *',
      [name, login, imageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Project Routes
app.post('/api/projects', async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Enrollment Routes
app.post('/api/sprints/:sprintId/students', async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  const { studentId, projectId } = req.body;
  console.log(`[ENROLL] Sprint: ${sprintId}, Student: ${studentId}, Project: ${projectId}`);

  if (!sprintId || !studentId || !projectId) {
    return res.status(400).json({ error: 'Missing sprintId, studentId, or projectId' });
  }

  try {
    await pool.query(
      'INSERT INTO sprint_students (sprint_id, student_id, project_id) VALUES ($1, $2, $3) ON CONFLICT (sprint_id, student_id) DO UPDATE SET project_id = EXCLUDED.project_id',
      [sprintId, studentId, projectId]
    );
    console.log('[ENROLL] Success');
    res.status(201).json({ message: 'Student enrolled/updated' });
  } catch (err) {
    console.error('[ENROLL] Error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/sprints/:sprintId/students', async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  try {
    const result = await pool.query(`
      SELECT s.*, p.name as project_name, p.id as project_id
      FROM students s
      JOIN sprint_students ss ON s.id = ss.student_id
      LEFT JOIN projects p ON ss.project_id = p.id
      WHERE ss.sprint_id = $1
      ORDER BY s.name ASC
    `, [sprintId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/sprints/:sprintId/students/:studentId', async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  const studentId = parseInt(req.params.studentId);
  try {
    await pool.query(
      'DELETE FROM sprint_students WHERE sprint_id = $1 AND student_id = $2',
      [sprintId, studentId]
    );
    await pool.query(
      'DELETE FROM daily_objectives WHERE sprint_id = $1 AND student_id = $2',
      [sprintId, studentId]
    );
    res.json({ message: 'Student removed from sprint' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Daily Objective Routes
app.get('/api/sprints/:sprintId/daily', async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  const { date } = req.query;
  try {
    const result = await pool.query(`
      SELECT
        s.id as student_id,
        s.name,
        s.login,
        s.image_url,
        ss.project_id,
        p.name as project_name,
        obj.id as objective_id,
        obj.objective,
        obj.is_done
      FROM students s
      JOIN sprint_students ss ON s.id = ss.student_id
      LEFT JOIN projects p ON ss.project_id = p.id
      LEFT JOIN daily_objectives obj ON s.id = obj.student_id AND obj.sprint_id = ss.sprint_id AND obj.date = $2
      WHERE ss.sprint_id = $1
      ORDER BY s.name ASC
    `, [sprintId, date]);
    res.json(result.rows);
  } catch (err) {
    console.error('[DAILY] Error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/objectives', async (req, res) => {
  const { studentId, sprintId, date, objective, isDone } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO daily_objectives (student_id, sprint_id, date, objective, is_done)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (student_id, sprint_id, date)
      DO UPDATE SET objective = EXCLUDED.objective, is_done = EXCLUDED.is_done
      RETURNING *
    `, [studentId, sprintId, date, objective, isDone]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
