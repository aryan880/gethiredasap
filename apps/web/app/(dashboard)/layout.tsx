'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useState, useRef, useEffect } from 'react'
import api from '@/lib/api'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, logout, clearAuth } = useAuthStore()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const menuRef   = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)

  function handleLogout() {
    logout()
    router.push('/login')
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) setMobileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    let cancelled = false

    async function verifySession() {
      const token = localStorage.getItem('accessToken')

      if (!token) {
        clearAuth()
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        return
      }

      try {
        const res = await api.get('/auth/me')
        if (cancelled) return
        useAuthStore.getState().setAuth(res.data.user, token)
        setAuthChecked(true)
      } catch {
        if (cancelled) return
        clearAuth()
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      }
    }

    verifySession()

    return () => {
      cancelled = true
    }
  }, [clearAuth, pathname, router])

  const links = [
    { href: '/dashboard', label: 'Feed',     icon: '◈' },
    { href: '/top',       label: 'Top',      icon: '◆' },
    { href: '/job-hunter', label: 'Hunter',  icon: '✦' },
    { href: '/saved-searches', label: 'Searches', icon: '⌕' },
    { href: '/pricing',   label: 'Pricing',  icon: '◇' },
    { href: '/settings',  label: 'Settings', icon: '◉' },
  ]

  const tierColor = user?.tier === 'PREMIUM' ? '#a78bfa' : '#00FF88'
  const initial   = user?.name?.charAt(0).toUpperCase() || '?'

  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#07080C',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6B7280',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        letterSpacing: '1px',
      }}>
        VERIFYING SESSION...
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07080C', position:'relative' }}>
      <style>{`
        @keyframes pulseAnim { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.7);} }
        @keyframes menuIn    { from{opacity:0;transform:translateY(-8px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
        :root {
          --bg:#07080C; --bg2:#0D0F14; --bg3:#13161D;
          --accent:#00FF88; --amber:#F59E0B; --red:#EF4444;
          --text:#F0F2F7; --text2:#C8CDD8; --muted:#4A5568; --muted2:#6B7280;
          --border:rgba(255,255,255,0.06);
        }
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif !important; }

        /* Desktop nav links */
        .nav-links { display: flex; }
        .nav-status { display: flex; }
        .hamburger  { display: none; }

        /* Mobile nav drawer */
        .mobile-drawer { display: none; }

        @media (max-width: 768px) {
          .nav-links  { display: none !important; }
          .nav-status { display: none !important; }
          .hamburger  { display: flex !important; }
          .mobile-drawer { display: block !important; }
          .main-content { padding: 72px 16px 80px !important; }
        }

        /* Bottom tab bar on mobile */
        .bottom-tabs {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 60px;
          background: rgba(13,15,20,0.97);
          border-top: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(20px);
          z-index: 200;
          justify-content: space-around;
          align-items: center;
          padding: 0 8px;
        }
        @media (max-width: 768px) {
          .bottom-tabs { display: flex !important; }
        }

        /* Stat grid responsive */
        @media (max-width: 640px) {
          .stat-grid { grid-template-columns: repeat(2,1fr) !important; }
          .filter-row { flex-wrap: wrap !important; }
          .filter-row button { font-size: 10px !important; padding: 6px 10px !important; }
        }
      `}</style>

      {/* Subtle bg */}
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(0,255,136,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.01) 1px,transparent 1px)`,backgroundSize:'56px 56px',opacity:0.5 }} />
      <div style={{ position:'fixed',top:-200,right:-200,width:600,height:600,borderRadius:'50%',background:'rgba(0,255,136,0.02)',filter:'blur(120px)',pointerEvents:'none',zIndex:0 }} />

      {/* ── NAV ── */}
      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:100,height:'60px',background:'rgba(7,8,12,0.92)',backdropFilter:'blur(28px)',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:'1280px',margin:'0 auto',padding:'0 20px',height:'100%',display:'flex',alignItems:'center',justifyContent:'space-between' }}>

          {/* Logo */}
          <Link href="/dashboard" style={{ display:'flex',alignItems:'center',gap:'9px',textDecoration:'none' }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 7px #00FF88',animation:'pulseAnim 2s ease-in-out infinite' }} />
            <span style={{ fontFamily:'JetBrains Mono, monospace',fontWeight:700,fontSize:'14px',color:'#F0F2F7' }}>GetHiredASAP</span>
          </Link>

          {/* Desktop nav links */}
          <div className="nav-links" style={{ gap:'2px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'12px',padding:'4px' }}>
            {links.map(l => {
              const active = pathname === l.href
              return (
                <Link key={l.href} href={l.href} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'7px 16px',borderRadius:'8px',fontFamily:'DM Sans, sans-serif',fontSize:'14px',fontWeight:active?600:400,color:active?'#00FF88':'#6B7280',textDecoration:'none',background:active?'rgba(0,255,136,0.08)':'transparent',border:active?'1px solid rgba(0,255,136,0.15)':'1px solid transparent',transition:'all 0.18s' }}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.color='#C8CDD8';e.currentTarget.style.background='rgba(255,255,255,0.04)'}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.color='#6B7280';e.currentTarget.style.background='transparent'}}}
                >
                  {l.label}
                  {active && <div style={{ width:4,height:4,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 4px #00FF88' }} />}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>

            {/* Status + tier pill — desktop only */}
            <div className="nav-status" style={{ alignItems:'center',gap:'0',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',overflow:'hidden' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'6px',padding:'7px 13px',borderRight:user?.tier&&user.tier!=='FREE'?'1px solid rgba(255,255,255,0.06)':'none' }}>
                <div style={{ width:6,height:6,borderRadius:'50%',flexShrink:0,background:user?.isActive?'#00FF88':'#4A5568',boxShadow:user?.isActive?'0 0 6px rgba(0,255,136,0.8)':'none',animation:user?.isActive?'pulseAnim 2s ease-in-out infinite':'none' }} />
                <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:user?.isActive?'rgba(0,255,136,0.8)':'#4A5568',letterSpacing:'1px' }}>
                  {user?.isActive?'LIVE':'PAUSED'}
                </span>
              </div>
              {user?.tier && user.tier !== 'FREE' && (
                <div style={{ padding:'7px 13px',fontFamily:'JetBrains Mono, monospace',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:tierColor }}>{user.tier}</div>
              )}
            </div>

            {/* Avatar + dropdown — desktop */}
            <div ref={menuRef} style={{ position:'relative' }} className="nav-status">
              <button onClick={()=>setMenuOpen(!menuOpen)} style={{ width:'36px',height:'36px',borderRadius:'50%',background:menuOpen?`${tierColor}20`:`${tierColor}10`,border:`1.5px solid ${menuOpen?`${tierColor}50`:`${tierColor}25`}`,color:tierColor,fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'15px',cursor:'pointer',transition:'all 0.18s',display:'flex',alignItems:'center',justifyContent:'center' }}>
                {initial}
              </button>
              {menuOpen && (
                <div style={{ position:'absolute',top:'calc(100% + 10px)',right:0,width:'250px',background:'#0D0F14',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',boxShadow:'0 24px 64px rgba(0,0,0,0.7)',overflow:'hidden',animation:'menuIn 0.2s ease both',zIndex:200 }}>
                  <div style={{ padding:'16px 18px',background:'rgba(255,255,255,0.02)',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
                      <div style={{ width:'38px',height:'38px',borderRadius:'50%',background:`${tierColor}15`,border:`1px solid ${tierColor}25`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px',color:tierColor,flexShrink:0 }}>{initial}</div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:'14px',fontWeight:600,color:'#F0F2F7',marginBottom:'1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.name}</p>
                        <p style={{ fontSize:'11px',color:'#6B7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.email}</p>
                      </div>
                    </div>
                    <div style={{ marginTop:'10px' }}>
                      <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',letterSpacing:'1.5px',padding:'3px 10px',borderRadius:'20px',background:`${tierColor}10`,color:tierColor,border:`1px solid ${tierColor}22`,textTransform:'uppercase' }}>
                        {user?.tier||'FREE'} plan
                      </span>
                    </div>
                  </div>
                  <div style={{ padding:'6px' }}>
                    {[{icon:'⚙️',label:'Settings',to:'/settings'},{icon:'✦',label:'Upgrade plan',to:'/pricing'}].map(item=>(
                      <button key={item.label} onClick={()=>{router.push(item.to);setMenuOpen(false)}} style={{ width:'100%',padding:'10px 12px',display:'flex',alignItems:'center',gap:'10px',background:'transparent',border:'none',color:'#C8CDD8',fontSize:'14px',fontFamily:'DM Sans, sans-serif',cursor:'pointer',borderRadius:'9px',transition:'all 0.15s',textAlign:'left' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)';e.currentTarget.style.color='#F0F2F7'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#C8CDD8'}}
                      ><span style={{ fontSize:'15px',width:'18px' }}>{item.icon}</span>{item.label}</button>
                    ))}
                    <div style={{ height:'1px',background:'rgba(255,255,255,0.06)',margin:'4px 6px' }} />
                    <button onClick={()=>{handleLogout();setMenuOpen(false)}} style={{ width:'100%',padding:'10px 12px',display:'flex',alignItems:'center',gap:'10px',background:'transparent',border:'none',color:'rgba(239,68,68,0.75)',fontSize:'14px',fontFamily:'DM Sans, sans-serif',cursor:'pointer',borderRadius:'9px',transition:'all 0.15s',textAlign:'left' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.06)';e.currentTarget.style.color='#EF4444'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(239,68,68,0.75)'}}
                    ><span style={{ fontSize:'15px',width:'18px' }}>→</span>Sign out</button>
                  </div>
                </div>
              )}
            </div>

            {/* Hamburger — mobile only */}
            <button className="hamburger" onClick={()=>setMobileOpen(!mobileOpen)} style={{ display:'none',flexDirection:'column',gap:'5px',background:'transparent',border:'none',cursor:'pointer',padding:'6px',borderRadius:'8px' }}>
              <span style={{ width:'22px',height:'2px',background:'#F0F2F7',borderRadius:'2px',transition:'all 0.25s',transform:mobileOpen?'rotate(45deg) translateY(7px)':'none',display:'block' }} />
              <span style={{ width:'22px',height:'2px',background:'#F0F2F7',borderRadius:'2px',transition:'all 0.25s',opacity:mobileOpen?0:1,display:'block' }} />
              <span style={{ width:'22px',height:'2px',background:'#F0F2F7',borderRadius:'2px',transition:'all 0.25s',transform:mobileOpen?'rotate(-45deg) translateY(-7px)':'none',display:'block' }} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div className="mobile-drawer" style={{ position:'absolute',top:'60px',left:0,right:0,background:'rgba(13,15,20,0.98)',borderBottom:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(20px)',animation:'slideDown 0.2s ease both',zIndex:99 }}>
            <div style={{ padding:'12px 16px 8px' }}>
              {/* User info */}
              <div style={{ display:'flex',alignItems:'center',gap:'12px',padding:'12px 14px',background:'rgba(255,255,255,0.03)',borderRadius:'12px',marginBottom:'8px' }}>
                <div style={{ width:'36px',height:'36px',borderRadius:'50%',background:`${tierColor}15`,border:`1px solid ${tierColor}25`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px',color:tierColor,flexShrink:0 }}>{initial}</div>
                <div>
                  <p style={{ fontSize:'14px',fontWeight:600,color:'#F0F2F7',marginBottom:'1px' }}>{user?.name}</p>
                  <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',letterSpacing:'1px',padding:'2px 8px',borderRadius:'10px',background:`${tierColor}10`,color:tierColor,border:`1px solid ${tierColor}20`,textTransform:'uppercase' }}>{user?.tier||'FREE'}</span>
                </div>
                <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:'5px' }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:user?.isActive?'#00FF88':'#4A5568',boxShadow:user?.isActive?'0 0 5px #00FF88':'none' }} />
                  <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',color:user?.isActive?'rgba(0,255,136,0.7)':'#4A5568' }}>{user?.isActive?'LIVE':'OFF'}</span>
                </div>
              </div>

              {/* Nav links */}
              {links.map(l=>{
                const active = pathname === l.href
                return (
                  <Link key={l.href} href={l.href} style={{ display:'flex',alignItems:'center',gap:'12px',padding:'13px 14px',borderRadius:'10px',textDecoration:'none',background:active?'rgba(0,255,136,0.07)':'transparent',border:active?'1px solid rgba(0,255,136,0.15)':'1px solid transparent',marginBottom:'4px',transition:'all 0.15s' }}>
                    <span style={{ fontSize:'16px' }}>{l.icon}</span>
                    <span style={{ fontFamily:'DM Sans, sans-serif',fontSize:'15px',fontWeight:active?600:400,color:active?'#00FF88':'#C8CDD8' }}>{l.label}</span>
                    {active && <div style={{ marginLeft:'auto',width:5,height:5,borderRadius:'50%',background:'#00FF88' }} />}
                  </Link>
                )
              })}

              <div style={{ height:'1px',background:'rgba(255,255,255,0.06)',margin:'8px 0' }} />

              <button onClick={()=>{handleLogout();setMobileOpen(false)}} style={{ width:'100%',padding:'13px 14px',display:'flex',alignItems:'center',gap:'12px',background:'transparent',border:'none',color:'rgba(239,68,68,0.8)',fontSize:'15px',fontFamily:'DM Sans, sans-serif',cursor:'pointer',borderRadius:'10px',textAlign:'left' }}>
                <span>→</span> Sign out
              </button>
              <div style={{ height:'8px' }} />
            </div>
          </div>
        )}
      </nav>

      {/* Bottom tab bar — mobile */}
      <div className="bottom-tabs">
        {links.map(l => {
          const active = pathname === l.href
          return (
            <Link key={l.href} href={l.href} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',textDecoration:'none',padding:'6px 16px',borderRadius:'10px',background:active?'rgba(0,255,136,0.08)':'transparent',transition:'all 0.18s',flex:1 }}>
              <span style={{ fontSize:'18px',lineHeight:1 }}>{l.icon}</span>
              <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',color:active?'#00FF88':'#4A5568',letterSpacing:'0.5px',textTransform:'uppercase' }}>{l.label}</span>
            </Link>
          )
        })}
      </div>

      {/* MAIN */}
      <main className="main-content" style={{ maxWidth:'1280px',margin:'0 auto',padding:'80px 28px 64px',position:'relative',zIndex:1 }}>
        {children}
      </main>
    </div>
  )
}
