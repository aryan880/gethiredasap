'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'

// ── REUSABLE INPUT ──
function Field({ label, hint, children }: { label:string; hint?:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
        <label style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',fontWeight:500,letterSpacing:'2px',textTransform:'uppercase',color:'var(--muted2)' }}>{label}</label>
        {hint && <span style={{ fontSize:'11px',color:'var(--muted)',fontStyle:'italic' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type='text', mono=false, onFocus, onBlur, focused }: any) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      onFocus={onFocus} onBlur={onBlur}
      style={{ width:'100%',background:'var(--bg3)',border:`1px solid ${focused?'rgba(0,255,136,0.3)':'rgba(255,255,255,0.07)'}`,borderRadius:'10px',padding:'11px 14px',color:'var(--text)',fontFamily:mono?'JetBrains Mono, monospace':'DM Sans, sans-serif',fontSize:'14px',outline:'none',transition:'all 0.2s',boxShadow:focused?'0 0 0 3px rgba(0,255,136,0.06)':'none' }}
    />
  )
}

// ── SECTION ──
function Section({ icon, tag, title, desc, children, delay='0s' }: any) {
  return (
    <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:'18px',overflow:'hidden',marginBottom:'14px',animation:`fadeUp 0.5s ease ${delay} both` }}>
      {/* Header */}
      <div style={{ padding:'24px 28px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',paddingBottom:'20px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
          <div style={{ width:'38px',height:'38px',borderRadius:'10px',background:'rgba(0,255,136,0.07)',border:'1px solid rgba(0,255,136,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0 }}>{icon}</div>
          <div>
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',color:'var(--accent)',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'3px' }}>{tag}</p>
            <h2 style={{ fontFamily:'Playfair Display, serif',fontSize:'18px',fontWeight:700,color:'var(--text)',lineHeight:1.2 }}>{title}</h2>
          </div>
        </div>
        {desc && <p style={{ fontSize:'13px',color:'var(--muted2)',marginTop:'10px',lineHeight:1.6 }}>{desc}</p>}
      </div>
      <div style={{ padding:'24px 28px' }}>{children}</div>
    </div>
  )
}

// ── RESUME ──
function ResumeSection() {
  const { user, updateUser } = useAuthStore()
  const [text, setText] = useState(user?.resumeText || '')
  const [saving, setSaving] = useState(false)
  const [focused, setFocused] = useState(false)

  async function save() {
    setSaving(true)
    try { await api.post('/users/resume',{resumeText:text}); updateUser({resumeText:text}); toast.success('Resume saved ✓') }
    catch(err:any){ toast.error(err.response?.data?.error||'Failed to save') }
    finally{ setSaving(false) }
  }

  const words   = text.trim().split(/\s+/).filter(Boolean).length
  const quality = text.length<100 ? {label:'Too short',color:'#EF4444',pct:10}
    : text.length<300 ? {label:'Basic',color:'#F59E0B',pct:35}
    : text.length<600 ? {label:'Good',color:'#60A5FA',pct:65}
    : text.length<1000 ? {label:'Great',color:'#00FF88',pct:85}
    : {label:'Excellent',color:'#00FF88',pct:100}

  return (
    <Section icon="📄" tag="// resume" title="Resume Text" desc="Paste your full resume. More detail means better NLP matching — aim for 600+ characters." delay="0.05s">
      <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
        <textarea value={text} onChange={e=>setText(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder={"Paste your full resume here...\n\nInclude:\n• Work experience with dates and responsibilities\n• Technical skills and tools\n• Education\n• Achievements and metrics\n\nThe more detail, the better your matches."}
          style={{ width:'100%',background:'var(--bg3)',border:`1px solid ${focused?'rgba(0,255,136,0.3)':'rgba(255,255,255,0.07)'}`,borderRadius:'12px',padding:'14px 16px',color:'var(--text)',fontFamily:'DM Sans, sans-serif',fontSize:'13.5px',lineHeight:'1.7',resize:'vertical',minHeight:'200px',outline:'none',transition:'all 0.2s',boxShadow:focused?'0 0 0 3px rgba(0,255,136,0.06)':'none' }}
        />

        {/* Quality bar */}
        <div>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px' }}>
            <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--muted)' }}>{words} words · {text.length.toLocaleString()} chars</span>
            <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',padding:'2px 9px',borderRadius:'5px',background:`${quality.color}12`,color:quality.color,border:`1px solid ${quality.color}25` }}>{quality.label}</span>
          </div>
          <div style={{ height:'3px',background:'rgba(255,255,255,0.05)',borderRadius:'2px',overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${quality.pct}%`,background:quality.color,borderRadius:'2px',transition:'width 0.5s ease' }} />
          </div>
        </div>

        <div style={{ display:'flex',justifyContent:'flex-end' }}>
          <button onClick={save} disabled={saving||text.length<50}
            style={{ padding:'10px 24px',borderRadius:'9px',background:saving?'rgba(0,255,136,0.5)':'var(--accent)',color:'var(--bg)',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'13px',border:'none',cursor:saving||text.length<50?'not-allowed':'pointer',opacity:text.length<50?0.4:1,transition:'all 0.2s' }}
            onMouseEnter={e=>{ if(!saving&&text.length>=50){e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 20px rgba(0,255,136,0.3)'} }}
            onMouseLeave={e=>{e.currentTarget.style.background=saving?'rgba(0,255,136,0.5)':'var(--accent)';e.currentTarget.style.boxShadow='none'}}
          >{saving?'Saving...':'Save Resume'}</button>
        </div>
      </div>
    </Section>
  )
}

// ── SEARCHES ──
function SearchesSection() {
  const qc = useQueryClient()
  const [role, setRole]   = useState('')
  const [loc,  setLoc]    = useState('')
  const [rf, setRF]       = useState(false)
  const [lf, setLF]       = useState(false)
  const [adding, setAdding] = useState(false)

  const { data } = useQuery({ queryKey:['searches'], queryFn:()=>api.get('/users/searches').then(r=>r.data.searches) })
  const searches = data || []

  async function add(e: React.FormEvent) {
    e.preventDefault(); if(!role||!loc) return
    setAdding(true)
    try { await api.post('/users/searches',{role,location:loc}); qc.invalidateQueries({queryKey:['searches']}); setRole(''); setLoc(''); toast.success('Search added') }
    catch(err:any){ toast.error(err.response?.data?.error||'Failed') }
    finally{ setAdding(false) }
  }

  async function remove(id: string) {
    try{ await api.delete(`/users/searches/${id}`); qc.invalidateQueries({queryKey:['searches']}); toast.success('Removed') }
    catch{ toast.error('Failed') }
  }

  return (
    <Section icon="🔍" tag="// searches" title="Job Searches" desc="Add role + location pairs. The Job Radar automatically scans all of them every 15 minutes." delay="0.1s">
      <form onSubmit={add} style={{ display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'10px',marginBottom:'20px',alignItems:'end' }}>
        <Field label="Job Role">
          <TextInput value={role} onChange={(e:any)=>setRole(e.target.value)} placeholder="e.g. Sales Representative" focused={rf} onFocus={()=>setRF(true)} onBlur={()=>setRF(false)} />
        </Field>
        <Field label="Location">
          <TextInput value={loc} onChange={(e:any)=>setLoc(e.target.value)} placeholder="e.g. Vancouver, BC, Canada" focused={lf} onFocus={()=>setLF(true)} onBlur={()=>setLF(false)} />
        </Field>
        <button type="submit" disabled={adding||!role||!loc}
          style={{ padding:'11px 20px',borderRadius:'10px',background:'var(--accent)',color:'var(--bg)',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'13px',border:'none',cursor:(!role||!loc)?'not-allowed':'pointer',opacity:(!role||!loc)?0.45:1,transition:'all 0.2s',whiteSpace:'nowrap' }}
          onMouseEnter={e=>{if(role&&loc&&!adding){e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 16px rgba(0,255,136,0.3)'}}}
          onMouseLeave={e=>{e.currentTarget.style.background='var(--accent)';e.currentTarget.style.boxShadow='none'}}
        >+ Add Search</button>
      </form>

      {searches.length === 0 ? (
        <div style={{ textAlign:'center',padding:'28px 0',borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--muted)',letterSpacing:'1.5px' }}>NO SEARCHES YET · ADD ONE ABOVE</p>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:'8px',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'16px' }}>
          {searches.map((s:any, i:number)=>(
            <div key={s.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--bg3)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:'10px',padding:'12px 16px',transition:'border-color 0.2s',animation:`fadeUp 0.3s ease ${i*0.05}s both` }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,255,136,0.12)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.055)'}
            >
              <div style={{ display:'flex',alignItems:'center',gap:'14px' }}>
                <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--accent)',opacity:0.5 }}>#{i+1}</span>
                <div>
                  <p style={{ fontSize:'14px',fontWeight:500,marginBottom:'2px' }}>{s.role}</p>
                  <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--muted2)' }}>📍 {s.location}</p>
                </div>
              </div>
              <button onClick={()=>remove(s.id)}
                style={{ padding:'5px 12px',borderRadius:'7px',background:'transparent',border:'1px solid rgba(239,68,68,0.18)',color:'rgba(239,68,68,0.7)',fontFamily:'JetBrains Mono, monospace',fontSize:'10px',cursor:'pointer',transition:'all 0.2s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.07)';e.currentTarget.style.borderColor='rgba(239,68,68,0.35)';e.currentTarget.style.color='#EF4444'}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='rgba(239,68,68,0.18)';e.currentTarget.style.color='rgba(239,68,68,0.7)'}}
              >Remove</button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── PREFERENCES ──
function PrefsSection() {
  const { user, updateUser } = useAuthStore()
  const [threshold, setThreshold] = useState(user?.threshold||15)
  const [interval,  setInterval]  = useState(user?.intervalMinutes||15)
  const [active,    setActive]    = useState(user?.isActive??true)
  const [saving,    setSaving]    = useState(false)

  async function save() {
    setSaving(true)
    try { await api.put('/users/me',{threshold,intervalMinutes:interval,isActive:active}); updateUser({threshold,intervalMinutes:interval,isActive:active}); toast.success('Preferences saved ✓') }
    catch(err:any){ toast.error(err.response?.data?.error||'Failed') }
    finally{ setSaving(false) }
  }

  const threshHint = threshold<=15?'Most jobs shown':threshold<=30?'Balanced':threshold<=50?'Strong matches only':'Best matches only'

  return (
    <Section icon="⚙️" tag="// preferences" title="Alert Preferences" desc="Control your match threshold, scan frequency, and alert status." delay="0.15s">
      <div style={{ display:'flex',flexDirection:'column',gap:'24px' }}>

        {/* Threshold */}
        <Field label="Match Threshold" hint={threshHint}>
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px' }}>
              <div style={{ display:'flex',gap:'8px' }}>
                {[15,25,35,50,65].map(v=>(
                  <button key={v} onClick={()=>setThreshold(v)}
                    style={{ padding:'4px 10px',borderRadius:'6px',fontFamily:'JetBrains Mono, monospace',fontSize:'10px',border:'none',cursor:'pointer',transition:'all 0.15s',
                      background: threshold===v?'rgba(0,255,136,0.1)':'var(--bg3)',
                      color: threshold===v?'var(--accent)':'var(--muted2)',
                      borderWidth:'1px',borderStyle:'solid',
                      borderColor: threshold===v?'rgba(0,255,136,0.25)':'rgba(255,255,255,0.06)',
                    }}
                  >{v}%</button>
                ))}
              </div>
              <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'15px',fontWeight:700,color:'var(--accent)' }}>{threshold}%</span>
            </div>
            <input type="range" min={5} max={80} step={5} value={threshold} onChange={e=>setThreshold(Number(e.target.value))}
              style={{ width:'100%',accentColor:'var(--accent)',cursor:'pointer',height:'3px' }} />
          </div>
        </Field>

        <div style={{ height:'1px',background:'rgba(255,255,255,0.05)' }} />

        {/* Interval */}
        <Field label="Scan Interval">
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'10px' }}>
              <div style={{ display:'flex',gap:'8px' }}>
                {[5,15,30,60].map(v=>(
                  <button key={v} onClick={()=>setInterval(v)}
                    style={{ padding:'4px 10px',borderRadius:'6px',fontFamily:'JetBrains Mono, monospace',fontSize:'10px',border:'none',cursor:'pointer',transition:'all 0.15s',
                      background: interval===v?'rgba(0,255,136,0.1)':'var(--bg3)',
                      color: interval===v?'var(--accent)':'var(--muted2)',
                      borderWidth:'1px',borderStyle:'solid',
                      borderColor: interval===v?'rgba(0,255,136,0.25)':'rgba(255,255,255,0.06)',
                    }}
                  >{v}m</button>
                ))}
              </div>
              <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'15px',fontWeight:700,color:'var(--accent)' }}>Every {interval} min</span>
            </div>
            <input type="range" min={5} max={60} step={5} value={interval} onChange={e=>setInterval(Number(e.target.value))}
              style={{ width:'100%',accentColor:'var(--accent)',cursor:'pointer',height:'3px' }} />
          </div>
        </Field>

        <div style={{ height:'1px',background:'rgba(255,255,255,0.05)' }} />

        {/* Active toggle */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--bg3)',border:`1px solid ${active?'rgba(0,255,136,0.15)':'rgba(255,255,255,0.06)'}`,borderRadius:'12px',padding:'16px 20px',transition:'border-color 0.25s' }}>
          <div>
            <p style={{ fontSize:'14px',fontWeight:500,marginBottom:'3px' }}>Alert Status</p>
            <p style={{ fontSize:'12px',color:'var(--muted2)' }}>{active ? '🟢 Job Radar is actively scanning' : '⏸ Alerts are paused'}</p>
          </div>
          <button onClick={()=>setActive(!active)} style={{ width:'52px',height:'28px',borderRadius:'14px',background:active?'rgba(0,255,136,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${active?'rgba(0,255,136,0.35)':'rgba(255,255,255,0.1)'}`,cursor:'pointer',position:'relative',transition:'all 0.25s',flexShrink:0 }}>
            <div style={{ position:'absolute',top:'4px',width:'18px',height:'18px',borderRadius:'50%',background:active?'var(--accent)':'var(--muted)',transition:'all 0.25s',left:active?'28px':'4px',boxShadow:active?'0 0 8px rgba(0,255,136,0.4)':'none' }} />
          </button>
        </div>

        <button onClick={save} disabled={saving}
          style={{ width:'100%',padding:'13px',borderRadius:'10px',background:'var(--accent)',color:'var(--bg)',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'14px',border:'none',cursor:saving?'not-allowed':'pointer',transition:'all 0.2s' }}
          onMouseEnter={e=>{if(!saving){e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 24px rgba(0,255,136,0.3)'}}}
          onMouseLeave={e=>{e.currentTarget.style.background='var(--accent)';e.currentTarget.style.boxShadow='none'}}
        >{saving?'Saving...':'Save Preferences'}</button>
      </div>
    </Section>
  )
}

// ── ACCOUNT ──
function AccountSection() {
  const { user } = useAuthStore()
  const tierColor = user?.tier==='PREMIUM'?'#a78bfa':'var(--accent)'

  return (
    <Section icon="👤" tag="// account" title="Account Details" delay="0.2s">
      <div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'20px' }}>
          {[{l:'Name',v:user?.name},{l:'Email',v:user?.email}].map(i=>(
            <div key={i.l} style={{ background:'var(--bg3)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'10px',padding:'14px 16px' }}>
              <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',color:'var(--muted2)',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:'5px' }}>{i.l}</p>
              <p style={{ fontSize:'14px',color:'var(--text)',fontWeight:500 }}>{i.v}</p>
            </div>
          ))}
        </div>

        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--bg3)',border:`1px solid ${tierColor}18`,borderRadius:'12px',padding:'16px 20px' }}>
          <div>
            <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',color:'var(--muted2)',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:'5px' }}>Current Plan</p>
            <p style={{ fontSize:'14px',fontWeight:600,color:'var(--text)' }}>{user?.tier||'Free'}</p>
          </div>
          <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',letterSpacing:'1.5px',padding:'5px 14px',borderRadius:'20px',background:`${tierColor}12`,color:tierColor,border:`1px solid ${tierColor}28`,textTransform:'uppercase' }}>
            {user?.tier||'FREE'}
          </span>
        </div>

        {user?.tier==='FREE' && (
          <div style={{ marginTop:'14px',padding:'18px 20px',background:'rgba(0,255,136,0.03)',border:'1px solid rgba(0,255,136,0.1)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexWrap:'wrap' }}>
            <div>
              <p style={{ fontSize:'14px',fontWeight:500,marginBottom:'3px' }}>Unlock auto-alerts</p>
              <p style={{ fontSize:'12px',color:'var(--muted2)' }}>Upgrade for faster scanning, unlimited searches, and priority NLP</p>
            </div>
            <a href="/pricing" style={{ padding:'9px 20px',borderRadius:'8px',background:'var(--accent)',color:'var(--bg)',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'13px',textDecoration:'none',transition:'all 0.2s',whiteSpace:'nowrap',flexShrink:0 }}
            onMouseEnter={e=>{e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 16px rgba(0,255,136,0.3)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='var(--accent)';e.currentTarget.style.boxShadow='none'}}
            >View pricing →</a>
          </div>
        )}
      </div>
    </Section>
  )
}

export default function SettingsPage() {
  return (
    <div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}`}</style>

      <div style={{ marginBottom:'36px',animation:'fadeUp 0.5s ease both' }}>
        <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'8px' }}>// settings</p>
        <h1 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(30px,4vw,48px)',fontWeight:700,color:'var(--text)',letterSpacing:'-0.5px',marginBottom:'6px' }}>Your Profile</h1>
        <p style={{ color:'var(--muted2)',fontSize:'13px' }}>Configure your resume, job searches, and alert preferences</p>
      </div>

      <ResumeSection />
      <SearchesSection />
      <PrefsSection />
      <AccountSection />
    </div>
  )
}