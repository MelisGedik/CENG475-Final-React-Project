import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import StarRating from '../components/StarRating'
import MovieCard from '../components/MovieCard'
import { useAuth } from '../state/AuthContext'
import Toast from '../components/Toast'
import Button from '../ui/Button'
import { Textarea } from '../ui/Input'

export default function MovieDetails() {
  const { id } = useParams()
  const [movie, setMovie] = useState(null)
  const [reviews, setReviews] = useState([])
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [message, setMessage] = useState(null)
  const { user } = useAuth()
  const [tags, setTags] = useState([])
  const [stats, setStats] = useState({ 1:0,2:0,3:0,4:0,5:0 })

  async function load() {
    const [{ data: m }, { data: r }, { data: g }, { data: s }] = await Promise.all([
      api.get(`/api/movies/${id}`),
      api.get(`/api/movies/${id}/ratings`),
      api.get(`/api/movies/${id}/genres`).catch(() => ({ data: [] })),
      api.get(`/api/movies/${id}/stats`).catch(() => ({ data: { histogram: {1:0,2:0,3:0,4:0,5:0} } }))
    ])
    setMovie(m)
    setReviews(r)
    setTags(Array.isArray(g) ? g : [])
    setStats((s && s.histogram) ? s.histogram : { 1:0,2:0,3:0,4:0,5:0 })
  }

  useEffect(() => { load() }, [id])

  async function submitRating(e) {
    e.preventDefault()
    if (!user) { setMessage('Please login to rate'); return }
    if (!rating) { setMessage('Please select a rating'); return }
    if (review.length > 500) { setMessage('Review must be <= 500 characters'); return }
    try {
      const { data } = await api.post(`/api/movies/${id}/ratings`, { rating, review })
      setMovie(data.movie)
      setMessage('Your rating was saved')
      const { data: r } = await api.get(`/api/movies/${id}/ratings`)
      setReviews(r)
      // history moved to its own page
    } catch (e) {
      setMessage(e.response?.data?.error || 'Could not save rating')
    }
  }

  async function removeMyRating() {
    try {
      const { data } = await api.delete(`/api/movies/${id}/ratings/me`)
      setMovie(data.movie)
      setMessage('Your rating was removed')
      const { data: r } = await api.get(`/api/movies/${id}/ratings`)
      setReviews(r)
    } catch (e) {
      setMessage(e.response?.data?.error || 'Could not remove rating')
    }
  }

  if (!movie) return <p>Loading...</p>

  return (
    <div className="details">
      <div className="details-hero">
        <img className="cover" src={movie.poster_url} alt={movie.title} />
        <div className="details-info">
          <h2 className="title">{movie.title}</h2>
          <div className="meta">
            <span className="tags">
              {(movie.genres ? String(movie.genres).split(',') : tags).map((t, i) => (
                <span className="chip" key={i}>{t}</span>
              ))}
            </span>
            <span className="pill">{movie.release_year}</span>
            <span className="pill">⭐ {movie.avg_rating?.toFixed(1)}</span>
          </div>
          <p className="desc">{movie.description}</p>
        </div>
      </div>

      <section className="rate">
        <h3>Rate this movie</h3>
        <form onSubmit={submitRating} className="ui-card rate-card">
          <StarRating value={rating} onChange={setRating} />
          <Textarea label="Review (optional)" placeholder="Share your thoughts" value={review} onChange={e => setReview(e.target.value)} maxLength={500} hint={`${review.length}/500`} />
          <div className="row">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={removeMyRating}>Remove My Rating</Button>
          </div>
        </form>
      </section>

      <section>
        <h3>Ratings Overview</h3>
        <div className="ui-card" aria-label="Rating histogram">
          {[5,4,3,2,1].map(st => (
            <div key={st} className="row space-between" style={{marginBottom:6}}>
              <span>{st}★</span>
              <div style={{flex:1, margin:'0 8px', background:'#12203f', borderRadius:8, overflow:'hidden'}}>
                <div style={{height:8, width: `${Math.min(100, (stats[st]||0) / Math.max(1, Object.values(stats).reduce((a,b)=>a+b,0)) * 100)}%`, background:'#ffd166'}} />
              </div>
              <span className="muted">{stats[st]||0}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Reviews</h3>
        {reviews.length === 0 ? <p className="muted">No reviews yet.</p> : (
          <ul className="reviews">
            {reviews.map(r => (
              <li key={r.id} className="ui-card">
                <div className="row space-between">
                  <strong>{r.user_name}</strong>
                  <span>⭐ {r.rating}</span>
                </div>
                {r.review && <p>{r.review}</p>}
                <small className="muted">{new Date(r.created_at + 'Z').toLocaleString()}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Toast message={message} type="info" onClose={() => setMessage(null)} />
    </div>
  )
}
