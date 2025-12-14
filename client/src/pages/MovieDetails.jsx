import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import api from "../api"
import { useAuth } from "../state/AuthContext"
import { useMovies } from "../state/MovieContext"

export default function MovieDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { addToWatchlist } = useMovies()

  const [movie, setMovie] = useState(null)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        setErr(null)

        const [mRes, rRes] = await Promise.all([
          api.get(`/api/movies/${id}`),
          api.get(`/api/movies/${id}/ratings`)
        ])

        if (!alive) return
        setMovie(mRes.data)
        setRatings(Array.isArray(rRes.data) ? rRes.data : [])
      } catch (e) {
        if (!alive) return
        setErr("Movie details could not be loaded.")
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [id])

  if (loading) {
    return <div style={{ padding: 24, color: "#a7b6cc" }}>Loading...</div>
  }

  if (err) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,0,0,0.08)", color: "#ffb4b4" }}>
          {err}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link to="/" className="btn btn-outline">Back Home</Link>
        </div>
      </div>
    )
  }

  if (!movie) return null

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ width: "min(1100px, 92%)", margin: "0 auto" }}>
        <Link to="/" className="btn btn-outline" style={{ marginBottom: 16 }}>
          ← Back
        </Link>

        <div style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 18,
          alignItems: "start"
        }}>
          <div style={{
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <div style={{ aspectRatio: "2 / 3", background: "#10131a" }}>
              <img
                src={movie.poster_url || "https://picsum.photos/seed/fallbackdetails/600/900"}
                alt={movie.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>

          <div style={{
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>{movie.title}</h1>

            <div style={{ marginTop: 8, color: "#a7b6cc" }}>
              {movie.genre} • {movie.release_year} • ⭐ {Number(movie.avg_rating || 0).toFixed(1)}
            </div>

            {movie.genres?.length ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {movie.genres.map((t) => (
                  <span key={t} style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(124,92,255,0.12)",
                    border: "1px solid rgba(124,92,255,0.25)",
                    color: "#c9bcff"
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            <p style={{ marginTop: 14, lineHeight: 1.6, color: "#d7e0ef" }}>
              {movie.description}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {user && (
                <button
                  className="btn"
                  style={{ background: "#7c5cff", color: "#fff" }}
                  onClick={() => addToWatchlist(movie.title)}
                >
                  + Watchlist
                </button>
              )}
              <Link to="/" className="btn btn-outline">Home</Link>
            </div>

            <div style={{ marginTop: 22 }}>
              <h3 style={{ margin: "0 0 10px 0" }}>Recent Reviews</h3>

              {ratings.length === 0 ? (
                <div style={{ color: "#a7b6cc" }}>No reviews yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {ratings.slice(0, 8).map((r) => (
                    <div key={r.id} style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>{r.user_name || `User #${r.user_id}`}</div>
                        <div style={{ color: "#a7b6cc" }}>⭐ {r.rating}</div>
                      </div>
                      {r.review ? (
                        <div style={{ marginTop: 8, color: "#d7e0ef" }}>{r.review}</div>
                      ) : null}
                      <div style={{ marginTop: 8, fontSize: 12, color: "#7f91aa" }}>
                        {String(r.created_at || "")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
