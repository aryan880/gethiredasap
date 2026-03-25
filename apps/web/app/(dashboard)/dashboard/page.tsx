'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'
import Link from 'next/link'

function scoreConfig(s: number) {
  if (s >= 70) return {
    label: 'Excellent', emoji: '🔥',
    color: '#00FF88', dimColor: 'rgba(0,255,136,0.6)',
    pill: 'rgba(0,255,136,0.08)', pillBorder: 'rgba(0,255,136,0.2)',
    bar: 'linear-gradient(90deg,#00FF88,#7FFFB0)',
    glow: '0 0 20px rgba(0,255,136,0.12)',
  }
  if (s >= 50) return {
    label: 'Strong', emoji: '✅',
    color: '#60A5FA', dimColor: 'rgba(96,165,250,0.6)',
    pill: 'rgba(59,130,246,0.08)', pillBorder: 'rgba(59,130,246,0.2)',
    bar: 'linear-gradient(90deg,#3B82F6,#93C5FD)',
    glow: '0 0 20px rgba(59,130,246,0.1)',
  }
  if (s >= 35) return {
    label: 'Good', emoji: '👍',
    color: '#F59E0B', dimColor: 'rgba(245,158,11,0.6)',
    pill: 'rgba(245,158,11,0.08)', pillBorder: 'rgba(245,158,11,0.2)',
    bar: 'linear-gradient(90deg,#D97706,#FCD34D)',
    glow: '0 0 20px rgba(245,158,11,0.08)',
  }
  return {
    label: 'Possible', emoji: '🔎',
    color: '#6B7280', dimColor: 'rgba(107,114,128,0.5)',
    pill: 'rgba(107,114,128,0.07)', pillBorder: 'rgba(107,114,128,0.15)',
    bar: 'linear-gradient(90deg,#4B5563,#9CA3AF)',
    glow: 'none',
  }
}

function JobCard({ match, index }: { match: any; index: number }) {
  const score  = Math.round(match.score)
  const cfg    = scoreConfig(score)
  const posted = match.job?.postedAt
    ? new Date(match.job.postedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '18px',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        animation: `fadeUp 0.5s ease ${index * 0.05}s both`,
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${cfg.color}30`
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.4), ${cfg.glow}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Top score bar */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', width: `${score}%`,
          background: cfg.bar, borderRadius: '2px',
          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>

      <div style={{ padding: '22px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

          {/* Rank + Score */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            {/* Rank number */}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px', fontWeight: 600,
              color: 'var(--muted)', letterSpacing: '1px',
            }}>
              #{index + 1}
            </span>
            {/* Score circle */}
            <div style={{ position: 'relative', width: '64px', height: '64px' }}>
              <svg width="64" height="64" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" />
                <circle cx="32" cy="32" r="28" fill="none"
                  stroke={cfg.color}
                  strokeWidth="3.5"
                  strokeDasharray={`${(score / 100) * 175.9} 175.9`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '1px',
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '16px', fontWeight: 700,
                  color: cfg.color, lineHeight: 1,
                }}>{score}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '8px', color: cfg.dimColor, lineHeight: 1,
                }}>%</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px', fontWeight: 600,
                padding: '3px 11px', borderRadius: '20px',
                background: cfg.pill, color: cfg.color,
                border: `1px solid ${cfg.pillBorder}`,
                letterSpacing: '0.5px', whiteSpace: 'nowrap',
              }}>
                {cfg.emoji} {cfg.label}
              </span>
              {match.isEarlyCareer && (
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px', padding: '3px 11px', borderRadius: '20px',
                  background: 'rgba(251,183,36,0.07)', color: '#FBB724',
                  border: '1px solid rgba(251,183,36,0.18)', whiteSpace: 'nowrap',
                }}>
                  ⭐ Early Career
                </span>
              )}
            </div>

            {/* Title */}
            <a
              href={match.job?.link} target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '20px', fontWeight: 700,
                color: 'var(--text)', textDecoration: 'none',
                display: 'block', marginBottom: '8px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 0.2s', lineHeight: 1.2,
              }}
              onMouseEnter={e => e.currentTarget.style.color = cfg.color}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
            >
              {match.job?.title}
            </a>

            {/* Company + location */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', color: 'var(--text2)', fontWeight: 500 }}>
                {match.job?.company}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>·</span>
              <span style={{ fontSize: '14px', color: 'var(--muted2)' }}>
                📍 {match.job?.location}
              </span>
            </div>

            {/* Meta pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {match.job?.salary && (
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                  padding: '3px 10px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--muted2)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>💰 {match.job.salary}</span>
              )}
              {posted && (
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                  padding: '3px 10px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--muted)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>🕐 {posted}</span>
              )}
            </div>
          </div>

          {/* Apply button */}
          <div style={{ flexShrink: 0 }}>
            <a
              href={match.job?.link} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '11px 20px', borderRadius: '10px',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '14px',
                color: cfg.color,
                background: cfg.pill,
                border: `1px solid ${cfg.pillBorder}`,
                textDecoration: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${cfg.color}18`
                e.currentTarget.style.borderColor = `${cfg.color}45`
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = cfg.glow
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = cfg.pill
                e.currentTarget.style.borderColor = cfg.pillBorder
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              Apply →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, suffix, color, icon }: {
  label: string; value: number; suffix?: string; color: string; icon: string
}) {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '24px',
        position: 'relative', overflow: 'hidden',
        transition: 'all 0.22s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${color}28`
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.3)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Bottom accent */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg,transparent,${color}50,transparent)`,
      }} />
      {/* Icon */}
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px',
        background: `${color}10`, border: `1px solid ${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', marginBottom: '14px',
      }}>{icon}</div>
      {/* Number */}
      <div style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: '42px', fontWeight: 700,
        color: 'var(--text)', lineHeight: 1, marginBottom: '6px',
      }}>
        {value}<span style={{ color, fontSize: '22px' }}>{suffix}</span>
      </div>
      {/* Label */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px', color: 'var(--muted2)',
        textTransform: 'uppercase', letterSpacing: '1.5px',
      }}>{label}</div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      height: '116px', borderRadius: '18px',
      background: 'var(--bg2)',
      backgroundImage: 'linear-gradient(90deg,var(--bg2) 25%,rgba(255,255,255,0.03) 50%,var(--bg2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
      border: '1px solid rgba(255,255,255,0.05)',
    }} />
  )
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const [filter, setFilter] = useState<'all' | 'excellent' | 'strong' | 'early'>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then(r => r.data),
    refetchInterval: 60_000,
  })

  const allJobs   = [...(data?.jobs || [])].sort((a: any, b: any) => b.score - a.score)
  const total     = data?.pagination?.total || 0
  const excellent = allJobs.filter((j: any) => j.score >= 70).length
  const strong    = allJobs.filter((j: any) => j.score >= 50 && j.score < 70).length
  const early     = allJobs.filter((j: any) => j.isEarlyCareer).length

  const filtered = (filter === 'all'       ? allJobs
    : filter === 'excellent' ? allJobs.filter((j: any) => j.score >= 70)
    : filter === 'strong'    ? allJobs.filter((j: any) => j.score >= 50 && j.score < 70)
    : allJobs.filter((j: any) => j.isEarlyCareer)
  ).sort((a: any, b: any) => b.score - a.score)

  const filters = [
    { key: 'all',       label: `All`,             count: allJobs.length, color: 'var(--text2)' },
    { key: 'excellent', label: `🔥 Excellent`,     count: excellent,      color: '#00FF88' },
    { key: 'strong',    label: `✅ Strong`,         count: strong,         color: '#60A5FA' },
    { key: 'early',     label: `⭐ Early Career`,   count: early,          color: '#FBB724' },
  ]

  return (
    <div>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);} }
        @keyframes shimmer  { 0%{background-position:200% 0;}100%{background-position:-200% 0;} }
        @keyframes pulseAnim{ 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.7);} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '16px',
        marginBottom: '40px', flexWrap: 'wrap',
        animation: 'fadeUp 0.5s ease both',
      }}>
        <div>
          <p style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase',
            marginBottom: '10px',
          }}>// job feed</p>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(34px,4vw,54px)',
            fontWeight: 700, lineHeight: 1.05,
            letterSpacing: '-1.5px', color: 'var(--text)', marginBottom: '8px',
          }}>
            Hey {user?.name?.split(' ')[0]},{' '}
            <span style={{ color: 'var(--accent)' }}>{total} matched.</span>
          </h1>
          <p style={{ color: 'var(--muted2)', fontSize: '15px', lineHeight: 1.5 }}>
            Personalised to your resume · Radar scans every {user?.intervalMinutes || 15} min
          </p>
        </div>

        {/* Status + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px', padding: '10px 16px',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: user?.isActive ? 'var(--accent)' : 'var(--muted)',
              boxShadow: user?.isActive ? '0 0 7px var(--accent)' : 'none',
              animation: user?.isActive ? 'pulseAnim 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
              color: user?.isActive ? 'var(--accent)' : 'var(--muted2)', letterSpacing: '1px',
            }}>
              {user?.isActive ? 'RADAR LIVE' : 'PAUSED'}
            </span>
          </div>
          <button
            onClick={() => refetch()}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.07)',
              color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '1px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--muted2)' }}
          >↻ Refresh</button>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: '14px', marginBottom: '36px',
        animation: 'fadeUp 0.5s ease 0.08s both',
      }}>
        <StatCard label="Total Matched" value={total}     suffix="+" color="#00FF88" icon="📡" />
        <StatCard label="Excellent"     value={excellent} suffix=""  color="#00FF88" icon="🔥" />
        <StatCard label="Strong"        value={strong}    suffix=""  color="#60A5FA" icon="✅" />
        <StatCard label="Early Career"  value={early}     suffix=""  color="#FBB724" icon="⭐" />
      </div>

      {/* ── FILTER TABS ── */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '20px',
        flexWrap: 'wrap', animation: 'fadeUp 0.5s ease 0.12s both',
      }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            style={{
              padding: '8px 18px', borderRadius: '10px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '0.5px',
              cursor: 'pointer', transition: 'all 0.18s', border: 'none',
              background: filter === f.key ? `${f.color}10` : 'var(--bg2)',
              color: filter === f.key ? f.color : 'var(--muted2)',
              borderWidth: '1px', borderStyle: 'solid',
              borderColor: filter === f.key ? `${f.color}30` : 'rgba(255,255,255,0.07)',
              boxShadow: filter === f.key ? `0 0 12px ${f.color}12` : 'none',
            }}
          >
            {f.label} <span style={{ opacity: 0.6 }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* ── DIVIDER ── */}
      <div style={{
        height: '1px', marginBottom: '20px',
        background: 'linear-gradient(90deg,transparent,rgba(0,255,136,0.12),transparent)',
      }} />

      {/* ── LOADING ── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── ERROR ── */}
      {isError && (
        <div style={{
          background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: '16px', padding: '48px', textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#EF4444', letterSpacing: '1px', marginBottom: '8px' }}>⚠ API connection failed</p>
          <p style={{ fontSize: '14px', color: 'var(--muted2)' }}>Is the API server running on port 3001?</p>
        </div>
      )}

      {/* ── EMPTY ── */}
      {!isLoading && !isError && allJobs.length === 0 && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '18px', padding: '72px 40px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.2 }}>📡</div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>// radar scanning</p>
          <p style={{ color: 'var(--muted2)', fontSize: '16px', marginBottom: '8px' }}>
            The Job Radar scans every {user?.intervalMinutes || 15} minutes.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            Set your resume and searches in{' '}
            <Link href="/settings" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Settings →</Link>
          </p>
        </div>
      )}

      {/* ── NO FILTER RESULTS ── */}
      {!isLoading && filtered.length === 0 && allJobs.length > 0 && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '40px', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--muted2)', fontSize: '15px' }}>No jobs in this category yet.</p>
        </div>
      )}

      {/* ── JOB LIST ── */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((match: any, i: number) => (
            <JobCard key={match.id} match={match} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}