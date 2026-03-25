'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── SCROLL PROGRESS ──
function ScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const u = () => { const s = document.documentElement; setP(s.scrollTop / (s.scrollHeight - s.clientHeight) * 100) }
    window.addEventListener('scroll', u, { passive: true })
    return () => window.removeEventListener('scroll', u)
  }, [])
  return <div style={{ position:'fixed',top:0,left:0,zIndex:999,height:'2px',width:`${p}%`,background:'var(--accent)',transition:'width 0.1s linear',boxShadow:'0 0 6px rgba(0,255,136,0.4)' }} />
}

// ── BUTTON ──
function Btn({ children, href, primary, large }: { children: React.ReactNode; href: string; primary?: boolean; large?: boolean }) {
  return (
    <Link href={href} style={{ display:'inline-flex',alignItems:'center',gap:'8px',padding:large?'17px 36px':'13px 28px',borderRadius:'12px',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:large?'17px':'15px',textDecoration:'none',transition:'all 0.2s ease',...(primary?{background:'var(--accent)',color:'var(--bg)'}:{background:'rgba(255,255,255,0.04)',color:'var(--text)',border:'1px solid rgba(255,255,255,0.1)'}) }}
    onMouseEnter={e=>{if(primary){e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 40px rgba(0,255,136,0.35)';e.currentTarget.style.transform='translateY(-2px)'}else{e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.borderColor='rgba(0,255,136,0.3)';e.currentTarget.style.color='var(--accent)';e.currentTarget.style.transform='translateY(-2px)'}}}
    onMouseLeave={e=>{if(primary){e.currentTarget.style.background='var(--accent)';e.currentTarget.style.boxShadow='none'}else{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='var(--text)'};e.currentTarget.style.transform='translateY(0)'}}
    >{children}</Link>
  )
}

// ── COUNTER ──
function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const dur = 1800, start = Date.now()
        const tick = () => { const p = Math.min((Date.now()-start)/dur,1); setCount(Math.round((1-Math.pow(1-p,3))*target)); if(p<1) requestAnimationFrame(tick) }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target])
  return <div ref={ref} style={{ fontFamily:'Playfair Display, serif',fontSize:'48px',fontWeight:700,color:'var(--text)',lineHeight:1,marginBottom:'8px' }}>{count}<span style={{ color:'var(--accent)' }}>{suffix}</span></div>
}

// ── FAQ ──
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={()=>setOpen(!open)} style={{ width:'100%',padding:'22px 0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'20px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left' }}>
        <span style={{ fontFamily:'DM Sans, sans-serif',fontSize:'16px',fontWeight:500,color:open?'var(--accent)':'var(--text)',lineHeight:1.4,transition:'color 0.2s' }}>{q}</span>
        <span style={{ width:'28px',height:'28px',borderRadius:'50%',background:open?'rgba(0,255,136,0.1)':'rgba(255,255,255,0.04)',border:`1px solid ${open?'rgba(0,255,136,0.3)':'rgba(255,255,255,0.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',color:open?'var(--accent)':'var(--muted)',transition:'all 0.25s',transform:open?'rotate(45deg)':'rotate(0)',flexShrink:0 }}>+</span>
      </button>
      <div style={{ maxHeight:open?'200px':'0',overflow:'hidden',transition:'max-height 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
        <p style={{ fontSize:'14px',color:'var(--muted2)',lineHeight:1.8,paddingBottom:'20px' }}>{a}</p>
      </div>
    </div>
  )
}

// ── PARTICLES ──
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      opacity: Math.random() * 0.4 + 0.05,
    }))

    let frame: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,136,${p.opacity})`
        ctx.fill()
      })
      // Draw connections
      particles.forEach((a, i) => {
        particles.slice(i+1).forEach(b => {
          const dist = Math.hypot(a.x-b.x, a.y-b.y)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(0,255,136,${0.04 * (1 - dist/120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.6 }} />
}

// ── TERMINAL ──
function Terminal() {
  const lines = [
    {c:'var(--muted)', t:'══════════════════════════════════════'},
    {c:'var(--text)',  t:'  GetHiredASAP · Job Radar System'},
    {c:'var(--muted)', t:'  2026-03-24 · 14:30:00'},
    {c:'var(--muted)', t:'══════════════════════════════════════'},
    {c:'transparent',  t:' '},
    {c:'var(--accent)',t:'  ✅ AI matching engine loaded'},
    {c:'var(--accent)',t:'  ✅ Job Radar active'},
    {c:'var(--accent)',t:'  ✅ 847 active users · 3 tiers'},
    {c:'transparent',  t:' '},
    {c:'#60A5FA',      t:'  📡 "sales rep" in "Vancouver, BC"...'},
    {c:'var(--muted)', t:'     15 found · 4 new'},
    {c:'#60A5FA',      t:'  📡 "frontend dev" in "Remote"...'},
    {c:'var(--muted)', t:'     12 found · 7 new'},
    {c:'transparent',  t:' '},
    {c:'var(--amber)', t:'  🧠 NLP scoring 11 opportunities...'},
    {c:'var(--accent)',t:'     Inside Sales @ Fresha → 78% ✅'},
    {c:'var(--accent)',t:'     Frontend Dev @ Shopify → 71% ✅'},
    {c:'var(--muted)', t:'     Retail Associate @ Gap → 12% skip'},
    {c:'transparent',  t:' '},
    {c:'var(--accent)',t:'  📲 2 matches sent · Next scan in 15 min'},
  ]
  return (
    <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'18px',overflow:'hidden',fontFamily:'JetBrains Mono, monospace',fontSize:'13px',boxShadow:'0 48px 120px rgba(0,0,0,0.7),0 0 0 1px rgba(0,255,136,0.04)' }}>
      <div style={{ background:'var(--bg3)',padding:'14px 20px',display:'flex',alignItems:'center',gap:'8px',borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        {['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{ width:'12px',height:'12px',borderRadius:'50%',background:c }} />)}
        <span style={{ flex:1,textAlign:'center',color:'var(--muted)',fontSize:'12px' }}>GetHiredASAP — Job Radar</span>
      </div>
      <div style={{ padding:'24px 26px',lineHeight:2.1 }}>
        {lines.map((l,i)=>(
          <div key={i} style={{ color:l.c,minHeight:'1.5em',animation:`fadeUp 0.3s ease ${0.3+i*0.05}s forwards`,opacity:0 }}>{l.t}</div>
        ))}
        <div style={{ color:'var(--muted)',animation:`fadeUp 0.3s ease ${0.3+lines.length*0.05}s forwards`,opacity:0 }}>
          {'  $ '}<span style={{ display:'inline-block',width:'8px',height:'15px',background:'var(--accent)',verticalAlign:'middle',animation:'blink 1s step-end infinite' }} />
        </div>
      </div>
    </div>
  )
}

// ── FLOATING JOB CARDS ──
function FloatingCards() {
  const cards = [
    { top:'8%',  right:'2%',  delay:'0s',   duration:'6s',  score:78, label:'Strong',  color:'var(--accent)', title:'Frontend Developer', company:'Shopify', salary:'$28–$38/hr', early:true },
    { top:'35%', right:'14%', delay:'1.5s', duration:'7s',  score:65, label:'Strong',  color:'var(--accent)', title:'Sales Representative', company:'Fresha', salary:'$22–$28/hr', early:false },
    { top:'62%', right:'3%',  delay:'0.8s', duration:'8s',  score:48, label:'Good',    color:'#60A5FA',       title:'Account Executive', company:'Telus', salary:'$55k–$70k', early:true },
  ]
  return (
    <div style={{ position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden' }}>
      {cards.map((c,i) => (
        <div key={i} style={{
          position:'absolute', top:c.top, right:c.right,
          background:'rgba(13,15,20,0.92)',
          border:`1px solid ${c.color === 'var(--accent)' ? 'rgba(0,255,136,0.2)' : 'rgba(59,130,246,0.2)'}`,
          borderRadius:'16px', padding:'16px 20px',
          width:'240px',
          boxShadow:`0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${c.color === 'var(--accent)' ? 'rgba(0,255,136,0.05)' : 'rgba(59,130,246,0.05)'}`,
          animation:`floatCard${i} ${c.duration} ease-in-out ${c.delay} infinite`,
          backdropFilter:'blur(12px)',
        }}>
          {/* Top accent */}
          <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',borderRadius:'16px 16px 0 0',background:`linear-gradient(90deg,transparent,${c.color === 'var(--accent)' ? 'rgba(0,255,136,0.4)' : 'rgba(59,130,246,0.4)'},transparent)` }} />
          {/* Badges */}
          <div style={{ display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap' }}>
            {c.early && <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',padding:'2px 7px',borderRadius:'4px',background:'rgba(245,158,11,0.1)',color:'#F59E0B',border:'1px solid rgba(245,158,11,0.2)' }}>⭐ EARLY</span>}
            <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',padding:'2px 7px',borderRadius:'4px',background:c.color==='var(--accent)'?'rgba(0,255,136,0.1)':'rgba(59,130,246,0.1)',color:c.color,border:`1px solid ${c.color==='var(--accent)'?'rgba(0,255,136,0.2)':'rgba(59,130,246,0.2)'}` }}>✓ {c.label} — {c.score}%</span>
          </div>
          {/* Score bar */}
          <div style={{ height:'2px',background:'rgba(255,255,255,0.06)',borderRadius:'2px',marginBottom:'10px',overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${c.score}%`,background:c.color,borderRadius:'2px',boxShadow:`0 0 6px ${c.color}` }} />
          </div>
          <div style={{ fontFamily:'Playfair Display, serif',fontWeight:600,fontSize:'13px',color:'var(--text)',marginBottom:'5px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{c.title}</div>
          <div style={{ fontSize:'11px',color:'var(--muted2)' }}>🏢 {c.company}</div>
          <div style={{ fontSize:'11px',color:'var(--muted2)',marginTop:'2px' }}>💰 {c.salary}</div>
        </div>
      ))}
    </div>
  )
}

// ── RADAR GRAPHIC ──
function RadarGraphic() {
  const [angle, setAngle] = useState(0)
  const [pings, setPings] = useState<{id:number,x:number,y:number,age:number}[]>([])
  const pingId = useRef(0)

  useEffect(() => {
    let frame: number
    let lastPingAngle = -999
    const tick = () => {
      setAngle(a => {
        const next = (a + 0.5) % 360
        // trigger ping when sweep passes a dot
        dots.forEach(d => {
          const prev = a
          const curr = next
          const da = ((d.angle - prev + 360) % 360)
          if (da < 1.5 && Math.abs(lastPingAngle - d.angle) > 5) {
            lastPingAngle = d.angle
            const pos = toXY(d.angle, maxR * d.r, size/2, size/2, maxR)
            setPings(p => [...p.slice(-6), { id: pingId.current++, x: pos.x, y: pos.y, age: 0 }])
          }
        })
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // age out pings
  useEffect(() => {
    const t = setInterval(() => {
      setPings(p => p.map(ping => ({ ...ping, age: ping.age + 1 })).filter(p => p.age < 40))
    }, 50)
    return () => clearInterval(t)
  }, [])

  const dots = [
    { angle: 40,  r: 0.38, label: 'Shopify',  score: 78 },
    { angle: 110, r: 0.58, label: 'Fresha',   score: 65 },
    { angle: 190, r: 0.44, label: 'Telus',    score: 48 },
    { angle: 290, r: 0.62, label: 'Amazon',   score: 71 },
    { angle: 250, r: 0.30, label: 'Apple',    score: 82 },
    { angle: 340, r: 0.50, label: 'Stripe',   score: 59 },
  ]

  const size = 360
  const maxR = size / 2 - 20

  const toXY = (angleDeg: number, radius: number, cx: number, cy: number, mr: number) => {
    const rad = (angleDeg - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const cx = size / 2, cy = size / 2
  const sweepEnd = toXY(angle, maxR, cx, cy, maxR)
  const sweepMid = toXY(angle - 70, maxR, cx, cy, maxR)
  const largeArc = 70 > 180 ? 1 : 0

  return (
    <div style={{ position:'relative', width:size, height:size }}>
      {/* Outer glow */}
      <div style={{ position:'absolute',inset:'-20px',borderRadius:'50%',background:'radial-gradient(circle,rgba(0,255,136,0.06) 0%,transparent 70%)',pointerEvents:'none' }} />

      <svg width={size} height={size} style={{ position:'absolute',inset:0,overflow:'visible' }}>
        <defs>
          {/* Sweep wedge gradient */}
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00FF88" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
          </radialGradient>
          {/* Center glow */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00FF88" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Rings */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((r,i) => (
          <circle key={i} cx={cx} cy={cy} r={maxR*r}
            fill="none"
            stroke={`rgba(0,255,136,${i===4?0.12:0.06})`}
            strokeWidth={i===4?1:0.75}
            strokeDasharray={i===4?'none':'4 8'}
          />
        ))}

        {/* Cross hairs */}
        {[0,45,90,135].map(a => {
          const s = toXY(a, maxR, cx, cy, maxR)
          const e = toXY(a+180, maxR, cx, cy, maxR)
          return <line key={a} x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="rgba(0,255,136,0.05)" strokeWidth="0.75" />
        })}

        {/* Sweep wedge */}
        <path
          d={`M ${cx} ${cy} L ${sweepMid.x} ${sweepMid.y} A ${maxR} ${maxR} 0 ${largeArc} 1 ${sweepEnd.x} ${sweepEnd.y} Z`}
          fill="url(#sweepGrad)"
        />

        {/* Sweep line with glow */}
        <line x1={cx} y1={cy} x2={sweepEnd.x} y2={sweepEnd.y}
          stroke="rgba(0,255,136,0.9)" strokeWidth="1.5"
          filter="url(#glow)"
        />

        {/* Tick marks on outer ring */}
        {Array.from({length:36}).map((_,i) => {
          const a = i * 10
          const inner = toXY(a, maxR - 6, cx, cy, maxR)
          const outer = toXY(a, maxR, cx, cy, maxR)
          return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(0,255,136,0.15)" strokeWidth="1" />
        })}

        {/* Ping ripples */}
        {pings.map(ping => {
          const progress = ping.age / 40
          const r = progress * 28
          const opacity = (1 - progress) * 0.7
          return (
            <circle key={ping.id} cx={ping.x} cy={ping.y} r={r}
              fill="none" stroke="rgba(0,255,136,0.8)" strokeWidth="1"
              opacity={opacity}
            />
          )
        })}

        {/* Job dots */}
        {dots.map((d,i) => {
          const pos = toXY(d.angle, maxR * d.r, cx, cy, maxR)
          const angleDiff = ((angle - d.angle) % 360 + 360) % 360
          const isLit = angleDiff < 80
          const fade = isLit ? Math.max(0.3, 1 - angleDiff/80) : 0.2

          return (
            <g key={i}>
              {/* Dot glow */}
              {isLit && (
                <circle cx={pos.x} cy={pos.y} r={12}
                  fill="rgba(0,255,136,0.08)"
                />
              )}
              {/* Dot */}
              <circle cx={pos.x} cy={pos.y}
                r={isLit ? 5 : 3.5}
                fill={isLit ? '#00FF88' : 'rgba(0,255,136,0.35)'}
                opacity={fade}
              />
              {/* Ring around lit dot */}
              {isLit && (
                <circle cx={pos.x} cy={pos.y} r={9}
                  fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="0.75"
                  opacity={fade}
                />
              )}
              {/* Label */}
              <text
                x={pos.x + (d.r > 0.5 ? -48 : 10)}
                y={pos.y + 4}
                fill={`rgba(0,255,136,${isLit ? 0.9 : 0.3})`}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {d.label}
              </text>
              {/* Score */}
              {isLit && (
                <text
                  x={pos.x + (d.r > 0.5 ? -48 : 10)}
                  y={pos.y + 16}
                  fill="rgba(0,255,136,0.5)"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {d.score}% match
                </text>
              )}
            </g>
          )
        })}

        {/* Center */}
        <circle cx={cx} cy={cy} r={20} fill="url(#centerGlow)" />
        <circle cx={cx} cy={cy} r={5} fill="#00FF88" filter="url(#glow)" />
        <circle cx={cx} cy={cy} r={10} fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={16} fill="none" stroke="rgba(0,255,136,0.15)" strokeWidth="0.75" />
      </svg>

      {/* Scanning label */}
      <div style={{ position:'absolute',bottom:'-24px',left:0,right:0,textAlign:'center',fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'rgba(0,255,136,0.5)',letterSpacing:'3px',textTransform:'uppercase' }}>
        SCANNING
      </div>
    </div>
  )
}

// ── TESTIMONIAL ──
function TestiCard({ quote, name, role, result }: { quote:string;name:string;role:string;result:string }) {
  return (
    <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'18px',padding:'32px',display:'flex',flexDirection:'column',gap:'20px',transition:'all 0.25s',flex:'1 1 280px' }}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,255,136,0.18)';e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 48px rgba(0,0,0,0.4)'}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
    >
      <div style={{ display:'flex',gap:'3px' }}>{[1,2,3,4,5].map(i=><span key={i} style={{ color:'var(--amber)',fontSize:'14px' }}>★</span>)}</div>
      <p style={{ fontSize:'15px',color:'var(--text2)',lineHeight:1.75,fontStyle:'italic',flex:1 }}>"{quote}"</p>
      <div style={{ display:'inline-flex',alignItems:'center',gap:'7px',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--accent)',background:'rgba(0,255,136,0.07)',border:'1px solid rgba(0,255,136,0.15)',padding:'6px 12px',borderRadius:'8px',width:'fit-content' }}>
        <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)',display:'inline-block' }} />{result}
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:'12px',paddingTop:'4px',borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width:'40px',height:'40px',borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,rgba(0,255,136,0.3),rgba(59,130,246,0.3))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px',color:'var(--text)' }}>{name.charAt(0)}</div>
        <div><div style={{ fontSize:'14px',fontWeight:600,color:'var(--text)' }}>{name}</div><div style={{ fontSize:'12px',color:'var(--muted2)' }}>{role}</div></div>
      </div>
    </div>
  )
}

// ── PRICE CARD ──
function PriceCard({ tier, price, period, features, featured, cta }: { tier:string;price:string;period:string;features:string[];featured?:boolean;cta:string }) {
  return (
    <div style={{ background:featured?'linear-gradient(160deg,var(--bg2) 0%,rgba(0,255,136,0.025) 100%)':'var(--bg2)',border:`1px solid ${featured?'rgba(0,255,136,0.28)':'rgba(255,255,255,0.07)'}`,borderRadius:'20px',padding:'36px 32px',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',flex:'1 1 280px',minWidth:'260px',maxWidth:'360px',transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1),box-shadow 0.3s' }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-8px) scale(1.01)';e.currentTarget.style.boxShadow=featured?'0 24px 80px rgba(0,255,136,0.12),0 0 0 1px rgba(0,255,136,0.2)':'0 24px 60px rgba(0,0,0,0.5)'}}
    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0) scale(1)';e.currentTarget.style.boxShadow='none'}}
    >
      {featured && <div style={{ position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,var(--accent),transparent)' }} />}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px' }}>
        <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--accent)' }}>{tier}</span>
        {featured && <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',letterSpacing:'1.5px',padding:'4px 12px',borderRadius:'20px',background:'rgba(0,255,136,0.1)',color:'var(--accent)',border:'1px solid rgba(0,255,136,0.25)' }}>POPULAR</span>}
      </div>
      <div style={{ display:'flex',alignItems:'flex-end',gap:'3px',marginBottom:'6px' }}>
        <span style={{ fontFamily:'Playfair Display, serif',fontSize:'24px',fontWeight:700,color:'var(--muted2)',lineHeight:1,paddingBottom:'10px' }}>$</span>
        <span style={{ fontFamily:'Playfair Display, serif',fontSize:'60px',fontWeight:700,color:'var(--text)',lineHeight:1 }}>{price}</span>
      </div>
      <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'12px',color:'var(--muted)',marginBottom:'24px' }}>{period}</p>
      <div style={{ height:'1px',background:'rgba(255,255,255,0.06)',marginBottom:'24px' }} />
      <ul style={{ listStyle:'none',flex:1,display:'flex',flexDirection:'column',gap:'12px',marginBottom:'32px' }}>
        {features.map(f=>(
          <li key={f} style={{ display:'flex',alignItems:'flex-start',gap:'10px',fontSize:'14px',color:'var(--muted2)',lineHeight:1.5 }}>
            <span style={{ color:'var(--accent)',fontWeight:700,fontSize:'15px',flexShrink:0,marginTop:'1px' }}>✓</span>{f}
          </li>
        ))}
      </ul>
      <Link href="/register" style={{ display:'block',width:'100%',padding:'14px',textAlign:'center',borderRadius:'10px',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'15px',textDecoration:'none',transition:'all 0.25s',...(featured?{background:'var(--accent)',color:'var(--bg)'}:{background:'transparent',color:'var(--text2)',border:'1px solid rgba(255,255,255,0.12)'}) }}
      onMouseEnter={e=>{if(featured){e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 24px rgba(0,255,136,0.35)'}else{e.currentTarget.style.borderColor='rgba(0,255,136,0.3)';e.currentTarget.style.color='var(--accent)'}}}
      onMouseLeave={e=>{if(featured){e.currentTarget.style.background='var(--accent)';e.currentTarget.style.boxShadow='none'}else{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='var(--text2)'}}}
      >{cta}</Link>
    </div>
  )
}

// ── SECTION DIVIDER ──
function Divider() {
  return (
    <div style={{ position:'relative',height:'1px',margin:'0',overflow:'visible' }}>
      <div style={{ height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,255,136,0.15),rgba(0,255,136,0.3),rgba(0,255,136,0.15),transparent)' }} />
      <div style={{ position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'6px',height:'6px',borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 12px var(--accent)',animation:'pulseAnim 2s ease-in-out infinite' }} />
    </div>
  )
}

// ── NAV ──
function NavBar() {
  const [hidden, setHidden] = useState(false)
  const [atTop,  setAtTop]  = useState(true)
  const lastY = useRef(0)
  useEffect(() => {
    const fn = () => { const y=window.scrollY; setAtTop(y<20); setHidden(y>lastY.current&&y>80); lastY.current=y }
    window.addEventListener('scroll', fn, { passive:true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const W = { maxWidth:'1120px',margin:'0 auto',padding:'0 32px' }
  return (
    <nav style={{ position:'fixed',top:'40px',left:0,right:0,zIndex:100,height:'68px',background:atTop?'rgba(7,8,12,0.6)':'rgba(7,8,12,0.95)',backdropFilter:'blur(28px) saturate(180%)',borderBottom:`1px solid ${atTop?'transparent':'rgba(255,255,255,0.055)'}`,transition:'transform 0.4s cubic-bezier(0.4,0,0.2,1),background 0.3s,border-color 0.3s,opacity 0.3s',transform:hidden?'translateY(-110%)':'translateY(0)',opacity:hidden?0:1 }}>
      <div style={{ ...W,height:'100%',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <Link href="/" style={{ display:'flex',alignItems:'center',gap:'10px',textDecoration:'none',fontFamily:'JetBrains Mono, monospace',fontWeight:700,fontSize:'15px',color:'#F0F2F7' }}>
          <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 8px var(--accent)',animation:'pulseAnim 2s ease-in-out infinite' }} />
          GetHiredASAP
        </Link>
        <div className="nl" style={{ display:'flex',gap:'4px' }}>
          {[['#features','Features'],['#how','How it works'],['#pricing','Pricing'],['#faq','FAQ']].map(([h,l])=>(
            <a key={h} href={h} style={{ fontFamily:'DM Sans, sans-serif',fontSize:'14px',fontWeight:500,color:'var(--muted2)',textDecoration:'none',padding:'7px 16px',borderRadius:'8px',transition:'all 0.2s' }}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--text)';e.currentTarget.style.background='rgba(255,255,255,0.05)'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--muted2)';e.currentTarget.style.background='transparent'}}
            >{l}</a>
          ))}
        </div>
        <div style={{ display:'flex',gap:'10px',alignItems:'center' }}>
          <Link href="/login" style={{ fontFamily:'DM Sans,sans-serif',fontWeight:500,fontSize:'14px',color:'var(--muted2)',textDecoration:'none',padding:'7px 16px',borderRadius:'8px',transition:'color 0.2s' }}
          onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}
          >Sign in</Link>
          <Btn href="/register" primary>Get started →</Btn>
        </div>
      </div>
    </nav>
  )
}

// ── MAIN ──
export default function LandingPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement
          el.style.opacity='1'; el.style.transform='translateY(0) translateX(0)'
          obs.unobserve(el)
        }
      })
    }, { threshold: 0.06 })
    document.querySelectorAll('[data-reveal]').forEach(el => {
      const h = el as HTMLElement
      h.style.opacity='0'
      h.style.transition='opacity 0.8s cubic-bezier(0.4,0,0.2,1),transform 0.8s cubic-bezier(0.4,0,0.2,1)'
      const dir = h.getAttribute('data-reveal')
      if(dir==='left') h.style.transform='translateX(-32px)'
      else if(dir==='right') h.style.transform='translateX(32px)'
      else h.style.transform='translateY(32px)'
      obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const glow = document.getElementById('cglow')
    if (!glow) return
    const move = (e: MouseEvent) => requestAnimationFrame(() => { glow.style.left=e.clientX-200+'px'; glow.style.top=e.clientY-200+'px' })
    window.addEventListener('mousemove', move, { passive:true })
    return () => window.removeEventListener('mousemove', move)
  }, [])

  const features = [
    { icon:'🤖',color:'green',title:'Semantic NLP Matching',  desc:'sentence-transformers understands meaning, not keywords. "Account executive" correctly matches "sales representative".' },
    { icon:'⚡',color:'blue', title:'Real-Time Alerts',       desc:'LinkedIn scanned every 15 minutes. You hear about opportunities before most applicants know they exist.' },
    { icon:'👥',color:'amber',title:'Fully Personalised',     desc:'Each user has their own resume and searches. Your feed is yours alone — no interference from other users.' },
    { icon:'⭐',color:'green',title:'Early Career Priority',  desc:'Detects entry-level and new-grad roles automatically. These always surface first in your personalised feed.' },
    { icon:'🎯',color:'blue', title:'Experience Matching',    desc:'Extracts years required from descriptions and adjusts your relevance score with smart gap tolerance.' },
    { icon:'💰',color:'amber',title:'Salary Intelligence',    desc:'Finds salary ranges in job descriptions automatically. See the compensation before clicking through.' },
  ]

  const testimonials = [
    { quote:"I landed 3 interviews in my first week. The matching is incredibly accurate — it only surfaced jobs that genuinely fit my background.", name:"Sarah K.", role:"Frontend Developer · Vancouver", result:"Hired in 3 weeks" },
    { quote:"I was checking LinkedIn manually 10 times a day. GetHiredASAP gave me my time back while finding better matches than I ever could.", name:"Marcus T.", role:"Sales Executive · Toronto", result:"Saved 2hrs/day" },
    { quote:"The early career filter is a game changer as a new grad. I only see roles that are actually relevant to me now.", name:"Priya M.", role:"MBA Graduate · Calgary", result:"4 offers received" },
  ]

  const faqs = [
    { q:"How is this different from LinkedIn job alerts?", a:"LinkedIn alerts send every job matching a keyword. GetHiredASAP scores each job against your actual resume using NLP and only alerts you for strong matches. Far less noise, far more signal." },
    { q:"Does it require my LinkedIn login?", a:"No. GetHiredASAP uses LinkedIn's public job listings — no login, no credentials, no risk to your account." },
    { q:"How accurate is the NLP matching?", a:"We use sentence-transformers (all-MiniLM-L6-v2), the same technology used in enterprise search systems. It understands meaning and context, not just keyword overlap." },
    { q:"Can I use it on my phone?", a:"Yes — alerts come via the web dashboard and Telegram. A native mobile app with push notifications is coming soon for Pro and Premium users." },
    { q:"What happens when I cancel?", a:"You're immediately downgraded to the free tier. No charges, no questions. Your data and history are preserved." },
  ]

  const W = { maxWidth:'1120px',margin:'0 auto',padding:'0 32px' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=JetBrains+Mono:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes pulseAnim  { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.7);} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);} }
        @keyframes blink      { 0%,100%{opacity:1;}50%{opacity:0;} }
        @keyframes float      { 0%,100%{transform:translateY(0);}50%{transform:translateY(-12px);} }
        @keyframes gradShift  { 0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;} }
        @keyframes floatCard0 { 0%,100%{transform:translateY(0px) rotate(-1deg);}50%{transform:translateY(-14px) rotate(1deg);} }
        @keyframes floatCard1 { 0%,100%{transform:translateY(0px) rotate(1deg);}50%{transform:translateY(-10px) rotate(-1deg);} }
        @keyframes floatCard2 { 0%,100%{transform:translateY(0px) rotate(-0.5deg);}50%{transform:translateY(-18px) rotate(0.5deg);} }
        @keyframes sectionIn  { from{opacity:0;transform:translateY(40px) scale(0.98);}to{opacity:1;transform:translateY(0) scale(1);} }
        html { scroll-behavior:smooth; }
        * { box-sizing:border-box;margin:0;padding:0; }
        body { background:#07080C;color:#F0F2F7;overflow-x:hidden;font-family:'DM Sans',sans-serif; }
        :root { --bg:#07080C;--bg2:#0D0F14;--bg3:#13161D;--accent:#00FF88;--amber:#F59E0B;--text:#F0F2F7;--text2:#C8CDD8;--muted:#4A5568;--muted2:#6B7280; }
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.3);border-radius:2px;}
        ::selection{background:rgba(0,255,136,0.2);color:#00FF88;}
        section { animation: sectionIn 0.9s cubic-bezier(0.4,0,0.2,1) both; }
        @media(max-width:768px){
          .nl{display:none!important;} .fg{grid-template-columns:1fr!important;}
          .sw{flex-direction:column!important;} .sl::before{display:none!important;}
          .mg{grid-template-columns:1fr!important;} .pw{flex-direction:column!important;align-items:center!important;}
          .pw>*{max-width:100%!important;width:100%!important;} .tw{flex-direction:column!important;}
          .hb{flex-direction:column!important;align-items:flex-start!important;}
          .cp{padding:44px 28px!important;} .hero-grid{grid-template-columns:1fr!important;}
          .fc{display:none!important;} .bento{grid-template-columns:1fr!important;}
        }
      `}</style>

      <ScrollProgress />
      {mounted && <Particles />}
      <div id="cglow" style={{ position:'fixed',width:'400px',height:'400px',borderRadius:'50%',pointerEvents:'none',zIndex:0,background:'radial-gradient(circle,rgba(0,255,136,0.03) 0%,transparent 70%)',left:0,top:0 }} />
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(0,255,136,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.01) 1px,transparent 1px)`,backgroundSize:'56px 56px' }} />
      <div style={{ position:'fixed',borderRadius:'50%',filter:'blur(130px)',pointerEvents:'none',zIndex:0,width:700,height:700,background:'rgba(0,255,136,0.04)',top:-150,right:-150,animation:'float 8s ease-in-out infinite' }} />
      <div style={{ position:'fixed',borderRadius:'50%',filter:'blur(100px)',pointerEvents:'none',zIndex:0,width:500,height:500,background:'rgba(59,130,246,0.025)',bottom:-100,left:-100,animation:'float 10s ease-in-out infinite reverse' }} />

      {/* Announcement */}
      <div style={{ background:'linear-gradient(90deg,rgba(0,255,136,0.07),rgba(0,255,136,0.1),rgba(0,255,136,0.07))',borderBottom:'1px solid rgba(0,255,136,0.1)',padding:'10px 32px',textAlign:'center',fontFamily:'JetBrains Mono, monospace',fontSize:'12px',color:'var(--text2)',letterSpacing:'0.5px',position:'relative',zIndex:101 }}>
        <span style={{ color:'var(--accent)',marginRight:'10px' }}>✦</span>
        Mobile push notifications now live for Pro & Premium users
        <Link href="/register" style={{ color:'var(--accent)',textDecoration:'none',marginLeft:'12px',fontWeight:600 }}>Try it →</Link>
      </div>

      <NavBar />

      {/* ── HERO ── */}
      <section style={{ minHeight:'100vh',display:'flex',alignItems:'center',padding:'120px 0 80px',position:'relative',zIndex:1,animationDelay:'0s' }}>
        <div style={{ ...W,width:'100%',position:'relative',zIndex:1 }}>
          <div className="hero-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'48px',alignItems:'center' }}>

            {/* Left */}
            <div>
              <div data-reveal="up" style={{ display:'inline-flex',alignItems:'center',gap:'9px',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--accent)',letterSpacing:'2px',textTransform:'uppercase',background:'rgba(0,255,136,0.06)',border:'1px solid rgba(0,255,136,0.18)',padding:'7px 16px',borderRadius:'20px',marginBottom:'36px',boxShadow:'0 0 24px rgba(0,255,136,0.05)' }}>
                <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)',animation:'pulseAnim 1.4s ease-in-out infinite' }} />
                Live · AI-Powered · Real-Time Job Matching
              </div>

              <h1 data-reveal="up" style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(48px,6vw,84px)',fontWeight:900,lineHeight:1.1,letterSpacing:'-2.5px',marginBottom:'28px',color:'var(--text)',overflow:'visible',paddingBottom:'4px' }}>
                Never miss<br />
                <span style={{ display:'inline-block',background:'linear-gradient(135deg,#00FF88 0%,#AFFFCC 40%,#00FF88 100%)',backgroundSize:'200% 200%',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',color:'transparent',animation:'gradShift 4s ease infinite',lineHeight:1.15,paddingBottom:'4px' }}>
                  a job posting.
                </span>
              </h1>

              <p data-reveal="up" style={{ fontSize:'18px',color:'var(--muted2)',lineHeight:1.8,maxWidth:'480px',marginBottom:'44px' }}>
                GetHiredASAP scans LinkedIn every 15 minutes, scores every opportunity against your resume using NLP, and delivers alerts before anyone else applies.
              </p>

              <div data-reveal="up" className="hb" style={{ display:'flex',gap:'14px',flexWrap:'wrap',marginBottom:'44px' }}>
                <Btn href="/register" primary large>Start for free →</Btn>
                <Btn href="#how" large>See how it works</Btn>
              </div>

              <div data-reveal="up" style={{ display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap' }}>
                <div style={{ display:'flex',alignItems:'center' }}>
                  {['#3B82F6','#00FF88','#F59E0B','#EC4899','#8B5CF6'].map((c,i)=>(
                    <div key={i} style={{ width:'30px',height:'30px',borderRadius:'50%',background:`linear-gradient(135deg,${c},${c}88)`,border:'2px solid var(--bg)',marginLeft:i>0?'-8px':'0',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'11px',color:'white' }}>{['S','M','P','A','R'][i]}</div>
                  ))}
                </div>
                <div>
                  <div style={{ display:'flex',gap:'2px',marginBottom:'2px' }}>{[1,2,3,4,5].map(i=><span key={i} style={{ color:'var(--amber)',fontSize:'12px' }}>★</span>)}</div>
                  <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--muted2)',letterSpacing:'0.5px' }}>Trusted by <span style={{ color:'var(--accent)' }}>847+</span> job seekers</p>
                </div>
              </div>
            </div>

            {/* Right — Radar + Floating Cards */}
            <div className="fc" style={{ position:'relative',height:'580px' }}>
              {mounted && (
                <>
                  <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-52%)',zIndex:1 }}>
                    <RadarGraphic />
                  </div>
                  <FloatingCards />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── STATS ── */}
      <div style={{ padding:'52px 0',position:'relative',zIndex:1 }}>
        <div style={{ ...W,display:'flex',justifyContent:'space-between',alignItems:'center',gap:'24px',flexWrap:'wrap' }}>
          {[{target:15,suffix:'min',label:'Scan interval'},{target:3,suffix:'+',label:'NLP layers'},{target:24,suffix:'/7',label:'Always running'},{target:100,suffix:'%',label:'Personalised'}].map((s,i)=>(
            <div key={i} data-reveal="up" style={{ textAlign:'center',flex:'1 1 120px' }}>
              <Counter target={s.target} suffix={s.suffix} />
              <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:'120px 0',position:'relative',zIndex:1,animationDelay:'0.1s' }}>
        <div style={W}>
          <div data-reveal="up" style={{ marginBottom:'64px' }}>
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'14px' }}>// features</p>
            <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(34px,4vw,56px)',fontWeight:700,lineHeight:1.1,letterSpacing:'-0.5px',color:'var(--text)',marginBottom:'16px' }}>Built for serious<br />job seekers</h2>
            <p style={{ fontSize:'17px',color:'var(--muted2)',maxWidth:'500px',lineHeight:1.8 }}>Every feature gives you an unfair advantage over other candidates.</p>
          </div>
          <div data-reveal="up" className="fg" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'20px',overflow:'hidden',gap:'1px',background:'rgba(255,255,255,0.035)' }}>
            {[
              {icon:'🤖',color:'green',title:'Semantic NLP Matching',  desc:'sentence-transformers understands meaning, not keywords. "Account executive" correctly matches "sales representative".',bg:'rgba(0,255,136,0.07)',border:'rgba(0,255,136,0.18)',glow:'rgba(0,255,136,0.15)'},
              {icon:'⚡',color:'blue', title:'Real-Time Alerts',       desc:'LinkedIn scanned every 15 minutes. You hear about opportunities before most applicants know they exist.',bg:'rgba(59,130,246,0.07)',border:'rgba(59,130,246,0.18)',glow:'rgba(59,130,246,0.15)'},
              {icon:'👥',color:'amber',title:'Fully Personalised',     desc:'Each user has their own resume and searches. Your feed is yours alone — no interference from other users.',bg:'rgba(245,158,11,0.07)',border:'rgba(245,158,11,0.18)',glow:'rgba(245,158,11,0.12)'},
              {icon:'⭐',color:'green',title:'Early Career Priority',  desc:'Detects entry-level and new-grad roles automatically. These always surface first in your personalised feed.',bg:'rgba(0,255,136,0.07)',border:'rgba(0,255,136,0.18)',glow:'rgba(0,255,136,0.15)'},
              {icon:'🎯',color:'blue', title:'Experience Matching',    desc:'Extracts years required from descriptions and adjusts your relevance score with smart gap tolerance.',bg:'rgba(59,130,246,0.07)',border:'rgba(59,130,246,0.18)',glow:'rgba(59,130,246,0.15)'},
              {icon:'💰',color:'amber',title:'Salary Intelligence',    desc:'Finds salary ranges in job descriptions automatically. See the compensation before clicking through.',bg:'rgba(245,158,11,0.07)',border:'rgba(245,158,11,0.18)',glow:'rgba(245,158,11,0.12)'},
            ].map(f=>(
              <div key={f.title} style={{ background:'var(--bg2)',padding:'34px 30px',transition:'background 0.3s',position:'relative',overflow:'hidden' }}
              onMouseEnter={e=>{
                e.currentTarget.style.background='rgba(255,255,255,0.035)'
                ;(e.currentTarget.querySelector('.fl') as HTMLElement).style.opacity='1'
                ;(e.currentTarget.querySelector('.fi') as HTMLElement).style.boxShadow=`0 0 24px ${f.glow}`
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.background='var(--bg2)'
                ;(e.currentTarget.querySelector('.fl') as HTMLElement).style.opacity='0'
                ;(e.currentTarget.querySelector('.fi') as HTMLElement).style.boxShadow='none'
              }}
              >
                <div className="fl" style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,255,136,0.5),transparent)',opacity:0,transition:'opacity 0.3s' }} />
                <div className="fi" style={{ width:'48px',height:'48px',borderRadius:'12px',background:f.bg,border:`1px solid ${f.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',marginBottom:'20px',transition:'box-shadow 0.3s' }}>{f.icon}</div>
                <div style={{ fontFamily:'Playfair Display, serif',fontSize:'18px',fontWeight:600,color:'var(--text)',marginBottom:'10px' }}>{f.title}</div>
                <div style={{ fontSize:'14px',color:'var(--muted2)',lineHeight:1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'120px 0',position:'relative',zIndex:1,animationDelay:'0.15s' }}>
        <div style={W}>
          <div data-reveal="up" style={{ textAlign:'center',marginBottom:'64px' }}>
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'14px' }}>// testimonials</p>
            <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(34px,4vw,56px)',fontWeight:700,lineHeight:1.1,color:'var(--text)',marginBottom:'16px' }}>People are getting<br />hired faster</h2>
          </div>
          <div data-reveal="up" className="tw" style={{ display:'flex',gap:'20px',flexWrap:'wrap' }}>
            {testimonials.map(t=><TestiCard key={t.name} {...t} />)}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding:'120px 0',position:'relative',zIndex:1,animationDelay:'0.2s' }}>
        <div style={W}>
          <div data-reveal="up" style={{ textAlign:'center',marginBottom:'72px' }}>
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'14px' }}>// how it works</p>
            <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(34px,4vw,56px)',fontWeight:700,lineHeight:1.1,color:'var(--text)',marginBottom:'16px' }}>From LinkedIn to<br />your phone in minutes</h2>
            <p style={{ fontSize:'17px',color:'var(--muted2)',maxWidth:'480px',margin:'0 auto',lineHeight:1.8 }}>A fully automated pipeline. Zero manual work required.</p>
          </div>
          <div data-reveal="up" className="sw sl" style={{ display:'flex',position:'relative',alignItems:'flex-start' }}>
            <div style={{ position:'absolute',top:'24px',left:'60px',right:'60px',height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,255,136,0.25),var(--accent),rgba(0,255,136,0.25),transparent)' }} />
            {[{n:'01',t:'Scan',d:'LinkedIn scanned every 15 min'},{n:'02',t:'Fetch',d:'Full description retrieved'},{n:'03',t:'Score',d:'NLP scored against your resume'},{n:'04',t:'Filter',d:'Only strong matches pass'},{n:'05',t:'Alert',d:'Instant notification sent'},].map(s=>(
              <div key={s.n} style={{ flex:1,textAlign:'center',padding:'0 14px' }}>
                <div style={{ width:'48px',height:'48px',borderRadius:'50%',border:'1px solid rgba(255,255,255,0.1)',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'JetBrains Mono, monospace',fontSize:'13px',color:'var(--accent)',margin:'0 auto 20px',position:'relative',zIndex:1,transition:'all 0.3s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 0 20px rgba(0,255,136,0.25)';e.currentTarget.style.background='rgba(0,255,136,0.08)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='var(--bg2)'}}
                >{s.n}</div>
                <div style={{ fontFamily:'Playfair Display, serif',fontSize:'15px',fontWeight:600,marginBottom:'8px' }}>{s.t}</div>
                <div style={{ fontSize:'13px',color:'var(--muted2)',lineHeight:1.6 }}>{s.d}</div>
              </div>
            ))}
          </div>

          {/* Alert mockup */}
          <div data-reveal="up" className="mg" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'72px',alignItems:'center',marginTop:'96px' }}>
            <div>
              <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'14px' }}>// sample match</p>
              <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(30px,3vw,44px)',fontWeight:700,lineHeight:1.1,color:'var(--text)',marginBottom:'18px' }}>What lands<br />on your phone</h2>
              <p style={{ fontSize:'15px',color:'var(--muted2)',lineHeight:1.8,marginBottom:'32px' }}>Every match includes a relevance score, salary if available, early career detection, and a direct link to apply. No noise — just signal.</p>
              <Btn href="/register" primary>Get started free →</Btn>
            </div>
            <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'20px',padding:'30px',boxShadow:'0 32px 80px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'12px',paddingBottom:'18px',marginBottom:'20px',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#3B82F6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0 }}>📡</div>
                <div><div style={{ fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px' }}>Radar</div><div style={{ fontSize:'12px',color:'var(--accent)' }}>● active · just now</div></div>
              </div>
              <div style={{ background:'rgba(0,255,136,0.05)',border:'1px solid rgba(0,255,136,0.12)',borderRadius:'14px',padding:'18px',marginBottom:'10px' }}>
                <div style={{ display:'flex',gap:'7px',marginBottom:'11px',flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',padding:'3px 9px',borderRadius:'5px',background:'rgba(245,158,11,0.1)',color:'#F59E0B',border:'1px solid rgba(245,158,11,0.2)' }}>⭐ Early career</span>
                  <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',padding:'3px 9px',borderRadius:'5px',background:'rgba(0,255,136,0.1)',color:'var(--accent)',border:'1px solid rgba(0,255,136,0.2)' }}>✅ Strong — 72%</span>
                </div>
                <div style={{ fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px',color:'#60A5FA',marginBottom:'7px' }}>Frontend Developer — React</div>
                <div style={{ fontSize:'13px',color:'var(--muted2)',lineHeight:1.8 }}>🏢 Shopify Inc. &nbsp;·&nbsp; 📍 Vancouver, BC<br />🕐 8 minutes ago &nbsp;·&nbsp; 💰 $28–$38/hr</div>
              </div>
              <div style={{ background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.12)',borderRadius:'14px',padding:'18px' }}>
                <div style={{ marginBottom:'11px' }}><span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',padding:'3px 9px',borderRadius:'5px',background:'rgba(59,130,246,0.1)',color:'#60A5FA',border:'1px solid rgba(59,130,246,0.2)' }}>👍 Good — 48%</span></div>
                <div style={{ fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'16px',color:'var(--text)',marginBottom:'7px' }}>Inside Sales Representative</div>
                <div style={{ fontSize:'13px',color:'var(--muted2)' }}>🏢 Telus &nbsp;·&nbsp; 📍 Downtown Vancouver<br />🕐 22 minutes ago</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding:'120px 0',position:'relative',zIndex:1,animationDelay:'0.25s' }}>
        <div style={W}>
          <div data-reveal="up" style={{ textAlign:'center',marginBottom:'72px' }}>
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'14px' }}>// pricing</p>
            <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(34px,4vw,56px)',fontWeight:700,lineHeight:1.1,color:'var(--text)',marginBottom:'16px' }}>Simple, transparent<br />pricing</h2>
            <p style={{ fontSize:'17px',color:'var(--muted2)',maxWidth:'400px',margin:'0 auto' }}>Start free. Upgrade when ready. Cancel anytime.</p>
          </div>
          <div data-reveal="up" className="pw" style={{ display:'flex',gap:'20px',justifyContent:'center',flexWrap:'wrap',alignItems:'stretch' }}>
            <PriceCard tier="Free"    price="0"  period="forever"   cta="Get started"   features={['Manual search only','1 job search','Basic NLP scoring','Web dashboard']} />
            <PriceCard tier="Pro"     price="9"  period="per month" cta="Get Pro →"     features={['Auto-alerts every 15 min','Up to 5 searches','Full NLP matching','Early career detection','Salary intelligence','Top matches history']} featured />
            <PriceCard tier="Premium" price="19" period="per month" cta="Get Premium →" features={['Auto-alerts every 5 min','Unlimited searches','Priority NLP scoring','Email alerts','Mobile push notifications','Priority support']} />
          </div>
          <p data-reveal="up" style={{ textAlign:'center',marginTop:'28px',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--muted)',letterSpacing:'0.5px' }}>Cancel anytime · Secure payment via Stripe · No hidden fees</p>
        </div>
      </section>

      <Divider />

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding:'120px 0',position:'relative',zIndex:1,animationDelay:'0.3s' }}>
        <div style={W}>
          <div data-reveal="up" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'80px',alignItems:'start' }}>
            <div>
              <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'14px' }}>// faq</p>
              <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(32px,3.5vw,48px)',fontWeight:700,lineHeight:1.1,color:'var(--text)',marginBottom:'18px' }}>Common<br />questions</h2>
              <p style={{ fontSize:'16px',color:'var(--muted2)',lineHeight:1.8,marginBottom:'32px' }}>Everything you need to know before getting started.</p>
              <Btn href="/register" primary>Start for free →</Btn>
            </div>
            <div style={{ display:'flex',flexDirection:'column' }}>
              {faqs.map(f=><FAQItem key={f.q} {...f} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:'80px 0',position:'relative',zIndex:1,animationDelay:'0.35s' }}>
        <div style={W}>
          <div data-reveal="up" className="cp" style={{ background:'var(--bg2)',border:'1px solid rgba(0,255,136,0.15)',borderRadius:'28px',padding:'80px 60px',textAlign:'center',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 0%,rgba(0,255,136,0.055) 0%,transparent 65%)',pointerEvents:'none' }} />
            <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,255,136,0.4),transparent)' }} />
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'20px' }}>// get started today</p>
            <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(34px,5vw,60px)',fontWeight:700,lineHeight:1.1,color:'var(--text)',marginBottom:'18px' }}>
              Your next opportunity<br />
              <span style={{ display:'inline-block',background:'linear-gradient(135deg,#00FF88 0%,#AFFFCC 40%,#00FF88 100%)',backgroundSize:'200% 200%',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',color:'transparent',animation:'gradShift 4s ease infinite' }}>
                is already posted.
              </span>
            </h2>
            <p style={{ fontSize:'17px',color:'var(--muted2)',maxWidth:'460px',margin:'0 auto 44px',lineHeight:1.8 }}>Set up GetHiredASAP in 2 minutes and get alerts before anyone else applies.</p>
            <div style={{ display:'flex',gap:'14px',justifyContent:'center',flexWrap:'wrap' }}>
              <Btn href="/register" primary large>Start for free →</Btn>
              <Btn href="#pricing" large>View pricing</Btn>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.05)',padding:'56px 0',position:'relative',zIndex:1 }}>
        <div style={{ ...W,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'28px' }}>
          <div>
            <div style={{ fontFamily:'Playfair Display, serif',fontWeight:700,fontSize:'24px',marginBottom:'6px' }}>GetHiredASAP</div>
            <div style={{ fontSize:'13px',color:'var(--muted2)' }}>AI-powered job matching · Built by Aryan Sawhney · Vancouver, BC</div>
          </div>
          <div style={{ display:'flex',gap:'24px',flexWrap:'wrap' }}>
            {[{h:'/login',l:'Dashboard'},{h:'/register',l:'Sign up'},{h:'#pricing',l:'Pricing'},{h:'#faq',l:'FAQ'},{h:'https://github.com/aryansawhney',l:'GitHub'},{h:'https://linkedin.com/in/aryansawhney',l:'LinkedIn'}].map(({h,l})=>(
              <Link key={h} href={h} style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'12px',color:'var(--muted)',textDecoration:'none',transition:'color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}
              >{l}</Link>
            ))}
          </div>
        </div>
      </footer>
    </>
  )
}