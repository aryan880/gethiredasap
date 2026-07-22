'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      o: Math.random() * 0.35 + 0.05,
    }))
    let frame: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,136,${p.o})`; ctx.fill()
      })
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(0,255,136,${0.05 * (1 - d / 110)})`
          ctx.lineWidth = 0.5; ctx.stroke()
        }
      }))
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

export default function LoginPage() {
  const router  = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [focused,  setFocused]  = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Invalid credentials')
      }
      setAuth(data.user, data.accessToken)
      toast.success('Welcome back')
      router.replace('/dashboard')
    } catch (err: any) {
      toast.error(err?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const inp = (f: string): React.CSSProperties => ({
    width: '100%', background: '#0D0F14',
    border: `1px solid ${focused === f ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '12px', padding: '13px 16px',
    color: '#F0F2F7', fontFamily: 'DM Sans, sans-serif', fontSize: '15px',
    outline: 'none', transition: 'all 0.2s',
    boxShadow: focused === f ? '0 0 0 3px rgba(0,255,136,0.07)' : 'none',
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#07080C;font-family:'DM Sans',sans-serif;}
        @keyframes pulseAnim{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.65);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        ::selection{background:rgba(0,255,136,0.2);color:#00FF88;}
        input:-webkit-autofill,input:-webkit-autofill:focus{
          -webkit-box-shadow:0 0 0 100px #0D0F14 inset !important;
          -webkit-text-fill-color:#F0F2F7 !important;
          caret-color:#00FF88 !important;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#07080C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>

        <Particles />

        {/* Ambient orbs */}
        <div style={{ position: 'fixed', top: '-200px', right: '-200px', width: '600px', height: '600px', borderRadius: '50%', background: 'rgba(0,255,136,0.04)', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: '-150px', left: '-150px', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(59,130,246,0.025)', filter: 'blur(110px)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: '420px',
          background: 'rgba(13,15,20,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px', padding: '44px 40px',
          position: 'relative', zIndex: 1,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,136,0.04)',
          animation: 'fadeUp 0.5s ease both',
        }}>
          {/* Top accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', borderRadius: '24px 24px 0 0', background: 'linear-gradient(90deg,transparent,rgba(0,255,136,0.4),transparent)' }} />

          {/* Logo */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', textDecoration: 'none', marginBottom: '36px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 7px #00FF88', animation: 'pulseAnim 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '14px', color: '#F0F2F7' }}>GetHiredASAP</span>
          </Link>

          {/* Heading */}
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00FF88', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>// welcome back</p>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '34px', fontWeight: 700, color: '#F0F2F7', letterSpacing: '-0.5px', marginBottom: '6px', lineHeight: 1.1 }}>Sign in</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '32px' }}>
            No account?{' '}
            <Link href="/register" style={{ color: '#00FF88', textDecoration: 'none', fontWeight: 500 }}>
              Create one →
            </Link>
          </p>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: focused === 'email' ? '#00FF88' : '#6B7280', marginBottom: '7px', transition: 'color 0.2s' }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                placeholder="you@example.com" required autoComplete="email"
                style={inp('email')} />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: focused === 'pass' ? '#00FF88' : '#6B7280', marginBottom: '7px', transition: 'color 0.2s' }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('pass')} onBlur={() => setFocused(null)}
                placeholder="••••••••" required autoComplete="current-password"
                style={inp('pass')} />
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: '12px', marginTop: '6px',
              background: loading ? 'rgba(0,255,136,0.45)' : '#00FF88',
              color: '#07080C', fontFamily: 'DM Sans, sans-serif',
              fontWeight: 700, fontSize: '15px', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#00FFAA'; e.currentTarget.style.boxShadow = '0 0 28px rgba(0,255,136,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = loading ? 'rgba(0,255,136,0.45)' : '#00FF88'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <p style={{ marginTop: '28px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#374151', letterSpacing: '1.5px', textAlign: 'center' }}>
            SECURED · ENCRYPTED · NO ADS
          </p>
        </div>
      </div>
    </>
  )
}
