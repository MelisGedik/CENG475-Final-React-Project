export default function StarRating({ value = 0, onChange }) {
  const stars = [1,2,3,4,5]
  function onKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange?.(Math.min(5, (value||0) + 1)) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange?.(Math.max(1, (value||0) - 1)) }
  }
  return (
    <div className="stars" role="radiogroup" aria-label="Rating" onKeyDown={onKeyDown}>
      {stars.map(n => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star`}
          role="radio"
          aria-checked={n === value}
          tabIndex={n === value ? 0 : -1}
          className={n <= value ? 'star active' : 'star'}
          onClick={() => onChange?.(n)}
        >★</button>
      ))}
    </div>
  )
}
