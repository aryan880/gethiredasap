'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobHunterJobs, normalizeJobHunterQuery, type JobHunterJobsQuery } from '@/lib/api'
import JobWorkflowActions, { StatusBadge } from '@/components/JobWorkflowActions'

type SummaryCounts = {
  jobs_by_source?: Array<{ label: string; count: number }>
  jobs_by_category?: Array<{ label: string; count: number }>
  jobs_by_priority?: Array<{ label: string; count: number }>
}

type Props = {
  summary?: SummaryCounts | null
  title?: string
  subtitle?: string
  emptyTitle?: string
  emptyBody?: string
  queryKeyPrefix: string
  initialQuery?: JobHunterJobsQuery
  loadJobs?: (query: JobHunterJobsQuery) => Promise<any>
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const SORT_OPTIONS = [
  { value: 'first_seen_desc', label: 'Recently found' },
  { value: 'date_posted_desc', label: 'Recently posted' },
  { value: 'score_desc', label: 'Highest score' },
  { value: 'company_asc', label: 'Company A-Z' },
]

const WORK_MODE_OPTIONS = [
  { value: '', label: 'All work modes' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'On-site', label: 'On-site' },
  { value: 'Unknown', label: 'Unknown' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

function formatTimestamp(value?: string | null) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function pageWindow(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1]
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  const pages: number[] = []
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  return pages
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '18px 22px',
        minHeight: '148px',
        backgroundImage: 'linear-gradient(90deg,var(--bg2) 25%,rgba(255,255,255,0.03) 50%,var(--bg2) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

function BrowserCard({ job, index }: { job: any; index: number }) {
  const score = Math.round(job.saved_search_match_score ?? job.score ?? 0)
  const scoreColor = score >= 90 ? '#00FF88' : score >= 75 ? '#60A5FA' : score >= 60 ? '#F59E0B' : '#6B7280'
  const scoreLabel = typeof job.saved_search_match_score === 'number' ? 'MATCH' : 'SCORE'

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '18px 22px',
        display: 'grid',
        gridTemplateColumns: '72px 1fr auto',
        gap: '18px',
        alignItems: 'start',
        animation: `fadeUp 0.35s ease ${index * 0.03}s both`,
      }}
    >
      <div
        style={{
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          border: `1px solid ${scoreColor}40`,
          background: `${scoreColor}10`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: scoreColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
        }}
      >
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div>{score}</div>
          <div style={{ fontSize: '8px', opacity: 0.75, marginTop: '3px', letterSpacing: '0.6px' }}>
            {scoreLabel}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {job.source && (
            <span style={chipStyle}>
              {job.source}
            </span>
          )}
          {job.category && <span style={chipStyle}>{job.category}</span>}
          {job.work_mode && <span style={chipStyle}>{job.work_mode}</span>}
          {job.priority && <span style={chipStyle}>{job.priority}</span>}
          <StatusBadge workflow={job.workflow} />
        </div>

        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            fontFamily: 'Playfair Display, serif',
            fontSize: '19px',
            fontWeight: 700,
            color: 'var(--text)',
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '6px',
          }}
        >
          {job.title}
        </a>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--muted2)', fontSize: '13px', marginBottom: '8px' }}>
          <span>{job.company}</span>
          <span>{job.location}</span>
          {job.posted && <span>Posted {job.posted}</span>}
          {job.first_seen && <span>Found {job.first_seen}</span>}
        </div>

        <JobWorkflowActions job={job} workflow={job.workflow} />
      </div>

      <a
        href={job.link}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: 'var(--accent)',
          border: '1px solid rgba(0,255,136,0.2)',
          background: 'rgba(0,255,136,0.07)',
          borderRadius: '10px',
          padding: '10px 16px',
          textDecoration: 'none',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }}
      >
        Open
      </a>
    </div>
  )
}

const chipStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '10px',
  color: 'var(--muted2)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '999px',
  padding: '3px 10px',
}

export default function AIJobBrowser({
  summary,
  title = 'Browse jobs',
  subtitle = 'Explore the full AI Job Hunter feed with server-side pagination.',
  emptyTitle = 'No jobs match these filters yet.',
  emptyBody = 'Try widening the search or clearing a filter.',
  queryKeyPrefix,
  initialQuery,
  loadJobs = getJobHunterJobs,
}: Props) {
  const [page, setPage] = useState(Number(initialQuery?.page || 1))
  const [limit, setLimit] = useState(Number(initialQuery?.limit || 25))
  const [source, setSource] = useState(String(initialQuery?.source || ''))
  const [category, setCategory] = useState(String(initialQuery?.category || ''))
  const [workMode, setWorkMode] = useState(String(initialQuery?.work_mode || ''))
  const [priority, setPriority] = useState(String(initialQuery?.priority || ''))
  const [status, setStatus] = useState(String(initialQuery?.status || ''))
  const [sort, setSort] = useState(String(initialQuery?.sort || 'first_seen_desc'))
  const [searchInput, setSearchInput] = useState(String(initialQuery?.q || ''))
  const [searchQuery, setSearchQuery] = useState(String(initialQuery?.q || ''))

  useEffect(() => {
    setPage(Number(initialQuery?.page || 1))
    setLimit(Number(initialQuery?.limit || 25))
    setSource(String(initialQuery?.source || ''))
    setCategory(String(initialQuery?.category || ''))
    setWorkMode(String(initialQuery?.work_mode || ''))
    setPriority(String(initialQuery?.priority || ''))
    setStatus(String(initialQuery?.status || ''))
    setSort(String(initialQuery?.sort || 'first_seen_desc'))
    setSearchInput(String(initialQuery?.q || ''))
    setSearchQuery(String(initialQuery?.q || ''))
  }, [initialQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [limit, source, category, workMode, priority, status, sort, searchQuery])

  const query: JobHunterJobsQuery = {
    page,
    limit,
    source: source || undefined,
    category: category || undefined,
    work_mode: workMode || undefined,
    priority: priority || undefined,
    status: status || undefined,
    q: searchQuery || undefined,
    sort,
  }

  const jobsQuery = useQuery({
    queryKey: [queryKeyPrefix, normalizeJobHunterQuery(query)],
    queryFn: () => loadJobs(query),
    placeholderData: previousData => previousData,
  })

  const jobs = jobsQuery.data?.items || []
  const total = jobsQuery.data?.total || 0
  const totalPages = jobsQuery.data?.total_pages || 0
  const currentPage = jobsQuery.data?.page || page
  const hasPrev = Boolean(jobsQuery.data?.has_prev)
  const hasNext = Boolean(jobsQuery.data?.has_next)
  const from = total === 0 ? 0 : ((currentPage - 1) * limit) + 1
  const to = total === 0 ? 0 : Math.min(total, from + jobs.length - 1)

  const sourceOptions = useMemo(
    () => (summary?.jobs_by_source || []).map(row => row.label).filter(Boolean),
    [summary],
  )
  const categoryOptions = useMemo(
    () => (summary?.jobs_by_category || []).map(row => row.label).filter(Boolean),
    [summary],
  )
  const priorityOptions = useMemo(
    () => (summary?.jobs_by_priority || []).map(row => row.label).filter(Boolean),
    [summary],
  )

  return (
    <div>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
        @keyframes shimmer { 0%{background-position:200% 0;}100%{background-position:-200% 0;} }
      `}</style>

      <div style={{ marginBottom: '18px' }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: 'var(--text)', marginBottom: '6px' }}>
          {title}
        </h3>
        <p style={{ color: 'var(--muted2)', fontSize: '14px' }}>{subtitle}</p>
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '18px',
        marginBottom: '18px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(4, minmax(0, 1fr))', gap: '10px', marginBottom: '10px' }}>
          <input
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder="Search title, company, location, source"
            style={inputStyle}
          />
          <select value={source} onChange={event => setSource(event.target.value)} style={inputStyle}>
            <option value="">All sources</option>
            {sourceOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={category} onChange={event => setCategory(event.target.value)} style={inputStyle}>
            <option value="">All categories</option>
            {categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={workMode} onChange={event => setWorkMode(event.target.value)} style={inputStyle}>
            {WORK_MODE_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <select value={priority} onChange={event => setPriority(event.target.value)} style={inputStyle}>
            <option value="">All priorities</option>
            {priorityOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
          <select value={status} onChange={event => setStatus(event.target.value)} style={inputStyle}>
            {STATUS_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)} style={inputStyle}>
            {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={String(limit)} onChange={event => setLimit(Number(event.target.value))} style={inputStyle}>
            {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option} per page</option>)}
          </select>
          <button
            onClick={() => {
              setSource('')
              setCategory('')
              setWorkMode('')
              setPriority('')
              setStatus('')
              setSort('first_seen_desc')
              setLimit(Number(initialQuery?.limit || 25))
              setSearchInput('')
              setSearchQuery('')
              setPage(1)
            }}
            style={{
              ...inputStyle,
              cursor: 'pointer',
              color: 'var(--text2)',
              fontWeight: 700,
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', color: 'var(--muted2)', fontSize: '13px' }}>
        <div>Showing {from}-{to} of {total.toLocaleString()} jobs</div>
        <div>Page {currentPage} of {totalPages || 1}</div>
        <div>Last updated {formatTimestamp(jobsQuery.data?.last_updated)}</div>
      </div>

      {jobsQuery.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(index => <SkeletonCard key={index} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>{emptyTitle}</div>
          <div style={{ color: 'var(--muted2)', fontSize: '14px' }}>{emptyBody}</div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '980px',
            overflowY: 'auto',
            paddingRight: '4px',
            marginBottom: '16px',
          }}
        >
          {jobs.map((job: any, index: number) => (
            <BrowserCard key={job.id} job={job} index={index} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setPage(previous => Math.max(1, previous - 1))}
          disabled={!hasPrev}
          style={paginationButtonStyle(!hasPrev)}
        >
          Previous
        </button>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {pageWindow(currentPage, totalPages || 1).map(pageNumber => (
            <button
              key={pageNumber}
              onClick={() => setPage(pageNumber)}
              style={{
                ...paginationButtonStyle(false),
                minWidth: '40px',
                background: pageNumber === currentPage ? 'var(--accent)' : 'var(--bg2)',
                color: pageNumber === currentPage ? '#07080C' : 'var(--text2)',
                borderColor: pageNumber === currentPage ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {pageNumber}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPage(previous => previous + 1)}
          disabled={!hasNext}
          style={paginationButtonStyle(!hasNext)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg3)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px',
  color: 'var(--text)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '13px',
  padding: '10px 12px',
  outline: 'none',
}

function paginationButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'var(--bg2)',
    color: disabled ? 'var(--muted)' : 'var(--text2)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '13px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  }
}
