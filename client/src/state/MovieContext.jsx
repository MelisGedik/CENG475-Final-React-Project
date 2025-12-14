import React, { createContext, useContext, useState, useEffect } from 'react'

const MovieContext = createContext()

// Başlangıç için sahte veriler (Boş görünmesin diye)
const initialWatchlist = [
  { id: 101, title: "Dune: Part Two", year: "2024", poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" },
  { id: 102, title: "Oppenheimer", year: "2023", poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" }
]

const initialHistory = [
  { id: 201, title: "The Matrix", rating: 5, date: "2023-10-12", review: "Masterpiece.", poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg" },
  { id: 202, title: "Inception", rating: 4.5, date: "2023-09-10", review: "Mind blowing.", poster: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg" }
]

export function MovieProvider({ children }) {
  // localStorage'dan veriyi çek, yoksa sahte verileri kullan
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('myWatchlist')
    return saved ? JSON.parse(saved) : initialWatchlist
  })

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('myHistory')
    return saved ? JSON.parse(saved) : initialHistory
  })

  // Veri değiştikçe kaydet
  useEffect(() => {
    localStorage.setItem('myWatchlist', JSON.stringify(watchlist))
    localStorage.setItem('myHistory', JSON.stringify(history))
  }, [watchlist, history])

  // WATCHLIST'E EKLEME
  const addToWatchlist = (movieTitle) => {
    const newMovie = {
      id: Date.now(),
      title: movieTitle,
      year: new Date().getFullYear().toString(),
      poster: "https://via.placeholder.com/300x450/1f2b55/ffffff?text=No+Poster" // API olmadığı için placeholder
    }
    setWatchlist([newMovie, ...watchlist])
  }

  // HISTORY'YE (GÜNLÜĞE) EKLEME
  const addToHistory = (movieTitle, rating, review, date) => {
    const newMovie = {
      id: Date.now(),
      title: movieTitle,
      rating: parseFloat(rating),
      review: review,
      date: date || new Date().toISOString().split('T')[0],
      poster: "https://via.placeholder.com/300x450/1f2b55/ffffff?text=" + movieTitle.replace(" ", "+")
    }
    setHistory([newMovie, ...history])
  }

  return (
    <MovieContext.Provider value={{ watchlist, history, addToWatchlist, addToHistory }}>
      {children}
    </MovieContext.Provider>
  )
}

export const useMovies = () => useContext(MovieContext)