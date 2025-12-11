import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  async function login(email, password) {
    setLoading(true); setError(null)
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      setUser(data.user)
      return true
    } catch (e) {
      setError(e.response?.data?.error || 'Login failed')
      return false
    } finally { setLoading(false) }
  }

  async function register(payload) {
    setLoading(true); setError(null)
    try {
      const { data } = await api.post('/api/auth/register', payload)
      localStorage.setItem('token', data.token)
      setUser(data.user)
      return true
    } catch (e) {
      setError(e.response?.data?.error || 'Registration failed')
      return false
    } finally { setLoading(false) }
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  const value = { user, loading, error, login, register, logout, setError }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}

