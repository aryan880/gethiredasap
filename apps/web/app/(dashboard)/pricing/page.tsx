'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'

function PricingCard({ price, isCurrentPlan }: { price:any; isCurrentPlan:boolean }) {
  const [loading, setLoading] = useState(false)
  const isPro  = price.tier === 'PRO'
  const isPrem = price.tier === 'PREMIUM'
  const accent = isPro ? '#00FF88' : '#a78bfa'

  async function checkout() {
    setLoading(true)
    try { const res = await api.post('/stripe/checkout',{priceId:price.id}); window.location.href = res.data.url }
    catch(err:any){ toast.error(err.response?.data?.error||'Failed'); setLoading(false) }
  }

  return (
    <div style={{
      background: isPro ? 'linear-gradient(160deg,#0D0F14 0%,rgba(0,255,136,0.03) 100%)' : '#0D0F14',
      border:`1px solid ${isCurrentPlan?`${accent}40`:isPro?'rgba(0,255,136,0.18)':isPrem?'rgba(167,139,250,0.15)':'rgba(255,255,255,0.07)'}`,
      borderRadius:'20px',padding:'32px',
      display:'flex',flexDirection:'column',
      flex:'1 1 260px',minWidth:'240px',maxWidth:'340px',
      position:'relative',overflow:'hidden',
      transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1),box-shadow 0.25s',
    }}
    onMouseEnter={e=>{
      e.currentTarget.style.transform='translateY(-6px)'
      e.currentTarget.style.boxShadow=`0 20px 64px rgba(0,0,0,0.5), 0 0 0 1px ${accent}18`
    }}
    onMouseLeave={e=>{
      e.currentTarget.style.transform='translateY(0)'
      e.currentTarget.style.boxShadow='none'
    }}
    >
      {/* Top accent */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,transparent,${accent}80,transparent)`,opacity:isPro||isPrem?1:0 }} />

      {/* Tier + badge */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'22px' }}>
        <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',letterSpacing:'3px',textTransform:'uppercase',color:accent }}>{price.tier}</span>
        {isPro  && <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',padding:'3px 10px',borderRadius:'20px',background:'rgba(0,255,136,0.08)',color:'#00FF88',border:'1px solid rgba(0,255,136,0.22)',letterSpacing:'1px' }}>POPULAR</span>}
        {isPrem && <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',padding:'3px 10px',borderRadius:'20px',background:'rgba(167,139,250,0.08)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.22)',letterSpacing:'1px' }}>BEST VALUE</span>}
      </div>

      {/* Price */}
      <div style={{ display:'flex',alignItems:'flex-end',gap:'3px',marginBottom:'5px' }}>
        <span style={{ fontFamily:'Playfair Display, serif',fontSize:'20px',fontWeight:700,color:'var(--muted2)',paddingBottom:'9px',lineHeight:1 }}>$</span>
        <span style={{ fontFamily:'Playfair Display, serif',fontSize:'56px',fontWeight:700,color:'var(--text)',lineHeight:1 }}>{price.amount/100}</span>
      </div>
      <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--muted)',marginBottom:'22px' }}>per month · cancel anytime</p>

      <div style={{ height:'1px',background:'rgba(255,255,255,0.06)',marginBottom:'22px' }} />

      {/* Features */}
      <ul style={{ listStyle:'none',flex:1,display:'flex',flexDirection:'column',gap:'10px',marginBottom:'28px' }}>
        {price.features.map((f:string)=>(
          <li key={f} style={{ display:'flex',alignItems:'flex-start',gap:'9px',fontSize:'13px',color:'var(--muted2)',lineHeight:1.5 }}>
            <span style={{ color:accent,fontWeight:700,fontSize:'13px',flexShrink:0,marginTop:'1px' }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrentPlan ? (
        <div style={{ padding:'12px',background:`${accent}07`,border:`1px solid ${accent}20`,borderRadius:'10px',textAlign:'center',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',letterSpacing:'1px',color:accent }}>
          ✓ CURRENT PLAN
        </div>
      ) : (
        <button onClick={checkout} disabled={loading}
          style={{ padding:'13px',borderRadius:'10px',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'14px',border:'none',cursor:loading?'not-allowed':'pointer',transition:'all 0.2s',
            ...(isPro ? {background:'#00FF88',color:'#07080C'} : {background:`${accent}10`,color:accent,borderWidth:'1px',borderStyle:'solid',borderColor:`${accent}30`})
          }}
          onMouseEnter={e=>{
            if(!loading){
              if(isPro){e.currentTarget.style.background='#00FFAA';e.currentTarget.style.boxShadow='0 0 24px rgba(0,255,136,0.3)'}
              else{e.currentTarget.style.background=`${accent}18`;e.currentTarget.style.borderColor=`${accent}50`}
            }
          }}
          onMouseLeave={e=>{
            if(isPro){e.currentTarget.style.background='#00FF88';e.currentTarget.style.boxShadow='none'}
            else{e.currentTarget.style.background=`${accent}10`;e.currentTarget.style.borderColor=`${accent}30`}
          }}
        >
          {loading ? 'Redirecting...' : `Get ${price.tier} →`}
        </button>
      )}
    </div>
  )
}

function CompareTable() {
  const rows = [
    { feature:'Auto-alerts',          free:'Manual only', pro:'Every 15 min', prem:'Every 5 min' },
    { feature:'Job searches',         free:'1',           pro:'Up to 5',      prem:'Unlimited' },
    { feature:'NLP matching',         free:'Basic',       pro:'Full semantic', prem:'Priority' },
    { feature:'Early career detect',  free:'✗',           pro:'✓',            prem:'✓' },
    { feature:'Salary extraction',    free:'✗',           pro:'✓',            prem:'✓' },
    { feature:'Top matches history',  free:'✗',           pro:'✓',            prem:'✓' },
    { feature:'Email alerts',         free:'✗',           pro:'✗',            prem:'✓' },
    { feature:'Mobile push notifs',   free:'✗',           pro:'✗',            prem:'✓' },
    { feature:'Priority support',     free:'✗',           pro:'✗',            prem:'✓' },
  ]

  return (
    <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',overflow:'hidden',marginTop:'28px',animation:'fadeUp 0.5s ease 0.15s both' }}>
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {['Feature','Free','Pro','Premium'].map((h,i)=>(
          <div key={h} style={{ padding:'14px 20px',fontFamily:'JetBrains Mono, monospace',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:i===0?'var(--muted2)':i===1?'var(--muted)':i===2?'#00FF88':'#a78bfa',borderLeft:i>0?'1px solid rgba(255,255,255,0.05)':undefined }}>{h}</div>
        ))}
      </div>
      {rows.map((r,i)=>(
        <div key={r.feature} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',borderBottom:i<rows.length-1?'1px solid rgba(255,255,255,0.04)':undefined,transition:'background 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.015)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        >
          <div style={{ padding:'13px 20px',fontSize:'13px',color:'var(--text2)' }}>{r.feature}</div>
          {[r.free,r.pro,r.prem].map((v,j)=>(
            <div key={j} style={{ padding:'13px 20px',borderLeft:'1px solid rgba(255,255,255,0.04)',
              color: v==='✓'?'#00FF88':v==='✗'?'var(--muted)':j===2?'#a78bfa':j===1?'#00FF88':'var(--muted2)',
              fontFamily: v==='✓'||v==='✗' ? 'DM Sans, sans-serif' : 'JetBrains Mono, monospace',
              fontSize: v==='✓'||v==='✗' ? '15px' : '12px',
            }}>{v}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function RedeemSection() {
  const { updateUser } = useAuthStore()
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)

  async function redeem(e: React.FormEvent) {
    e.preventDefault(); if(!code) return
    setLoading(true)
    try { const res=await api.post('/stripe/redeem',{code}); updateUser({tier:res.data.tier}); toast.success(res.data.message); setCode('') }
    catch(err:any){ toast.error(err.response?.data?.error||'Invalid code') }
    finally{ setLoading(false) }
  }

  return (
    <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'24px 28px',marginTop:'16px',animation:'fadeUp 0.5s ease 0.2s both' }}>
      <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px' }}>
        <div style={{ width:'32px',height:'32px',borderRadius:'8px',background:'rgba(0,255,136,0.07)',border:'1px solid rgba(0,255,136,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px' }}>🎟</div>
        <div>
          <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',color:'var(--accent)',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'2px' }}>// invite code</p>
          <p style={{ fontSize:'13px',color:'var(--muted2)' }}>Have a promo or invite code? Redeem it below.</p>
        </div>
      </div>
      <form onSubmit={redeem} style={{ display:'flex',gap:'10px' }}>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder="PRO-XXXXXX"
          style={{ flex:1,background:'var(--bg3)',border:`1px solid ${focused?'rgba(0,255,136,0.3)':'rgba(255,255,255,0.07)'}`,borderRadius:'9px',padding:'10px 14px',color:'var(--text)',fontFamily:'JetBrains Mono, monospace',fontSize:'14px',letterSpacing:'2px',outline:'none',transition:'all 0.2s',boxShadow:focused?'0 0 0 3px rgba(0,255,136,0.06)':'none' }}
        />
        <button type="submit" disabled={loading||!code}
          style={{ padding:'10px 20px',borderRadius:'9px',background:'var(--accent)',color:'var(--bg)',fontFamily:'DM Sans, sans-serif',fontWeight:700,fontSize:'13px',border:'none',cursor:!code?'not-allowed':'pointer',opacity:!code?0.45:1,transition:'all 0.2s',whiteSpace:'nowrap' }}
          onMouseEnter={e=>{if(code&&!loading){e.currentTarget.style.background='#00FFAA'}}}
          onMouseLeave={e=>{e.currentTarget.style.background='var(--accent)'}}
        >{loading?'...':'Redeem'}</button>
      </form>
    </div>
  )
}

export default function PricingPage() {
  const { user } = useAuthStore()
  const [showCompare, setShowCompare] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey:['prices'],
    queryFn:()=>api.get('/stripe/prices').then(r=>r.data.prices),
  })
  const prices = data || []

  return (
    <div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}`}</style>

      {/* Header */}
      <div style={{ textAlign:'center',marginBottom:'52px',animation:'fadeUp 0.5s ease both' }}>
        <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'10px' }}>// pricing</p>
        <h1 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(34px,4vw,54px)',fontWeight:700,lineHeight:1.1,letterSpacing:'-1px',color:'var(--text)',marginBottom:'12px' }}>
          Get hired faster.
        </h1>
        <p style={{ color:'var(--muted2)',fontSize:'15px',maxWidth:'440px',margin:'0 auto 16px',lineHeight:1.75 }}>
          Start free. Upgrade when you're ready. Every plan includes AI-powered NLP matching.
        </p>
        {user?.tier && user.tier !== 'FREE' && (
          <span style={{ display:'inline-block',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',letterSpacing:'1.5px',padding:'5px 14px',borderRadius:'20px',background:'rgba(0,255,136,0.07)',color:'var(--accent)',border:'1px solid rgba(0,255,136,0.2)' }}>
            ✓ You are on the {user.tier} plan
          </span>
        )}
      </div>

      {/* Free tier */}
      <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'14px',padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',animation:'fadeUp 0.5s ease 0.05s both',flexWrap:'wrap',gap:'10px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
          <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--muted2)',letterSpacing:'2px',textTransform:'uppercase' }}>FREE</span>
          <span style={{ width:'1px',height:'20px',background:'rgba(255,255,255,0.08)' }} />
          <p style={{ fontSize:'13px',color:'var(--muted2)' }}>Manual search · 1 job search · Basic NLP · No auto-alerts</p>
        </div>
        <span style={{ fontFamily:'Playfair Display, serif',fontSize:'22px',fontWeight:700,color:'var(--muted)' }}>$0</span>
      </div>

      {/* Paid plans */}
      {isLoading ? (
        <div style={{ display:'flex',gap:'14px',flexWrap:'wrap' }}>
          {[1,2].map(i=><div key={i} style={{ flex:'1 1 260px',height:'380px',background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'20px',backgroundImage:'linear-gradient(90deg,var(--bg2) 25%,rgba(255,255,255,0.03) 50%,var(--bg2) 75%)',backgroundSize:'200% 100%',animation:'shimmer 1.5s infinite' }} />)}
        </div>
      ) : (
        <div style={{ display:'flex',gap:'14px',flexWrap:'wrap',justifyContent:'center',animation:'fadeUp 0.5s ease 0.1s both' }}>
          {prices.map((p:any)=><PricingCard key={p.id} price={p} isCurrentPlan={user?.tier===p.tier} />)}
        </div>
      )}

      {/* Compare toggle */}
      <div style={{ textAlign:'center',marginTop:'24px',animation:'fadeUp 0.5s ease 0.12s both' }}>
        <button onClick={()=>setShowCompare(!showCompare)}
          style={{ padding:'8px 20px',borderRadius:'8px',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',color:'var(--muted2)',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',cursor:'pointer',transition:'all 0.2s',letterSpacing:'0.5px' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,255,136,0.2)';e.currentTarget.style.color='var(--accent)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';e.currentTarget.style.color='var(--muted2)'}}
        >{showCompare ? '↑ Hide comparison' : '↓ Compare all features'}</button>
      </div>

      {showCompare && <CompareTable />}

      <RedeemSection />

      <p style={{ textAlign:'center',marginTop:'24px',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--muted)',letterSpacing:'0.5px',animation:'fadeUp 0.5s ease 0.25s both' }}>
        Cancel anytime · Secure payments via Stripe · No hidden fees
      </p>
      <style>{`@keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}`}</style>
    </div>
  )
}