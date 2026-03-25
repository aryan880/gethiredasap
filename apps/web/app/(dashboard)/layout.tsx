'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useState, useRef, useEffect } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  function handleLogout() {
    logout()
    router.push('/login')
  }

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const links = [
    { href: '/dashboard', label: 'Feed',     icon: '◈' },
    { href: '/top',       label: 'Top',      icon: '◆' },
    { href: '/pricing',   label: 'Pricing',  icon: '◇' },
    { href: '/settings',  label: 'Settings', icon: '◉' },
  ]

  const tierColor = user?.tier === 'PREMIUM' ? '#a78bfa' : '#00FF88'
  const initial   = user?.name?.charAt(0).toUpperCase() || '?'

  return (
    <div style={{ minHeight: '100vh', background: '#07080C', position: 'relative' }}>
      <style>{`
        @keyframes pulseAnim { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.7);} }
        @keyframes menuIn    { from{opacity:0;transform:translateY(-8px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);} }
        :root {
          --bg:#07080C; --bg2:#0D0F14; --bg3:#13161D;
          --accent:#00FF88; --amber:#F59E0B; --red:#EF4444;
          --text:#F0F2F7; --text2:#C8CDD8; --muted:#4A5568; --muted2:#6B7280;
          --border:rgba(255,255,255,0.06);
        }
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=JetBrains+Mono:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif !important; }
      `}</style>

      {/* Subtle grid */}
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(0,255,136,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.01) 1px,transparent 1px)`,backgroundSize:'56px 56px' }} />
      {/* Ambient orb */}
      <div style={{ position:'fixed',top:'-200px',right:'-200px',width:'600px',height:'600px',borderRadius:'50%',background:'rgba(0,255,136,0.02)',filter:'blur(120px)',pointerEvents:'none',zIndex:0 }} />

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: '64px',
        background: 'rgba(7,8,12,0.92)',
        backdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth:'1280px',margin:'0 auto',padding:'0 32px',height:'100%',display:'flex',alignItems:'center',justifyContent:'space-between' }}>

          {/* Logo */}
          <Link href="/dashboard" style={{ display:'flex',alignItems:'center',gap:'10px',textDecoration:'none' }}>
            <div style={{ width:8,height:8,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 8px #00FF88',animation:'pulseAnim 2s ease-in-out infinite' }} />
            <span style={{ fontFamily:'JetBrains Mono, monospace',fontWeight:700,fontSize:'15px',color:'#F0F2F7',letterSpacing:'0.3px' }}>
              GetHiredASAP
            </span>
          </Link>

          {/* Nav links */}
          <div style={{ display:'flex',gap:'2px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'12px',padding:'4px' }}>
            {links.map(l => {
              const active = pathname === l.href
              return (
                <Link key={l.href} href={l.href} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '8px',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: '14px', fontWeight: active ? 600 : 400,
                  color: active ? '#00FF88' : '#6B7280',
                  textDecoration: 'none',
                  background: active ? 'rgba(0,255,136,0.08)' : 'transparent',
                  border: active ? '1px solid rgba(0,255,136,0.15)' : '1px solid transparent',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#C8CDD8'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent' }}}
                >
                  {l.label}
                  {active && <div style={{ width:4,height:4,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 4px #00FF88' }} />}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>

            {/* Combined status pill — tier + live status */}
            <div style={{
              display:'flex',alignItems:'center',gap:'0',
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:'10px',overflow:'hidden',
            }}>
              {/* Radar live/paused */}
              <div style={{
                display:'flex',alignItems:'center',gap:'6px',
                padding:'7px 13px',
                borderRight: user?.tier && user.tier !== 'FREE' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <div style={{
                  width:6,height:6,borderRadius:'50%',flexShrink:0,
                  background:user?.isActive?'#00FF88':'#4A5568',
                  boxShadow:user?.isActive?'0 0 6px rgba(0,255,136,0.8)':'none',
                  animation:user?.isActive?'pulseAnim 2s ease-in-out infinite':'none',
                }} />
                <span style={{
                  fontFamily:'JetBrains Mono, monospace',fontSize:'10px',
                  color:user?.isActive?'rgba(0,255,136,0.8)':'#4A5568',
                  letterSpacing:'1px',
                }}>
                  {user?.isActive ? 'LIVE' : 'PAUSED'}
                </span>
              </div>

              {/* Tier — only if not free */}
              {user?.tier && user.tier !== 'FREE' && (
                <div style={{
                  padding:'7px 13px',
                  fontFamily:'JetBrains Mono, monospace',fontSize:'10px',
                  letterSpacing:'1.5px',textTransform:'uppercase',
                  color:tierColor,
                }}>
                  {user.tier}
                </div>
              )}
            </div>

            {/* Avatar button */}
            <div ref={menuRef} style={{ position:'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  width:'38px',height:'38px',borderRadius:'50%',
                  background: menuOpen ? `${tierColor}20` : `${tierColor}10`,
                  border:`1.5px solid ${menuOpen ? `${tierColor}50` : `${tierColor}25`}`,
                  color:tierColor,
                  fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px',
                  cursor:'pointer',transition:'all 0.18s',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow: menuOpen ? `0 0 20px ${tierColor}20` : 'none',
                  flexShrink:0,
                }}
                onMouseEnter={e=>{ if(!menuOpen){ e.currentTarget.style.background=`${tierColor}18`; e.currentTarget.style.borderColor=`${tierColor}40`; e.currentTarget.style.boxShadow=`0 0 16px ${tierColor}15` }}}
                onMouseLeave={e=>{ if(!menuOpen){ e.currentTarget.style.background=`${tierColor}10`; e.currentTarget.style.borderColor=`${tierColor}25`; e.currentTarget.style.boxShadow='none' }}}
              >
                {initial}
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position:'absolute',top:'calc(100% + 10px)',right:0,
                  width:'260px',
                  background:'#0D0F14',
                  border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:'16px',
                  boxShadow:'0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,136,0.04)',
                  overflow:'hidden',
                  animation:'menuIn 0.2s cubic-bezier(0.4,0,0.2,1) both',
                  zIndex:200,
                }}>
                  {/* User info header */}
                  <div style={{ padding:'18px 20px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
                      <div style={{ width:'42px',height:'42px',borderRadius:'50%',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'18px',color:'#00FF88',flexShrink:0 }}>
                        {initial}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:'14px',fontWeight:600,color:'#F0F2F7',marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.name}</p>
                        <p style={{ fontSize:'12px',color:'#6B7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.email}</p>
                      </div>
                    </div>
                    <div style={{ marginTop:'12px' }}>
                      <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',letterSpacing:'1.5px',padding:'3px 10px',borderRadius:'20px',background:`${tierColor}10`,color:tierColor,border:`1px solid ${tierColor}22`,textTransform:'uppercase' }}>
                        {user?.tier||'FREE'} plan
                      </span>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div style={{ padding:'6px' }}>
                    {[
                      { icon:'⚙️', label:'Settings',     action:()=>{ router.push('/settings'); setMenuOpen(false) } },
                      { icon:'✦',  label:'Upgrade plan',  action:()=>{ router.push('/pricing');  setMenuOpen(false) } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} style={{
                        width:'100%',padding:'11px 14px',
                        display:'flex',alignItems:'center',gap:'12px',
                        background:'transparent',border:'none',
                        color:'#C8CDD8',fontSize:'14px',
                        fontFamily:'DM Sans, sans-serif',
                        cursor:'pointer',borderRadius:'10px',
                        transition:'all 0.15s',textAlign:'left',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#F0F2F7' }}
                      onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#C8CDD8' }}
                      >
                        <span style={{ fontSize:'16px',width:'20px',textAlign:'center' }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}

                    {/* Divider */}
                    <div style={{ height:'1px',background:'rgba(255,255,255,0.06)',margin:'4px 8px' }} />

                    {/* Sign out */}
                    <button onClick={()=>{ handleLogout(); setMenuOpen(false) }} style={{
                      width:'100%',padding:'11px 14px',
                      display:'flex',alignItems:'center',gap:'12px',
                      background:'transparent',border:'none',
                      color:'rgba(239,68,68,0.75)',fontSize:'14px',
                      fontFamily:'DM Sans, sans-serif',
                      cursor:'pointer',borderRadius:'10px',
                      transition:'all 0.15s',textAlign:'left',
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,0.06)'; e.currentTarget.style.color='#EF4444' }}
                    onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(239,68,68,0.75)' }}
                    >
                      <span style={{ fontSize:'16px',width:'20px',textAlign:'center' }}>→</span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ maxWidth:'1280px',margin:'0 auto',padding:'84px 32px 64px',position:'relative',zIndex:1 }}>
        {children}
      </main>
    </div>
  )
}