'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const medals = ['🥇','🥈','🥉']

function TopCard({ match, rank }: { match: any; rank: number }) {
  const score = Math.round(match.score)
  const isMedal = rank <= 3
  const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'var(--muted2)'

  return (
    <div style={{
      background:'var(--bg2)',
      border:`1px solid ${isMedal ? `${medalColor}25` : 'rgba(255,255,255,0.06)'}`,
      borderRadius:'16px',padding:'20px 24px',
      position:'relative',overflow:'hidden',
      transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      animation:`fadeUp 0.4s ease ${rank * 0.05}s both`,
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 12px 40px rgba(0,0,0,0.4)`}}
    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
    >
      {/* Top shimmer for medal ranks */}
      {isMedal && <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:`linear-gradient(90deg,transparent,${medalColor}60,transparent)` }} />}

      <div style={{ display:'flex',alignItems:'center',gap:'18px' }}>
        {/* Rank */}
        <div style={{ flexShrink:0,width:'52px',textAlign:'center' }}>
          {isMedal ? (
            <span style={{ fontSize:'28px',lineHeight:1 }}>{medals[rank-1]}</span>
          ) : (
            <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'18px',fontWeight:700,color:'var(--muted)',lineHeight:1 }}>#{rank}</span>
          )}
        </div>

        {/* Score ring */}
        <div style={{ flexShrink:0,position:'relative',width:'52px',height:'52px' }}>
          <svg width="52" height="52" style={{ transform:'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="26" cy="26" r="22" fill="none"
              stroke={score >= 70 ? '#00FF88' : score >= 50 ? '#60A5FA' : '#F59E0B'}
              strokeWidth="3"
              strokeDasharray={`${(score/100) * 138} 138`}
              strokeLinecap="round"
            />
          </svg>
          <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',fontWeight:600,color:'var(--text)' }}>
            {score}%
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',gap:'6px',marginBottom:'6px',flexWrap:'wrap' }}>
            {match.isEarlyCareer && (
              <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'9px',padding:'2px 8px',borderRadius:'4px',background:'rgba(245,158,11,0.08)',color:'#FBB724',border:'1px solid rgba(245,158,11,0.2)' }}>⭐ EARLY</span>
            )}
          </div>
          <a href={match.job?.link} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily:'Playfair Display, serif',fontSize:'16px',fontWeight:600,color:'var(--text)',textDecoration:'none',display:'block',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',transition:'color 0.2s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text)'}
          >
            {match.job?.title}
          </a>
          <div style={{ display:'flex',gap:'14px',flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px',color:'var(--text2)' }}>🏢 {match.job?.company}</span>
            <span style={{ fontSize:'13px',color:'var(--muted2)' }}>📍 {match.job?.location}</span>
            {match.job?.salary && <span style={{ fontSize:'13px',color:'var(--muted2)' }}>💰 {match.job.salary}</span>}
          </div>
        </div>

        {/* Apply */}
        <a href={match.job?.link} target="_blank" rel="noopener noreferrer"
          style={{ flexShrink:0,padding:'8px 16px',borderRadius:'8px',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--accent)',background:'rgba(0,255,136,0.07)',border:'1px solid rgba(0,255,136,0.2)',textDecoration:'none',transition:'all 0.2s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,255,136,0.14)';e.currentTarget.style.borderColor='rgba(0,255,136,0.4)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,255,136,0.07)';e.currentTarget.style.borderColor='rgba(0,255,136,0.2)'}}
        >
          Apply →
        </a>
      </div>
    </div>
  )
}

export default function TopPage() {
  const { data, isLoading } = useQuery({
    queryKey:['top-jobs'],
    queryFn:()=>api.get('/jobs/top').then(r=>r.data),
  })

  const jobs = data?.jobs || []

  return (
    <div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:'40px',animation:'fadeUp 0.5s ease both' }}>
        <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'10px',color:'var(--accent)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:'10px' }}>// top matches</p>
        <h1 style={{ fontFamily:'Playfair Display, serif',fontSize:'clamp(32px,4vw,52px)',fontWeight:700,lineHeight:1.05,letterSpacing:'-1px',color:'var(--text)',marginBottom:'8px' }}>
          Your best<br /><span style={{ color:'var(--accent)' }}>opportunities.</span>
        </h1>
        <p style={{ color:'var(--muted2)',fontSize:'14px' }}>Ranked by NLP relevance score · Updated every scan</p>
      </div>

      {/* Podium for top 3 */}
      {!isLoading && jobs.length >= 3 && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1.1fr 1fr',gap:'12px',marginBottom:'24px',alignItems:'end',animation:'fadeUp 0.5s ease 0.1s both' }}>
          {/* 2nd */}
          <div style={{ background:'linear-gradient(180deg,rgba(192,192,192,0.06) 0%,var(--bg2) 100%)',border:'1px solid rgba(192,192,192,0.15)',borderRadius:'16px',padding:'20px',textAlign:'center',transition:'all 0.25s' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(0,0,0,0.4)'}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
          >
            <div style={{ fontSize:'32px',marginBottom:'8px' }}>🥈</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'22px',fontWeight:700,color:'#C0C0C0',marginBottom:'6px' }}>{Math.round(jobs[1]?.score)}%</div>
            <div style={{ fontFamily:'Playfair Display, serif',fontSize:'14px',fontWeight:600,color:'var(--text)',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{jobs[1]?.job?.title}</div>
            <div style={{ fontSize:'12px',color:'var(--muted2)' }}>{jobs[1]?.job?.company}</div>
          </div>
          {/* 1st */}
          <div style={{ background:'linear-gradient(180deg,rgba(255,215,0,0.08) 0%,var(--bg2) 100%)',border:'1px solid rgba(255,215,0,0.2)',borderRadius:'16px',padding:'24px',textAlign:'center',transition:'all 0.25s',position:'relative',overflow:'hidden' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(0,0,0,0.5)'}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
          >
            <div style={{ position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,rgba(255,215,0,0.6),transparent)' }} />
            <div style={{ fontSize:'36px',marginBottom:'8px' }}>🥇</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'28px',fontWeight:700,color:'#FFD700',marginBottom:'6px' }}>{Math.round(jobs[0]?.score)}%</div>
            <div style={{ fontFamily:'Playfair Display, serif',fontSize:'15px',fontWeight:600,color:'var(--text)',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{jobs[0]?.job?.title}</div>
            <div style={{ fontSize:'12px',color:'var(--muted2)',marginBottom:'12px' }}>{jobs[0]?.job?.company}</div>
            <a href={jobs[0]?.job?.link} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-block',padding:'8px 18px',borderRadius:'8px',background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.3)',color:'#FFD700',fontFamily:'JetBrains Mono, monospace',fontSize:'11px',textDecoration:'none',transition:'all 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,215,0,0.18)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,215,0,0.1)'}}
            >Apply now →</a>
          </div>
          {/* 3rd */}
          <div style={{ background:'linear-gradient(180deg,rgba(205,127,50,0.06) 0%,var(--bg2) 100%)',border:'1px solid rgba(205,127,50,0.15)',borderRadius:'16px',padding:'20px',textAlign:'center',transition:'all 0.25s' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(0,0,0,0.4)'}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
          >
            <div style={{ fontSize:'32px',marginBottom:'8px' }}>🥉</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'22px',fontWeight:700,color:'#CD7F32',marginBottom:'6px' }}>{Math.round(jobs[2]?.score)}%</div>
            <div style={{ fontFamily:'Playfair Display, serif',fontSize:'14px',fontWeight:600,color:'var(--text)',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{jobs[2]?.job?.title}</div>
            <div style={{ fontSize:'12px',color:'var(--muted2)' }}>{jobs[2]?.job?.company}</div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,255,136,0.15),transparent)',marginBottom:'20px' }} />

      {/* Full list */}
      {isLoading ? (
        <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
          {[1,2,3,4,5].map(i=>(
            <div key={i} style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'20px 24px',height:'80px',animation:'shimmer 1.5s infinite',backgroundImage:'linear-gradient(90deg,var(--bg2) 25%,rgba(255,255,255,0.03) 50%,var(--bg2) 75%)',backgroundSize:'200% 100%' }} />
          ))}
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
          {jobs.map((match: any, i: number) => (
            <TopCard key={match.id} match={match} rank={i+1} />
          ))}
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <div style={{ background:'var(--bg2)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'64px',textAlign:'center' }}>
          <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'32px',marginBottom:'16px',opacity:0.3 }}>◆</div>
          <p style={{ fontFamily:'JetBrains Mono, monospace',fontSize:'11px',color:'var(--accent)',letterSpacing:'2px',marginBottom:'8px' }}>// no matches yet</p>
          <p style={{ color:'var(--muted2)',fontSize:'14px' }}>Add your resume and searches in <a href="/settings" style={{ color:'var(--accent)',textDecoration:'none' }}>Settings →</a></p>
        </div>
      )}
    </div>
  )
}