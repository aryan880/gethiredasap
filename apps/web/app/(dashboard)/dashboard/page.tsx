'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Globe2,
  Layers3,
  MapPin,
  Radar,
  Search,
  Send,
  Sparkles,
  Target,
  Upload,
  Wifi,
} from 'lucide-react'
import { getJobHunterCommandCenter, refreshJobHunter } from '@/lib/api'

type CountRow = { label: string; count: number }
type JobActivity = {
  id: string
  title?: string
  company?: string
  source?: string
  location?: string
  timestamp?: string | null
  link?: string | null
  status?: string
}
type ResumeActivity = {
  id: string
  label: string
  detail?: string
  timestamp?: string | null
}

type CommandCenterResponse = {
  generated_at: string
  scoring_mode: string
  saved_searches: {
    total: number
    enabled: number
    jobs_matching_today: number
    alert_status: string
    pending_alerts: number
  }
  overview: {
    total_jobs: number
    new_today: number
    companies: number
    sources: number
    remote: number
    hybrid: number
    onsite: number
  }
  pipeline: {
    SAVED: number
    APPLIED: number
    INTERVIEW: number
    OFFER: number
    REJECTED: number
  }
  charts: {
    jobs_over_time: CountRow[]
    jobs_by_source: CountRow[]
    jobs_by_city: CountRow[]
    jobs_by_category: CountRow[]
    jobs_by_work_mode: CountRow[]
    match_score_distribution: CountRow[]
  }
  recent_activity: {
    newly_discovered_jobs: JobActivity[]
    recently_applied_jobs: JobActivity[]
    resume_uploads: ResumeActivity[]
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function shortDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function panelStyle(height = '100%') {
  return {
    background: 'var(--bg2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '18px 20px',
    height,
    boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
  } as const
}

function SectionHeader({ eyebrow, title, description, action }: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '22px' }}>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
          {eyebrow}
        </div>
        <h1 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: '34px', lineHeight: 1.08, color: 'var(--text)' }}>
          {title}
        </h1>
        <p style={{ margin: '10px 0 0', color: 'var(--muted2)', fontSize: '15px', maxWidth: '760px', lineHeight: 1.55 }}>
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div style={{ ...panelStyle(), padding: '15px 16px', display: 'grid', gridTemplateColumns: '34px 1fr', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}12`, color: accent, border: `1px solid ${accent}28` }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '25px', fontWeight: 700, lineHeight: 1, color: 'var(--text)', marginBottom: '6px' }}>{value.toLocaleString()}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted2)' }}>{label}</div>
      </div>
    </div>
  )
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={panelStyle()}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ color: 'var(--muted2)', fontSize: '13px', marginTop: '4px' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '180px', textAlign: 'center', color: 'var(--muted2)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '14px' }}>
      <div>
        <div style={{ color: 'var(--text2)', fontWeight: 700, marginBottom: '6px' }}>{title}</div>
        <div style={{ fontSize: '13px', maxWidth: '320px', lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  )
}

function HorizontalBars({ rows, color = '#00FF88' }: { rows: CountRow[]; color?: string }) {
  if (!rows.length) return <EmptyState title="Nothing to chart yet" body="This panel will populate once job data is available." />
  const max = Math.max(...rows.map(row => row.count), 1)
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {rows.map(row => (
        <div key={`${row.label}-${row.count}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
            <span style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace' }}>{row.count}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(row.count / max) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineBars({ rows }: { rows: CountRow[] }) {
  if (!rows.length) return <EmptyState title="No recent job trend yet" body="Fresh discovery activity will show up here as jobs arrive." />
  const max = Math.max(...rows.map(row => row.count), 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end', minHeight: '210px' }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{row.count}</div>
          <div style={{ width: '100%', minHeight: '10px', height: `${Math.max(14, (row.count / max) * 150)}px`, borderRadius: '12px 12px 4px 4px', background: 'linear-gradient(180deg, rgba(0,255,136,0.95), rgba(0,255,136,0.22))' }} />
          <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>{row.label.slice(5)}</div>
        </div>
      ))}
    </div>
  )
}

function ActivityList({ items, emptyTitle, emptyBody, renderItem }: { items: any[]; emptyTitle: string; emptyBody: string; renderItem: (item: any) => React.ReactNode }) {
  if (!items.length) return <EmptyState title={emptyTitle} body={emptyBody} />
  return <div style={{ display: 'grid', gap: '12px' }}>{items.map(renderItem)}</div>
}

function DashboardSkeleton() {
  const skeleton = {
    background: 'linear-gradient(90deg,var(--bg2) 25%, rgba(255,255,255,0.03) 50%, var(--bg2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s ease-in-out infinite',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '18px',
  } as const

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ ...skeleton, height: '120px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {Array.from({ length: 7 }).map((_, index) => <div key={index} style={{ ...skeleton, height: '132px' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 6 }).map((_, index) => <div key={index} style={{ ...skeleton, height: '260px' }} />)}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const qc = useQueryClient()
  const commandCenterQuery = useQuery<CommandCenterResponse>({
    queryKey: ['job-hunter-command-center'],
    queryFn: getJobHunterCommandCenter,
    staleTime: 60_000,
  })

  const refreshJobsMutation = useMutation({
    mutationFn: refreshJobHunter,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ predicate: query => typeof query.queryKey?.[0] === 'string' && String(query.queryKey[0]).startsWith('job-hunter') })
      qc.invalidateQueries({ queryKey: ['saved-searches'] })
      toast.success(data?.message || `Fetched new jobs${typeof data?.inserted_new_jobs === 'number' || typeof data?.updated_existing_jobs === 'number' ? ` · ${data?.inserted_new_jobs ?? 0} new, ${data?.updated_existing_jobs ?? 0} updated` : ''}`)
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail
      const message = (typeof detail === 'string' && detail) || detail?.error || error?.response?.data?.error || error?.message || 'Unable to fetch new jobs right now'
      toast.error(message)
    },
  })

  if (commandCenterQuery.isLoading) {
    return (
      <>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <DashboardSkeleton />
      </>
    )
  }

  if (commandCenterQuery.isError || !commandCenterQuery.data) {
    return (
      <div style={panelStyle()}>
        <div style={{ color: '#FCA5A5', fontWeight: 700, marginBottom: '8px' }}>We couldn&apos;t load the Job Command Center.</div>
        <div style={{ color: 'var(--muted2)', marginBottom: '16px', lineHeight: 1.6 }}>
          The analytics layer is available through the API, but this request failed. Try refreshing or opening Hunter for the raw feed.
        </div>
        <button
          onClick={() => commandCenterQuery.refetch()}
          style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    )
  }

  const data = commandCenterQuery.data
  const overviewCards = [
    { label: 'Total Jobs', value: data.overview.total_jobs, accent: '#00FF88', icon: <Radar size={18} /> },
    { label: 'New Today', value: data.overview.new_today, accent: '#60A5FA', icon: <Clock3 size={18} /> },
    { label: 'Companies', value: data.overview.companies, accent: '#F59E0B', icon: <Building2 size={18} /> },
    { label: 'Sources', value: data.overview.sources, accent: '#A78BFA', icon: <Globe2 size={18} /> },
    { label: 'Remote', value: data.overview.remote, accent: '#34D399', icon: <Wifi size={18} /> },
    { label: 'Hybrid', value: data.overview.hybrid, accent: '#F472B6', icon: <Layers3 size={18} /> },
    { label: 'On-site', value: data.overview.onsite, accent: '#FB7185', icon: <MapPin size={18} /> },
  ]

  const savedSearchCards = [
    { label: 'Saved searches', value: data.saved_searches.total, accent: '#22C55E', icon: <Search size={18} /> },
    { label: 'Jobs matching today', value: data.saved_searches.jobs_matching_today, accent: '#F59E0B', icon: <Bell size={18} /> },
    { label: 'Pending alerts', value: data.saved_searches.pending_alerts, accent: '#A78BFA', icon: <Sparkles size={18} /> },
  ]

  const pipelineCards = [
    { label: 'Saved', value: data.pipeline.SAVED, accent: '#60A5FA', icon: <Briefcase size={18} /> },
    { label: 'Applied', value: data.pipeline.APPLIED, accent: '#00FF88', icon: <Send size={18} /> },
    { label: 'Interview', value: data.pipeline.INTERVIEW, accent: '#F59E0B', icon: <Activity size={18} /> },
    { label: 'Offer', value: data.pipeline.OFFER, accent: '#A78BFA', icon: <Sparkles size={18} /> },
    { label: 'Rejected', value: data.pipeline.REJECTED, accent: '#F87171', icon: <Target size={18} /> },
  ]

  return (
    <div style={{ display: 'grid', gap: '26px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      <SectionHeader
        eyebrow="// command center"
        title="Job Command Center"
        description="Discovery health, fresh opportunities, and application activity in one view."
        action={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href="/job-hunter" style={{ textDecoration: 'none', borderRadius: '12px', padding: '10px 14px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.18)', color: 'var(--accent)', fontWeight: 700 }}>
              Open Hunter
            </Link>
            <Link href="/top" style={{ textDecoration: 'none', borderRadius: '12px', padding: '10px 14px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text2)', fontWeight: 700 }}>
              Open Top
            </Link>
          </div>
        }
      />

      <div style={{ ...panelStyle(), display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--text2)', fontWeight: 700 }}>Data snapshot</div>
          <div style={{ color: 'var(--muted2)', fontSize: '13px', marginTop: '4px' }}>
            Generated {formatTimestamp(data.generated_at)} · Match score distribution source: {data.scoring_mode.replaceAll('_', ' ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => refreshJobsMutation.mutate()}
            disabled={refreshJobsMutation.isPending}
            style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--accent)', background: refreshJobsMutation.isPending ? 'rgba(0,255,136,0.4)' : 'var(--accent)', color: '#07080C', cursor: refreshJobsMutation.isPending ? 'wait' : 'pointer', fontWeight: 700 }}
          >
            {refreshJobsMutation.isPending ? 'Reloading jobs…' : 'Reload latest jobs'}
          </button>
          <button
            onClick={() => commandCenterQuery.refetch()}
            style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontWeight: 700 }}
          >
            Refresh analytics
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '10px' }}>
        {overviewCards.map(card => <MetricCard key={card.label} {...card} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
        {savedSearchCards.map(card => <MetricCard key={card.label} {...card} />)}
      </div>

      <div style={{ ...panelStyle(), display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--text)', fontWeight: 700 }}>Saved search alerts</div>
          <div style={{ color: 'var(--muted2)', fontSize: '13px', marginTop: '4px' }}>
            Status: {data.saved_searches.alert_status} · {data.saved_searches.enabled} enabled of {data.saved_searches.total} total
          </div>
        </div>
        <Link href="/saved-searches" style={{ textDecoration: 'none', borderRadius: '12px', padding: '10px 14px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.18)', color: 'var(--accent)', fontWeight: 700 }}>
          Open Saved Searches
        </Link>
      </div>

      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: '12px' }}>
          Application Pipeline
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
          {pipelineCards.map(card => <MetricCard key={card.label} {...card} />)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <ChartPanel title="Jobs over time" subtitle="New discoveries over the last 14 days based on first-seen timestamps.">
          <TimelineBars rows={data.charts.jobs_over_time} />
        </ChartPanel>
        <ChartPanel title="Jobs by source" subtitle="Where discovery volume is coming from right now.">
          <HorizontalBars rows={data.charts.jobs_by_source} color="#60A5FA" />
        </ChartPanel>
        <ChartPanel title="Jobs by city" subtitle="Top cities extracted from job locations.">
          <HorizontalBars rows={data.charts.jobs_by_city} color="#F59E0B" />
        </ChartPanel>
        <ChartPanel title="Jobs by category" subtitle="Rule-based categorization from AI Job Hunter exports.">
          <HorizontalBars rows={data.charts.jobs_by_category} color="#A78BFA" />
        </ChartPanel>
        <ChartPanel title="Jobs by work mode" subtitle="Remote, hybrid, on-site, and unknown mix.">
          <HorizontalBars rows={data.charts.jobs_by_work_mode} color="#34D399" />
        </ChartPanel>
        <ChartPanel title="Match score distribution" subtitle="Personalized if resume-based matching exists, otherwise global job scores.">
          <HorizontalBars rows={data.charts.match_score_distribution} color="#FB7185" />
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <ChartPanel title="Newly discovered jobs" subtitle="The freshest jobs found by AI Job Hunter.">
          <ActivityList
            items={data.recent_activity.newly_discovered_jobs}
            emptyTitle="No new discoveries yet"
            emptyBody="Once the discovery engine finds new jobs, they’ll appear here."
            renderItem={(job: JobActivity) => (
              <a key={job.id} href={job.link || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>{job.title}</div>
                  <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '6px' }}>{job.company} · {job.location}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: 'var(--muted2)', fontSize: '12px' }}>
                    <span>{job.source}</span>
                    <span>{shortDate(job.timestamp)}</span>
                  </div>
                </div>
              </a>
            )}
          />
        </ChartPanel>

        <ChartPanel title="Recently applied jobs" subtitle="Workflow activity from your application CRM state.">
          <ActivityList
            items={data.recent_activity.recently_applied_jobs}
            emptyTitle="No application activity yet"
            emptyBody="Saved and applied jobs will start showing up here once you move them through the pipeline."
            renderItem={(job: JobActivity) => (
              <a key={job.id} href={job.link || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ color: 'var(--text)', fontWeight: 700 }}>{job.title || 'Job activity'}</div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase' }}>{job.status}</span>
                  </div>
                  <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '6px' }}>{job.company || 'Unknown company'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: 'var(--muted2)', fontSize: '12px' }}>
                    <span>Updated</span>
                    <span>{shortDate(job.timestamp)}</span>
                  </div>
                </div>
              </a>
            )}
          />
        </ChartPanel>

        <ChartPanel title="Resume uploads" subtitle="Recent profile-level resume activity used for personalization.">
          <ActivityList
            items={data.recent_activity.resume_uploads}
            emptyTitle="No resume uploaded yet"
            emptyBody="Upload a resume in Settings to unlock personalized matching and resume intelligence."
            renderItem={(item: ResumeActivity) => (
              <div key={item.id} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.18)' }}>
                    <Upload size={16} />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 700 }}>{item.label}</div>
                    <div style={{ color: 'var(--muted2)', fontSize: '12px' }}>{item.detail}</div>
                  </div>
                </div>
                <div style={{ color: 'var(--muted2)', fontSize: '12px' }}>{formatTimestamp(item.timestamp)}</div>
              </div>
            )}
          />
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div style={panelStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <CheckCircle2 size={18} color="#00FF88" />
            <div style={{ color: 'var(--text)', fontWeight: 700 }}>Built for daily rhythm</div>
          </div>
          <div style={{ color: 'var(--muted2)', fontSize: '14px', lineHeight: 1.6 }}>
            Use this page as the scan-and-decide layer, then jump into Hunter for deep job analysis or Top for a tighter ranked list.
          </div>
        </div>
        <div style={panelStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <CalendarClock size={18} color="#60A5FA" />
            <div style={{ color: 'var(--text)', fontWeight: 700 }}>Recent activity is live</div>
          </div>
          <div style={{ color: 'var(--muted2)', fontSize: '14px', lineHeight: 1.6 }}>
            Fresh job discovery, application workflow changes, and resume-profile updates are all surfaced here without changing the ranking engine underneath.
          </div>
        </div>
      </div>
    </div>
  )
}
