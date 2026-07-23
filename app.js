const express = require('express');
const path = require('path');
const session = require('express-session');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

// Setup SQLite Database
const db = new Database('database.db');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    subject TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER,
    title TEXT NOT NULL,
    peer_name TEXT NOT NULL,
    datetime TEXT NOT NULL,
    location TEXT NOT NULL,
    FOREIGN KEY(tutor_id) REFERENCES users(id)
  );
`);

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(
  session({
    secret: 'jchs_mu_alpha_theta_secret_key',
    resave: false,
    saveUninitialized: false,
  })
);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

app.post('/submit-onboarding', (req, res) => {
  const { username, role, subject } = req.body;

  const stmt = db.prepare(
    'INSERT INTO users (username, role, subject) VALUES (?, ?, ?)'
  );
  const info = stmt.run(username, role, subject || 'N/A');

  // Store logged in state in session
  req.session.userId = info.lastInsertRowid;

  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  // Fetch current user
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.session.userId);

  if (!user) {
    req.session.destroy();
    return res.redirect('/');
  }

  // Fetch user's scheduled sessions
  const userSessions = db
    .prepare('SELECT * FROM sessions WHERE tutor_id = ?')
    .all(user.id);

  res.render('dashboard', { user, sessions: userSessions });
});

// Create a new tutoring session dynamic API endpoint
app.post('/api/sessions', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title, peer_name, datetime, location } = req.body;

  const stmt = db.prepare(
    'INSERT INTO sessions (tutor_id, title, peer_name, datetime, location) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(req.session.userId, title, peer_name, datetime, location);

  res.json({ success: true });
});

// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Replace your app.listen block at the bottom with:
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;