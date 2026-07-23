'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobHunterMatches, getJobHunterResumeGap, jobHunterQueryKeys, type JobHunterJobsQuery } from '@/lib/api'
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
  showExplainability?: boolean
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Best match' },
  { value: 'first_seen_desc', label: 'Recently found' },
  { value: 'date_posted_desc', label: 'Recently posted' },
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

const chipStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '10px',
  color: 'var(--muted2)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '999px',
  padding: '3px 10px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: 'var(--text)',
  padding: '11px 12px',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '14px',
  outline: 'none',
}

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
  for (let page = start; page <= end; page += 1) pages.push(page)
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
        minHeight: '188px',
        backgroundImage: 'linear-gradient(90deg,var(--bg2) 25%,rgba(255,255,255,0.03) 50%,var(--bg2) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

function MatchCard({
  item,
  index,
  showExplainability,
}: {
  item: any
  index: number
  showExplainability: boolean
}) {
  const job = item.job || {}
  const [gapReport, setGapReport] = useState<any>(null)
  const [gapLoading, setGapLoading] = useState(false)
  const [gapError, setGapError] = useState('')
  const score = Math.round(item.final_match_score || item.user_match_score || 0)
  const scoreColor = score >= 90 ? '#00FF88' : score >= 75 ? '#60A5FA' : score >= 60 ? '#F59E0B' : '#6B7280'
  const reasons = (item.reasons || []).slice(0, 4)
  const missingKeywords = (item.missing_keywords || []).slice(0, 6)

  const analyzeResumeFit = async () => {
    if (!job.id || gapLoading) return
    setGapLoading(true)
    setGapError('')
    try {
      const report = await getJobHunterResumeGap(job.id)
      setGapReport(report)
    } catch (error: any) {
      setGapError(error.response?.data?.detail || error.message || 'Unable to analyze resume fit.')
    } finally {
      setGapLoading(false)
    }
  }

  const renderList = (items: string[], emptyText: string) => (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {(items.length > 0 ? items : [emptyText]).map((itemValue: string, itemIndex: number) => (
        <span key={`${itemValue}-${itemIndex}`} style={chipStyle}>{itemValue}</span>
      ))}
    </div>
  )

  const renderConfidenceBadge = (value?: string) => (
    <span style={{
      color: value === 'High Confidence' ? '#00FF88' : value === 'Medium Confidence' ? '#F59E0B' : 'var(--muted2)',
      background: value === 'High Confidence' ? 'rgba(0,255,136,0.08)' : value === 'Medium Confidence' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${value === 'High Confidence' ? 'rgba(0,255,136,0.22)' : value === 'Medium Confidence' ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.08)'}` ,
      borderRadius: '999px',
      padding: '3px 9px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono, monospace',
      whiteSpace: 'nowrap',
    }}>
      {value || 'Confidence pending'}
    </span>
  )

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
            MATCH
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {job.source && <span style={chipStyle}>{job.source}</span>}
          {job.category && <span style={chipStyle}>{job.category}</span>}
          {job.work_mode && <span style={chipStyle}>{job.work_mode}</span>}
          {item.match_label && (
            <span style={{ ...chipStyle, color: scoreColor, borderColor: `${scoreColor}35` }}>
              {item.match_label}
            </span>
          )}
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

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--muted2)', fontSize: '13px', marginBottom: '10px' }}>
          <span>{job.company}</span>
          <span>{job.location}</span>
          {job.posted && <span>Posted {job.posted}</span>}
          {job.first_seen && <span>Found {job.first_seen}</span>}
        </div>

        {showExplainability && (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={chipStyle}>Final {score}</span>
              <span style={chipStyle}>NLP {Math.round(item.nlp_score || 0)}</span>
              <span style={chipStyle}>Rule {Math.round(item.rule_score || 0)}</span>
              <span style={chipStyle}>{item.scoring_method === 'nlp_semantic' ? 'NLP semantic' : 'Rule fallback'}</span>
            </div>

            {reasons.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Why this matched
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {reasons.map((reason: string) => (
                    <span key={reason} style={chipStyle}>{reason}</span>
                  ))}
                </div>
              </div>
            )}

            {missingKeywords.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Improvement opportunities
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {missingKeywords.map((keyword: string) => (
                    <span key={keyword} style={chipStyle}>{keyword}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <JobWorkflowActions job={job} workflow={job.workflow} />

        <button
          onClick={analyzeResumeFit}
          disabled={gapLoading}
          style={{
            color: '#07080C',
            background: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: '10px',
            padding: '9px 12px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            cursor: gapLoading ? 'wait' : 'pointer',
            marginTop: '12px',
          }}
        >
          {gapLoading ? 'Analyzing...' : 'Analyze Resume Fit'}
        </button>

        {gapError && (
          <div style={{
            color: '#EF4444',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: '10px',
            padding: '9px 10px',
            fontSize: '13px',
            marginTop: '10px',
          }}>
            {gapError}
          </div>
        )}

        {gapReport && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '14px',
            marginTop: '12px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: 'var(--accent)',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}>
                Resume intelligence
              </div>
              <div style={{
                color: scoreColor,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                Current fit {Math.round(gapReport.skill_match_score || 0)}%
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>✓ Strengths</div>
                {renderList(gapReport.concepts_present || gapReport.matched_keywords || [], 'No clear strengths detected yet')}
              </div>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>↗ Improvement opportunities</div>
                {renderList(gapReport.concepts_missing || gapReport.missing_keywords || [], 'No major improvement opportunities detected')}
              </div>
            </div>

            {(gapReport.evidence_found || []).length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Evidence found</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {gapReport.evidence_found.slice(0, 6).map((entry: any, entryIndex: number) => (
                    <div key={`${entry.label}-${entryIndex}`} style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      padding: '9px 10px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text)', fontSize: '12px' }}>{entry.label}</strong>
                        {renderConfidenceBadge(entry.confidence)}
                      </div>
                      <div style={{ color: 'var(--muted2)', fontSize: '12px', lineHeight: 1.5 }}>
                        <div><strong style={{ color: 'var(--text2)' }}>Job:</strong> {(entry.job_evidence || []).join(' | ') || 'No explicit job evidence snippet captured.'}</div>
                        <div style={{ marginTop: '4px' }}><strong style={{ color: 'var(--text2)' }}>Resume:</strong> {(entry.resume_evidence || []).join(' | ') || 'Resume does not yet surface this concept clearly.'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(gapReport.recommended_resume_changes || []).length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Recommended resume changes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {gapReport.recommended_resume_changes.slice(0, 6).map((change: any, changeIndex: number) => (
                    <div key={`${change.label}-${changeIndex}`} style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      padding: '9px 10px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text)', fontSize: '12px' }}>{change.label}</strong>
                        {renderConfidenceBadge(change.confidence)}
                      </div>
                      <div style={{ color: 'var(--muted2)', fontSize: '12px', lineHeight: 1.5 }}>{change.recommendation}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.5, marginTop: '4px' }}>{change.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              {[
                ['Semantic alignment', Math.round(gapReport.semantic_alignment_score || 0), '#60A5FA'],
                ['Current fit', Math.round(gapReport.skill_match_score || 0), scoreColor],
                ['After improvements', Math.round(gapReport.potential_match_score_after_improvements || 0), '#00FF88'],
              ].map(([label, value, color]) => (
                <div key={String(label)} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '10px',
                }}>
                  <div style={{ color: 'var(--muted2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
                  <div style={{ color: String(color), fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 700 }}>{String(value)}%</div>
                </div>
              ))}
            </div>

            {(gapReport.resume_weaknesses || []).length > 0 && (
              <div style={{ color: 'var(--muted2)', fontSize: '13px', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>Resume weaknesses:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                  {gapReport.resume_weaknesses.slice(0, 6).map((weakness: string, weaknessIndex: number) => <li key={`${weakness}-${weaknessIndex}`}>{weakness}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
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

function paginationButtonStyle(disabled: boolean, active: boolean): CSSProperties {
  return {
    minWidth: '42px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: active ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.03)',
    color: disabled ? 'var(--muted)' : active ? 'var(--accent)' : 'var(--text2)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}

export default function AIJobMatchesBrowser({
  summary,
  title = 'Browse personalized matches',
  subtitle = 'Explore your ranked matches with filters, search, and pagination.',
  emptyTitle = 'No personalized matches yet.',
  emptyBody = 'Try clearing a filter or upload a stronger resume profile.',
  showExplainability = false,
}: Props) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [source, setSource] = useState('')
  const [category, setCategory] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('score_desc')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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

  const matchesQuery = useQuery({
    queryKey: jobHunterQueryKeys.personalizedMatches(query),
    queryFn: () => getJobHunterMatches(query),
    placeholderData: previousData => previousData,
  })

  const items = matchesQuery.data?.items || []
  const total = matchesQuery.data?.total || 0
  const totalPages = matchesQuery.data?.total_pages || 0
  const currentPage = matchesQuery.data?.page || page
  const hasPrev = Boolean(matchesQuery.data?.has_prev)
  const hasNext = Boolean(matchesQuery.data?.has_next)
  const from = total === 0 ? 0 : ((currentPage - 1) * limit) + 1
  const to = total === 0 ? 0 : Math.min(total, from + items.length - 1)

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
              setSort('score_desc')
              setLimit(25)
              setSearchInput('')
              setSearchQuery('')
              setPage(1)
            }}
            style={{ ...inputStyle, cursor: 'pointer', color: 'var(--text2)', fontWeight: 700 }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', color: 'var(--muted2)', fontSize: '13px' }}>
        <div>Showing {from}-{to} of {total.toLocaleString()} matches</div>
        <div>Page {currentPage} of {totalPages || 1}</div>
        <div>Last updated {formatTimestamp(matchesQuery.data?.last_updated)}</div>
      </div>

      {matchesQuery.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map(index => <SkeletonCard key={index} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '46px 28px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '38px', marginBottom: '16px', opacity: 0.25 }}>✦</div>
          <div style={{ color: 'var(--text)', fontSize: '18px', marginBottom: '8px' }}>{emptyTitle}</div>
          <div style={{ color: 'var(--muted2)', fontSize: '14px' }}>{emptyBody}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '980px', overflowY: 'auto', paddingRight: '4px' }}>
            {items.map((item: any, index: number) => (
              <MatchCard
                key={item.job?.id || index}
                item={item}
                index={index}
                showExplainability={showExplainability}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '18px', flexWrap: 'wrap' }}>
            <button
              disabled={!hasPrev}
              onClick={() => hasPrev && setPage(currentPage - 1)}
              style={paginationButtonStyle(!hasPrev, false)}
            >
              Previous
            </button>
            {pageWindow(currentPage, totalPages || 1).map(pageNumber => (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                style={paginationButtonStyle(false, pageNumber === currentPage)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              disabled={!hasNext}
              onClick={() => hasNext && setPage(currentPage + 1)}
              style={paginationButtonStyle(!hasNext, false)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
