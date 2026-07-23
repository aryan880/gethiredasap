'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jobHunterQueryKeys, queueApplicationPackage, updateApplicationStatus } from '@/lib/api'

type WorkflowStatus = 'NEW' | 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  NEW: 'New',
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
}

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  NEW: '#9CA3AF',
  SAVED: '#60A5FA',
  APPLIED: '#00FF88',
  INTERVIEW: '#F59E0B',
  OFFER: '#A78BFA',
  REJECTED: '#EF4444',
}

const QUICK_ACTIONS: Array<{ label: string; status: WorkflowStatus }> = [
  { label: 'Save', status: 'SAVED' },
  { label: 'Mark Applied', status: 'APPLIED' },
  { label: 'Mark Interview', status: 'INTERVIEW' },
  { label: 'Mark Offer', status: 'OFFER' },
  { label: 'Mark Rejected', status: 'REJECTED' },
]

function workflowStatus(workflow: any): WorkflowStatus {
  const status = String(workflow?.status || 'NEW').toUpperCase()
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? status as WorkflowStatus : 'NEW'
}

export function StatusBadge({ workflow }: { workflow: any }) {
  const status = workflowStatus(workflow)
  const color = STATUS_COLORS[status]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      color,
      background: `${color}12`,
      border: `1px solid ${color}30`,
      borderRadius: '999px',
      padding: '3px 10px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.4px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export default function JobWorkflowActions({ job, workflow }: { job: any; workflow: any }) {
  const qc = useQueryClient()
  const [recruiterName, setRecruiterName] = useState(workflow?.recruiter_name || '')
  const [recruiterEmail, setRecruiterEmail] = useState(workflow?.recruiter_email || '')
  const [followUpNotes, setFollowUpNotes] = useState(workflow?.follow_up_notes || '')
  const status = workflowStatus(workflow)

  const mutation = useMutation({
    mutationFn: (nextStatus: WorkflowStatus) => updateApplicationStatus(job.id, {
      status: nextStatus,
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location,
      job_url: job.link,
      recruiter_name: recruiterName,
      recruiter_email: recruiterEmail,
      follow_up_notes: followUpNotes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: jobHunterQueryKeys.personalizedMatchesRoot })
      qc.invalidateQueries({ queryKey: ['job-hunter-command-center'] })
      qc.invalidateQueries({ queryKey: ['job-hunter-summary'] })
      qc.invalidateQueries({ queryKey: ['feed-global-browser'] })
      qc.invalidateQueries({ queryKey: ['feed-personalized-browser'] })
      qc.invalidateQueries({ queryKey: ['job-hunter-browser'] })
      qc.invalidateQueries({ queryKey: ['job-hunter-personalized-browser'] })
      qc.invalidateQueries({ queryKey: ['top-jobs-general'] })
      qc.invalidateQueries({ queryKey: ['application-stats'] })
    },
  })

  const packageMutation = useMutation({
    mutationFn: () => queueApplicationPackage({
      source: job.source || 'ai_job_hunter',
      external_job_id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      job_url: job.link,
      application_url: job.application_url || job.apply_url,
      canonical_employer_url: job.canonical_employer_url,
      source_native_id: job.source_native_id || job.ats_posting_id,
      requisition_id: job.requisition_id,
      url_provenance: job.url_provenance || 'UNKNOWN',
      application_url_verified_at: job.application_url_verified_at,
      source_metadata: job.source_metadata,
      discovered_by: 'AI_JOB_HUNTER',
      verification_status: job.verification_status || 'UNVERIFIED',
      verification_evidence: job.verification_evidence,
      published_at: job.posted_at || job.postedAt,
      first_seen_at: job.first_seen,
      fit_score: job.score ?? job.match_score,
      freshness_score: job.freshness_score,
      score_breakdown: job.score_breakdown,
      hard_blockers: job.hard_blockers || [],
      match_evidence: job.match_evidence,
      role_family: job.role_family || 'GENERAL',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application-packages'] })
      qc.invalidateQueries({ queryKey: ['application-package-stats'] })
    },
  })

  return (
    <div style={{
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <StatusBadge workflow={workflow} />
        <button
          onClick={() => packageMutation.mutate()}
          disabled={packageMutation.isPending}
          style={{
            border: '1px solid rgba(167,139,250,0.35)',
            background: 'rgba(167,139,250,0.10)',
            color: '#C4B5FD',
            borderRadius: '8px',
            padding: '6px 10px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            cursor: packageMutation.isPending ? 'wait' : 'pointer',
          }}
        >
          {packageMutation.isPending ? 'Queuing...' : 'Prepare package'}
        </button>
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.status}
            onClick={() => mutation.mutate(action.status)}
            disabled={mutation.isPending || status === action.status}
            style={{
              border: `1px solid ${STATUS_COLORS[action.status]}30`,
              background: status === action.status ? `${STATUS_COLORS[action.status]}18` : 'rgba(255,255,255,0.03)',
              color: status === action.status ? STATUS_COLORS[action.status] : 'var(--text2)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              cursor: mutation.isPending || status === action.status ? 'default' : 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {packageMutation.isSuccess && (
        <div style={{ color: 'var(--accent)', fontSize: '12px', marginBottom: '10px' }}>
          Added to Application Studio for verification and package preparation.
        </div>
      )}
      {packageMutation.isError && (
        <div style={{ color: '#FCA5A5', fontSize: '12px', marginBottom: '10px' }}>
          {(packageMutation.error as any)?.response?.data?.error || 'Unable to prepare application package.'}
        </div>
      )}

      <details>
        <summary style={{
          color: 'var(--muted2)',
          cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
        }}>
          Recruiter notes
        </summary>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px',
          marginTop: '10px',
        }}>
          <input
            value={recruiterName}
            onChange={event => setRecruiterName(event.target.value)}
            placeholder="Recruiter name"
            style={inputStyle}
          />
          <input
            value={recruiterEmail}
            onChange={event => setRecruiterEmail(event.target.value)}
            placeholder="Recruiter email"
            style={inputStyle}
          />
          <textarea
            value={followUpNotes}
            onChange={event => setFollowUpNotes(event.target.value)}
            placeholder="Follow-up notes"
            style={{ ...inputStyle, gridColumn: '1 / -1', minHeight: '66px', resize: 'vertical' }}
          />
          <button
            onClick={() => mutation.mutate(status)}
            disabled={mutation.isPending}
            style={{
              gridColumn: '1 / -1',
              justifySelf: 'start',
              border: '1px solid rgba(0,255,136,0.22)',
              background: 'rgba(0,255,136,0.08)',
              color: 'var(--accent)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              cursor: mutation.isPending ? 'wait' : 'pointer',
            }}
          >
            {mutation.isPending ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </details>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg3)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '12px',
  padding: '8px 10px',
  outline: 'none',
}
