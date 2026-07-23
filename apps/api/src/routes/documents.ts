import express, { Response, Router } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { cleanString } from '../middleware/security'
import { decryptDocument, encryptDocument, sha256 } from '../services/documentCrypto'
import { clearPersonalizedMatchesCache } from '../services/jobHunterService'
import { candidateResumeFamily } from '../services/candidateProfileService'
import { extractResumeText } from '../services/resumeTextExtraction'

const router = Router()
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024

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

const RESUME_FAMILIES = new Set(['SOFTWARE', 'IT_SUPPORT', 'SYSTEMS_ANALYST', 'GENERAL', 'CUSTOM'])

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
])

router.use(authenticate)

function normalizedEnum(value: unknown, allowed: Set<string>) {
  const normalized = String(value || '').trim().toUpperCase()
  return allowed.has(normalized) ? normalized : null
}

function safeFileName(value: unknown) {
  const raw = cleanString(value, 240)
  const fileName = raw.replace(/[\r\n"\\/]/g, '_').replace(/^\.+/, '')
  return fileName || 'document'
}

function documentResponse(document: any) {
  return {
    id: document.id,
    name: document.name,
    file_name: document.fileName,
    mime_type: document.mimeType,
    kind: document.kind,
    resume_family: document.resumeFamily,
    byte_size: document.byteSize,
    sha256: document.sha256,
    is_master: document.isMaster,
    text_ready: Boolean(document.textCiphertext && document.textExtractedAt),
    text_length: document.textLength,
    text_extracted_at: document.textExtractedAt,
    text_extraction_error: document.textExtractionError,
    library_file_id: document.libraryFileId,
    library_path: document.libraryPath,
    created_at: document.createdAt,
    updated_at: document.updatedAt,
  }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const kind = normalizedEnum(req.query.kind, DOCUMENT_KINDS)
    const resumeFamily = normalizedEnum(req.query.resume_family, RESUME_FAMILIES)
    const [documents, user] = await Promise.all([
      prisma.candidateDocument.findMany({
        where: {
          userId: req.user!.userId,
          ...(kind && { kind: kind as any }),
          ...(resumeFamily && { resumeFamily: resumeFamily as any }),
        },
        orderBy: [{ isMaster: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { activeResumeFamily: true },
      }),
    ])

    res.json({
      documents: documents.map(documentResponse),
      active_resume_family: user?.activeResumeFamily || null,
    })
  } catch (error) {
    console.error('List documents error:', error)
    res.status(500).json({ error: 'Unable to load documents' })
  }
})

router.post(
  '/upload',
  express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Document file is required' })
        return
      }

      const mimeType = cleanString(req.headers['content-type'], 160).split(';')[0]
      const kind = normalizedEnum(req.query.kind, DOCUMENT_KINDS)
      const resumeFamily = normalizedEnum(req.query.resume_family, RESUME_FAMILIES)
      const isMaster = String(req.query.is_master || '').toLowerCase() === 'true'
      const name = cleanString(req.query.name, 160)
      const fileName = safeFileName(req.query.file_name)

      if (!kind || !name) {
        res.status(400).json({ error: 'Document name and valid kind are required' })
        return
      }

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(415).json({ error: 'Only PDF, DOCX, Markdown, and plain-text files are supported' })
        return
      }

      if ((kind === 'MASTER_RESUME' || isMaster) && !resumeFamily) {
        res.status(400).json({ error: 'Master resumes require a resume family' })
        return
      }

      const checksum = sha256(req.body)
      const duplicate = await prisma.candidateDocument.findFirst({
        where: { userId: req.user!.userId, sha256: checksum },
      })

      if (duplicate) {
        res.status(409).json({
          error: 'This document has already been uploaded',
          document: documentResponse(duplicate),
        })
        return
      }

      const encrypted = encryptDocument(req.body)
      let encryptedText: ReturnType<typeof encryptDocument> | null = null
      let textLength: number | null = null
      let textExtractionError: string | null = null

      if (kind === 'MASTER_RESUME' || kind === 'TAILORED_RESUME') {
        try {
          const text = await extractResumeText(req.body, mimeType)
          encryptedText = encryptDocument(Buffer.from(text, 'utf8'))
          textLength = text.length
        } catch (error: any) {
          textExtractionError = cleanString(error?.message, 300) || 'Resume text extraction failed'
        }
      }

      const document = await prisma.$transaction(async tx => {
        if (isMaster && resumeFamily) {
          await tx.candidateDocument.updateMany({
            where: {
              userId: req.user!.userId,
              resumeFamily: resumeFamily as any,
              isMaster: true,
            },
            data: { isMaster: false },
          })
        }

        const created = await tx.candidateDocument.create({
          data: {
            userId: req.user!.userId,
            name,
            fileName,
            mimeType,
            kind: kind as any,
            resumeFamily: resumeFamily as any,
            byteSize: req.body.length,
            sha256: encrypted.sha256,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            textCiphertext: encryptedText?.ciphertext,
            textIv: encryptedText?.iv,
            textAuthTag: encryptedText?.authTag,
            textSha256: encryptedText?.sha256,
            textLength,
            textExtractedAt: encryptedText ? new Date() : null,
            textExtractionError,
            isMaster,
          },
        })

        if (isMaster && resumeFamily && encryptedText) {
          await tx.user.updateMany({
            where: { id: req.user!.userId, activeResumeFamily: null },
            data: { activeResumeFamily: resumeFamily as any },
          })
        }

        return created
      })

      clearPersonalizedMatchesCache(req.user!.userId)
      res.status(201).json({ document: documentResponse(document) })
    } catch (error: any) {
      console.error('Upload document error:', error)
      const configurationError = String(error?.message || '').includes('DOCUMENT_ENCRYPTION_KEY')
      res.status(configurationError ? 503 : 500).json({
        error: configurationError ? 'Document storage is not configured' : 'Unable to store document',
      })
    }
  },
)

router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  try {
    const document = await prisma.candidateDocument.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })

    if (!document) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    const data = decryptDocument(
      Buffer.from(document.ciphertext),
      Buffer.from(document.iv),
      Buffer.from(document.authTag),
    )

    if (sha256(data) !== document.sha256) {
      res.status(500).json({ error: 'Document integrity check failed' })
      return
    }

    res.setHeader('Content-Type', document.mimeType)
    res.setHeader('Content-Length', String(data.length))
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(document.fileName)}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(data)
  } catch (error: any) {
    console.error('Download document error:', error)
    const configurationError = String(error?.message || '').includes('DOCUMENT_ENCRYPTION_KEY')
    res.status(configurationError ? 503 : 500).json({
      error: configurationError ? 'Document storage is not configured' : 'Unable to download document',
    })
  }
})

router.patch('/active-resume', async (req: AuthRequest, res: Response) => {
  try {
    const family = req.body.resume_family === null ? null : candidateResumeFamily(req.body.resume_family)
    if (req.body.resume_family !== null && !family) {
      res.status(400).json({ error: 'A valid resume family is required' })
      return
    }

    if (family) {
      const readyMaster = await prisma.candidateDocument.findFirst({
        where: {
          userId: req.user!.userId,
          resumeFamily: family as any,
          kind: 'MASTER_RESUME',
          isMaster: true,
          textCiphertext: { not: null },
        },
        select: { id: true },
      })
      if (!readyMaster) {
        res.status(409).json({ error: 'Upload a readable master resume for this family first' })
        return
      }
    }

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { activeResumeFamily: family as any },
    })
    clearPersonalizedMatchesCache(req.user!.userId)
    res.json({ active_resume_family: family })
  } catch (error) {
    console.error('Set active resume error:', error)
    res.status(500).json({ error: 'Unable to select resume for matching' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.candidateDocument.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })

    if (!existing) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    const resumeFamily = req.body.resume_family === null
      ? null
      : normalizedEnum(req.body.resume_family, RESUME_FAMILIES)
    const isMaster = typeof req.body.is_master === 'boolean' ? req.body.is_master : existing.isMaster
    const effectiveFamily = req.body.resume_family === undefined ? existing.resumeFamily : resumeFamily

    if (isMaster && !effectiveFamily) {
      res.status(400).json({ error: 'Master resumes require a resume family' })
      return
    }

    const document = await prisma.$transaction(async tx => {
      if (isMaster && effectiveFamily) {
        await tx.candidateDocument.updateMany({
          where: {
            userId: req.user!.userId,
            resumeFamily: effectiveFamily as any,
            isMaster: true,
            id: { not: existing.id },
          },
          data: { isMaster: false },
        })
      }

      return tx.candidateDocument.update({
        where: { id: existing.id },
        data: {
          ...(req.body.name !== undefined && { name: cleanString(req.body.name, 160) || existing.name }),
          ...(req.body.resume_family !== undefined && { resumeFamily: resumeFamily as any }),
          isMaster,
          ...(req.body.library_file_id !== undefined && {
            libraryFileId: cleanString(req.body.library_file_id, 240) || null,
          }),
          ...(req.body.library_path !== undefined && {
            libraryPath: cleanString(req.body.library_path, 1000) || null,
          }),
        },
      })
    })

    clearPersonalizedMatchesCache(req.user!.userId)
    res.json({ document: documentResponse(document) })
  } catch (error) {
    console.error('Update document error:', error)
    res.status(500).json({ error: 'Unable to update document' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.candidateDocument.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
      select: { id: true, resumeFamily: true, isMaster: true },
    })
    const result = existing
      ? await prisma.$transaction(async tx => {
          const deleted = await tx.candidateDocument.deleteMany({
            where: { id: existing.id, userId: req.user!.userId },
          })
          if (existing.isMaster && existing.resumeFamily) {
            await tx.user.updateMany({
              where: { id: req.user!.userId, activeResumeFamily: existing.resumeFamily },
              data: { activeResumeFamily: null },
            })
          }
          return deleted
        })
      : { count: 0 }

    if (!result.count) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    clearPersonalizedMatchesCache(req.user!.userId)
    res.status(204).send()
  } catch (error) {
    console.error('Delete document error:', error)
    res.status(500).json({ error: 'Unable to delete document' })
  }
})

export default router
