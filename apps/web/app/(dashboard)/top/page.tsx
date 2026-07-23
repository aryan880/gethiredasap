'use client'

import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_PERSONALIZED_MATCHES_QUERY,
  getJobHunterJobs,
  getJobHunterMatches,
  jobHunterQueryKeys,
} from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import JobWorkflowActions, { StatusBadge } from '@/components/JobWorkflowActions'

const medals = ['🥇', '🥈', '🥉']

function TopCard({ item, rank, isPersonalized }: { item: any; rank: number; isPersonalized: boolean }) {
  const job = item.job
  const score = Math.round(item.score || 0)
  const isMedal = rank <= 3
  const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'var(--muted2)'

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${isMedal ? `${medalColor}25` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '16px',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        animation: `fadeUp 0.4s ease ${rank * 0.05}s both`,
      }}
      onMouseEnter={event => {
        event.currentTarget.style.transform = 'translateY(-2px)'
        event.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={event => {
        event.currentTarget.style.transform = 'translateY(0)'
        event.currentTarget.style.boxShadow = 'none'
      }}
    >
      {isMedal && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: `linear-gradient(90deg,transparent,${medalColor}60,transparent)`,
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
        <div style={{ flexShrink: 0, width: '52px', textAlign: 'center' }}>
          {isMedal ? (
            <span style={{ fontSize: '28px', lineHeight: 1 }}>{medals[rank - 1]}</span>
          ) : (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '18px', fontWeight: 700, color: 'var(--muted)', lineHeight: 1 }}>
              #{rank}
            </span>
          )}
        </div>

        <div style={{ flexShrink: 0, position: 'relative', width: '52px', height: '52px' }}>
          <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke={score >= 70 ? '#00FF88' : score >= 50 ? '#60A5FA' : '#F59E0B'}
              strokeWidth="3"
              strokeDasharray={`${(score / 100) * 138} 138`}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            {score}%
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {item.matchLabel && (
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(0,255,136,0.08)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(0,255,136,0.2)',
                }}
              >
                {item.matchLabel}
              </span>
            )}
            {job?.source && (
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--muted2)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {job.source}
              </span>
            )}
            {job?.workflow && <StatusBadge workflow={job.workflow} />}
          </div>

          <a
            href={job?.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text)',
              textDecoration: 'none',
              display: 'block',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'color 0.2s',
            }}
            onMouseEnter={event => {
              event.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={event => {
              event.currentTarget.style.color = 'var(--text)'
            }}
          >
            {job?.title}
          </a>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>🏢 {job?.company}</span>
            <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>📍 {job?.location}</span>
          </div>

          {isPersonalized && item.reasons?.length > 0 && (
            <div style={{ color: 'var(--muted2)', fontSize: '12px', lineHeight: 1.5, marginBottom: '12px' }}>
              {item.reasons.slice(0, 2).join(' · ')}
            </div>
          )}

          {job && <JobWorkflowActions job={job} workflow={job.workflow} />}
        </div>

        <a
          href={job?.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            borderRadius: '8px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: 'var(--accent)',
            background: 'rgba(0,255,136,0.07)',
            border: '1px solid rgba(0,255,136,0.2)',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={event => {
            event.currentTarget.style.background = 'rgba(0,255,136,0.14)'
            event.currentTarget.style.borderColor = 'rgba(0,255,136,0.4)'
          }}
          onMouseLeave={event => {
            event.currentTarget.style.background = 'rgba(0,255,136,0.07)'
            event.currentTarget.style.borderColor = 'rgba(0,255,136,0.2)'
          }}
        >
          Open →
        </a>
      </div>
    </div>
  )
}

function normalizeItems(data: any, isPersonalized: boolean) {
  const items = data?.items || []

  return [...items]
    .map((item: any) => {
      if (item.job) {
        return {
          id: item.job.id,
          score: item.final_match_score || item.user_match_score || item.rule_score || 0,
          matchLabel: item.match_label || item.scoring_method || 'Personalized match',
          reasons: item.reasons || [],
          job: item.job,
        }
      }

      return {
        id: item.id,
        score: item.score || 0,
        matchLabel: isPersonalized ? 'Personalized match' : 'General job feed',
        reasons: [],
        job: item,
      }
    })
    .sort((left, right) => right.score - left.score)
}

export default function TopPage() {
  const user = useAuthStore(state => state.user)
  const isPersonalized = Boolean(user?.resumeText?.trim() || user?.activeResumeFamily)

  const { data, isLoading, isError } = useQuery({
    queryKey: isPersonalized
      ? jobHunterQueryKeys.personalizedMatches(DEFAULT_PERSONALIZED_MATCHES_QUERY)
      : ['top-jobs-general', { limit: 20 }],
    queryFn: () => (isPersonalized ? getJobHunterMatches(DEFAULT_PERSONALIZED_MATCHES_QUERY) : getJobHunterJobs({ limit: 20 })),
  })

  const jobs = normalizeItems(data, isPersonalized)

  return (
    <div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}`}</style>

      <div style={{ marginBottom: '40px', animation: 'fadeUp 0.5s ease both' }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>
          // top matches
        </p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-1px', color: 'var(--text)', marginBottom: '8px' }}>
          Your best
          <br />
          <span style={{ color: 'var(--accent)' }}>opportunities.</span>
        </h1>
        <p style={{ color: 'var(--muted2)', fontSize: '14px' }}>
          {isPersonalized
            ? 'Same personalized rankings as Feed and Hunter.'
            : 'General AI Job Hunter feed. Upload your resume to personalize these rankings.'}
        </p>
      </div>

      {!isPersonalized && (
        <div
          style={{
            background: 'rgba(0,255,136,0.06)',
            border: '1px solid rgba(0,255,136,0.18)',
            borderRadius: '16px',
            padding: '20px 22px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--accent)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Resume needed for personal ranking
            </div>
            <div style={{ color: 'var(--text2)', fontSize: '14px' }}>
              Top is showing the general AI Job Hunter feed until you upload a resume.
            </div>
          </div>
          <a
            href="/settings"
            style={{
              color: '#07080C',
              background: 'var(--accent)',
              borderRadius: '10px',
              padding: '10px 16px',
              textDecoration: 'none',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Upload resume
          </a>
        </div>
      )}

      {isError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: '16px',
            padding: '22px',
            color: '#EF4444',
            marginBottom: '24px',
          }}
        >
          We couldn&apos;t load AI Job Hunter matches right now.
        </div>
      )}

      {!isLoading && jobs.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: '12px', marginBottom: '24px', alignItems: 'end', animation: 'fadeUp 0.5s ease 0.1s both' }}>
          {[
            { index: 1, badge: '🥈', color: '#C0C0C0' },
            { index: 0, badge: '🥇', color: '#FFD700' },
            { index: 2, badge: '🥉', color: '#CD7F32' },
          ].map(({ index, badge, color }) => (
            <div
              key={index}
              style={{
                background: `linear-gradient(180deg,${color}12 0%,var(--bg2) 100%)`,
                border: `1px solid ${color}25`,
                borderRadius: '16px',
                padding: index === 0 ? '24px' : '20px',
                textAlign: 'center',
                transition: 'all 0.25s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={event => {
                event.currentTarget.style.transform = 'translateY(-4px)'
                event.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.4)'
              }}
              onMouseLeave={event => {
                event.currentTarget.style.transform = 'translateY(0)'
                event.currentTarget.style.boxShadow = 'none'
              }}
            >
              {index === 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${color}80,transparent)` }} />}
              <div style={{ fontSize: index === 0 ? '36px' : '32px', marginBottom: '8px' }}>{badge}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: index === 0 ? '28px' : '22px', fontWeight: 700, color, marginBottom: '6px' }}>
                {Math.round(jobs[index]?.score || 0)}%
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: index === 0 ? '15px' : '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {jobs[index]?.job?.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', marginBottom: index === 0 ? '12px' : 0 }}>
                {jobs[index]?.job?.company}
              </div>
              {index === 0 && (
                <a
                  href={jobs[0]?.job?.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'rgba(255,215,0,0.1)',
                    border: '1px solid rgba(255,215,0,0.3)',
                    color: '#FFD700',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Open top job →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(0,255,136,0.15),transparent)', marginBottom: '20px' }} />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4, 5].map(index => (
            <div
              key={index}
              style={{
                background: 'var(--bg2)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '20px 24px',
                height: '150px',
                animation: 'shimmer 1.5s infinite',
                backgroundImage: 'linear-gradient(90deg,var(--bg2) 25%,rgba(255,255,255,0.03) 50%,var(--bg2) 75%)',
                backgroundSize: '200% 100%',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {jobs.map((item: any, index: number) => (
            <TopCard key={item.id} item={item} rank={index + 1} isPersonalized={isPersonalized} />
          ))}
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '64px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '32px', marginBottom: '16px', opacity: 0.3 }}>◆</div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--accent)', letterSpacing: '2px', marginBottom: '8px' }}>
            // no ranked jobs yet
          </p>
          <p style={{ color: 'var(--muted2)', fontSize: '14px' }}>
            {isPersonalized ? 'We couldn’t find ranked matches yet.' : 'Upload your resume in '}
            {!isPersonalized && (
              <a href="/settings" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Settings
              </a>
            )}
            {!isPersonalized && ' to unlock personalized Top jobs.'}
          </p>
        </div>
      )}
    </div>
  )
}
