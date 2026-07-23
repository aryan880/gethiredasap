import prisma from '../config/database'
import { decryptDocument, sha256 } from './documentCrypto'

const RESUME_FAMILIES = new Set(['SOFTWARE', 'IT_SUPPORT', 'SYSTEMS_ANALYST', 'GENERAL', 'CUSTOM'])

function normalizeFamily(value: unknown) {
  const family = String(value || '').trim().toUpperCase()
  return RESUME_FAMILIES.has(family) ? family : null
}

function profileSearches(user: any) {
  const savedSearchRoles = (user.savedSearches || []).flatMap((search: any) =>
    String(search.keywords || '')
      .split(/[\n,]/)
      .map((role: string) => role.trim())
      .filter(Boolean)
      .map((role: string) => ({ role, location: String(search.location || '') }))
  )
  return [...(user.searches || []), ...savedSearchRoles]
}

function extractedText(document: any) {
  if (!document?.textCiphertext || !document?.textIv || !document?.textAuthTag || !document?.textSha256) {
    return null
  }

  const data = decryptDocument(
    Buffer.from(document.textCiphertext),
    Buffer.from(document.textIv),
    Buffer.from(document.textAuthTag),
  )
  if (sha256(data) !== document.textSha256) {
    throw new Error('Resume text integrity check failed')
  }
  return data.toString('utf8')
}

export async function getCandidateMatchingProfile(userId: string, requestedFamily?: unknown) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      resumeText: true,
      activeResumeFamily: true,
      searches: {
        where: { isActive: true },
        select: { role: true, location: true },
      },
      savedSearches: {
        where: { enabled: true },
        select: { keywords: true, location: true },
      },
      documents: {
        where: { kind: 'MASTER_RESUME', isMaster: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  if (!user) return null

  const requested = normalizeFamily(requestedFamily)
  const selectedFamily = requested || user.activeResumeFamily || null
  const selectedDocument = selectedFamily
    ? user.documents.find(document => document.resumeFamily === selectedFamily)
    : null
  const selectedText = selectedDocument ? extractedText(selectedDocument) : null
  const fallbackText = user.resumeText?.trim() || null

  return {
    profile: {
      resumeText: selectedText || fallbackText,
      searches: profileSearches(user),
    },
    selection: {
      requested_family: requested,
      active_family: selectedFamily,
      document_id: selectedText ? selectedDocument?.id || null : null,
      document_name: selectedText ? selectedDocument?.name || null : null,
      source: selectedText ? 'encrypted_resume_family' : fallbackText ? 'legacy_resume_text' : 'none',
      available_families: user.documents
        .filter(document => Boolean(document.textCiphertext))
        .map(document => document.resumeFamily)
        .filter(Boolean),
    },
  }
}

export function candidateResumeFamily(value: unknown) {
  return normalizeFamily(value)
}
