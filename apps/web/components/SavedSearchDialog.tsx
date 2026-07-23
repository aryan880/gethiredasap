'use client'

import { useEffect, useState } from 'react'

export type SavedSearchFormValues = {
  name: string
  keywords: string
  location: string
  category: string
  workMode: string
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
}

type Props = {
  open: boolean
  title: string
  submitLabel: string
  initialValues?: Partial<SavedSearchFormValues>
  onClose: () => void
  onSubmit: (values: SavedSearchFormValues) => Promise<void> | void
}

const defaultValues: SavedSearchFormValues = {
  name: '',
  keywords: '',
  location: '',
  category: '',
  workMode: '',
  minimumMatchScore: 0,
  companies: [],
  sources: [],
  frequency: 'daily',
  matchMode: 'balanced',
  excludeSeniorRoles: false,
  preferJuniorRoles: false,
  excludeContract: false,
  excludeStaffingAgencies: false,
  enabled: true,
}

function parseCsv(value: string) {
  return Array.from(new Set(
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  ))
}

export default function SavedSearchDialog({
  open,
  title,
  submitLabel,
  initialValues,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<SavedSearchFormValues>(defaultValues)
  const [companiesInput, setCompaniesInput] = useState('')
  const [sourcesInput, setSourcesInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const merged = { ...defaultValues, ...initialValues }
    setValues(merged)
    setCompaniesInput((merged.companies || []).join(', '))
    setSourcesInput((merged.sources || []).join(', '))
    setSubmitting(false)
    setError('')
  }, [initialValues, open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        ...values,
        companies: parseCsv(companiesInput),
        sources: parseCsv(sourcesInput),
      })
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to save search')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    padding: '12px 14px',
    fontSize: '14px',
    outline: 'none',
  } as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,8,12,0.72)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'grid', placeItems: 'center', padding: '18px' }}>
      <form onSubmit={handleSubmit} style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '22px', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
              // saved search
            </div>
            <div style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif', fontSize: '32px', lineHeight: 1.1 }}>{title}</div>
            <div style={{ color: 'var(--muted2)', fontSize: '14px', marginTop: '8px' }}>
              Save a filter set and let the alert layer track newly matching jobs for you. Role Family Match is the recommended default for most searches.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--muted2)', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer' }}>Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Search name</span>
            <input value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} style={inputStyle} placeholder="BC analyst roles" />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Keywords</span>
            <input value={values.keywords} onChange={e => setValues({ ...values, keywords: e.target.value })} style={inputStyle} placeholder="business analyst, operations, customer success" />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Location</span>
            <input value={values.location} onChange={e => setValues({ ...values, location: e.target.value })} style={inputStyle} placeholder="Vancouver, BC" />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Category</span>
            <input value={values.category} onChange={e => setValues({ ...values, category: e.target.value })} style={inputStyle} placeholder="Business Analysis" />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Work mode</span>
            <select value={values.workMode} onChange={e => setValues({ ...values, workMode: e.target.value })} style={inputStyle}>
              <option value="">Any</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
              <option value="Unknown">Unknown</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Minimum match score</span>
            <input type="number" min={0} max={100} value={values.minimumMatchScore} onChange={e => setValues({ ...values, minimumMatchScore: Number(e.target.value || 0) })} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Companies</span>
            <input value={companiesInput} onChange={e => setCompaniesInput(e.target.value)} style={inputStyle} placeholder="TELUS, Clio, HubSpot" />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Sources</span>
            <input value={sourcesInput} onChange={e => setSourcesInput(e.target.value)} style={inputStyle} placeholder="linkedin, remoteok, workbc" />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Frequency</span>
            <select value={values.frequency} onChange={e => setValues({ ...values, frequency: e.target.value as SavedSearchFormValues['frequency'] })} style={inputStyle}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Match mode</span>
            <select value={values.matchMode} onChange={e => setValues({ ...values, matchMode: e.target.value as SavedSearchFormValues['matchMode'] })} style={inputStyle}>
              <option value="strict">Strict Title Match</option>
              <option value="balanced">Role Family Match</option>
              <option value="broad">Broad Exploratory Match</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px', color: 'var(--text2)', fontSize: '14px' }}>
            <input type="checkbox" checked={values.excludeSeniorRoles} onChange={e => setValues({ ...values, excludeSeniorRoles: e.target.checked })} />
            Exclude senior roles
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px', color: 'var(--text2)', fontSize: '14px' }}>
            <input type="checkbox" checked={values.preferJuniorRoles} onChange={e => setValues({ ...values, preferJuniorRoles: e.target.checked })} />
            Prefer junior / entry-level roles
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px', color: 'var(--text2)', fontSize: '14px' }}>
            <input type="checkbox" checked={values.excludeContract} onChange={e => setValues({ ...values, excludeContract: e.target.checked })} />
            Exclude contract roles
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px', color: 'var(--text2)', fontSize: '14px' }}>
            <input type="checkbox" checked={values.excludeStaffingAgencies} onChange={e => setValues({ ...values, excludeStaffingAgencies: e.target.checked })} />
            Exclude staffing agencies
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px', color: 'var(--text2)', fontSize: '14px' }}>
            <input type="checkbox" checked={values.enabled} onChange={e => setValues({ ...values, enabled: e.target.checked })} />
            Enable alerts for this search
          </label>
        </div>

        {error && <div style={{ marginTop: '16px', color: '#FCA5A5', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ borderRadius: '10px', padding: '11px 16px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={submitting} style={{ borderRadius: '10px', padding: '11px 18px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#07080C', cursor: 'pointer', fontWeight: 700 }}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
