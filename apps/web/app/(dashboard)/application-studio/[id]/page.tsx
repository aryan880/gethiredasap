'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, ExternalLink, FileText, Mail, Plus, ShieldCheck, UserRound } from 'lucide-react'
import {
  addApplicationPackageContact,
  addApplicationPackageOutreach,
  getApplicationPackage,
  updateApplicationPackageStatus,
} from '@/lib/api'

function cardStyle() {
  return {
    background: 'var(--bg2)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px',
    padding: '18px',
  } as const
}

const inputStyle = {
  width: '100%',
  borderRadius: '10px',
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  outline: 'none',
} as const

function humanize(value?: string | null) {
  return String(value || 'unknown').replaceAll('_', ' ').toLowerCase()
}

type PackageContact = {
  id: string
  name: string
  title?: string | null
  contact_type: string
  profile_url?: string | null
  verified_email?: string | null
}

type OutreachDraft = {
  id: string
  channel: string
  status: string
  subject?: string | null
  body: string
}

type PackageDocumentLink = {
  purpose: string
  document: { id: string; file_name: string }
}

type ApplicationPackageDetail = {
  id: string
  title: string
  company: string
  location?: string | null
  status: string
  job_url: string
  application_url?: string | null
  verification_status: string
  verification_evidence?: unknown
  verified_at?: string | null
  fit_score?: number | null
  scoring_policy_version?: string | null
  url_provenance?: string | null
  source_observations?: Array<{ id: string }>
  contacts?: PackageContact[]
  outreach_drafts?: OutreachDraft[]
  documents?: PackageDocumentLink[]
}

function apiErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback
}

export default function ApplicationPackagePage() {
  const params = useParams<{ id: string }>()
  const id = String(params.id)
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [contactForm, setContactForm] = useState({ name: '', title: '', profile_url: '', contact_type: 'RECRUITER' })
  const [draftForm, setDraftForm] = useState({ channel: 'LINKEDIN', subject: '', body: '' })

  const packageQuery = useQuery<{ package: ApplicationPackageDetail }>({
    queryKey: ['application-package', id],
    queryFn: () => getApplicationPackage(id),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['application-package', id] })
    qc.invalidateQueries({ queryKey: ['application-packages'] })
    qc.invalidateQueries({ queryKey: ['application-package-stats'] })
  }
  const contactMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => addApplicationPackageContact(id, payload),
    onSuccess: refresh,
  })
  const draftMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => addApplicationPackageOutreach(id, payload),
    onSuccess: refresh,
  })
  const statusMutation = useMutation({
    mutationFn: (status: string) => updateApplicationPackageStatus(id, { status }),
    onSuccess: refresh,
  })

  const applicationPackage = packageQuery.data?.package

  async function submitContact(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await contactMutation.mutateAsync(contactForm)
      setContactForm({ name: '', title: '', profile_url: '', contact_type: 'RECRUITER' })
    } catch (mutationError: unknown) {
      setError(apiErrorMessage(mutationError, 'Unable to save contact'))
    }
  }

  async function submitDraft(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await draftMutation.mutateAsync({ ...draftForm, generated_by: 'USER' })
      setDraftForm({ channel: 'LINKEDIN', subject: '', body: '' })
    } catch (mutationError: unknown) {
      setError(apiErrorMessage(mutationError, 'Unable to save outreach draft'))
    }
  }

  async function copyDraft(draft: OutreachDraft) {
    await navigator.clipboard.writeText([draft.subject, draft.body].filter(Boolean).join('\n\n'))
    setCopied(draft.id)
    window.setTimeout(() => setCopied(''), 1800)
  }

  if (packageQuery.isLoading) return <div style={{ ...cardStyle(), color: 'var(--muted2)' }}>Loading application package…</div>
  if (!applicationPackage) return <div style={{ ...cardStyle(), color: '#FCA5A5' }}>Application package not found.</div>

  const nextAction = applicationPackage.status === 'READY_FOR_REVIEW'
    ? { label: 'Approve package', status: 'APPROVED' }
    : applicationPackage.status === 'APPROVED'
      ? { label: 'Mark applied', status: 'APPLIED' }
      : null

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div>
        <Link href="/application-studio" style={{ color: 'var(--muted2)', textDecoration: 'none', display: 'inline-flex', gap: '7px', alignItems: 'center', fontSize: '13px', marginBottom: '15px' }}><ArrowLeft size={14} /> Application Studio</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{humanize(applicationPackage.status)}</div>
            <h1 style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(30px,4vw,48px)', margin: '7px 0 5px' }}>{applicationPackage.title}</h1>
            <div style={{ color: 'var(--text2)' }}>{applicationPackage.company}{applicationPackage.location ? ` · ${applicationPackage.location}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {nextAction && <button onClick={() => statusMutation.mutate(nextAction.status)} style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#07080C', cursor: 'pointer', fontWeight: 800 }}>{nextAction.label}</button>}
            <a href={applicationPackage.application_url || applicationPackage.job_url} target="_blank" rel="noreferrer" style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(0,255,136,0.18)', background: 'rgba(0,255,136,0.07)', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '7px', fontWeight: 700 }}>Open job <ExternalLink size={14} /></a>
          </div>
        </div>
      </div>

      {error && <div style={{ ...cardStyle(), color: '#FCA5A5' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: '12px' }}>
        {[
          { label: 'Verification', value: humanize(applicationPackage.verification_status), detail: applicationPackage.verified_at ? `Checked ${new Date(applicationPackage.verified_at).toLocaleString()}` : 'Not yet verified' },
          { label: 'Fit score', value: applicationPackage.fit_score ?? '—', detail: applicationPackage.scoring_policy_version || 'No scoring snapshot' },
          { label: 'URL provenance', value: humanize(applicationPackage.url_provenance), detail: applicationPackage.application_url ? 'Direct application URL recorded' : 'Direct application URL missing' },
          { label: 'Source evidence', value: applicationPackage.source_observations?.length || 0, detail: 'Distinct source observations retained' },
        ].map(item => (
          <div key={item.label} style={cardStyle()}>
            <div style={{ color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase' }}>{item.label}</div>
            <div style={{ color: 'var(--text)', fontSize: '22px', fontWeight: 750, margin: '9px 0 4px', textTransform: 'capitalize' }}>{item.value}</div>
            <div style={{ color: 'var(--muted2)', fontSize: '11px' }}>{item.detail}</div>
          </div>
        ))}
      </div>

      <div style={cardStyle()}>
        <div style={{ display: 'flex', gap: '9px', alignItems: 'center', marginBottom: '13px' }}><ShieldCheck size={18} color="var(--accent)" /><div style={{ color: 'var(--text)', fontWeight: 750 }}>Verification evidence</div></div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--muted2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', lineHeight: 1.6 }}>{JSON.stringify(applicationPackage.verification_evidence || { status: 'Evidence has not been added yet.' }, null, 2)}</pre>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px,1fr))', gap: '16px' }}>
        <section style={cardStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}><UserRound size={18} color="#C4B5FD" /><div style={{ color: 'var(--text)', fontWeight: 750 }}>Who to contact</div></div>
          <div style={{ display: 'grid', gap: '8px', marginBottom: '15px' }}>
            {(applicationPackage.contacts || []).length === 0 ? <div style={{ color: 'var(--muted2)', fontSize: '12px' }}>No verified public contacts yet. ChatGPT Work can research recruiters, hiring managers, and relevant team members.</div> : applicationPackage.contacts?.map((contact: PackageContact) => (
              <div key={contact.id} style={{ padding: '11px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ color: 'var(--text2)', fontWeight: 750 }}>{contact.name}</div>
                <div style={{ color: 'var(--muted2)', fontSize: '11px', marginTop: '3px' }}>{contact.title || humanize(contact.contact_type)}</div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', fontSize: '11px' }}>
                  {contact.profile_url && <a href={contact.profile_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Public profile</a>}
                  {contact.verified_email && <a href={`mailto:${contact.verified_email}`} style={{ color: '#60A5FA' }}>{contact.verified_email}</a>}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={submitContact} style={{ display: 'grid', gap: '8px' }}>
            <div style={{ color: 'var(--muted2)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>Add public contact</div>
            <input required placeholder="Name" value={contactForm.name} onChange={event => setContactForm({ ...contactForm, name: event.target.value })} style={inputStyle} />
            <input placeholder="Title" value={contactForm.title} onChange={event => setContactForm({ ...contactForm, title: event.target.value })} style={inputStyle} />
            <input required type="url" placeholder="Public LinkedIn or company profile URL" value={contactForm.profile_url} onChange={event => setContactForm({ ...contactForm, profile_url: event.target.value })} style={inputStyle} />
            <select value={contactForm.contact_type} onChange={event => setContactForm({ ...contactForm, contact_type: event.target.value })} style={inputStyle}>
              <option value="RECRUITER">Recruiter</option><option value="HIRING_MANAGER">Hiring manager</option><option value="TEAM_MEMBER">Team member</option><option value="ALUMNI">Alumni</option><option value="GENERAL">General</option>
            </select>
            <button disabled={contactMutation.isPending} style={{ borderRadius: '10px', padding: '9px 12px', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.09)', color: '#C4B5FD', cursor: 'pointer', fontWeight: 700 }}><Plus size={13} style={{ verticalAlign: 'text-bottom', marginRight: 5 }} /> Save contact</button>
          </form>
        </section>

        <section style={cardStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}><Mail size={18} color="#60A5FA" /><div style={{ color: 'var(--text)', fontWeight: 750 }}>Outreach drafts</div></div>
          <div style={{ display: 'grid', gap: '8px', marginBottom: '15px' }}>
            {(applicationPackage.outreach_drafts || []).length === 0 ? <div style={{ color: 'var(--muted2)', fontSize: '12px' }}>No drafts yet. Generated messages are saved for review and are never sent automatically.</div> : applicationPackage.outreach_drafts?.map((draft: OutreachDraft) => (
              <div key={draft.id} style={{ padding: '11px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ color: 'var(--text2)', fontWeight: 750, fontSize: '12px' }}>{humanize(draft.channel)} · {humanize(draft.status)}</div>
                  <button onClick={() => copyDraft(draft)} title="Copy" style={{ border: 'none', background: 'transparent', color: copied === draft.id ? 'var(--accent)' : 'var(--muted2)', cursor: 'pointer' }}>{copied === draft.id ? <Check size={14} /> : <Copy size={14} />}</button>
                </div>
                {draft.subject && <div style={{ color: 'var(--text)', fontSize: '12px', marginTop: '8px' }}>{draft.subject}</div>}
                <div style={{ color: 'var(--muted2)', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: '7px' }}>{draft.body}</div>
              </div>
            ))}
          </div>
          <form onSubmit={submitDraft} style={{ display: 'grid', gap: '8px' }}>
            <div style={{ color: 'var(--muted2)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>Add or edit manually</div>
            <select value={draftForm.channel} onChange={event => setDraftForm({ ...draftForm, channel: event.target.value })} style={inputStyle}><option value="LINKEDIN">LinkedIn</option><option value="EMAIL">Email</option><option value="OTHER">Other</option></select>
            <input placeholder="Subject (email only)" value={draftForm.subject} onChange={event => setDraftForm({ ...draftForm, subject: event.target.value })} style={inputStyle} />
            <textarea required placeholder="Message" value={draftForm.body} onChange={event => setDraftForm({ ...draftForm, body: event.target.value })} style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} />
            <button disabled={draftMutation.isPending} style={{ borderRadius: '10px', padding: '9px 12px', border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(96,165,250,0.08)', color: '#93C5FD', cursor: 'pointer', fontWeight: 700 }}>Save draft</button>
          </form>
        </section>
      </div>

      <section style={cardStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}><FileText size={18} color="var(--accent)" /><div style={{ color: 'var(--text)', fontWeight: 750 }}>Package documents</div></div>
        {(applicationPackage.documents || []).length === 0 ? <div style={{ color: 'var(--muted2)', fontSize: '12px' }}>No tailored documents attached yet.</div> : applicationPackage.documents?.map((link: PackageDocumentLink) => (
          <div key={link.document.id} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--text2)', fontSize: '13px' }}>{link.document.file_name} <span style={{ color: 'var(--muted2)' }}>· {humanize(link.purpose)}</span></div>
        ))}
      </section>
    </div>
  )
}
