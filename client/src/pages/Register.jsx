import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import Toast from '../components/Toast'
import Button from '../ui/Button'
import { Input } from '../ui/Input'

export default function Register() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()
  const { register, error, setError, loading } = useAuth()

  function validate() {
    const er = {}
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = 'Enter a valid email'
    if (!name || name.trim().length < 2) er.name = 'Name must be at least 2 characters'
    if (!password || password.length < 6) er.password = 'Password must be at least 6 characters'
    if (password !== confirm) er.confirm = 'Passwords do not match'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const ok = await register({ email: email.trim(), name: name.trim(), password })
    if (ok) navigate('/')
  }

  return (
    <div className="auth auth--center">
      <div className="auth-card ui-card">
        <h2 className="auth-title">Create account</h2>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={errors.name} />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />
          <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} error={errors.confirm} />
          <Button type="submit" disabled={loading}>Create account</Button>
        </form>
        <p className="muted">Already have an account? <Link to="/login">Login</Link></p>
      </div>
      <Toast message={error} onClose={() => setError(null)} />
    </div>
  )
}
