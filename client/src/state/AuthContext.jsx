import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  // Sayfa yenilenince giriş gitmesin diye localStorage kontrolü yapıyoruz
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  // LOGIN FONKSİYONU
  const login = async (email, password) => {
    try {
      // Sunucuya istek at
      const res = await api.post('/login', { email, password })

      // Gelen veriyi kaydet
      const { user, token } = res.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      // State'i güncelle (Bu sayede menüler değişecek)
      setUser(user)
      return true
    } catch (error) {
      console.error("Login hatası:", error)
      throw error
    }
  }

  // REGISTER FONKSİYONU
  const register = async (name, email, password) => {
    try {
      const res = await api.post('/register', { name, email, password })
      const { user, token } = res.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
      return true
    } catch (error) {
      console.error("Register hatası:", error)
      throw error
    }
  }

  // LOGOUT FONKSİYONU
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // UPDATE USER LOCAL (Profil güncellenince)
  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)