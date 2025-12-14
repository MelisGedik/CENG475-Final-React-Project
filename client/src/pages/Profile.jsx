import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

// İki resmi de import ediyoruz
import heroBgDark from '../assets/hero-bg.jpg'
import heroBgLight from '../assets/hero-bg-light.jpg'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Mevcut temayı hafızadan kontrol et
  const currentTheme = localStorage.getItem('siteTheme') || 'dark'
  
  // Temaya göre resim seç
  const bgImage = currentTheme === 'light' ? heroBgLight : heroBgDark

  if (!user) return null

  return (
    <div 
      className="auth-page" 
      style={{ backgroundImage: `url(${bgImage})` }} // Seçilen resmi kullan
    >
      <div className="auth-overlay" />

      {/* Profil Kartı */}
      <div className="auth-card" style={{ maxWidth: '500px', textAlign: 'left' }}>
        
        {/* Üst Kısım: Başlık ve Kapat */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
           <h2 className="auth-title" style={{ margin: 0, fontSize: '24px' }}>My Profile</h2>
           <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#a7b6cc', cursor: 'pointer', fontSize: '14px' }}>
             ✕ Close
           </button>
        </div>

        {/* Avatar ve İsim */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #243557' }}>
          <div style={{
            width: '70px', height: '70px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c5cff, #22d3ee)', 
            color: '#fff', fontSize: '28px', fontWeight: 'bold',
            display: 'grid', placeItems: 'center', boxShadow: '0 4px 15px rgba(124, 92, 255, 0.4)'
          }}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h3 className="auth-title" style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{user.name}</h3>
            <span className="auth-subtitle">Movie Fanatic</span>
          </div>
        </div>

        {/* Detaylar */}
        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', color: '#7c5cff', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>EMAIL ADDRESS</label>
            <div className="auth-input" style={{ padding: '12px' }}>
              {user.email}
            </div>
          </div>
          
          <div>
             <label style={{ display: 'block', color: '#7c5cff', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>MEMBERSHIP</label>
             <div className="auth-input" style={{ padding: '12px' }}>
               Standard User
             </div>
          </div>
        </div>

        {/* Çıkış Butonu */}
        <button 
          onClick={() => { logout(); navigate('/'); }}
          className="btn btn-outline" 
          style={{ width: '100%', marginTop: '30px', borderColor: '#ef4444', color: '#ef4444' }}
        >
          Sign Out
        </button>

      </div>
    </div>
  )
}