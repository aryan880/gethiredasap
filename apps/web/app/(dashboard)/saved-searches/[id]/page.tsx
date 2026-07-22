'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import AIJobBrowser from '@/components/AIJobBrowser'
import { getJobHunterSummary, getSavedSearch, getSavedSearchJobs } from '@/lib/api'

type SavedSearchDetail = {
  id: string
  name: string
  keywords: string
  location?: string | null
  category?: string | null
  workMode?: string | null
  minimumMatchScore: number
  companies: string[]
  sources: string[]
  frequency: 'hourly' | 'daily' | 'weekly'
  matchMode: 'strict' | 'balanced' | 'broad'
  excludeSeniorRoles: boolean
  preferJuniorRoles: boolean
  excludeContract: boolean
  excludeStaffingAgencies: boolean
  enabled: boolean
  matchingJobsCount: number
  matchingJobsToday: number
  newMatchingJobsSinceLastRun: number
  pendingAlerts: number
  lastEvaluatedAt?: string | null
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Not evaluated yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatMatchMode(mode: 'strict' | 'balanced' | 'broad') {
  if (mode === 'strict') return 'Strict Title Match'
  if (mode === 'broad') return 'Broad Exploratory Match'
  return 'Role Family Match'
}

function cardStyle() {
  return {
    background: 'var(--bg2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 18px 48px rgba(0,0,0,0.2)',
  } as const
}

function pill(label: string) {
  return (
    <span key={label} style={{
      fontSize: '12px',
      color: 'var(--text2)',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.04)',
      padding: '4px 10px',
    }}>
      {label}
    </span>
  )
}

export default function SavedSearchDetailPage() {
  const params = useParams<{ id: string }>()
  const searchId = String(params?.id || '')

  const detailQuery = useQuery<{ search: SavedSearchDetail }>({
    queryKey: ['saved-search', searchId],
    queryFn: () => getSavedSearch(searchId),
    enabled: Boolean(searchId),
    staleTime: 60_000,
  })

  const summaryQuery = useQuery({
    queryKey: ['job-hunter-summary'],
    queryFn: getJobHunterSummary,
    staleTime: 60_000,
  })

  const search = detailQuery.data?.search

  if (detailQuery.isLoading) {
    return <div style={{ color: 'var(--muted2)' }}>Loading saved search…</div>
  }

  if (!search) {
    return (
      <div style={cardStyle()}>
        <div style={{ color: '#FCA5A5', fontWeight: 700, marginBottom: '8px' }}>Saved search not found</div>
        <Link href="/saved-searches" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Back to Saved Searches</Link>
      </div>
    )
  }

  const filterPills = [
    search.keywords,
    search.location || '',
    search.category || '',
    search.workMode || '',
    search.sources.length ? `Sources: ${search.sources.join(', ')}` : '',
    search.companies.length ? `Companies: ${search.companies.join(', ')}` : '',
    `Minimum score: ${search.minimumMatchScore}`,
    search.excludeSeniorRoles ? 'Exclude senior roles' : '',
    search.preferJuniorRoles ? 'Prefer junior / entry-level' : '',
    search.excludeContract ? 'Exclude contract' : '',
    search.excludeStaffingAgencies ? 'Exclude staffing agencies' : '',
  ].filter(Boolean)

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
            // saved search matches
          </div>
          <h1 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 'clamp(34px,4vw,52px)', lineHeight: 1.05, color: 'var(--text)' }}>
            {search.name}
          </h1>
          <p style={{ margin: '10px 0 0', color: 'var(--muted2)', fontSize: '15px', maxWidth: '760px', lineHeight: 1.55 }}>
            Browse every job currently matching this saved search with the same server-side pagination and filters as the global browser.
          </p>
        </div>
        <Link href="/saved-searches" style={{ borderRadius: '12px', padding: '11px 16px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text2)', textDecoration: 'none' }}>
          Back to Saved Searches
        </Link>
      </div>

      <div style={cardStyle()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          {[
            ['Total matching jobs', search.matchingJobsCount],
            ['New since last run', search.newMatchingJobsSinceLastRun],
            ['Matching today', search.matchingJobsToday],
            ['Pending alerts', search.pendingAlerts],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ color: 'var(--text)', fontSize: '30px', fontWeight: 700 }}>{Number(value).toLocaleString()}</div>
              <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ color: 'var(--muted2)', fontSize: '13px', marginBottom: '14px' }}>
          Last evaluated {formatTimestamp(search.lastEvaluatedAt)} · Frequency {search.frequency} · Mode {formatMatchMode(search.matchMode)} · Alerts {search.enabled ? 'enabled' : 'disabled'}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filterPills.map(label => pill(label))}
        </div>
      </div>

      <AIJobBrowser
        summary={summaryQuery.data}
        title="All matching jobs"
        subtitle="Saved-search constraints are applied on the server first. Use the browser controls below to narrow, sort, and paginate within that result set."
        emptyTitle="No jobs match this saved search right now."
        emptyBody="Try editing the saved search or widening one of the browser filters."
        queryKeyPrefix={`saved-search-${searchId}-jobs`}
        loadJobs={(query) => getSavedSearchJobs(searchId, query)}
      />
    </div>
  )
}
