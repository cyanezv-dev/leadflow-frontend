import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Button, Input } from '@/components/ui'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate('/')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>⚡</div>
          <h1 className={styles.logoText}>LeadFlow</h1>
        </div>

        <p className={styles.subtitle}>Ingresa a tu cuenta</p>

        <form onSubmit={submit} className={styles.form}>
          <Input
            label="Email"
            type="email"
            placeholder="Ingresa tu email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" loading={loading} disabled={!email || !password} className={styles.submitBtn}>
            Ingresar →
          </Button>
        </form>

        <div className={styles.hint}>
        </div>
      </div>
    </div>
  )
}
