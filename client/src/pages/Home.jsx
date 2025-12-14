import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { useMovies } from '../state/MovieContext'
import api from '../api'


import heroBgDark from '../assets/hero-bg.jpg'
import heroBgLight from '../assets/hero-bg-light.jpg'

export default function Home() {
  const { user, logout } = useAuth()
  const { addToWatchlist, addToHistory } = useMovies()

  const [theme, setTheme] = useState(() => localStorage.getItem('siteTheme') || 'dark')
  
  // MODAL STATE'LERİ
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('watchlist')
  
  // FORM DATASI
  const [movieName, setMovieName] = useState('')
  const [rating, setRating] = useState(0) // Varsayılan puan 0 olsun (seçilmemiş)
  const [review, setReview] = useState('')
  const [watchDate, setWatchDate] = useState(new Date().toISOString().split('T')[0])
  
  // Hover efekti için (Yıldızların üstüne gelince yanması için)
  const [hoverRating, setHoverRating] = useState(0)

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('siteTheme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(p => p === 'dark' ? 'light' : 'dark')
  const currentHeroImage = theme === 'dark' ? heroBgDark : heroBgLight
    // --- MOVIE LIST STATE ---
  const [movies, setMovies] = useState([])
  const [loadingMovies, setLoadingMovies] = useState(true)
  const [moviesError, setMoviesError] = useState(null)

  // filtre/search
  const [q, setQ] = useState('')
  const [genreFilter, setGenreFilter] = useState('All')
  const [sortBy, setSortBy] = useState('newest') // newest | rating | year

  useEffect(() => {
    let alive = true

    async function loadMovies() {
      try {
        setLoadingMovies(true)
        setMoviesError(null)

        // 1) Normal endpoint
        let res
        try {
          res = await api.get('/api/movies')
        } catch (err) {
          // 2) Eğer baseURL zaten /api ile bitiyorsa fallback
          if (err?.response?.status === 404) {
            res = await api.get('/movies')
          } else {
            throw err
          }
        }

        if (!alive) return
        const data = res?.data
        setMovies(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!alive) return
        const status = e?.response?.status
        const msg = e?.response?.data?.error || e?.message
        console.error('MOVIES ERROR:', { status, msg, data: e?.response?.data })
        setMoviesError(`Movies could not be loaded. (${status || 'NETWORK'}) ${msg || ''}`)
      } finally {
        if (!alive) return
        setLoadingMovies(false)
      }
    }

    loadMovies()
    return () => { alive = false }
  }, [])



  // --- KAYDETME FONKSİYONU ---
  const handleSave = (e) => {
    e.preventDefault()
    if (!movieName) return alert("Please enter a movie name")

    if (activeTab === 'watchlist') {
      addToWatchlist(movieName)
      alert(`${movieName} added to Watchlist!`)
    } else {
      if (rating === 0) return alert("Please rate the movie")  
      addToHistory(movieName, rating, review, watchDate)
      alert(`${movieName} logged to History!`)
    }
    
    // Temizlik ve Kapatma
    setMovieName('')
    setReview('')
    setRating(0)
    setShowModal(false)
  }

  return (
    <div className="home">
      
      {/* ──────────────── NAVBAR ──────────────── */}
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand">Movie<span className="brand-accent">Rec</span></Link>

          {user && (
            <div className="nav-links">
               
               <Link to="/" className="nav-item">Home</Link>
               <Link to="/history" className="nav-item">History</Link>
               <Link to="/watchlist" className="nav-item">Watchlist</Link>              
               <Link to="/profile" className="nav-item">Profile</Link>
            </div>
          )}

          <span className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>

          <div className="auth-buttons">
            
            {/* LOG BUTONU */}
            {user && (
              <button 
                onClick={() => setShowModal(true)}
                style={{
                  background: '#7c5cff',
                  color: '#fff', 
                  border: 'none',
                  padding: '8px 20px', 
                  borderRadius: '50px',
                  fontSize: '13px', 
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '6px',
                  marginRight: '15px', 
                  boxShadow: '0 4px 15px rgba(124, 92, 255, 0.4)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ fontSize: '16px' }}>+</span> LOG
              </button>
            )}

            
            
            {user ? (
              <div className="user-menu">
                <div onClick={logout} className="user-avatar" title="Logout">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">Login</Link>
                <Link to="/register" className="btn btn-primary" style={{marginLeft: '10px'}}>Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ──────────────── HERO ──────────────── */}
      <section className="hero-banner">
        <div className="hero-bg" style={{ backgroundImage: `url(${currentHeroImage})` }} />
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Movie World</h1>
          <p className="hero-desc">Log films you've watched. Save films to watch later.</p>
          <button className="btn btn-outline" style={{marginTop: '10px'}}>More Info</button>
        </div>
      </section>
      {/* ──────────────── MOVIE LIST (DB) ──────────────── */}
      <section style={{ padding: '40px 0' }}>
        <div style={{ width: 'min(1100px, 92%)', margin: '0 auto' }}>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Browse Movies</h2>
          <p style={{ marginTop: 8, color: 'var(--muted, #a7b6cc)' }}>
            Loaded from your database via <code>/api/movies</code>.
          </p>

          {/* Controls */}
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
            marginTop: 18, marginBottom: 18
          }}>
            <input
              className="auth-input"
              placeholder="Search title..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 320 }}
            />

            <select
              className="auth-input"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="All">All genres</option>
              {[...new Set(movies.map(m => m.genre).filter(Boolean))].sort().map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <select
              className="auth-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="newest">Sort: Newest</option>
              <option value="rating">Sort: Highest Rating</option>
              <option value="year">Sort: Release Year</option>
            </select>
          </div>

          {/* States */}
          {loadingMovies && (
            <div style={{ padding: 20, color: '#a7b6cc' }}>Loading movies...</div>
          )}

          {moviesError && (
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(255,0,0,0.08)', color: '#ffb4b4'
            }}>
              {moviesError}
            </div>
          )}

          {!loadingMovies && !moviesError && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
              marginTop: 10
            }}>
              {movies
                .filter(m => {
                  const okGenre = genreFilter === 'All' || m.genre === genreFilter
                  const okQ = !q || String(m.title || '').toLowerCase().includes(q.toLowerCase())
                  return okGenre && okQ
                })
                .sort((a, b) => {
                  if (sortBy === 'rating') return Number(b.avg_rating) - Number(a.avg_rating)
                  if (sortBy === 'year') return Number(b.release_year) - Number(a.release_year)
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
                .map(m => (
                  <div key={m.id} style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ aspectRatio: '2 / 3', background: '#10131a' }}>
                      <img
                        src={m.poster_url || 'https://picsum.photos/seed/fallback/400/600'}
                        alt={m.title}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>

                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
                        {m.title}
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, color: '#a7b6cc' }}>
                        {m.genre} • {m.release_year} • ⭐ {Number(m.avg_rating || 0).toFixed(1)}
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        {/* Route senin projende farklıysa burada değiştir:
                            /movie/${m.id} yerine /movies/${m.id} gibi */}
                        <Link
                          to={`/movie/${m.id}`}
                          className="btn btn-outline"
                          style={{ padding: '8px 12px', fontSize: 12 }}
                        >
                          Details
                        </Link>

                        {user && (
                          <button
                            className="btn"
                            style={{ padding: '8px 12px', fontSize: 12, background: '#7c5cff', color: '#fff' }}
                            onClick={() => {
                              addToWatchlist(m.title)
                              alert(`${m.title} added to Watchlist!`)
                            }}
                          >
                            + Watchlist
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ──────────────── LOG MODAL (POPUP) ──────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div className="auth-card" style={{ maxWidth: '450px', width: '90%', textAlign: 'left', position: 'relative' }}>
            
            {/* Kapat Tuşu */}
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', right: 20, top: 20, background: 'transparent', border: 'none', color: '#a7b6cc', cursor: 'pointer', fontSize: '18px' }}
            >✕</button>

            <h2 className="auth-title" style={{ fontSize: '22px', marginBottom: '20px' }}>Log a Movie</h2>

            {/* Sekmeler */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #2c3440', paddingBottom: '10px' }}>
              
              <button 
                onClick={() => setActiveTab('log')}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px',
                  color: activeTab === 'log' ? '#7c5cff' : '#a7b6cc',
                  fontWeight: activeTab === 'log' ? 'bold' : 'normal',
                  padding: 0
                }}
              >
                Add to History
              </button>
              
              <button 
                onClick={() => setActiveTab('watchlist')}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px',
                  color: activeTab === 'watchlist' ? '#7c5cff' : '#a7b6cc',
                  fontWeight: activeTab === 'watchlist' ? 'bold' : 'normal',
                  padding: 0
                }}
              >
                Add to Watchlist
              </button>
              
              
            </div>

            <form onSubmit={handleSave} className="auth-form">
              {/* Film Adı */}
              <div>
                <label style={{color:'#a7b6cc', fontSize:'12px', display:'block', marginBottom:'5px'}}>NAME OF FILM</label>
                <input 
                  type="text" className="auth-input" placeholder="Enter movie title..." 
                  value={movieName} onChange={e => setMovieName(e.target.value)} autoFocus
                />
              </div>

              {/* Sadece LOG sekmesi seçiliyse gösterilecek alanlar */}
              {activeTab === 'log' && (
                <>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                       <label style={{color:'#a7b6cc', fontSize:'12px', display:'block', marginBottom:'5px'}}>DATE</label>
                       <input 
                         type="date" className="auth-input" 
                         value={watchDate} onChange={e => setWatchDate(e.target.value)}
                       />
                    </div>
                    
                    {/* YILDIZLI PUANLAMA ALANI */}
                    <div style={{ flex: 1 }}>
                       <label style={{color:'#a7b6cc', fontSize:'12px', display:'block', marginBottom:'5px'}}>RATING</label>
                       <div style={{ display: 'flex', gap: '5px', height: '42px', alignItems: 'center' }}>
                         {[1, 2, 3, 4, 5].map((star) => (
                           <span
                             key={star}
                             onClick={() => setRating(star)}
                             onMouseEnter={() => setHoverRating(star)}
                             onMouseLeave={() => setHoverRating(0)}
                             style={{
                               cursor: 'pointer',
                               fontSize: '24px',
                               // Eğer mouse üstündeyse (hover) veya kalıcı olarak seçildiyse (rating) Mor olsun
                               color: (hoverRating || rating) >= star ? '#7c5cff' : '#2c3440',
                               transition: 'color 0.2s'
                             }}
                           >
                             ★
                           </span>
                         ))}
                       </div>
                    </div>
                  </div>

                  <div>
                    <label style={{color:'#a7b6cc', fontSize:'12px', display:'block', marginBottom:'5px'}}>REVIEW</label>
                    <textarea 
                      className="auth-input" rows="3" placeholder="Add a review..." 
                      style={{ resize: 'none' }}
                      value={review} onChange={e => setReview(e.target.value)}
                    />
                  </div>
                </>
              )}

              <button 
                type="submit" className="btn"
                style={{ 
                  marginTop: '15px', width: '100%', 
                  background: '#7c5cff',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(124, 92, 255, 0.4)'
                }}
              >
                {activeTab === 'watchlist' ? 'Add to Watchlist' : 'Save to Diary'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}