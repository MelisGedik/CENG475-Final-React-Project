import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Toast from '../components/Toast'
import Button from '../ui/Button'
import { Input } from '../ui/Input'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [me, setMe] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data } = await api.get('/api/me')
        if (!mounted) return
        setMe(data)
      } catch (e) {
        if (!mounted) return
        const status = e?.response?.status
        if (status === 401) {
          setMsg('Session expired. Please login again.')
          logout()
          navigate('/login', { replace: true })
          return
        }
        // Fallback to known user info so page still renders
        setMsg(e?.response?.data?.error || 'Failed to load profile')
        if (user) setMe(user)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [logout, navigate, user])

  if (loading) return <p>Loading...</p>
  return (
    <div>
      <h2>Profile</h2>
      <div className="ui-card">
        <p><strong>Name:</strong> {me.name}</p>
        <p><strong>Email:</strong> {me.email}</p>
        <p><strong>Role:</strong> {me.role}</p>
        {me.created_at && (
          <p><strong>Joined:</strong> {new Date(me.created_at + 'Z').toLocaleString()}</p>
        )}
      </div>

      <h3>Change Password</h3>
      <form className="ui-card" onSubmit={async (e) => {
        e.preventDefault()
        if (!currentPassword || !newPassword) { setMsg('Please fill all fields'); return }
        if (newPassword.length < 6) { setMsg('New password must be at least 6 characters'); return }
        if (newPassword !== confirm) { setMsg('Passwords do not match'); return }
        try {
          await api.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword })
          setMsg('Password updated')
          setCurrentPassword(''); setNewPassword(''); setConfirm('')
        } catch (e) {
          setMsg(e.response?.data?.error || 'Failed to change password')
        }
      }}>
        <Input label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        <Input label="Confirm New Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        <Button type="submit">Update Password</Button>
      </form>
      <Toast message={msg} type="info" onClose={() => setMsg(null)} />
    </div>
  )
}
