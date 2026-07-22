'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearches,
  updateSavedSearch,
} from '@/lib/api'
import SavedSearchDialog, { type SavedSearchFormValues } from '@/components/SavedSearchDialog'

type SavedSearch = {
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
  createdAt: string
  updatedAt: string
  matchingJobsCount: number
  matchingJobsToday: number
  newMatchingJobsSinceLastRun: number
  pendingAlerts: number
  lastEvaluatedAt?: string | null
  latestMatches: Array<{
    id: string
    title: string
    company: string
    location: string
    source: string
    link: string
    first_seen?: string
    score?: number
  }>
}

type SavedSearchResponse = {
  searches: SavedSearch[]
  summary: {
    total: number
    enabled: number
    disabled: number
    jobsMatchingToday: number
    newMatchingJobsSinceLastRun: number
    pendingAlerts: number
    alertStatus: string
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Unknown'
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

function SkeletonGrid() {
  const skeleton = {
    background: 'linear-gradient(90deg,var(--bg2) 25%, rgba(255,255,255,0.03) 50%, var(--bg2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s ease-in-out infinite',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '18px',
  } as const
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ ...skeleton, height: '118px' }} />)}
      </div>
      <div style={{ display: 'grid', gap: '16px' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ ...skeleton, height: '240px' }} />)}
      </div>
    </div>
  )
}

export default function SavedSearchesPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null)
  const [pageError, setPageError] = useState('')

  function invalidateSavedSearchQueries(id?: string) {
    qc.invalidateQueries({ queryKey: ['saved-searches'] })
    qc.invalidateQueries({ queryKey: ['saved-search'] })
    qc.invalidateQueries({
      predicate: query => {
        const head = query.queryKey?.[0]
        return typeof head === 'string' && head.startsWith('saved-search-')
      },
    })
    if (id) {
      qc.invalidateQueries({ queryKey: ['saved-search', id] })
    }
  }

  const savedSearchesQuery = useQuery<SavedSearchResponse>({
    queryKey: ['saved-searches'],
    queryFn: getSavedSearches,
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: createSavedSearch,
    onSuccess: () => invalidateSavedSearchQueries(),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateSavedSearch(id, payload),
    onSuccess: (_data, variables) => invalidateSavedSearchQueries(variables.id),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteSavedSearch,
    onSuccess: () => invalidateSavedSearchQueries(),
  })

  const summary = savedSearchesQuery.data?.summary
  const searches = savedSearchesQuery.data?.searches || []

  const summaryCards = useMemo(() => [
    { label: 'Saved searches', value: summary?.total || 0 },
    { label: 'Enabled alerts', value: summary?.enabled || 0 },
    { label: 'Jobs matching today', value: summary?.jobsMatchingToday || 0 },
    { label: 'New since last run', value: summary?.newMatchingJobsSinceLastRun || 0 },
    { label: 'Pending alerts', value: summary?.pendingAlerts || 0 },
  ], [summary])

  async function handleSave(values: SavedSearchFormValues) {
    setPageError('')
    const payload = {
      name: values.name,
      keywords: values.keywords,
      location: values.location,
      category: values.category,
      workMode: values.workMode,
      minimumMatchScore: values.minimumMatchScore,
      companies: values.companies,
      sources: values.sources,
      frequency: values.frequency,
      matchMode: values.matchMode,
      excludeSeniorRoles: values.excludeSeniorRoles,
      preferJuniorRoles: values.preferJuniorRoles,
      excludeContract: values.excludeContract,
      excludeStaffingAgencies: values.excludeStaffingAgencies,
      enabled: values.enabled,
    }
    if (editingSearch) {
      await updateMutation.mutateAsync({ id: editingSearch.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setEditingSearch(null)
  }

  async function handleToggle(search: SavedSearch) {
    try {
      await updateMutation.mutateAsync({ id: search.id, payload: { enabled: !search.enabled } })
    } catch (error: any) {
      setPageError(error?.response?.data?.error || 'Unable to update alert status')
    }
  }

  async function handleDuplicate(search: SavedSearch) {
    try {
      await createMutation.mutateAsync({
        ...search,
        name: `${search.name} copy`,
      })
    } catch (error: any) {
      setPageError(error?.response?.data?.error || 'Unable to duplicate search')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
    } catch (error: any) {
      setPageError(error?.response?.data?.error || 'Unable to delete search')
    }
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
            // saved searches
          </div>
          <h1 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 'clamp(34px,4vw,52px)', lineHeight: 1.05, color: 'var(--text)' }}>
            Smart Job Alerts
          </h1>
          <p style={{ margin: '10px 0 0', color: 'var(--muted2)', fontSize: '15px', maxWidth: '760px', lineHeight: 1.55 }}>
            Save reusable job filters, track how many opportunities match today, and let the alert layer queue notification payloads for fresh matches.
          </p>
        </div>
        <button onClick={() => { setEditingSearch(null); setDialogOpen(true) }} style={{ borderRadius: '12px', padding: '11px 16px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#07080C', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Save search
        </button>
      </div>

      {pageError && <div style={{ ...cardStyle(), color: '#FCA5A5' }}>{pageError}</div>}

      {savedSearchesQuery.isLoading ? <SkeletonGrid /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {summaryCards.map(card => (
              <div key={card.label} style={cardStyle()}>
                <div style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif', fontSize: '34px', lineHeight: 1, marginBottom: '8px' }}>{card.value.toLocaleString()}</div>
                <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 700 }}>Alert status</div>
                <div style={{ color: 'var(--muted2)', fontSize: '13px', marginTop: '4px' }}>
                  {summary?.alertStatus === 'active' ? 'Saved-search alert evaluation is active.' : 'No enabled saved searches right now.'}
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '999px', padding: '8px 12px', background: summary?.alertStatus === 'active' ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.05)', color: summary?.alertStatus === 'active' ? 'var(--accent)' : 'var(--muted2)', border: `1px solid ${summary?.alertStatus === 'active' ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.08)'}` }}>
                <Bell size={14} /> {summary?.alertStatus || 'paused'}
              </div>
            </div>
          </div>

          {searches.length === 0 ? (
            <div style={{ ...cardStyle(), textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>No saved searches yet</div>
              <div style={{ color: 'var(--muted2)', fontSize: '14px', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 18px' }}>
                Create your first saved search to start tracking filtered job streams and preparing alerts for fresh matches.
              </div>
              <button onClick={() => setDialogOpen(true)} style={{ borderRadius: '12px', padding: '11px 16px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#07080C', cursor: 'pointer', fontWeight: 700 }}>
                Create saved search
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {searches.map(search => (
                <div key={search.id} style={cardStyle()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <div style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700 }}>{search.name}</div>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: search.enabled ? 'var(--accent)' : 'var(--muted2)', background: search.enabled ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${search.enabled ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '999px', padding: '4px 10px' }}>
                          {search.enabled ? 'alerts on' : 'alerts off'}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted2)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '4px 10px' }}>
                          {search.frequency}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted2)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '4px 10px' }}>
                          {formatMatchMode(search.matchMode)}
                        </span>
                      </div>
                      <div style={{ color: 'var(--muted2)', fontSize: '14px', lineHeight: 1.6 }}>
                        <Search size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '6px' }} />
                        {search.keywords}
                        {search.location ? ` · ${search.location}` : ''}
                        {search.category ? ` · ${search.category}` : ''}
                        {search.workMode ? ` · ${search.workMode}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Link href={`/saved-searches/${search.id}`} style={{ borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(0,255,136,0.18)', background: 'rgba(0,255,136,0.06)', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'none' }}>
                        View all matches
                      </Link>
                      <button onClick={() => handleToggle(search)} style={{ borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>{search.enabled ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => { setEditingSearch(search); setDialogOpen(true) }} style={{ borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}><Pencil size={14} /></button>
                      <button onClick={() => handleDuplicate(search)} style={{ borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}><Copy size={14} /></button>
                      <button onClick={() => handleDelete(search.id)} style={{ borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.06)', color: '#FCA5A5', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    {[
                      ['Matching jobs', search.matchingJobsCount],
                      ['Matching today', search.matchingJobsToday],
                      ['New since last run', search.newMatchingJobsSinceLastRun],
                      ['Pending alerts', search.pendingAlerts],
                      ['Min score', search.minimumMatchScore],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ color: 'var(--text)', fontSize: '24px', fontWeight: 700 }}>{Number(value).toLocaleString()}</div>
                        <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {search.companies.map(company => <span key={company} style={{ fontSize: '12px', color: 'var(--text2)', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px' }}>{company}</span>)}
                    {search.sources.map(source => <span key={source} style={{ fontSize: '12px', color: 'var(--text2)', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px' }}>{source}</span>)}
                  </div>

                  <div style={{ color: 'var(--muted2)', fontSize: '12px', marginBottom: '12px' }}>
                    Updated {formatTimestamp(search.updatedAt)}
                    {search.lastEvaluatedAt ? ` · evaluated ${formatTimestamp(search.lastEvaluatedAt)}` : ''}
                  </div>

                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '10px' }}>Latest matching jobs</div>
                    {search.latestMatches.length === 0 ? (
                      <div style={{ color: 'var(--muted2)', fontSize: '13px' }}>No fresh matches in the current alert window.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {search.latestMatches.map(job => (
                          <a key={job.id} href={job.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ color: 'var(--text)', fontWeight: 700 }}>{job.title}</div>
                              <div style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>Score {Math.round(Number(job.score || 0))}</div>
                            </div>
                            <div style={{ color: 'var(--text2)', fontSize: '13px' }}>{job.company} · {job.location}</div>
                            <div style={{ color: 'var(--muted2)', fontSize: '12px' }}>{job.source} · {formatTimestamp(job.first_seen)}</div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SavedSearchDialog
        open={dialogOpen}
        title={editingSearch ? 'Edit saved search' : 'Create saved search'}
        submitLabel={editingSearch ? 'Update search' : 'Save search'}
        initialValues={editingSearch ? {
          name: editingSearch.name,
          keywords: editingSearch.keywords,
          location: editingSearch.location || '',
          category: editingSearch.category || '',
          workMode: editingSearch.workMode || '',
          minimumMatchScore: editingSearch.minimumMatchScore,
          companies: editingSearch.companies || [],
          sources: editingSearch.sources || [],
          frequency: editingSearch.frequency,
          matchMode: editingSearch.matchMode,
          excludeSeniorRoles: editingSearch.excludeSeniorRoles,
          preferJuniorRoles: editingSearch.preferJuniorRoles,
          excludeContract: editingSearch.excludeContract,
          excludeStaffingAgencies: editingSearch.excludeStaffingAgencies,
          enabled: editingSearch.enabled,
        } : undefined}
        onClose={() => { setDialogOpen(false); setEditingSearch(null) }}
        onSubmit={handleSave}
      />
    </div>
  )
}
