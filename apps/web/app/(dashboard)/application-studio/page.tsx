'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FolderLock,
  LoaderCircle,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import {
  deleteCandidateDocument,
  downloadCandidateDocument,
  getApplicationPackages,
  getApplicationPackageStats,
  getCandidateDocuments,
  updateApplicationPackageStatus,
  uploadCandidateDocument,
} from '@/lib/api'

type ResumeFamily = 'SOFTWARE' | 'IT_SUPPORT' | 'SYSTEMS_ANALYST'

type CandidateDocument = {
  id: string
  name: string
  file_name: string
  mime_type: string
  kind: string
  resume_family?: string | null
  byte_size: number
  is_master: boolean
  library_file_id?: string | null
  library_path?: string | null
  updated_at: string
}

type ApplicationPackage = {
  id: string
  title: string
  company: string
  location?: string | null
  job_url: string
  application_url?: string | null
  url_provenance?: string | null
  source: string
  discovered_by: string
  verification_status: string
  fit_score?: number | null
  freshness_score?: number | null
  role_family: string
  status: string
  work_notes?: string | null
  published_at?: string | null
  first_seen_at?: string | null
  counts?: { documents: number; contacts: number; outreach_drafts: number }
}

type ApplicationPackageStats = {
  statuses?: Record<string, number>
  verification?: Record<string, number>
  documents?: number
}

function apiErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback
}

const RESUME_FAMILIES: Array<{ value: ResumeFamily; label: string; description: string }> = [
  { value: 'SOFTWARE', label: 'Software', description: 'Full-stack, frontend, backend, QA, and new-grad engineering roles.' },
  { value: 'IT_SUPPORT', label: 'IT support', description: 'Service desk, technical support, IT operations, and endpoint roles.' },
  { value: 'SYSTEMS_ANALYST', label: 'Systems analyst', description: 'Application support, business systems, implementation, and analyst roles.' },
]

const STATUS_DETAILS: Record<string, { label: string; color: string; description: string }> = {
  NEEDS_REVIEW: { label: 'Needs verification', color: '#F59E0B', description: 'Confirm the direct application route, date, fit, and blockers.' },
  READY_FOR_WORK: { label: 'Ready for Work', color: '#60A5FA', description: 'Verified and eligible for tailored documents and contact research.' },
  GENERATING: { label: 'Generating', color: '#A78BFA', description: 'ChatGPT Work or another approved generator is preparing assets.' },
  READY_FOR_REVIEW: { label: 'Review package', color: '#22D3EE', description: 'Documents and outreach drafts are ready for your approval.' },
  APPROVED: { label: 'Approved', color: '#00FF88', description: 'Package is approved and ready to apply.' },
  APPLIED: { label: 'Applied', color: '#34D399', description: 'Application submitted and ready for follow-up tracking.' },
  FAILED: { label: 'Generation failed', color: '#EF4444', description: 'Generation needs another attempt or manual review.' },
  ARCHIVED: { label: 'Archived', color: '#6B7280', description: 'No longer in the active pipeline.' },
}

function cardStyle() {
  return {
    background: 'var(--bg2)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
  } as const
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function StatusPill({ status }: { status: string }) {
  const detail = STATUS_DETAILS[status] || { label: status, color: '#9CA3AF' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '5px 10px',
      border: `1px solid ${detail.color}38`, background: `${detail.color}12`, color: detail.color,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px',
    }}>
      {detail.label}
    </span>
  )
}

export default function ApplicationStudioPage() {
  const qc = useQueryClient()
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [tab, setTab] = useState<'pipeline' | 'vault'>('pipeline')
  const [pageError, setPageError] = useState('')

  const packagesQuery = useQuery<{ packages: ApplicationPackage[] }>({
    queryKey: ['application-packages'],
    queryFn: () => getApplicationPackages(),
    staleTime: 30_000,
  })
  const statsQuery = useQuery<ApplicationPackageStats>({
    queryKey: ['application-package-stats'],
    queryFn: getApplicationPackageStats,
    staleTime: 30_000,
  })
  const documentsQuery = useQuery<{ documents: CandidateDocument[] }>({
    queryKey: ['candidate-documents'],
    queryFn: () => getCandidateDocuments(),
    staleTime: 30_000,
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, family }: { file: File; family: ResumeFamily }) => uploadCandidateDocument(file, {
      name: `${RESUME_FAMILIES.find(item => item.value === family)?.label || family} master resume`,
      kind: 'MASTER_RESUME',
      resume_family: family,
      is_master: true,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate-documents'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteCandidateDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate-documents'] }),
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateApplicationPackageStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application-packages'] })
      qc.invalidateQueries({ queryKey: ['application-package-stats'] })
    },
  })

  const documents = useMemo(() => documentsQuery.data?.documents || [], [documentsQuery.data?.documents])
  const packages = packagesQuery.data?.packages || []
  const masters = useMemo(() => new Map(
    documents.filter(document => document.is_master).map(document => [document.resume_family, document]),
  ), [documents])

  const stats = statsQuery.data || {}
  const summaryCards = [
    { label: 'Needs verification', value: stats.statuses?.NEEDS_REVIEW || 0, icon: SearchCheck, color: '#F59E0B' },
    { label: 'Ready for Work', value: stats.statuses?.READY_FOR_WORK || 0, icon: Sparkles, color: '#60A5FA' },
    { label: 'Ready to review', value: stats.statuses?.READY_FOR_REVIEW || 0, icon: CheckCircle2, color: '#22D3EE' },
    { label: 'Verified open', value: stats.verification?.VERIFIED_OPEN || 0, icon: ShieldCheck, color: '#00FF88' },
  ]

  async function handleUpload(file: File | undefined, family: ResumeFamily) {
    if (!file) return
    setPageError('')
    try {
      await uploadMutation.mutateAsync({ file, family })
    } catch (error: unknown) {
      setPageError(apiErrorMessage(error, 'Unable to upload resume'))
    }
  }

  async function handleDownload(document: CandidateDocument) {
    setPageError('')
    try {
      const response = await downloadCandidateDocument(document.id)
      const url = URL.createObjectURL(response.data)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.file_name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error: unknown) {
      setPageError(apiErrorMessage(error, 'Unable to download document'))
    }
  }

  async function handleArchive(applicationPackage: ApplicationPackage) {
    setPageError('')
    try {
      await statusMutation.mutateAsync({ id: applicationPackage.id, status: 'ARCHIVED' })
    } catch (error: unknown) {
      setPageError(apiErrorMessage(error, 'Unable to archive package'))
    }
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
            {'// application studio'}
          </div>
          <h1 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 'clamp(34px,4vw,52px)', lineHeight: 1.05, color: 'var(--text)' }}>
            From verified job to ready-to-send package.
          </h1>
          <p style={{ margin: '10px 0 0', color: 'var(--muted2)', fontSize: '15px', maxWidth: '820px', lineHeight: 1.6 }}>
            GetHiredASAP owns the job record, evidence, documents, contacts, and application state. ChatGPT Work can enrich eligible packages without becoming a hidden source of truth.
          </p>
        </div>
        <div style={{ display: 'flex', padding: '4px', gap: '4px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['pipeline', 'vault'] as const).map(value => (
            <button key={value} onClick={() => setTab(value)} style={{
              border: 'none', borderRadius: '9px', padding: '9px 14px', cursor: 'pointer',
              background: tab === value ? 'rgba(0,255,136,0.10)' : 'transparent',
              color: tab === value ? 'var(--accent)' : 'var(--muted2)', fontWeight: 700,
            }}>
              {value === 'pipeline' ? 'Pipeline' : 'Document vault'}
            </button>
          ))}
        </div>
      </div>

      {pageError && <div style={{ ...cardStyle(), color: '#FCA5A5' }}>{pageError}</div>}

      {tab === 'pipeline' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
            {summaryCards.map(card => (
              <div key={card.label} style={cardStyle()}>
                <card.icon size={18} color={card.color} />
                <div style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif', fontSize: '34px', lineHeight: 1, margin: '14px 0 8px' }}>{card.value}</div>
                <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            {['Verified direct route', 'Work-parity score ≥ 80', 'No hard blockers', 'Human approval before send'].map((label, index) => (
              <div key={label} style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--text2)', fontSize: '13px' }}>
                <div style={{ width: 25, height: 25, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.18)', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>{index + 1}</div>
                {label}
              </div>
            ))}
          </div>

          {packagesQuery.isLoading ? (
            <div style={{ ...cardStyle(), color: 'var(--muted2)', display: 'flex', gap: '10px', alignItems: 'center' }}><LoaderCircle size={17} /> Loading packages…</div>
          ) : packages.length === 0 ? (
            <div style={{ ...cardStyle(), textAlign: 'center', padding: '52px 24px' }}>
              <BriefcaseBusiness size={30} color="var(--accent)" style={{ marginBottom: '12px' }} />
              <div style={{ color: 'var(--text)', fontSize: '18px', fontWeight: 700 }}>No application packages yet</div>
              <p style={{ color: 'var(--muted2)', maxWidth: '520px', margin: '8px auto 0', lineHeight: 1.6 }}>
                Choose “Prepare package” on a job. Unverified jobs enter review; verified jobs scoring 80+ with no hard blockers become ready for Work.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {packages.map(applicationPackage => {
                const detail = STATUS_DETAILS[applicationPackage.status] || STATUS_DETAILS.NEEDS_REVIEW
                return (
                  <div key={applicationPackage.id} style={cardStyle()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: '1 1 480px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                          <StatusPill status={applicationPackage.status} />
                          <span style={{ color: applicationPackage.verification_status === 'VERIFIED_OPEN' ? 'var(--accent)' : '#F59E0B', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>
                            {applicationPackage.verification_status.replaceAll('_', ' ')}
                          </span>
                          <span style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>{applicationPackage.discovered_by.replaceAll('_', ' ')}</span>
                        </div>
                        <div style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 750 }}>{applicationPackage.title}</div>
                        <div style={{ color: 'var(--text2)', marginTop: '4px' }}>{applicationPackage.company}{applicationPackage.location ? ` · ${applicationPackage.location}` : ''}</div>
                        <div style={{ color: 'var(--muted2)', fontSize: '12px', marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <span>Fit <strong style={{ color: 'var(--text2)' }}>{applicationPackage.fit_score ?? '—'}</strong></span>
                          <span>Freshness <strong style={{ color: 'var(--text2)' }}>{applicationPackage.freshness_score ?? '—'}</strong></span>
                          <span>Posted <strong style={{ color: 'var(--text2)' }}>{formatDate(applicationPackage.published_at)}</strong></span>
                          <span>Source <strong style={{ color: 'var(--text2)' }}>{applicationPackage.source}</strong></span>
                          <span>URL <strong style={{ color: 'var(--text2)' }}>{applicationPackage.url_provenance?.replaceAll('_', ' ') || 'UNKNOWN'}</strong></span>
                        </div>
                        <p style={{ color: 'var(--muted2)', fontSize: '13px', lineHeight: 1.55, margin: '12px 0 0' }}>{applicationPackage.work_notes || detail.description}</p>
                      </div>
                      <div style={{ flex: '0 1 300px', minWidth: '240px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
                          {[
                            { icon: FileText, value: applicationPackage.counts?.documents || 0, label: 'files' },
                            { icon: Users, value: applicationPackage.counts?.contacts || 0, label: 'contacts' },
                            { icon: Sparkles, value: applicationPackage.counts?.outreach_drafts || 0, label: 'drafts' },
                          ].map(item => (
                            <div key={item.label} style={{ borderRadius: '10px', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <item.icon size={14} color="var(--muted2)" />
                              <div style={{ color: 'var(--text)', fontWeight: 700, marginTop: '6px' }}>{item.value}</div>
                              <div style={{ color: 'var(--muted2)', fontSize: '10px' }}>{item.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Link href={`/application-studio/${applicationPackage.id}`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', padding: '9px 11px', textDecoration: 'none', color: '#C4B5FD', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.20)', fontSize: '12px', fontWeight: 700 }}>
                            Open package
                          </Link>
                          <a href={applicationPackage.application_url || applicationPackage.job_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', borderRadius: '10px', padding: '9px 11px', textDecoration: 'none', color: 'var(--accent)', background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.18)', fontSize: '12px', fontWeight: 700 }}>
                            {applicationPackage.application_url ? 'Apply' : 'Job'} <ExternalLink size={13} />
                          </a>
                          <button onClick={() => handleArchive(applicationPackage)} disabled={statusMutation.isPending || applicationPackage.status === 'ARCHIVED'} title="Archive" style={{ width: 40, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--muted2)', cursor: 'pointer' }}><Archive size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ ...cardStyle(), display: 'flex', gap: '13px', alignItems: 'flex-start' }}>
            <FolderLock size={24} color="var(--accent)" />
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 700 }}>Private candidate document vault</div>
              <div style={{ color: 'var(--muted2)', fontSize: '13px', marginTop: '4px', lineHeight: 1.55 }}>
                Files are encrypted before database storage. Each resume family has one active master; uploading a replacement keeps packages organized without mixing software and IT evidence.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {RESUME_FAMILIES.map(family => {
              const document = masters.get(family.value)
              return (
                <div key={family.value} style={cardStyle()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontSize: '17px', fontWeight: 750 }}>{family.label}</div>
                      <div style={{ color: 'var(--muted2)', fontSize: '12px', lineHeight: 1.5, marginTop: '5px' }}>{family.description}</div>
                    </div>
                    <FileText size={20} color={document ? 'var(--accent)' : 'var(--muted)'} />
                  </div>

                  {document ? (
                    <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.12)' }}>
                      <div style={{ color: 'var(--text2)', fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{document.file_name}</div>
                      <div style={{ color: 'var(--muted2)', fontSize: '11px', marginTop: '5px' }}>{formatBytes(document.byte_size)} · updated {formatDate(document.updated_at)}</div>
                      <div style={{ display: 'flex', gap: '7px', marginTop: '10px' }}>
                        <button onClick={() => handleDownload(document)} style={{ flex: 1, borderRadius: '9px', padding: '8px', border: '1px solid rgba(0,255,136,0.18)', background: 'rgba(0,255,136,0.07)', color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}><Download size={13} /> Download</button>
                        <button onClick={() => deleteMutation.mutate(document.id)} title="Delete" style={{ width: 36, borderRadius: '9px', border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.05)', color: '#F87171', cursor: 'pointer' }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--muted2)', fontSize: '12px', marginTop: '18px' }}>No master resume uploaded.</div>
                  )}

                  <input
                    ref={element => { fileInputs.current[family.value] = element }}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: 'none' }}
                    onChange={event => handleUpload(event.target.files?.[0], family.value)}
                  />
                  <button onClick={() => fileInputs.current[family.value]?.click()} disabled={uploadMutation.isPending} style={{ width: '100%', marginTop: '12px', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', color: 'var(--text2)', cursor: uploadMutation.isPending ? 'wait' : 'pointer', display: 'inline-flex', gap: '7px', justifyContent: 'center', alignItems: 'center', fontWeight: 700 }}>
                    <Upload size={14} /> {document ? 'Replace master' : 'Upload master'}
                  </button>
                </div>
              )
            })}
          </div>

          <div style={cardStyle()}>
            <div style={{ color: 'var(--text)', fontWeight: 750, marginBottom: '12px' }}>All stored documents <span style={{ color: 'var(--muted2)' }}>({documents.length})</span></div>
            {documents.length === 0 ? <div style={{ color: 'var(--muted2)', fontSize: '13px' }}>Tailored resumes, cover letters, match reports, and outreach files will appear here.</div> : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {documents.map(document => (
                  <div key={document.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--text2)', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{document.file_name}</div>
                      <div style={{ color: 'var(--muted2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>{document.kind.replaceAll('_', ' ')} · {document.resume_family?.replaceAll('_', ' ') || 'GENERAL'} · {formatBytes(document.byte_size)}</div>
                    </div>
                    <button onClick={() => handleDownload(document)} title="Download" style={{ width: 34, height: 34, borderRadius: '9px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--muted2)', cursor: 'pointer' }}><Download size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
