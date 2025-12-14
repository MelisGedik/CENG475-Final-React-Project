import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMovies } from '../state/MovieContext' // Context'i çek

export default function Watchlist() {
  const navigate = useNavigate()
  const { watchlist } = useMovies() // Canlı veriyi al

  return (
    <div className="container">
      <button onClick={() => navigate(-1)} className="back-btn">← Back to Home</button>

      <div className="page-header">
        <h2 style={{ color: '#fff', margin: 0, fontSize: '24px' }}>My Watchlist</h2>
        <span style={{ color: '#6d7f97', fontSize: '14px' }}>{watchlist.length} films to watch</span>
      </div>

      <div className="poster-grid">
        {watchlist.map((movie) => (
          <div key={movie.id} className="poster-card">
            <div className="poster-image" style={{ backgroundImage: `url(${movie.poster})` }} />
            <div className="poster-info">
              <div className="poster-title">{movie.title}</div>
              <div className="poster-meta">{movie.year}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}