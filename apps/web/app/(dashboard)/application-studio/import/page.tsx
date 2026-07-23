'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, ExternalLink, LoaderCircle } from 'lucide-react'
import { importExternalJob } from '@/lib/api'

const fieldStyle = {
  width: '100%', boxSizing: 'border-box' as const, borderRadius: '8px', padding: '11px 12px',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.035)',
  color: 'var(--text)', fontSize: '14px', outline: 'none',
}

const labelStyle = {
  display: 'grid', gap: '7px', color: 'var(--text2)', fontSize: '12px', fontWeight: 700,
}

function errorMessage(error: unknown) {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    || 'Unable to import this job'
}

export default function ExternalJobImportPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ id: string; title: string; company: string } | null>(null)
  const [form, setForm] = useState({
    title: '', company: '', location: '', job_url: '', application_url: '', source: 'chatgpt_work',
    requisition_id: '', published_at: '', fit_score: '', verification_status: 'UNVERIFIED',
    url_provenance: 'UNKNOWN', notes: '',
  })

  const mutation = useMutation({
    mutationFn: importExternalJob,
    onSuccess: data => {
      setError('')
      setResult({ id: data.package.id, title: data.package.title, company: data.package.company })
      queryClient.invalidateQueries({ queryKey: ['application-packages'] })
      queryClient.invalidateQueries({ queryKey: ['application-package-stats'] })
      queryClient.invalidateQueries({ queryKey: ['discovery-coverage'] })
    },
    onError: value => setError(errorMessage(value)),
  })

  function update(name: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [name]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setResult(null)
    setError('')
    mutation.mutate({
      ...form,
      discovered_by: 'CHATGPT_WORK',
      fit_score: form.fit_score === '' ? null : Number(form.fit_score),
      first_seen_at: new Date().toISOString(),
      source_metadata: { import_channel: 'dashboard', notes: form.notes || undefined },
    })
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gap: '20px' }}>
      <Link href="/application-studio" style={{ color: 'var(--muted2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', width: 'fit-content' }}>
        <ArrowLeft size={14} /> Application Studio
      </Link>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>{'// external discovery'}</div>
        <h1 style={{ margin: 0, color: 'var(--text)', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(34px,5vw,52px)', lineHeight: 1.05 }}>Import a verified lead.</h1>
        <p style={{ color: 'var(--muted2)', lineHeight: 1.6, maxWidth: '760px' }}>Add a job found by ChatGPT Work or manual research. GetHiredASAP will deduplicate it against existing application packages and retain the source observation.</p>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: '18px', padding: '22px', borderRadius: '8px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
          <label style={labelStyle}>Job title<input required maxLength={300} style={fieldStyle} value={form.title} onChange={event => update('title', event.target.value)} /></label>
          <label style={labelStyle}>Company<input required maxLength={200} style={fieldStyle} value={form.company} onChange={event => update('company', event.target.value)} /></label>
          <label style={labelStyle}>Location<input maxLength={200} style={fieldStyle} placeholder="Vancouver, BC or Remote Canada" value={form.location} onChange={event => update('location', event.target.value)} /></label>
          <label style={labelStyle}>Source<input required maxLength={80} style={fieldStyle} value={form.source} onChange={event => update('source', event.target.value)} /></label>
          <label style={labelStyle}>Job detail URL<input required type="url" maxLength={2000} style={fieldStyle} value={form.job_url} onChange={event => update('job_url', event.target.value)} /></label>
          <label style={labelStyle}>Direct application URL<input type="url" maxLength={2000} style={fieldStyle} value={form.application_url} onChange={event => update('application_url', event.target.value)} /></label>
          <label style={labelStyle}>Requisition ID<input maxLength={240} style={fieldStyle} value={form.requisition_id} onChange={event => update('requisition_id', event.target.value)} /></label>
          <label style={labelStyle}>Employer posting date<input type="date" style={fieldStyle} value={form.published_at} onChange={event => update('published_at', event.target.value)} /></label>
          <label style={labelStyle}>Fit score<input type="number" min={0} max={100} style={fieldStyle} value={form.fit_score} onChange={event => update('fit_score', event.target.value)} /></label>
          <label style={labelStyle}>Verification
            <select style={fieldStyle} value={form.verification_status} onChange={event => update('verification_status', event.target.value)}>
              <option value="UNVERIFIED">Unverified</option><option value="VERIFIED_OPEN">Verified open</option><option value="UNCERTAIN">Uncertain</option><option value="CLOSED">Closed</option>
            </select>
          </label>
          <label style={labelStyle}>URL provenance
            <select style={fieldStyle} value={form.url_provenance} onChange={event => update('url_provenance', event.target.value)}>
              <option value="UNKNOWN">Unknown</option><option value="EMPLOYER_ATS">Employer ATS</option><option value="EMPLOYER_CAREERS">Employer careers</option><option value="AGGREGATOR_DETAIL">Aggregator detail</option><option value="REDIRECT">Redirect</option>
            </select>
          </label>
          <label style={labelStyle}>Research notes<textarea maxLength={2000} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} value={form.notes} onChange={event => update('notes', event.target.value)} /></label>
        </div>

        {error && <div style={{ color: '#FCA5A5', fontSize: '13px' }}>{error}</div>}
        {result && <div style={{ color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px' }}><CheckCircle2 size={16} /> {result.title} at {result.company} is in the canonical tracker. <Link href={`/application-studio/${result.id}`} style={{ color: 'var(--accent)' }}>Open package</Link></div>}
        <button disabled={mutation.isPending} type="submit" style={{ justifySelf: 'start', border: 0, borderRadius: '8px', padding: '11px 16px', background: 'var(--accent)', color: '#04110A', fontWeight: 800, cursor: mutation.isPending ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {mutation.isPending ? <LoaderCircle size={15} /> : <ExternalLink size={15} />} Import job
        </button>
      </form>
    </div>
  )
}
