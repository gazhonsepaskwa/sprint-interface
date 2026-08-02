import express from 'express';
import session from 'express-session';
import { Pool } from 'pg';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'sprint-secret-key',
  resave: false,
  saveUninitialized: false,
  name: 'sprint-session', // Removed __Host- prefix for local HTTP development
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000 // 12 hours
  }
}));

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
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Migration: Ensure projects.name is UNIQUE
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'projects_name_key'
        ) THEN
          ALTER TABLE projects ADD CONSTRAINT projects_name_key UNIQUE (name);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS completion_levels (
        id SERIAL PRIMARY KEY,
        text VARCHAR(20) NOT NULL,
        color VARCHAR(7) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_objectives (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        sprint_id INTEGER REFERENCES sprints(id),
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        completion_level_id INTEGER REFERENCES completion_levels(id) ON DELETE SET NULL,
        date DATE NOT NULL,
        objective TEXT,
        is_done BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, sprint_id, date)
      );

      -- Migration: Add completion_level_id to daily_objectives
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_objectives' AND column_name='completion_level_id') THEN
          ALTER TABLE daily_objectives ADD COLUMN completion_level_id INTEGER REFERENCES completion_levels(id) ON DELETE SET NULL;
        END IF;
      END $$;

      -- Migration: Add project_id to daily_objectives if missing
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_objectives' AND column_name='project_id') THEN
          ALTER TABLE daily_objectives ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
      END $$;

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

      -- Migration: Add is_goal_met to sprint_students
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sprint_students' AND column_name='sprint_goal') THEN
          ALTER TABLE sprint_students ADD COLUMN sprint_goal TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sprint_students' AND column_name='is_goal_met') THEN
          ALTER TABLE sprint_students ADD COLUMN is_goal_met BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS whitelist (
        id SERIAL PRIMARY KEY,
        login TEXT UNIQUE NOT NULL,
        is_superuser BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Migration: Add is_superuser column if it doesn't exist
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whitelist' AND column_name='is_superuser') THEN
          ALTER TABLE whitelist ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Bootstrap Superuser from ENV
    const BOOTSTRAP_USER = (process.env.SUPERUSER_LOGIN || 'nalebrun').trim().toLowerCase();

    // Check if any superuser already exists
    const superuserCheck = await pool.query('SELECT login FROM whitelist WHERE is_superuser = TRUE');

    if (superuserCheck.rows.length === 0) {
      console.log(`[INIT] No superuser found. Bootstrapping ${BOOTSTRAP_USER} as initial Superuser.`);
      await pool.query(`
        INSERT INTO whitelist (login, is_superuser)
        VALUES ($1, TRUE)
        ON CONFLICT (login) DO UPDATE SET is_superuser = TRUE
      `, [BOOTSTRAP_USER]);
    }

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

// Auth Routes
app.get('/api/auth/42', (req, res) => {
  const UID = process.env.FORTYTWO_APP_ID;
  const REDIRECT_URI = process.env.FORTYTWO_APP_REDIRECT_URI;

  if (!UID || !REDIRECT_URI) {
    return res.status(500).json({ error: '42 API credentials missing in .env' });
  }

  const url = `https://api.intra.42.fr/oauth/authorize?client_id=${UID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
  res.redirect(url);
});

app.get('/api/auth/42/callback', async (req, res) => {
  const { code } = req.query;
  const UID = process.env.FORTYTWO_APP_ID;
  const SECRET = process.env.FORTYTWO_APP_SECRET;
  const REDIRECT_URI = process.env.FORTYTWO_APP_REDIRECT_URI;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!code) return res.redirect(`${FRONTEND_URL}/login?error=no_code`);

  try {
    // Exchange code for token
    const tokenRes = await axios.post('https://api.intra.42.fr/oauth/token', {
      grant_type: 'authorization_code',
      client_id: UID,
      client_secret: SECRET,
      code: code,
      redirect_uri: REDIRECT_URI
    });

    const accessToken = tokenRes.data.access_token;

    // Get user info
    const userRes = await axios.get('https://api.intra.42.fr/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const userData = userRes.data;
    const login = userData.login.toLowerCase();
    console.log(`[AUTH] 42 API returned login: "${login}"`);

    // Check Whitelist and Superuser status in DB
    const whitelistRes = await pool.query('SELECT is_superuser FROM whitelist WHERE login = $1', [login]);

    if (whitelistRes.rows.length === 0) {
      console.log(`[AUTH] Access REJECTED for ${login} (not in whitelist)`);
      return res.redirect(`${FRONTEND_URL}/login?error=not_whitelisted`);
    }

    const isSuperuser = whitelistRes.rows[0].is_superuser;
    console.log(`[AUTH] Access GRANTED for ${login} (Superuser: ${isSuperuser})`);

    // Store user in session
    (req.session as any).user = {
      id: userData.id,
      login: login,
      name: userData.displayname,
      image_url: userData.image?.versions?.medium || userData.image?.link,
      is_staff: userData['staff?']
    };

    // Explicitly save the session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('[SESSION] Error saving session:', err);
        return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
      }
      res.redirect(FRONTEND_URL);
    });
  } catch (err) {
    console.error('Auth Error:', (err as any).response?.data || (err as Error).message);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

// Middleware to protect API routes and enforce whitelist
const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const login = req.session.user.login;

  try {
    const whitelistRes = await pool.query('SELECT is_superuser FROM whitelist WHERE login = $1', [login]);

    if (whitelistRes.rows.length === 0) {
      console.log(`[AUTH] Access REVOKED for ${login} (not in whitelist)`);
      return req.session.destroy(() => {
        res.status(401).json({ error: 'Access revoked' });
      });
    }

    const isSuperuser = whitelistRes.rows[0].is_superuser;

    // Attach fresh permissions
    req.user = {
      ...req.session.user,
      is_superuser: isSuperuser
    };

    next();
  } catch (err) {
    console.error('[AUTH] DB Error during verification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

app.get('/api/auth/me', requireAuth, (req: any, res) => {
  res.json(req.user);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// Whitelist Routes
app.get('/api/whitelist', requireAuth, async (req: any, res) => {
  if (!req.user?.is_superuser) return res.status(403).json({ error: 'Superuser access required' });

  try {
    const result = await pool.query('SELECT id, login, is_superuser, created_at FROM whitelist ORDER BY login ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/whitelist', requireAuth, async (req: any, res) => {
  if (!req.user?.is_superuser) return res.status(403).json({ error: 'Superuser access required' });

  const { login } = req.body;
  if (!login || typeof login !== 'string') return res.status(400).json({ error: 'Invalid login' });

  try {
    const result = await pool.query(
      'INSERT INTO whitelist (login) VALUES ($1) ON CONFLICT (login) DO NOTHING RETURNING id, login, is_superuser, created_at',
      [login.trim().toLowerCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/whitelist/transfer-superuser', requireAuth, async (req: any, res) => {
  if (!req.user?.is_superuser) return res.status(403).json({ error: 'Only the current Superuser can transfer their role' });

  const { targetLogin } = req.body;
  const currentLogin = req.user.login;

  if (!targetLogin) return res.status(400).json({ error: 'Target login required' });
  if (targetLogin.toLowerCase() === currentLogin.toLowerCase()) return res.status(400).json({ error: 'You are already the Superuser' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure target user is whitelisted
    const targetCheck = await client.query('SELECT login FROM whitelist WHERE login = $1', [targetLogin.toLowerCase()]);
    if (targetCheck.rows.length === 0) {
      throw new Error('Target user must be whitelisted first');
    }

    // 2. Remove superuser status from current user
    await client.query('UPDATE whitelist SET is_superuser = FALSE WHERE login = $1', [currentLogin]);

    // 3. Give superuser status to target user
    await client.query('UPDATE whitelist SET is_superuser = TRUE WHERE login = $1', [targetLogin.toLowerCase()]);

    await client.query('COMMIT');
    res.json({ message: `Superuser role transferred to ${targetLogin}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

app.delete('/api/whitelist/:id', requireAuth, async (req: any, res) => {
  if (!req.user?.is_superuser) return res.status(403).json({ error: 'Superuser access required' });

  const { id } = req.params;

  try {
    // Check if the user is a superuser
    const userCheck = await pool.query('SELECT login, is_superuser FROM whitelist WHERE id = $1', [id]);
    if (userCheck.rows.length > 0 && userCheck.rows[0].is_superuser) {
      return res.status(400).json({ error: 'The Superuser cannot be removed from the whitelist. Transfer the role first.' });
    }

    await pool.query('DELETE FROM whitelist WHERE id = $1', [id]);
    res.json({ message: 'Removed from whitelist' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Sprint Routes
app.post('/api/sprints', requireAuth, async (req, res) => {
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

app.get('/api/sprints', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sprints ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/sprints/:id', requireAuth, async (req, res) => {
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
// Student Routes
app.post('/api/students/sync-42', requireAuth, async (req, res) => {
  const UID = process.env.FORTYTWO_APP_ID;
  const SECRET = process.env.FORTYTWO_APP_SECRET;
  const CAMPUS_ID = process.env.FORTYTWO_CAMPUS_ID || '52'; // Default to 42 Brussels

  if (!UID || !SECRET) {
    return res.status(500).json({ error: '42 API credentials missing in .env' });
  }

  try {
    // 1. Get OAuth Token
    const authRes = await axios.post('https://api.intra.42.fr/oauth/token', {
      grant_type: 'client_credentials',
      client_id: UID,
      client_secret: SECRET
    });
    const token = authRes.data.access_token;

    let page = 1;
    let allUsers: any[] = [];
    let hasMore = true;

    // 2. Fetch users from Belgian Campus
    while (hasMore) {
      console.log(`Fetching page ${page} from 42 API...`);
      const usersRes = await axios.get(`https://api.intra.42.fr/v2/campus/${CAMPUS_ID}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          'page[size]': 100,
          'page[number]': page
        }
      });

      const users = usersRes.data;
      if (users.length === 0) {
        hasMore = false;
      } else {
        allUsers = [...allUsers, ...users];
        page++;
      }

      // Safety break to avoid infinite loops if API behaves unexpectedly
      if (page > 50) hasMore = false;
    }

    console.log(`Syncing ${allUsers.length} students to database...`);

    // 3. Insert into DB
    let syncedCount = 0;
    for (const user of allUsers) {
      // Skip users who are not active students (e.g. blackholed or staff)
      if (user['active?'] === false || user.kind !== 'student') {
        continue;
      }

      // Standardize data: handle missing images
      const imageUrl = user.image?.versions?.medium || user.image?.link || '';
      const fullName = user.displayname || user.login;

      await pool.query(`
        INSERT INTO students (name, login, image_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (login)
        DO UPDATE SET name = EXCLUDED.name, image_url = EXCLUDED.image_url
      `, [fullName, user.login, imageUrl]);
      syncedCount++;
    }

    res.json({ message: `Successfully synced ${syncedCount} active students.` });
  } catch (err) {
    console.error('42 Sync Error:', (err as any).response?.data || (err as Error).message);
    res.status(500).json({ error: 'Failed to sync with 42 API' });
  }
});

app.post('/api/students', requireAuth, async (req, res) => {
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

app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
             (COALESCE(ss_usage.count, 0) + COALESCE(do_usage.count, 0)) as usage_count
      FROM students s
      LEFT JOIN (
        SELECT student_id, COUNT(*) as count
        FROM sprint_students
        GROUP BY student_id
      ) ss_usage ON s.id = ss_usage.student_id
      LEFT JOIN (
        SELECT student_id, COUNT(*) as count
        FROM daily_objectives
        WHERE student_id IS NOT NULL
        GROUP BY student_id
      ) do_usage ON s.id = do_usage.student_id
      ORDER BY usage_count DESC, s.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/students', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM daily_objectives');
    await pool.query('DELETE FROM sprint_students');
    await pool.query('DELETE FROM students');
    res.json({ message: 'All students deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Delete student and all related data
    await pool.query('DELETE FROM daily_objectives WHERE student_id = $1', [id]);
    await pool.query('DELETE FROM sprint_students WHERE student_id = $1', [id]);
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/students/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, login, imageUrl } = req.body;
  try {
    const result = await pool.query(
      'UPDATE students SET name = $1, login = $2, image_url = $3 WHERE id = $4 RETURNING *',
      [name, login, imageUrl, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Project Routes
app.post('/api/projects/sync-42', requireAuth, async (req, res) => {
  const UID = process.env.FORTYTWO_APP_ID;
  const SECRET = process.env.FORTYTWO_APP_SECRET;

  if (!UID || !SECRET) {
    return res.status(500).json({ error: '42 API credentials missing in .env' });
  }

  try {
    const authRes = await axios.post('https://api.intra.42.fr/oauth/token', {
      grant_type: 'client_credentials',
      client_id: UID,
      client_secret: SECRET
    });
    const token = authRes.data.access_token;

    let page = 1;
    let allProjects: any[] = [];
    let hasMore = true;

    // Fetch projects from the 42 Cursus (ID 21)
    while (hasMore) {
      console.log(`Fetching page ${page} of projects from 42 API...`);
      const projectsRes = await axios.get(`https://api.intra.42.fr/v2/cursus/21/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          'page[size]': 100,
          'page[number]': page
        }
      });

      const projects = projectsRes.data;
      if (projects.length === 0) {
        hasMore = false;
      } else {
        allProjects = [...allProjects, ...projects];
        page++;
      }
      if (page > 20) hasMore = false; // Safety break
    }

    console.log(`Syncing ${allProjects.length} projects to database...`);

    for (const project of allProjects) {
      await pool.query(`
        INSERT INTO projects (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name)
        DO NOTHING
      `, [project.name, project.slug]); // Using slug as description if empty, or intra has more?
    }

    res.json({ message: `Successfully synced ${allProjects.length} projects.` });
  } catch (err) {
    console.error('Project Sync Error:', (err as any).response?.data || (err as Error).message);
    res.status(500).json({ error: 'Failed to sync projects with 42 API' });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
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

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             (COALESCE(ss_usage.count, 0) + COALESCE(do_usage.count, 0)) as usage_count
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM sprint_students
        GROUP BY project_id
      ) ss_usage ON p.id = ss_usage.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM daily_objectives
        WHERE project_id IS NOT NULL
        GROUP BY project_id
      ) do_usage ON p.id = do_usage.project_id
      ORDER BY usage_count DESC, p.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Projects in sprint_students or daily_objectives will be set to NULL (based on schema)
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Completion Level Routes
app.post('/api/completion-levels', requireAuth, async (req, res) => {
  const { text, color } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO completion_levels (text, color) VALUES ($1, $2) RETURNING *',
      [text, color]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/completion-levels', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM completion_levels ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/completion-levels/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM completion_levels WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/completion-levels/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { text, color } = req.body;
  try {
    const result = await pool.query(
      'UPDATE completion_levels SET text = $1, color = $2 WHERE id = $3 RETURNING *',
      [text, color, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Enrollment Routes
app.post('/api/sprints/:sprintId/students', requireAuth, async (req, res) => {
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

app.get('/api/sprints/:sprintId/students', requireAuth, async (req, res) => {
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

app.delete('/api/sprints/:sprintId/students/:studentId', requireAuth, async (req, res) => {
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
app.get('/api/sprints/:sprintId/summary', requireAuth, async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  try {
    const result = await pool.query(`
      SELECT
        s.id as student_id,
        s.name,
        s.login,
        s.image_url,
        obj.date,
        cl.color as completion_color,
        ss.sprint_goal,
        ss.is_goal_met
      FROM students s
      JOIN sprint_students ss ON s.id = ss.student_id
      LEFT JOIN daily_objectives obj ON s.id = obj.student_id AND obj.sprint_id = ss.sprint_id
      LEFT JOIN completion_levels cl ON obj.completion_level_id = cl.id
      WHERE ss.sprint_id = $1
      ORDER BY s.name ASC
    `, [sprintId]);

    const studentsMap: any = {};
    result.rows.forEach(row => {
      if (!studentsMap[row.student_id]) {
        studentsMap[row.student_id] = {
          id: row.student_id,
          name: row.name,
          login: row.login,
          image_url: row.image_url,
          sprint_goal: row.sprint_goal,
          is_goal_met: row.is_goal_met,
          days: {}
        };
      }
      if (row.date) {
        const dateStr = new Date(row.date).toISOString().split('T')[0];
        studentsMap[row.student_id].days[dateStr] = row.completion_color;
      }
    });

    res.json(Object.values(studentsMap));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update sprint goal
app.post('/api/sprints/:sprintId/students/:studentId/goal', requireAuth, async (req, res) => {
  const { sprintId, studentId } = req.params;
  const { goal, isMet } = req.body;
  try {
    await pool.query(
      'UPDATE sprint_students SET sprint_goal = $1, is_goal_met = $2 WHERE sprint_id = $3 AND student_id = $4',
      [goal, isMet, sprintId, studentId]
    );
    res.json({ message: 'Sprint goal updated' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/sprints/:sprintId/daily', requireAuth, async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  const { date } = req.query;
  try {
    const result = await pool.query(`
      SELECT
        s.id as student_id,
        s.name,
        s.login,
        s.image_url,
        active_project.id as project_id,
        active_project.name as project_name,
        obj.id as objective_id,
        obj.objective,
        obj.is_done,
        obj.completion_level_id,
        cl.text as completion_text,
        cl.color as completion_color
      FROM students s
      JOIN sprint_students ss ON s.id = ss.student_id
      LEFT JOIN daily_objectives obj ON s.id = obj.student_id AND obj.sprint_id = ss.sprint_id AND obj.date = $2
      LEFT JOIN completion_levels cl ON obj.completion_level_id = cl.id
      CROSS JOIN LATERAL (
        SELECT p.id, p.name
        FROM (
          -- Get the latest project assignment on or before the selected date
          SELECT project_id, date FROM daily_objectives
          WHERE student_id = s.id AND sprint_id = ss.sprint_id AND date <= $2 AND project_id IS NOT NULL
          UNION ALL
          -- Fallback to the initial enrollment project
          SELECT project_id, CAST('1900-01-01' AS DATE) FROM sprint_students
          WHERE student_id = s.id AND sprint_id = ss.sprint_id
        ) historical
        JOIN projects p ON historical.project_id = p.id
        ORDER BY historical.date DESC
        LIMIT 1
      ) active_project
      WHERE ss.sprint_id = $1
      ORDER BY s.name ASC
    `, [sprintId, date]);
    res.json(result.rows);
  } catch (err) {
    console.error('[DAILY] Error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/objectives', requireAuth, async (req, res) => {
  const { studentId, sprintId, date, objective, isDone, projectId, completionLevelId } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO daily_objectives (student_id, sprint_id, date, objective, is_done, project_id, completion_level_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (student_id, sprint_id, date)
      DO UPDATE SET
        objective = EXCLUDED.objective,
        is_done = EXCLUDED.is_done,
        project_id = COALESCE(EXCLUDED.project_id, daily_objectives.project_id),
        completion_level_id = EXCLUDED.completion_level_id
      RETURNING *
    `, [studentId, sprintId, date, objective, isDone, projectId, completionLevelId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update project for today and all FOLLOWING days
app.post('/api/sprints/:sprintId/students/:studentId/project', requireAuth, async (req, res) => {
  const sprintId = parseInt(req.params.sprintId);
  const studentId = parseInt(req.params.studentId);
  const { projectId, date } = req.body;

  try {
    // Save assignment to this specific day
    await pool.query(`
      INSERT INTO daily_objectives (student_id, sprint_id, date, project_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (student_id, sprint_id, date)
      DO UPDATE SET project_id = EXCLUDED.project_id
    `, [studentId, sprintId, date, projectId]);

    // Clear any FUTURE project overrides for this student to let the new project carry forward
    await pool.query(`
      UPDATE daily_objectives
      SET project_id = NULL
      WHERE student_id = $1 AND sprint_id = $2 AND date > $3
    `, [studentId, sprintId, date]);

    res.json({ message: 'Project updated forward' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
