import { useState, useRef, useEffect } from 'react'
import styles from './ComunaInput.module.css'

export default function ComunaInput({ value, onChange, placeholder = 'Buscar comuna...', className }) {
  const [q, setQ]         = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen]   = useState(false)
  const [dropPos, setDropPos] = useState({top:0,left:0,width:0})
  const ref    = useRef()
  const inputRef = useRef()

  useEffect(() => { setQ(value || '') }, [value])

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updatePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }

  const search = async (val) => {
    setQ(val)
    if (val.length < 2) { setResults([]); setOpen(false); return }
    updatePos()
    const token = localStorage.getItem('lf_token')
    const res = await fetch(`/api/comunas?search=${encodeURIComponent(val)}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    })
    const data = await res.json()
    setResults(data)
    setOpen(true)
  }

  const select = (c) => {
    setQ(c.comuna)
    setOpen(false)
    setResults([])
    onChange(c.comuna, c)
  }

  return (
    <div ref={ref} className={styles.wrap}>
      <input
        ref={inputRef}
        className={className || styles.input}
        value={q}
        onChange={e => search(e.target.value)}
        placeholder={placeholder}
        onFocus={() => { if (q.length >= 2 && results.length) { updatePos(); setOpen(true) } }}
      />
      {open && results.length > 0 && (
        <div className={styles.drop} style={{
          position:'fixed',
          top: dropPos.top,
          left: dropPos.left,
          width: dropPos.width,
          zIndex: 99999
        }}>
          {results.map(c => (
            <div key={c.comuna_codigo} className={styles.item} onMouseDown={e=>{ e.preventDefault(); select(c) }}>
              <span className={styles.comuna}>{c.comuna}</span>
              <span className={styles.region}>{c.region}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
