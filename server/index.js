require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('./db')
const { authRequired, requireRole } = require('./middleware/auth')

const app = express()
const PORT = Number(process.env.PORT || 4000)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

function signToken(u) {
  return jwt.sign({ id: u.id, role: u.role, email: u.email, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' })
}


app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {}
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' })
    if (String(password).length < 4) return res.status(400).json({ error: 'Password too short' })

    const [exists] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (exists.length) return res.status(409).json({ error: 'Email already registered' })

    const hash = await bcrypt.hash(password, 10)
    const [r] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email, hash, 'user']
    )

    const user = { id: r.insertId, name, email, role: 'user' }
    const token = signToken(user)
    res.json({ token, user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Register failed' })
  }
})

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email, password required' })

    const [rows] = await pool.execute(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    )
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' })

    const u = rows[0]
    const ok = await bcrypt.compare(password, u.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' })

    const user = { id: u.id, name: u.name, email: u.email, role: u.role }
    const token = signToken(user)
    res.json({ token, user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Login failed' })
  }
})


app.get('/api/movies', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, title, description, genre, release_year, poster_url, avg_rating, created_at FROM movies ORDER BY created_at DESC'
  )
  res.json(rows)
})

app.get('/api/movies/:id', async (req, res) => {
  const id = Number(req.params.id)
  const [[movie]] = await pool.execute(
    'SELECT id, title, description, genre, release_year, poster_url, avg_rating, created_at FROM movies WHERE id = ?',
    [id]
  )
  if (!movie) return res.status(404).json({ error: 'Movie not found' })

  const [tags] = await pool.execute('SELECT tag FROM movie_genres WHERE movie_id = ? ORDER BY tag', [id])
  movie.genres = tags.map(t => t.tag)
  res.json(movie)
})

app.get('/api/movies/:id/genres', async (req, res) => {
  const id = Number(req.params.id)
  const [tags] = await pool.execute('SELECT tag FROM movie_genres WHERE movie_id = ? ORDER BY tag', [id])
  res.json(tags.map(t => t.tag))
})


async function recalcAvg(movieId) {
  await pool.execute(
    `UPDATE movies
     SET avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM ratings WHERE movie_id = ?)
     WHERE id = ?`,
    [movieId, movieId]
  )
}

app.get('/api/movies/:id/ratings', async (req, res) => {
  const movieId = Number(req.params.id)
  const [rows] = await pool.execute(
    `SELECT r.id, r.user_id, r.movie_id, r.rating, r.review, r.created_at,
            u.name AS user_name
     FROM ratings r
     JOIN users u ON u.id = r.user_id
     WHERE r.movie_id = ?
     ORDER BY r.created_at DESC`,
    [movieId]
  )
  res.json(rows)
})

app.post('/api/movies/:id/ratings', authRequired, async (req, res) => {
  const movieId = Number(req.params.id)
  const userId = req.user.id
  const { rating, review } = req.body || {}

  const r = Number(rating)
  if (!(r >= 1 && r <= 5)) return res.status(400).json({ error: 'rating must be 1..5' })
  if (review && String(review).length > 500) return res.status(400).json({ error: 'review must be <= 500 chars' })

  await pool.execute(
    `INSERT INTO ratings (user_id, movie_id, rating, review, created_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), created_at = NOW()`,
    [userId, movieId, r, review || null]
  )

  await recalcAvg(movieId)

  const [[movie]] = await pool.execute(
    'SELECT id, title, description, genre, release_year, poster_url, avg_rating, created_at FROM movies WHERE id = ?',
    [movieId]
  )
  res.json({ movie })
})

app.delete('/api/movies/:id/ratings/me', authRequired, async (req, res) => {
  const movieId = Number(req.params.id)
  const userId = req.user.id

  await pool.execute('DELETE FROM ratings WHERE user_id = ? AND movie_id = ?', [userId, movieId])
  await recalcAvg(movieId)

  const [[movie]] = await pool.execute(
    'SELECT id, title, description, genre, release_year, poster_url, avg_rating, created_at FROM movies WHERE id = ?',
    [movieId]
  )
  res.json({ movie })
})

app.get('/api/movies/:id/stats', async (req, res) => {
  const movieId = Number(req.params.id)
  const [rows] = await pool.execute(
    'SELECT rating, COUNT(*) AS c FROM ratings WHERE movie_id = ? GROUP BY rating',
    [movieId]
  )
  const histogram = { 1:0,2:0,3:0,4:0,5:0 }
  for (const row of rows) histogram[row.rating] = Number(row.c)
  res.json({ histogram })
})


app.get('/api/admin/users', authRequired, requireRole('admin'), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  )
  res.json(rows)
})

app.put('/api/admin/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { role } = req.body || {}
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be user|admin' })
  await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, id])
  res.json({ ok: true })
})

app.post('/api/movies', authRequired, requireRole('admin'), async (req, res) => {
  const { title, description, genre, release_year, poster_url } = req.body || {}
  if (!title || !description || !genre || !release_year) return res.status(400).json({ error: 'Missing fields' })

  const [r] = await pool.execute(
    `INSERT INTO movies (title, description, genre, release_year, poster_url, avg_rating, created_at)
     VALUES (?, ?, ?, ?, ?, 0, NOW())`,
    [title, description, genre, Number(release_year), poster_url || null]
  )
  const [[movie]] = await pool.execute(
    'SELECT id, title, description, genre, release_year, poster_url, avg_rating, created_at FROM movies WHERE id = ?',
    [r.insertId]
  )
  res.json(movie)
})

app.put('/api/movies/:id/genres', authRequired, requireRole('admin'), async (req, res) => {
  const movieId = Number(req.params.id)
  const genres = (req.body && req.body.genres) || []
  if (!Array.isArray(genres)) return res.status(400).json({ error: 'genres must be array' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute('DELETE FROM movie_genres WHERE movie_id = ?', [movieId])
    for (const tag of genres.map(s => String(s).trim()).filter(Boolean)) {
      await conn.execute('INSERT INTO movie_genres (movie_id, tag) VALUES (?, ?)', [movieId, tag])
    }
    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(500).json({ error: 'Could not update genres' })
  } finally {
    conn.release()
  }
})

app.delete('/api/movies/:id', authRequired, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  await pool.execute('DELETE FROM movies WHERE id = ?', [id])
  res.json({ ok: true })
})


app.get('/api/admin/activity', authRequired, requireRole('admin'), async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.created_at, r.rating, r.review,
            u.id AS user_id, u.name AS user_name, u.email,
            m.id AS movie_id, m.title AS movie_title
     FROM ratings r
     JOIN users u ON u.id = r.user_id
     JOIN movies m ON m.id = r.movie_id
     ORDER BY r.created_at DESC
     LIMIT 20`
  )
  res.json(rows)
})

app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`))
