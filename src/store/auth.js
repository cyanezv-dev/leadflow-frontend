import { create } from 'zustand'
import api from '@/utils/api'

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('lf_token'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('lf_token', data.token)
      set({ user: data.user, token: data.token, loading: false })
      return true
    } catch (err) {
      set({ error: err.message, loading: false })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('lf_token')
    set({ user: null, token: null })
  },

  setUser: (user) => set({ user }),
}))
