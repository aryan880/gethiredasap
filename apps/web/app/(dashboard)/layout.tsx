'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BriefcaseBusiness,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import styles from './dashboard-shell.module.css'

function tokenAppearsCurrent(token: string) {
  try {
    const segment = token.split('.')[1]
    const padded = `${segment.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (segment.length % 4)) % 4)}`
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

const links = [
  { href: '/dashboard', label: 'Command Center', shortLabel: 'Feed', icon: LayoutDashboard },
  { href: '/top', label: 'Top Matches', shortLabel: 'Top', icon: Trophy },
  { href: '/job-hunter', label: 'Job Hunter', shortLabel: 'Hunter', icon: Radar },
  { href: '/saved-searches', label: 'Saved Searches', shortLabel: 'Searches', icon: Search },
  { href: '/application-studio', label: 'Application Studio', shortLabel: 'Studio', icon: BriefcaseBusiness },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
]

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, clearAuth } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const initialPathRef = useRef(pathname)

  useEffect(() => {
    function closeProfile(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeProfile)
    return () => document.removeEventListener('mousedown', closeProfile)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    async function verifySession() {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        clearAuth()
        router.replace(`/login?next=${encodeURIComponent(initialPathRef.current)}`)
        return
      }

      const storedUser = useAuthStore.getState().user
      if (storedUser && tokenAppearsCurrent(token)) setAuthChecked(true)

      try {
        const response = await api.get('/auth/me')
        if (cancelled) return
        useAuthStore.getState().setAuth(response.data.user, token)
        setAuthChecked(true)
      } catch {
        if (cancelled) return
        clearAuth()
        router.replace(`/login?next=${encodeURIComponent(initialPathRef.current)}`)
      }
    }

    verifySession()
    return () => {
      cancelled = true
    }
  }, [clearAuth, router])

  function handleLogout() {
    logout()
    router.push('/login')
  }

  if (!authChecked) {
    return (
      <div className={styles.sessionScreen}>
        <div className={styles.sessionPulse} />
        Verifying session
      </div>
    )
  }

  const initial = user?.name?.charAt(0).toUpperCase() || '?'
  const tier = user?.tier || 'FREE'

  const navLinks = (mobile = false) => links.map(link => {
    const active = isActiveRoute(pathname, link.href)
    const Icon = link.icon
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`${styles.navLink} ${active ? styles.navLinkActive : ''} ${mobile ? styles.mobileNavLink : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <Icon size={18} strokeWidth={1.8} />
        <span>{link.label}</span>
        {active && <span className={styles.activeMarker} />}
      </Link>
    )
  })

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark}><Sparkles size={16} /></span>
          <span>
            <strong>GetHiredASAP</strong>
            <small>Career command center</small>
          </span>
        </Link>

        <div className={styles.liveStatus}>
          <span className={user?.isActive ? styles.liveDot : styles.pausedDot} />
          <span>{user?.isActive ? 'Services connected' : 'Account paused'}</span>
        </div>

        <nav className={styles.nav} aria-label="Primary navigation">
          <div className={styles.navLabel}>Workspace</div>
          {navLinks()}
        </nav>

        <div className={styles.sidebarFooter} ref={profileRef}>
          {profileOpen && (
            <div className={styles.profileMenu}>
              <div className={styles.profileDetails}>
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>
              <Link href="/settings" onClick={() => setProfileOpen(false)}>
                <Settings size={16} /> Account settings
              </Link>
              <button type="button" onClick={handleLogout}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.profileButton}
            onClick={() => setProfileOpen(value => !value)}
            aria-expanded={profileOpen}
          >
            <span className={styles.avatar}>{initial}</span>
            <span className={styles.profileCopy}>
              <strong>{user?.name || 'Your account'}</strong>
              <small>{tier} plan</small>
            </span>
            <ChevronDown size={16} className={profileOpen ? styles.chevronOpen : ''} />
          </button>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link href="/dashboard" className={styles.mobileBrand}>
          <span className={styles.brandMark}><Sparkles size={15} /></span>
          GetHiredASAP
        </Link>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setMobileOpen(value => !value)}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileOpen && (
        <div className={styles.mobileDrawer}>
          <div className={styles.mobileIdentity}>
            <span className={styles.avatar}>{initial}</span>
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </span>
          </div>
          <nav aria-label="Mobile navigation">{navLinks(true)}</nav>
          <button type="button" className={styles.mobileLogout} onClick={handleLogout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      )}

      <main className={styles.main}>{children}</main>

      <nav className={styles.bottomNav} aria-label="Mobile quick navigation">
        {links.slice(0, 5).map(link => {
          const active = isActiveRoute(pathname, link.href)
          const Icon = link.icon
          return (
            <Link key={link.href} href={link.href} className={active ? styles.bottomLinkActive : styles.bottomLink}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{link.shortLabel}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
