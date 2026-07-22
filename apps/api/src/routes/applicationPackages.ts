import { Response, Router } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { cleanString, isEmail } from '../middleware/security'
import {
  SCORING_POLICY_VERSION,
  applicationPackageResponse,
  canTransitionPackage,
  canonicalJobKey,
  clampScore,
  evaluatePackageGate,
  normalizeHardBlockers,
  parseDate,
  validHttpUrl,
} from '../services/applicationPackageService'

const router = Router()

const DISCOVERY_ORIGINS = new Set(['AI_JOB_HUNTER', 'CHATGPT_WORK', 'BOTH', 'MANUAL'])
const VERIFICATION_STATUSES = new Set(['UNVERIFIED', 'VERIFIED_OPEN', 'UNCERTAIN', 'CLOSED', 'REJECTED'])
const URL_PROVENANCE = new Set(['EMPLOYER_ATS', 'EMPLOYER_CAREERS', 'AGGREGATOR_DETAIL', 'REDIRECT', 'UNKNOWN'])
const PACKAGE_STATUSES = new Set([
  'NEEDS_REVIEW',
  'READY_FOR_WORK',
  'GENERATING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'APPLIED',
  'FAILED',
  'ARCHIVED',
])
const RESUME_FAMILIES = new Set(['SOFTWARE', 'IT_SUPPORT', 'SYSTEMS_ANALYST', 'GENERAL', 'CUSTOM'])
const DOCUMENT_KINDS = new Set([
  'MASTER_RESUME',
  'TAILORED_RESUME',
  'COVER_LETTER',
  'JOB_DESCRIPTION',
  'MATCH_REPORT',
  'RECRUITER_OUTREACH',
  'APPLICATION_ANSWERS',
  'OTHER',
])
const CONTACT_TYPES = new Set(['RECRUITER', 'HIRING_MANAGER', 'TEAM_MEMBER', 'ALUMNI', 'GENERAL'])
const OUTREACH_CHANNELS = new Set(['EMAIL', 'LINKEDIN', 'OTHER'])
const OUTREACH_STATUSES = new Set(['DRAFT', 'APPROVED', 'SENT', 'REPLIED', 'ARCHIVED'])

router.use(authenticate)

function normalizedEnum(value: unknown, allowed: Set<string>) {
  const normalized = String(value || '').trim().toUpperCase()
  return allowed.has(normalized) ? normalized : null
}

function packageInclude() {
  return {
    documents: { include: { document: true }, orderBy: { createdAt: 'desc' as const } },
    contacts: { orderBy: [{ recommendedOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
    outreachDrafts: { orderBy: { createdAt: 'desc' as const } },
    sourceObservations: { orderBy: { lastSeenAt: 'desc' as const } },
  }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const status = normalizedEnum(req.query.status, PACKAGE_STATUSES)
    const verificationStatus = normalizedEnum(req.query.verification_status, VERIFICATION_STATUSES)
    const packages = await prisma.applicationPackage.findMany({
      where: {
        userId: req.user!.userId,
        ...(status && { status: status as any }),
        ...(verificationStatus && { verificationStatus: verificationStatus as any }),
      },
      include: { _count: { select: { documents: true, contacts: true, outreachDrafts: true } } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    })

    res.json({ packages: packages.map(applicationPackageResponse) })
  } catch (error) {
    console.error('List application packages error:', error)
    res.status(500).json({ error: 'Unable to load application packages' })
  }
})

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [statusRows, verificationRows, documentCount] = await Promise.all([
      prisma.applicationPackage.groupBy({
        by: ['status'],
        where: { userId: req.user!.userId },
        _count: { status: true },
      }),
      prisma.applicationPackage.groupBy({
        by: ['verificationStatus'],
        where: { userId: req.user!.userId },
        _count: { verificationStatus: true },
      }),
      prisma.candidateDocument.count({ where: { userId: req.user!.userId } }),
    ])

    res.json({
      statuses: Object.fromEntries(statusRows.map(row => [row.status, row._count.status])),
      verification: Object.fromEntries(
        verificationRows.map(row => [row.verificationStatus, row._count.verificationStatus]),
      ),
      documents: documentCount,
    })
  } catch (error) {
    console.error('Application package stats error:', error)
    res.status(500).json({ error: 'Unable to load application package stats' })
  }
})

router.post('/queue', async (req: AuthRequest, res: Response) => {
  try {
    const source = cleanString(req.body.source, 80)
    const externalJobId = cleanString(req.body.external_job_id || req.body.job_id, 180)
    const title = cleanString(req.body.title, 300)
    const company = cleanString(req.body.company, 200)
    const location = cleanString(req.body.location, 200) || null
    const jobUrl = cleanString(req.body.job_url || req.body.link, 2000)
    const applicationUrl = cleanString(req.body.application_url, 2000) || null
    const canonicalEmployerUrl = cleanString(req.body.canonical_employer_url, 2000) || null
    const sourceNativeId = cleanString(req.body.source_native_id, 240) || null
    const requisitionId = cleanString(req.body.requisition_id, 240) || null
    const urlProvenance = normalizedEnum(req.body.url_provenance, URL_PROVENANCE) || 'UNKNOWN'
    const discoveredBy = normalizedEnum(req.body.discovered_by, DISCOVERY_ORIGINS) || 'AI_JOB_HUNTER'
    const verificationStatus = normalizedEnum(req.body.verification_status, VERIFICATION_STATUSES) || 'UNVERIFIED'
    const roleFamily = normalizedEnum(req.body.role_family, RESUME_FAMILIES) || 'GENERAL'
    const fitScore = clampScore(req.body.fit_score)
    const freshnessScore = clampScore(req.body.freshness_score)
    const blockers = normalizeHardBlockers(req.body.hard_blockers)

    if (!source || !externalJobId || !title || !company || !validHttpUrl(jobUrl)) {
      res.status(400).json({ error: 'Source, job id, title, company, and a valid job URL are required' })
      return
    }

    if (applicationUrl && !validHttpUrl(applicationUrl)) {
      res.status(400).json({ error: 'Application URL must be a valid HTTP or HTTPS URL' })
      return
    }

    if (canonicalEmployerUrl && !validHttpUrl(canonicalEmployerUrl)) {
      res.status(400).json({ error: 'Canonical employer URL must be a valid HTTP or HTTPS URL' })
      return
    }

    const gate = evaluatePackageGate({
      verificationStatus,
      fitScore,
      hardBlockers: blockers,
      applicationUrl,
      urlProvenance,
    })
    const status = gate.eligible ? 'READY_FOR_WORK' : 'NEEDS_REVIEW'
    const publishedAt = parseDate(req.body.published_at)
    const firstSeenAt = parseDate(req.body.first_seen_at) || new Date()
    const urlVerifiedAt = parseDate(req.body.application_url_verified_at)
    const canonicalKey = canonicalJobKey({
      source,
      externalJobId,
      company,
      title,
      location,
      publishedAt,
      requisitionId,
      sourceNativeId,
      applicationUrl,
      canonicalEmployerUrl,
      detailUrl: jobUrl,
    })
    const packageData = {
      canonicalJobKey: canonicalKey,
      title,
      company,
      location,
      jobUrl,
      applicationUrl,
      canonicalEmployerUrl,
      sourceNativeId,
      requisitionId,
      urlProvenance: urlProvenance as any,
      applicationUrlVerifiedAt: urlVerifiedAt,
      discoveredBy: discoveredBy as any,
      verificationStatus: verificationStatus as any,
      verificationEvidence: req.body.verification_evidence || undefined,
      verifiedAt: verificationStatus === 'VERIFIED_OPEN' ? parseDate(req.body.verified_at) || new Date() : null,
      publishedAt,
      firstSeenAt,
      fitScore,
      freshnessScore,
      scoringPolicyVersion: cleanString(req.body.scoring_policy_version, 80) || SCORING_POLICY_VERSION,
      scoreBreakdown: req.body.score_breakdown || undefined,
      hardBlockers: blockers,
      matchEvidence: req.body.match_evidence || undefined,
      roleFamily: roleFamily as any,
      status: status as any,
      workNotes: gate.reasons.length ? gate.reasons.join(' ') : null,
    }

    const applicationPackage = await prisma.$transaction(async tx => {
      const sourceObservation = await tx.jobSourceObservation.findUnique({
        where: {
          userId_source_externalJobId: {
            userId: req.user!.userId,
            source,
            externalJobId,
          },
        },
      })

      const existing = sourceObservation
        ? await tx.applicationPackage.findUnique({ where: { id: sourceObservation.packageId } })
        : await tx.applicationPackage.findUnique({
            where: {
              userId_canonicalJobKey: {
                userId: req.user!.userId,
                canonicalJobKey: canonicalKey,
              },
            },
          })

      const mergedOrigin = existing && existing.discoveredBy !== discoveredBy && existing.discoveredBy !== 'BOTH'
        ? 'BOTH'
        : discoveredBy

      const savedPackage = existing
        ? await tx.applicationPackage.update({
            where: { id: existing.id },
            data: {
              ...packageData,
              canonicalJobKey: existing.canonicalJobKey,
              applicationUrl: applicationUrl || existing.applicationUrl,
              canonicalEmployerUrl: canonicalEmployerUrl || existing.canonicalEmployerUrl,
              sourceNativeId: sourceNativeId || existing.sourceNativeId,
              requisitionId: requisitionId || existing.requisitionId,
              urlProvenance: applicationUrl ? urlProvenance as any : existing.urlProvenance,
              applicationUrlVerifiedAt: urlVerifiedAt || existing.applicationUrlVerifiedAt,
              discoveredBy: mergedOrigin as any,
              verificationStatus: existing.verificationStatus === 'VERIFIED_OPEN' && verificationStatus !== 'VERIFIED_OPEN'
                ? existing.verificationStatus
                : verificationStatus as any,
              verificationEvidence: req.body.verification_evidence || existing.verificationEvidence || undefined,
              verifiedAt: verificationStatus === 'VERIFIED_OPEN'
                ? packageData.verifiedAt
                : existing.verifiedAt,
              publishedAt: existing.publishedAt || publishedAt,
              firstSeenAt: existing.firstSeenAt && existing.firstSeenAt < firstSeenAt
                ? existing.firstSeenAt
                : firstSeenAt,
              fitScore: fitScore ?? existing.fitScore,
              freshnessScore: freshnessScore ?? existing.freshnessScore,
              status: ['NEEDS_REVIEW', 'READY_FOR_WORK'].includes(existing.status)
                ? (existing.status === 'READY_FOR_WORK' && !gate.eligible ? existing.status : status as any)
                : existing.status,
              workNotes: existing.status === 'READY_FOR_WORK' && !gate.eligible
                ? existing.workNotes
                : packageData.workNotes,
            },
          })
        : await tx.applicationPackage.create({
            data: {
              userId: req.user!.userId,
              source,
              externalJobId,
              ...packageData,
            },
          })

      await tx.jobSourceObservation.upsert({
        where: {
          userId_source_externalJobId: {
            userId: req.user!.userId,
            source,
            externalJobId,
          },
        },
        create: {
          userId: req.user!.userId,
          packageId: savedPackage.id,
          source,
          externalJobId,
          sourceNativeId,
          requisitionId,
          detailUrl: jobUrl,
          applicationUrl,
          urlProvenance: urlProvenance as any,
          applicationUrlVerifiedAt: urlVerifiedAt,
          firstSeenAt,
          lastSeenAt: new Date(),
          rawMetadata: req.body.source_metadata || undefined,
        },
        update: {
          packageId: savedPackage.id,
          sourceNativeId,
          requisitionId,
          detailUrl: jobUrl,
          applicationUrl,
          urlProvenance: urlProvenance as any,
          applicationUrlVerifiedAt: urlVerifiedAt,
          lastSeenAt: new Date(),
          rawMetadata: req.body.source_metadata || undefined,
        },
      })

      return tx.applicationPackage.findUnique({
        where: { id: savedPackage.id },
        include: packageInclude(),
      })
    })

    res.status(201).json({
      package: applicationPackageResponse(applicationPackage),
      gate,
    })
  } catch (error) {
    console.error('Queue application package error:', error)
    res.status(500).json({ error: 'Unable to queue application package' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const applicationPackage = await prisma.applicationPackage.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
      include: packageInclude(),
    })

    if (!applicationPackage) {
      res.status(404).json({ error: 'Application package not found' })
      return
    }

    res.json({ package: applicationPackageResponse(applicationPackage) })
  } catch (error) {
    console.error('Get application package error:', error)
    res.status(500).json({ error: 'Unable to load application package' })
  }
})

router.patch('/:id/verification', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.applicationPackage.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })
    if (!existing) {
      res.status(404).json({ error: 'Application package not found' })
      return
    }

    const verificationStatus = normalizedEnum(req.body.verification_status, VERIFICATION_STATUSES)
    if (!verificationStatus) {
      res.status(400).json({ error: 'A valid verification status is required' })
      return
    }

    const applicationUrl = req.body.application_url === undefined
      ? existing.applicationUrl
      : cleanString(req.body.application_url, 2000) || null
    const canonicalEmployerUrl = req.body.canonical_employer_url === undefined
      ? existing.canonicalEmployerUrl
      : cleanString(req.body.canonical_employer_url, 2000) || null
    const requisitionId = req.body.requisition_id === undefined
      ? existing.requisitionId
      : cleanString(req.body.requisition_id, 240) || null
    const sourceNativeId = req.body.source_native_id === undefined
      ? existing.sourceNativeId
      : cleanString(req.body.source_native_id, 240) || null
    const urlProvenance = req.body.url_provenance === undefined
      ? existing.urlProvenance
      : normalizedEnum(req.body.url_provenance, URL_PROVENANCE)

    if ((applicationUrl && !validHttpUrl(applicationUrl)) ||
        (canonicalEmployerUrl && !validHttpUrl(canonicalEmployerUrl)) ||
        !urlProvenance) {
      res.status(400).json({ error: 'Valid application URL, employer URL, and URL provenance are required' })
      return
    }

    const fitScore = req.body.fit_score === undefined ? existing.fitScore : clampScore(req.body.fit_score)
    const blockers = req.body.hard_blockers === undefined
      ? normalizeHardBlockers(existing.hardBlockers)
      : normalizeHardBlockers(req.body.hard_blockers)
    const gate = evaluatePackageGate({
      verificationStatus,
      fitScore,
      hardBlockers: blockers,
      applicationUrl,
      urlProvenance,
    })
    const publishedAt = req.body.published_at === undefined
      ? existing.publishedAt
      : parseDate(req.body.published_at)
    const canonicalKey = canonicalJobKey({
      source: existing.source,
      externalJobId: existing.externalJobId,
      company: existing.company,
      title: existing.title,
      location: existing.location,
      publishedAt,
      requisitionId,
      sourceNativeId,
      applicationUrl,
      canonicalEmployerUrl,
      detailUrl: existing.jobUrl,
    })

    const applicationPackage = await prisma.applicationPackage.update({
      where: { id: existing.id },
      data: {
        verificationStatus: verificationStatus as any,
        verificationEvidence: req.body.verification_evidence ?? existing.verificationEvidence ?? undefined,
        verifiedAt: verificationStatus === 'VERIFIED_OPEN'
          ? parseDate(req.body.verified_at) || new Date()
          : null,
        canonicalJobKey: canonicalKey,
        applicationUrl,
        canonicalEmployerUrl,
        requisitionId,
        sourceNativeId,
        urlProvenance: urlProvenance as any,
        applicationUrlVerifiedAt: verificationStatus === 'VERIFIED_OPEN'
          ? parseDate(req.body.application_url_verified_at) || new Date()
          : existing.applicationUrlVerifiedAt,
        publishedAt,
        ...(req.body.fit_score !== undefined && { fitScore }),
        ...(req.body.freshness_score !== undefined && { freshnessScore: clampScore(req.body.freshness_score) }),
        ...(req.body.score_breakdown !== undefined && { scoreBreakdown: req.body.score_breakdown }),
        ...(req.body.match_evidence !== undefined && { matchEvidence: req.body.match_evidence }),
        hardBlockers: blockers,
        status: gate.eligible ? 'READY_FOR_WORK' : 'NEEDS_REVIEW',
        workNotes: gate.reasons.length ? gate.reasons.join(' ') : null,
      },
      include: packageInclude(),
    })

    res.json({ package: applicationPackageResponse(applicationPackage), gate })
  } catch (error) {
    console.error('Verify application package error:', error)
    res.status(500).json({ error: 'Unable to update verification' })
  }
})

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.applicationPackage.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })
    if (!existing) {
      res.status(404).json({ error: 'Application package not found' })
      return
    }

    const nextStatus = normalizedEnum(req.body.status, PACKAGE_STATUSES)
    if (!nextStatus || !canTransitionPackage(existing.status, nextStatus)) {
      res.status(409).json({ error: `Cannot move package from ${existing.status} to ${nextStatus || 'invalid status'}` })
      return
    }

    if (nextStatus === 'READY_FOR_WORK') {
      const gate = evaluatePackageGate(existing)
      if (!gate.eligible) {
        res.status(409).json({ error: 'Package does not pass the generation gate', gate })
        return
      }
    }

    const applicationPackage = await prisma.applicationPackage.update({
      where: { id: existing.id },
      data: {
        status: nextStatus as any,
        ...(req.body.work_notes !== undefined && {
          workNotes: cleanString(req.body.work_notes, 10000) || null,
        }),
        ...(req.body.library_folder_id !== undefined && {
          libraryFolderId: cleanString(req.body.library_folder_id, 240) || null,
        }),
        ...(req.body.library_path !== undefined && {
          libraryPath: cleanString(req.body.library_path, 1000) || null,
        }),
      },
      include: packageInclude(),
    })

    res.json({ package: applicationPackageResponse(applicationPackage) })
  } catch (error) {
    console.error('Update application package status error:', error)
    res.status(500).json({ error: 'Unable to update package status' })
  }
})

router.post('/:id/documents', async (req: AuthRequest, res: Response) => {
  try {
    const purpose = normalizedEnum(req.body.purpose, DOCUMENT_KINDS)
    const documentId = cleanString(req.body.document_id, 100)
    if (!purpose || !documentId) {
      res.status(400).json({ error: 'Document id and purpose are required' })
      return
    }

    const [applicationPackage, document] = await Promise.all([
      prisma.applicationPackage.findFirst({
        where: { id: String(req.params.id), userId: req.user!.userId },
      }),
      prisma.candidateDocument.findFirst({
        where: { id: documentId, userId: req.user!.userId },
      }),
    ])
    if (!applicationPackage || !document) {
      res.status(404).json({ error: 'Application package or document not found' })
      return
    }

    await prisma.applicationPackageDocument.upsert({
      where: { packageId_documentId: { packageId: applicationPackage.id, documentId } },
      create: { packageId: applicationPackage.id, documentId, purpose: purpose as any },
      update: { purpose: purpose as any },
    })

    const updated = await prisma.applicationPackage.findUnique({
      where: { id: applicationPackage.id },
      include: packageInclude(),
    })
    res.status(201).json({ package: applicationPackageResponse(updated) })
  } catch (error) {
    console.error('Attach package document error:', error)
    res.status(500).json({ error: 'Unable to attach document' })
  }
})

router.post('/:id/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const applicationPackage = await prisma.applicationPackage.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })
    if (!applicationPackage) {
      res.status(404).json({ error: 'Application package not found' })
      return
    }

    const name = cleanString(req.body.name, 160)
    const title = cleanString(req.body.title, 200) || null
    const company = cleanString(req.body.company, 200) || applicationPackage.company
    const contactType = normalizedEnum(req.body.contact_type, CONTACT_TYPES) || 'GENERAL'
    const profileUrl = cleanString(req.body.profile_url, 2000) || null
    const verifiedEmail = cleanString(req.body.verified_email, 254) || null
    const emailVerificationUrl = cleanString(req.body.email_verification_url, 2000) || null

    if (!name || (!profileUrl && !verifiedEmail)) {
      res.status(400).json({ error: 'Contact name and a public profile or verified email are required' })
      return
    }
    if (profileUrl && !validHttpUrl(profileUrl)) {
      res.status(400).json({ error: 'Invalid public profile URL' })
      return
    }
    if (verifiedEmail && (!isEmail(verifiedEmail) || !validHttpUrl(emailVerificationUrl))) {
      res.status(400).json({
        error: 'Verified emails require a valid address and a public verification URL; guessed emails are not accepted',
      })
      return
    }

    const contact = await prisma.jobContact.create({
      data: {
        userId: req.user!.userId,
        packageId: applicationPackage.id,
        name,
        title,
        company,
        contactType: contactType as any,
        profileUrl,
        verifiedEmail,
        emailVerificationUrl,
        verificationConfidence: clampScore(req.body.verification_confidence),
        recommendedOrder: Math.max(0, Math.min(99, Number(req.body.recommended_order) || 0)),
        notes: cleanString(req.body.notes, 5000) || null,
      },
    })

    res.status(201).json({ contact })
  } catch (error) {
    console.error('Create job contact error:', error)
    res.status(500).json({ error: 'Unable to save contact' })
  }
})

router.post('/:id/outreach', async (req: AuthRequest, res: Response) => {
  try {
    const applicationPackage = await prisma.applicationPackage.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })
    if (!applicationPackage) {
      res.status(404).json({ error: 'Application package not found' })
      return
    }

    const contactId = cleanString(req.body.contact_id, 100) || null
    if (contactId) {
      const contact = await prisma.jobContact.findFirst({
        where: { id: contactId, packageId: applicationPackage.id, userId: req.user!.userId },
      })
      if (!contact) {
        res.status(404).json({ error: 'Contact not found in this application package' })
        return
      }
    }

    const channel = normalizedEnum(req.body.channel, OUTREACH_CHANNELS)
    const body = cleanString(req.body.body, 10000)
    if (!channel || !body) {
      res.status(400).json({ error: 'Outreach channel and message body are required' })
      return
    }

    const draft = await prisma.outreachDraft.create({
      data: {
        userId: req.user!.userId,
        packageId: applicationPackage.id,
        contactId,
        channel: channel as any,
        subject: cleanString(req.body.subject, 300) || null,
        body,
        status: 'DRAFT',
        generatedBy: cleanString(req.body.generated_by, 80) || 'CHATGPT_WORK',
      },
    })

    res.status(201).json({ outreach_draft: draft })
  } catch (error) {
    console.error('Create outreach draft error:', error)
    res.status(500).json({ error: 'Unable to save outreach draft' })
  }
})

router.patch('/:packageId/outreach/:draftId/status', async (req: AuthRequest, res: Response) => {
  try {
    const draft = await prisma.outreachDraft.findFirst({
      where: {
        id: String(req.params.draftId),
        packageId: String(req.params.packageId),
        userId: req.user!.userId,
      },
    })
    if (!draft) {
      res.status(404).json({ error: 'Outreach draft not found' })
      return
    }

    const status = normalizedEnum(req.body.status, OUTREACH_STATUSES)
    if (!status) {
      res.status(400).json({ error: 'Invalid outreach status' })
      return
    }

    const updated = await prisma.outreachDraft.update({
      where: { id: draft.id },
      data: {
        status: status as any,
        sentAt: status === 'SENT' ? draft.sentAt || new Date() : draft.sentAt,
      },
    })
    res.json({ outreach_draft: updated })
  } catch (error) {
    console.error('Update outreach status error:', error)
    res.status(500).json({ error: 'Unable to update outreach status' })
  }
})

export default router
