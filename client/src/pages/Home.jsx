import { useEffect, useState } from 'react'
import api from '../api'
import MovieCard from '../components/MovieCard'
import { useAuth } from '../state/AuthContext'
import SkeletonCard from '../components/SkeletonCard'
import Hero from '../components/Hero'
import Button from '../ui/Button'
import { Input, Select } from '../ui/Input'

export default function Home() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('')
  const [minRating, setMinRating] = useState('')
  const [year, setYear] = useState('')
  const [sort, setSort] = useState('rating_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [total, setTotal] = useState(0)
  const [recs, setRecs] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [liveResults, setLiveResults] = useState([])
  const [liveSearching, setLiveSearching] = useState(false)
  const [activeQuery, setActiveQuery] = useState('')
  const { user } = useAuth()

  async function fetchMovies(params = {}) {
    setLoading(true)
    try {
      const { data } = await api.get('/api/movies/search', { params })
      setMovies(data.items || data)
      setTotal(data.total || (data.items ? data.items.length : (data.length || 0)))
      if (data.page) setPage(data.page)
      if (data.pageSize) setPageSize(data.pageSize)
    } finally { setLoading(false) }
  }

  async function fetchRecs() {
    if (!user) { setRecs([]); return }
    try {
      const { data } = await api.get('/api/recommendations/advanced').catch(async () => (await api.get('/api/recommendations')).data)
      setRecs(data)
    } catch {}
  }

  useEffect(() => { fetchMovies({ page, page_size: pageSize, sort }) }, [page, pageSize, sort])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [page])
  useEffect(() => { fetchRecs() }, [user])

  async function submitFilters(e) {
    e.preventDefault()
    setPage(1)
    await runSearch()
    fetchMovies({ q: q || undefined, genre: genre || undefined, min_rating: minRating || undefined, year: year || undefined, page: 1, page_size: pageSize, sort })
  }

  function clearFilters() {
    setGenre(''); setMinRating(''); setYear(''); setSort('rating_desc'); setPage(1)
    fetchMovies({ page: 1, page_size: pageSize, sort: 'rating_desc' })
  }

  // Live search while typing (debounced)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2 || term === activeQuery) { setLiveResults([]); return }
    setLiveSearching(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/movies/suggest', { params: { q: term } })
        setLiveResults(data || [])
      } catch { setLiveResults([]) }
      finally { setLiveSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, activeQuery])

  async function runSearch() {
    const term = q.trim()
    if (!term) return
    setSearching(true)
    try {
      const { data } = await api.get('/api/movies/search', { params: { q: term, page: 1, page_size: 24, title_only: 1 } })
      setSearchResults(data.items || [])
      setActiveQuery(term)
      setLiveResults([])
    } finally { setSearching(false) }
  }

  function clearSearch() {
    setActiveQuery('')
    setSearchResults([])
    setLiveResults([])
    setQ('')
  }

  return (
    <div className="home">
      <Hero query={q} onQueryChange={setQ} onSearch={() => runSearch()} />

      {(activeQuery || q.trim().length >= 2) && (
        <div className="search-meta">
          {activeQuery ? (
            <div className="search-chip">Search: <strong>"{activeQuery}"</strong>
              <button className="chip-x" onClick={clearSearch} aria-label="Clear search">x</button>
            </div>
          ) : (
            <div className="search-chip muted">Typing: "{q.trim()}"</div>
          )}
        </div>
      )}

      <section className="toolbar">
        <form className="toolbar-form" onSubmit={submitFilters}>
          <Select label="Genre" value={genre} onChange={e => setGenre(e.target.value)}>
            <option value="">All genres</option>
            <option>Action</option>
            <option>Adventure</option>
            <option>Animation</option>
            <option>Comedy</option>
            <option>Crime</option>
            <option>Drama</option>
            <option>Fantasy</option>
            <option>Romance</option>
            <option>Sci-Fi</option>
            <option>Thriller</option>
          </Select>
          <Select label="Min Rating" value={minRating} onChange={e => setMinRating(e.target.value)}>
            <option value="">Any</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
          </Select>
          <Input label="Year" type="number" value={year} onChange={e => setYear(e.target.value)} />
          <Select label="Sort" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="rating_desc">Top rated</option>
            <option value="rating_asc">Lowest rated</option>
            <option value="year_desc">Newest</option>
            <option value="year_asc">Oldest</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
          </Select>
          <Button type="submit" variant="secondary" disabled={loading}>Apply</Button>
          <Button type="button" variant="outline" onClick={clearFilters}>Clear</Button>
        </form>
      </section>

      {(q.trim().length >= 2 && !activeQuery && liveResults.length > 0) && (
        <section>
          <div className="section-head"><h2>Results</h2>{liveSearching && <span className="muted"> Searching...</span>}</div>
          <div className="grid">
            {liveResults.map(m => <MovieCard key={`live-${m.id}`} movie={m} />)}
          </div>
        </section>
      )}

      {(activeQuery && (searchResults.length >= 0)) && (
        <section>
          <div className="section-head"><h2>Search Results</h2>{searching && <span className="muted"> Loading...</span>}</div>
          {searchResults.length === 0 && !searching ? <p className="muted">No matches for "{activeQuery}"</p> : (
            <div className="grid">
              {searchResults.map(m => <MovieCard key={`q-${m.id}`} movie={m} />)}
            </div>
          )}
        </section>
      )}

      {user && recs.length > 0 && (
        <section>
          <h2>Recommended For You</h2>
          <div className="grid">
            {recs.map(m => <MovieCard key={m.id} movie={m} />)}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Movies</h2>
        </div>
        {loading ? (
          <div className="grid">
            {Array.from({ length: pageSize }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid">
              {movies.map(m => <MovieCard key={m.id} movie={m} />)}
            </div>
            <div className="pager">
              <Button variant="outline" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</Button>
              <span className="muted">Page {page} / {Math.max(1, Math.ceil(total / pageSize) || 1)}</span>
              <Button variant="outline" disabled={page>=Math.ceil(total / pageSize)} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
