const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const { db, ensureSchema, seedIfEmpty, recalcMovieAvg } = require('./db');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

ensureSchema();
seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const password_hash = bcrypt.hashSync(password, 10);
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const role = userCount === 0 ? 'admin' : 'user';
  const info = db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email, name, password_hash, role);
  const user = { id: info.lastInsertRowid, email, name, role };
  const token = generateToken(user);
  return res.json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(user);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// Change password
app.post('/api/auth/change-password', authRequired, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password are required' });
  if (String(new_password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = bcrypt.compareSync(current_password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  return res.json({ success: true });
});

app.get('/api/me', authRequired, (req, res) => {
  const u = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  return res.json(u);
});

// Movies CRUD + list with filters
app.get('/api/movies', (req, res) => {
  const { q, genre, min_rating, year } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (genre) { where.push('genre = ?'); params.push(genre); }
  if (min_rating) { where.push('avg_rating >= ?'); params.push(Number(min_rating)); }
  if (year) { where.push('release_year = ?'); params.push(Number(year)); }
  const sql = `SELECT * FROM movies ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY avg_rating DESC, id DESC LIMIT 100`;
  const movies = db.prepare(sql).all(...params);
  res.json(movies);
});

// (moved) advanced search route lives above /api/movies/:id to avoid collisions

app.get('/api/movies/:id(\\d+)', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  res.json(movie);
});

// Advanced movie search with pagination/sorting and aggregated genres
app.get('/api/movies/search', (req, res) => {
  const { q, genre, min_rating, year, page = 1, page_size = 12, sort = 'rating_desc', title_only, starts_with } = req.query;
  // Optional token parse to enrich results with my_rating
  let currentUserId = 0;
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) currentUserId = jwt.verify(token, JWT_SECRET).id || 0;
  } catch (e) {}
  const where = [];
  const params = [];
  if (q) {
    const term = String(q).trim();
    const phrase = term.startsWith('"') && term.endsWith('"') && term.length > 2 ? term.slice(1, -1) : null;
    if (title_only === '1' || title_only === 'true') {
      const tokens = (phrase || term).split(/\s+/).filter(Boolean);
      if (starts_with === '1' || starts_with === 'true') {
        for (const t of tokens) { where.push('m.title LIKE ? COLLATE NOCASE'); params.push(`${t}%`); }
      } else {
        for (const t of tokens) { where.push('m.title LIKE ? COLLATE NOCASE'); params.push(`%${t}%`); }
      }
    } else {
      if (phrase) { where.push('(m.title LIKE ? OR m.description LIKE ?)'); params.push(`%${phrase}%`, `%${phrase}%`); }
      else { where.push('(m.title LIKE ? OR m.description LIKE ?)'); params.push(`%${term}%`, `%${term}%`); }
    }
  }
  if (genre) { where.push('EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_id = m.id AND mg.tag = ?)'); params.push(genre); }
  if (min_rating) { where.push('m.avg_rating >= ?'); params.push(Number(min_rating)); }
  if (year) { where.push('m.release_year = ?'); params.push(Number(year)); }

  const sortMap = {
    'rating_desc': 'm.avg_rating DESC, m.id DESC',
    'rating_asc': 'm.avg_rating ASC, m.id DESC',
    'year_desc': 'm.release_year DESC, m.id DESC',
    'year_asc': 'm.release_year ASC, m.id DESC',
    'title_asc': 'm.title COLLATE NOCASE ASC',
    'title_desc': 'm.title COLLATE NOCASE DESC',
  };
  const orderBy = sortMap[sort] || sortMap['rating_desc'];

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(50, Math.max(1, Number(page_size)));
  const offset = (pageNum - 1) * pageSize;

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM movies m ${whereSql}`).get(...params).c;

  const rows = db.prepare(`
    SELECT m.*, (
      SELECT GROUP_CONCAT(mg.tag, ',') FROM movie_genres mg WHERE mg.movie_id = m.id
    ) as genres,
    (SELECT rating FROM ratings r WHERE r.user_id = ? AND r.movie_id = m.id) as my_rating
    FROM movies m
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(currentUserId, ...params, pageSize, offset);

  res.json({ items: rows, page: pageNum, pageSize, total });
});

// Title-only suggestions for live search
app.get('/api/movies/suggest', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const prefix = q + '%';
  const contains = `%${q}%`;
  const rows = db.prepare(`
    SELECT m.*, (
      SELECT GROUP_CONCAT(mg.tag, ',') FROM movie_genres mg WHERE mg.movie_id = m.id
    ) as genres
    FROM movies m
    WHERE m.title LIKE ? COLLATE NOCASE OR m.title LIKE ? COLLATE NOCASE
    ORDER BY CASE WHEN m.title LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END, m.avg_rating DESC, m.id DESC
    LIMIT 10
  `).all(prefix, contains, prefix);
  res.json(rows);
});

// Movie genres management (multi-tag support)
app.get('/api/movies/:id(\\d+)/genres', (req, res) => {
  const rows = db.prepare('SELECT tag FROM movie_genres WHERE movie_id = ? ORDER BY tag').all(req.params.id);
  res.json(rows.map(r => r.tag));
});

app.put('/api/movies/:id(\\d+)/genres', authRequired, adminRequired, (req, res) => {
  const { genres } = req.body || {};
  if (!Array.isArray(genres)) return res.status(400).json({ error: 'genres must be an array of strings' });
  const m = db.prepare('SELECT id FROM movies WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Movie not found' });
  db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, tag) VALUES (?, ?)');
  for (const t of new Set(genres.map(s => String(s).trim()).filter(Boolean))) ins.run(req.params.id, t);
  const updated = db.prepare('SELECT tag FROM movie_genres WHERE movie_id = ? ORDER BY tag').all(req.params.id).map(r => r.tag);
  res.json({ genres: updated });
});

app.post('/api/movies', authRequired, adminRequired, (req, res) => {
  const { title, description, genre, release_year, poster_url } = req.body || {};
  if (!title || !description || !genre || !release_year) return res.status(400).json({ error: 'Missing required fields' });
  const info = db.prepare('INSERT INTO movies (title, description, genre, release_year, poster_url) VALUES (?, ?, ?, ?, ?)')
    .run(title, description, genre, Number(release_year), poster_url || null);
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(movie);
});

app.put('/api/movies/:id(\\d+)', authRequired, adminRequired, (req, res) => {
  const { title, description, genre, release_year, poster_url } = req.body || {};
  const m = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Movie not found' });
  db.prepare('UPDATE movies SET title = ?, description = ?, genre = ?, release_year = ?, poster_url = ? WHERE id = ?')
    .run(title ?? m.title, description ?? m.description, genre ?? m.genre, Number(release_year ?? m.release_year), poster_url ?? m.poster_url, req.params.id);
  const updated = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/movies/:id(\\d+)', authRequired, adminRequired, (req, res) => {
  const info = db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Movie not found' });
  res.json({ success: true });
});

// Ratings & reviews
app.get('/api/movies/:id(\\d+)/ratings', (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.rating, r.review, r.created_at, u.name as user_name
    FROM ratings r JOIN users u ON r.user_id = u.id
    WHERE r.movie_id = ?
    ORDER BY r.created_at DESC
    LIMIT 100
  `).all(req.params.id);
  res.json(rows);
});

// Movie stats: histogram counts per rating
app.get('/api/movies/:id(\\d+)/stats', (req, res) => {
  const rows = db.prepare('SELECT rating, COUNT(*) as c FROM ratings WHERE movie_id = ? GROUP BY rating').all(req.params.id);
  const hist = { 1:0,2:0,3:0,4:0,5:0 };
  for (const r of rows) hist[r.rating] = r.c;
  res.json({ histogram: hist });
});
app.post('/api/movies/:id(\\d+)/ratings', authRequired, (req, res) => {
  const movieId = Number(req.params.id);
  const { rating, review } = req.body || {};
  const r = Number(rating);
  if (!(r >= 1 && r <= 5)) return res.status(400).json({ error: 'Rating must be 1-5' });
  const exists = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!exists) return res.status(404).json({ error: 'Movie not found' });
  const upsert = db.prepare(`
    INSERT INTO ratings (user_id, movie_id, rating, review)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, movie_id) DO UPDATE SET rating = excluded.rating, review = excluded.review, created_at = datetime('now')
  `);
  upsert.run(req.user.id, movieId, r, review || null);
  recalcMovieAvg(movieId);
  const updated = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
  res.json({ success: true, movie: updated });
});

app.delete('/api/movies/:id(\\d+)/ratings/me', authRequired, (req, res) => {
  const movieId = Number(req.params.id);
  const info = db.prepare('DELETE FROM ratings WHERE user_id = ? AND movie_id = ?').run(req.user.id, movieId);
  if (info.changes === 0) return res.status(404).json({ error: 'No rating to delete' });
  recalcMovieAvg(movieId);
  const updated = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
  res.json({ success: true, movie: updated });
});

// Watch history for current user
app.get('/api/history', authRequired, (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const rows = db.prepare(`
    SELECT m.*, r.rating as my_rating, r.review as my_review, r.created_at as rated_at,
      (SELECT GROUP_CONCAT(mg.tag, ',') FROM movie_genres mg WHERE mg.movie_id = m.id) as genres
    FROM ratings r JOIN movies m ON r.movie_id = m.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(req.user.id, limit);
  res.json(rows);
});

// Admin: seed additional sample movies with tags
app.post('/api/admin/seed-samples', authRequired, adminRequired, (_req, res) => {
  const samples = [
    {
      title: 'The Matrix',
      description: 'A hacker discovers the reality is a simulation and joins a rebellion.',
      genre: 'Sci-Fi',
      genres: ['Sci-Fi', 'Action', 'Thriller'],
      release_year: 1999,
      poster_url: 'https://m.media-amazon.com/images/I/51vpnbwFHrL._AC_.jpg'
    },
    {
      title: 'Parasite',
      description: 'Greed and class discrimination threaten a newly formed symbiotic relationship between the wealthy and the destitute.',
      genre: 'Thriller',
      genres: ['Thriller', 'Drama'],
      release_year: 2019,
      poster_url: 'https://m.media-amazon.com/images/I/71tG0NQyIvL._AC_SL1024_.jpg'
    },
    {
      title: 'Spirited Away',
      description: 'During her family’s move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.',
      genre: 'Animation',
      genres: ['Animation', 'Fantasy', 'Adventure'],
      release_year: 2001,
      poster_url: 'https://m.media-amazon.com/images/I/81s+4A+4jhL._AC_SL1500_.jpg'
    },
    {
      title: 'Whiplash',
      description: 'A promising young drummer enrolls at a cut-throat music conservatory where an abusive instructor pushes him to the brink.',
      genre: 'Drama',
      genres: ['Drama', 'Music'],
      release_year: 2014,
      poster_url: 'https://m.media-amazon.com/images/I/71yqjUeE0eL._AC_SL1344_.jpg'
    },
    {
      title: 'Mad Max: Fury Road',
      description: 'In a post-apocalyptic wasteland, Max helps a rebellious woman and a group of female prisoners.',
      genre: 'Action',
      genres: ['Action', 'Adventure', 'Sci-Fi'],
      release_year: 2015,
      poster_url: 'https://m.media-amazon.com/images/I/81YvQ7x9vML._AC_SL1500_.jpg'
    },
    {
      title: 'The Grand Budapest Hotel',
      description: 'A writer encounters the owner of an aging high-class hotel, who tells him of his early years.',
      genre: 'Comedy',
      genres: ['Comedy', 'Drama'],
      release_year: 2014,
      poster_url: 'https://m.media-amazon.com/images/I/81eS8n2xb1L._AC_SL1500_.jpg'
    },
    {
      title: 'Her',
      description: 'In the near future, a lonely writer develops an unlikely relationship with an operating system.',
      genre: 'Romance',
      genres: ['Romance', 'Drama', 'Sci-Fi'],
      release_year: 2013,
      poster_url: 'https://m.media-amazon.com/images/I/71G-3c7gEQL._AC_SL1111_.jpg'
    },
    {
      title: 'The Shawshank Redemption',
      description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption.',
      genre: 'Drama',
      genres: ['Drama', 'Crime'],
      release_year: 1994,
      poster_url: 'https://m.media-amazon.com/images/I/51NiGlapXlL._AC_.jpg'
    },
    {
      title: 'Coco',
      description: 'Aspiring musician Miguel enters the Land of the Dead to find his great-great-grandfather.',
      genre: 'Animation',
      genres: ['Animation', 'Family', 'Adventure'],
      release_year: 2017,
      poster_url: 'https://m.media-amazon.com/images/I/81i2rWmJYOL._AC_SL1333_.jpg'
    },
    {
      title: 'Dune',
      description: 'A noble family becomes embroiled in a war for control over the galaxy’s most valuable asset.',
      genre: 'Sci-Fi',
      genres: ['Sci-Fi', 'Adventure', 'Drama'],
      release_year: 2021,
      poster_url: 'https://m.media-amazon.com/images/I/71sfk7KqY-L._AC_SL1333_.jpg'
    }
  ];

  let inserted = 0;
  const insertMovie = db.prepare('INSERT INTO movies (title, description, genre, release_year, poster_url) VALUES (?,?,?,?,?)');
  const insTag = db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, tag) VALUES (?, ?)');
  const selectByTitle = db.prepare('SELECT id FROM movies WHERE title = ?');

  const tx = db.transaction(() => {
    for (const s of samples) {
      const existing = selectByTitle.get(s.title);
      if (existing && existing.id) {
        // ensure tags exist even for existing movies
        const baseTags = new Set([s.genre, ...(s.genres || [])]);
        for (const t of baseTags) insTag.run(existing.id, t);
        continue;
      }
      const info = insertMovie.run(s.title, s.description, s.genre, s.release_year, s.poster_url);
      inserted++;
      const movieId = info.lastInsertRowid;
      const baseTags = new Set([s.genre, ...(s.genres || [])]);
      for (const t of baseTags) insTag.run(movieId, t);
    }
  });
  tx();

  res.json({ success: true, inserted });
});
// Advanced recommendations (collaborative filtering -> content-based -> global top)
app.get('/api/recommendations/advanced', authRequired, (req, res) => {
  const cfSql = `
    WITH my_likes AS (
      SELECT movie_id FROM ratings WHERE user_id = ? AND rating >= 4
    ), neighbors AS (
      SELECT r.user_id, COUNT(*) AS overlap
      FROM ratings r JOIN my_likes ml ON r.movie_id = ml.movie_id
      WHERE r.user_id != ? AND r.rating >= 4
      GROUP BY r.user_id
    ), neighbor_recs AS (
      SELECT r.movie_id, SUM(n.overlap * r.rating) AS score
      FROM ratings r JOIN neighbors n ON r.user_id = n.user_id
      WHERE r.rating >= 4 AND r.movie_id NOT IN (SELECT movie_id FROM ratings WHERE user_id = ?)
      GROUP BY r.movie_id
    )
    SELECT m.*, (
      SELECT GROUP_CONCAT(mg.tag, ',') FROM movie_genres mg WHERE mg.movie_id = m.id
    ) as genres,
    COALESCE(nr.score, 0) AS cf_score
    FROM movies m JOIN neighbor_recs nr ON m.id = nr.movie_id
    ORDER BY cf_score DESC, m.avg_rating DESC, m.id DESC
    LIMIT 20
  `;
  let movies = db.prepare(cfSql).all(req.user.id, req.user.id, req.user.id);

  if (movies.length === 0) {
    const topTags = db.prepare(`
      SELECT mg.tag, COUNT(*) as c
      FROM ratings r
      JOIN movie_genres mg ON r.movie_id = mg.movie_id
      WHERE r.user_id = ? AND r.rating >= 4
      GROUP BY mg.tag
      ORDER BY c DESC
      LIMIT 3
    `).all(req.user.id).map(r => r.tag);
    if (topTags.length > 0) {
      const placeholders = topTags.map(() => '?').join(',');
      movies = db.prepare(`
        SELECT m.*, (
          SELECT GROUP_CONCAT(mg.tag, ',') FROM movie_genres mg WHERE mg.movie_id = m.id
        ) as genres
        FROM movies m
        WHERE m.id NOT IN (SELECT movie_id FROM ratings WHERE user_id = ?)
        AND EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_id = m.id AND mg.tag IN (${placeholders}))
        ORDER BY m.avg_rating DESC, m.id DESC
        LIMIT 20
      `).all(req.user.id, ...topTags);
    }
  }

  if (movies.length === 0) {
    movies = db.prepare(`
      SELECT m.*, (
        SELECT GROUP_CONCAT(mg.tag, ',') FROM movie_genres mg WHERE mg.movie_id = m.id
      ) as genres
      FROM movies m
      WHERE m.id NOT IN (SELECT movie_id FROM ratings WHERE user_id = ?)
      ORDER BY m.avg_rating DESC, m.id DESC
      LIMIT 20
    `).all(req.user.id);
  }
  res.json(movies);
});
// Recommendations (simple content-based by preferred genres and avg rating)
app.get('/api/recommendations', authRequired, (req, res) => {
  // Find user\'s top genres (rated >=4)
  const rows = db.prepare(`
    SELECT m.genre, COUNT(*) as c
    FROM ratings r JOIN movies m ON r.movie_id = m.id
    WHERE r.user_id = ? AND r.rating >= 4
    GROUP BY m.genre
    ORDER BY c DESC
  `).all(req.user.id);
  let movies = [];
  if (rows.length > 0) {
    const genres = rows.map(r => r.genre);
    const placeholders = genres.map(() => '?').join(',');
    movies = db.prepare(`
      SELECT * FROM movies
      WHERE genre IN (${placeholders})
      AND id NOT IN (SELECT movie_id FROM ratings WHERE user_id = ?)
      ORDER BY avg_rating DESC, id DESC
      LIMIT 20
    `).all(...genres, req.user.id);
  }
  if (movies.length === 0) {
    movies = db.prepare(`
      SELECT * FROM movies
      WHERE id NOT IN (SELECT movie_id FROM ratings WHERE user_id = ?)
      ORDER BY avg_rating DESC, id DESC
      LIMIT 20
    `).all(req.user.id);
  }
  res.json(movies);
});

// Admin: users management
app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

app.put('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  const { role, name } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET role = ?, name = ? WHERE id = ?')
    .run(role ?? u.role, name ?? u.name, req.params.id);
  const updated = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve built client in production if present
try {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
} catch {}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
