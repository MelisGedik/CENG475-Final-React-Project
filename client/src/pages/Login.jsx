import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import Toast from '../components/Toast'
import Button from '../ui/Button'
import { Input } from '../ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState(null)
  const navigate = useNavigate()
  const { login, error, setError, loading } = useAuth()

  async function onSubmit(e) {
    e.preventDefault()
    if (!email || !password) { setLocalError('Please enter email and password'); return }
    const ok = await login(email.trim(), password)
    if (ok) navigate('/')
  }

  return (
    <div className="auth auth--center">
      <div className="auth-card ui-card">
        <h2 className="auth-title">Welcome back</h2>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} error={localError && !email ? localError : null} />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} error={localError && !password ? localError : null} />
          <Button type="submit" disabled={loading}>Login</Button>
        </form>
        <p className="muted">Don\'t have an account? <Link to="/register">Register</Link></p>
      </div>
      <Toast message={error} onClose={() => setError(null)} />
    </div>
  )
}
