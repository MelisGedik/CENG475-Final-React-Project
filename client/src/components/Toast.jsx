import { useEffect } from 'react'

export default function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onClose?.(), 3000)
    return () => clearTimeout(t)
  }, [message])
  if (!message) return null
  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">{message}</div>
  )
}
