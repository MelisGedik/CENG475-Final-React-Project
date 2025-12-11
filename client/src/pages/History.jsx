import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import api from '../api'
import HistoryCard from '../components/HistoryCard'
import SkeletonCard from '../components/SkeletonCard'
import Button from '../ui/Button'

export default function History() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/history', { params: { limit: 50 } })
      setItems(data)
    } finally { setLoading(false) }
  }

  if (!user) return <p className="center">Please login to see your history.</p>

  return (
    <div>
      <div className="section-head"><h2>Your History</h2>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>
      {loading ? (
        <div className="grid">{Array.from({length:12}).map((_,i) => <SkeletonCard key={i} />)}</div>
      ) : items.length === 0 ? (
        <p className="center">No ratings yet. Rate some movies to build your history.</p>
      ) : (
        <div className="grid">
          {items.map(m => <HistoryCard key={`h-${m.id}-${m.rated_at}`} movie={m} />)}
        </div>
      )}
    </div>
  )
}
