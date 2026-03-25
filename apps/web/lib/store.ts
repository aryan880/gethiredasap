import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id:             string
  email:          string
  name:           string
  tier:           string
  threshold:      number
  intervalMinutes:number
  isActive:       boolean
  resumeText:     string | null
}

interface AuthStore {
  user:         User | null
  accessToken:  string | null
  isLoggedIn:   boolean
  setAuth:      (user: User, token: string) => void
  updateUser:   (user: Partial<User>) => void
  logout:       () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:        null,
      accessToken: null,
      isLoggedIn:  false,

      setAuth: (user, accessToken) => {
        localStorage.setItem('accessToken', accessToken)
        set({ user, accessToken, isLoggedIn: true })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, accessToken: null, isLoggedIn: false })
      },
    }),
    { name: 'auth-storage' }
  )
)