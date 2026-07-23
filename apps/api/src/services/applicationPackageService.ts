import { createHash } from 'crypto'

export const APPLICATION_PACKAGE_SCORE_THRESHOLD = 80
export const SCORING_POLICY_VERSION = 'work-parity-v1'

type PackageGateInput = {
  verificationStatus: string
  fitScore?: number | null
  hardBlockers?: unknown
  applicationUrl?: string | null
  urlProvenance?: string | null
}

const PACKAGE_TRANSITIONS: Record<string, Set<string>> = {
  NEEDS_REVIEW: new Set(['READY_FOR_WORK', 'ARCHIVED']),
  READY_FOR_WORK: new Set(['GENERATING', 'NEEDS_REVIEW', 'ARCHIVED']),
  GENERATING: new Set(['READY_FOR_REVIEW', 'FAILED', 'ARCHIVED']),
  READY_FOR_REVIEW: new Set(['APPROVED', 'FAILED', 'ARCHIVED']),
  APPROVED: new Set(['APPLIED', 'READY_FOR_REVIEW', 'ARCHIVED']),
  APPLIED: new Set(['ARCHIVED']),
  FAILED: new Set(['READY_FOR_WORK', 'GENERATING', 'ARCHIVED']),
  ARCHIVED: new Set(['NEEDS_REVIEW']),
}

type CanonicalJobInput = {
  source: string
  externalJobId: string
  company: string
  title: string
  location?: string | null
  publishedAt?: Date | null
  requisitionId?: string | null
  sourceNativeId?: string | null
  applicationUrl?: string | null
  canonicalEmployerUrl?: string | null
  detailUrl: string
}

function normalizedUrl(value: string) {
  let normalized = value.trim().toLowerCase()

  try {
    const parsed = new URL(value)
    parsed.hash = ''
    for (const parameter of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      parsed.searchParams.delete(parameter)
    }
    normalized = `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`
  } catch {
    // Route validation handles invalid URLs; the fallback keeps identity generation deterministic.
  }
  return normalized
}

function normalizedIdentityPart(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function canonicalJobKey(input: CanonicalJobInput) {
  const company = normalizedIdentityPart(input.company)
  const requisitionId = normalizedIdentityPart(input.requisitionId)
  const preferredEmployerUrl = input.applicationUrl || input.canonicalEmployerUrl

  let identity: string
  if (requisitionId) {
    identity = `requisition|${company}|${requisitionId}`
  } else if (preferredEmployerUrl) {
    identity = `employer-url|${normalizedUrl(preferredEmployerUrl)}`
  } else {
    const publishedDay = input.publishedAt?.toISOString().slice(0, 10) || ''
    const roleIdentity = [
      company,
      normalizedIdentityPart(input.title),
      normalizedIdentityPart(input.location),
      publishedDay,
    ].join('|')

    // If date/location evidence is weak, include the source observation to avoid
    // accidentally merging two distinct openings with the same title.
    const fallback = publishedDay || input.location
      ? roleIdentity
      : `${roleIdentity}|${normalizedIdentityPart(input.source)}|${normalizedIdentityPart(input.sourceNativeId || input.externalJobId)}|${normalizedUrl(input.detailUrl)}`
    identity = `role|${fallback}`
  }

  return createHash('sha256').update(identity).digest('hex')
}

export function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function clampScore(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

export function parseDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeHardBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, 20)
}

export function evaluatePackageGate(input: PackageGateInput) {
  const blockers = normalizeHardBlockers(input.hardBlockers)
  const reasons: string[] = []

  if (input.verificationStatus !== 'VERIFIED_OPEN') {
    reasons.push('The employer or ATS application route has not been verified open.')
  }
  if (!validHttpUrl(input.applicationUrl)) {
    reasons.push('A valid direct employer application URL is required.')
  }
  if (!['EMPLOYER_ATS', 'EMPLOYER_CAREERS'].includes(String(input.urlProvenance || ''))) {
    reasons.push('The application URL must be proven as an employer ATS or careers URL.')
  }
  if (input.fitScore === null || input.fitScore === undefined || input.fitScore < APPLICATION_PACKAGE_SCORE_THRESHOLD) {
    reasons.push(`Fit score must be at least ${APPLICATION_PACKAGE_SCORE_THRESHOLD}.`)
  }
  if (blockers.length) {
    reasons.push('One or more hard blockers require review.')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    blockers,
  }
}

export function canTransitionPackage(currentStatus: string, nextStatus: string) {
  if (currentStatus === nextStatus) return true
  return PACKAGE_TRANSITIONS[currentStatus]?.has(nextStatus) || false
}

export function applicationPackageResponse(applicationPackage: any) {
  return {
    id: applicationPackage.id,
    source: applicationPackage.source,
    external_job_id: applicationPackage.externalJobId,
    canonical_job_key: applicationPackage.canonicalJobKey,
    title: applicationPackage.title,
    company: applicationPackage.company,
    location: applicationPackage.location,
    job_url: applicationPackage.jobUrl,
    application_url: applicationPackage.applicationUrl,
    canonical_employer_url: applicationPackage.canonicalEmployerUrl,
    source_native_id: applicationPackage.sourceNativeId,
    requisition_id: applicationPackage.requisitionId,
    url_provenance: applicationPackage.urlProvenance,
    application_url_verified_at: applicationPackage.applicationUrlVerifiedAt,
    discovered_by: applicationPackage.discoveredBy,
    verification_status: applicationPackage.verificationStatus,
    verification_evidence: applicationPackage.verificationEvidence,
    verified_at: applicationPackage.verifiedAt,
    published_at: applicationPackage.publishedAt,
    first_seen_at: applicationPackage.firstSeenAt,
    fit_score: applicationPackage.fitScore,
    freshness_score: applicationPackage.freshnessScore,
    scoring_policy_version: applicationPackage.scoringPolicyVersion,
    score_breakdown: applicationPackage.scoreBreakdown,
    hard_blockers: applicationPackage.hardBlockers,
    match_evidence: applicationPackage.matchEvidence,
    role_family: applicationPackage.roleFamily,
    status: applicationPackage.status,
    work_notes: applicationPackage.workNotes,
    missed_by_automation: applicationPackage.missedByAutomation,
    automation_miss_reason: applicationPackage.automationMissReason,
    automation_miss_notes: applicationPackage.automationMissNotes,
    automation_reviewed_at: applicationPackage.automationReviewedAt,
    alerted_at: applicationPackage.alertedAt,
    library_folder_id: applicationPackage.libraryFolderId,
    library_path: applicationPackage.libraryPath,
    created_at: applicationPackage.createdAt,
    updated_at: applicationPackage.updatedAt,
    documents: applicationPackage.documents?.map((link: any) => ({
      purpose: link.purpose,
      document: link.document && {
        id: link.document.id,
        name: link.document.name,
        file_name: link.document.fileName,
        mime_type: link.document.mimeType,
        kind: link.document.kind,
        resume_family: link.document.resumeFamily,
        byte_size: link.document.byteSize,
        is_master: link.document.isMaster,
        library_file_id: link.document.libraryFileId,
        library_path: link.document.libraryPath,
        updated_at: link.document.updatedAt,
      },
    })),
    contacts: applicationPackage.contacts?.map((contact: any) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      company: contact.company,
      contact_type: contact.contactType,
      profile_url: contact.profileUrl,
      verified_email: contact.verifiedEmail,
      email_verification_url: contact.emailVerificationUrl,
      verification_confidence: contact.verificationConfidence,
      recommended_order: contact.recommendedOrder,
      notes: contact.notes,
      created_at: contact.createdAt,
    })),
    outreach_drafts: applicationPackage.outreachDrafts?.map((draft: any) => ({
      id: draft.id,
      contact_id: draft.contactId,
      channel: draft.channel,
      subject: draft.subject,
      body: draft.body,
      status: draft.status,
      generated_by: draft.generatedBy,
      sent_at: draft.sentAt,
      created_at: draft.createdAt,
      updated_at: draft.updatedAt,
    })),
    source_observations: applicationPackage.sourceObservations?.map((observation: any) => ({
      id: observation.id,
      source: observation.source,
      external_job_id: observation.externalJobId,
      source_native_id: observation.sourceNativeId,
      requisition_id: observation.requisitionId,
      detail_url: observation.detailUrl,
      application_url: observation.applicationUrl,
      url_provenance: observation.urlProvenance,
      application_url_verified_at: observation.applicationUrlVerifiedAt,
      first_seen_at: observation.firstSeenAt,
      last_seen_at: observation.lastSeenAt,
    })),
    counts: applicationPackage._count && {
      documents: applicationPackage._count.documents,
      contacts: applicationPackage._count.contacts,
      outreach_drafts: applicationPackage._count.outreachDrafts,
    },
  }
}
