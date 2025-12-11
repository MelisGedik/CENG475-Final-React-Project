const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

ensureDir();
const db = new Database(DB_PATH);

function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      genre TEXT NOT NULL,
      release_year INTEGER NOT NULL,
      poster_url TEXT,
      avg_rating REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movie_genres (
      movie_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (movie_id, tag),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, movie_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(release_year);
    CREATE INDEX IF NOT EXISTS idx_movies_avgr ON movies(avg_rating);
    CREATE INDEX IF NOT EXISTS idx_genres_movie ON movie_genres(movie_id);
    CREATE INDEX IF NOT EXISTS idx_genres_tag ON movie_genres(tag);
    CREATE INDEX IF NOT EXISTS idx_ratings_user_movie ON ratings(user_id, movie_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings(movie_id);
  `);
  // Best-effort FTS
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS movie_fts USING fts5(title, description, content='movies', content_rowid='id');
      CREATE TRIGGER IF NOT EXISTS movie_ai AFTER INSERT ON movies BEGIN
        INSERT INTO movie_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
      END;
      CREATE TRIGGER IF NOT EXISTS movie_ad AFTER DELETE ON movies BEGIN
        INSERT INTO movie_fts(movie_fts, rowid, title, description) VALUES('delete', old.id, old.title, old.description);
      END;
      CREATE TRIGGER IF NOT EXISTS movie_au AFTER UPDATE ON movies BEGIN
        INSERT INTO movie_fts(movie_fts) VALUES('rebuild');
      END;
    `);
    db.prepare("INSERT INTO movie_fts(movie_fts) VALUES ('rebuild')").run();
  } catch (e) {}
  // Backfill primary genre as tag for existing movies
  db.exec(`
    INSERT OR IGNORE INTO movie_genres (movie_id, tag)
    SELECT id, genre FROM movies;
  `);
}

function recalcMovieAvg(movieId) {
  const avg = db.prepare('SELECT COALESCE(AVG(rating), 0) as avg FROM ratings WHERE movie_id = ?').get(movieId).avg;
  db.prepare('UPDATE movies SET avg_rating = ? WHERE id = ?').run(avg, movieId);
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM movies').get().c;
  if (count > 0) return;

  const movies = [
    {
      title: 'Inception',
      description: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.',
      genre: 'Sci-Fi',
      release_year: 2010,
      poster_url: 'https://m.media-amazon.com/images/I/51oD3t6xvIL._AC_.jpg'
    },
    {
      title: 'The Dark Knight',
      description: 'Batman faces the Joker, a criminal mastermind who plunges Gotham into anarchy.',
      genre: 'Action',
      release_year: 2008,
      poster_url: 'https://m.media-amazon.com/images/I/51K8ouYrHeL._AC_.jpg'
    },
    {
      title: 'Interstellar',
      description: 'A team travels through a wormhole in space in an attempt to ensure humanity\'s survival.',
      genre: 'Sci-Fi',
      release_year: 2014,
      poster_url: 'https://m.media-amazon.com/images/I/71n58L9VfNL._AC_SL1181_.jpg'
    },
    {
      title: 'La La Land',
      description: 'A jazz pianist and an aspiring actress fall in love and strive to reconcile their aspirations.',
      genre: 'Romance',
      release_year: 2016,
      poster_url: 'https://m.media-amazon.com/images/I/91PqkG3RzjL._SL1500_.jpg'
    },
    {
      title: 'The Godfather',
      description: 'An organized crime dynasty\'s aging patriarch transfers control of his empire to his reluctant son.',
      genre: 'Crime',
      release_year: 1972,
      poster_url: 'https://m.media-amazon.com/images/I/51xw2s3Xl+L._AC_.jpg'
    }
  ];

  const stmt = db.prepare('INSERT INTO movies (title, description, genre, release_year, poster_url) VALUES (?, ?, ?, ?, ?)');
  const insertMany = db.transaction((items) => {
    for (const m of items) {
      const info = stmt.run(m.title, m.description, m.genre, m.release_year, m.poster_url);
      // seed primary genre into movie_genres
      try { db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, tag) VALUES (?, ?)').run(info.lastInsertRowid, m.genre); } catch {}
    }
  });
  insertMany(movies);
}

module.exports = {
  db,
  ensureSchema,
  seedIfEmpty,
  recalcMovieAvg,
};
