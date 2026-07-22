import prisma from '../config/database'
import { getJobHunterJobs, type JobHunterJob, type JobHunterJobsQuery } from './jobHunterService'

const JOBS_PAGE_LIMIT = 500
const JOBS_MAX_PAGES = 12
const SEARCH_CACHE_TTL_MS = 60_000

export type SavedSearchInput = {
  name: string
  keywords: string
  location?: string | null
  category?: string | null
  workMode?: string | null
  minimumMatchScore?: number
  companies?: string[]
  sources?: string[]
  frequency?: 'hourly' | 'daily' | 'weekly'
  matchMode?: 'strict' | 'balanced' | 'broad'
  excludeSeniorRoles?: boolean
  preferJuniorRoles?: boolean
  excludeContract?: boolean
  excludeStaffingAgencies?: boolean
  enabled?: boolean
}

type CachedJobs = {
  expiresAt: number
  items: any[]
}

const jobsCache = new Map<string, CachedJobs>()

const SORTABLE_TEXT_FIELDS = new Set(['title', 'company', 'location', 'source', 'category', 'work_mode', 'priority', 'status'])

const SEARCH_ROLE_FAMILIES = [
  {
    key: 'software_engineering',
    triggers: ['software', 'software development', 'web development', 'developer', 'engineer', 'web developer'],
    aliases: [
      'software engineer',
      'software developer',
      'junior developer',
      'junior software engineer',
      'junior software developer',
      'web developer',
      'frontend developer',
      'front-end developer',
      'backend developer',
      'back-end developer',
      'full stack developer',
      'full-stack developer',
      'full stack engineer',
      'full-stack engineer',
      'application developer',
      'mobile developer',
      'software development engineer',
      'sdet',
    ],
    categoryAliases: ['software engineering'],
    adjacentSignals: ['javascript', 'typescript', 'react', 'node', 'python', 'java', 'api', 'web application'],
    unrelatedSignals: ['helpdesk', 'support technician', 'customer support', 'offboarding', 'business analyst', 'customer success'],
  },
]

const SOFTWARE_TITLE_REQUIRED_ALIASES = [
  'software engineer',
  'software developer',
  'junior developer',
  'junior software engineer',
  'junior software developer',
  'web developer',
  'frontend developer',
  'front-end developer',
  'backend developer',
  'back-end developer',
  'full stack developer',
  'full-stack developer',
  'full stack engineer',
  'full-stack engineer',
  'mobile developer',
  'application developer',
  'software development engineer',
  'sdet',
  'programmer',
]

const EARLY_CAREER_SIGNALS = ['junior', 'entry', 'entry level', 'new grad', 'intern', 'internship', 'graduate', 'associate']
const SENIORITY_BLOCKERS = ['senior', 'sr.', 'staff', 'principal', 'manager', 'director', 'lead']
const CONTRACT_SIGNALS = ['contract', 'contractor', 'temporary', 'temp ', 'temp-to-hire', 'fixed term', 'fixed-term', '6 month', '12 month', 'month contract']
const STAFFING_COMPANY_SIGNALS = ['staffing', 'recruiting', 'recruitment', 'talent', 'headhunt', 'employment services', 'search group']
const STAFFING_TEXT_SIGNALS = ['staffing agency', 'recruiting agency', 'our client', 'on behalf of our client', 'third-party recruiter']
const MATCH_MODES = ['strict', 'balanced', 'broad'] as const
type SavedSearchMatchMode = (typeof MATCH_MODES)[number]

function cleanText(value: unknown, max = 200) {
  return String(value || '').trim().slice(0, max)
}

function normalize(value: unknown) {
  return String(value || '').toLowerCase().trim()
}

function normalizeArray(values: unknown, maxItems = 20, maxLength = 80) {
  if (!Array.isArray(values)) return []
  const unique = new Set<string>()
  for (const value of values) {
    const item = cleanText(value, maxLength)
    if (item) unique.add(item)
    if (unique.size >= maxItems) break
  }
  return Array.from(unique)
}

function isAllowedFrequency(value: unknown): value is 'hourly' | 'daily' | 'weekly' {
  return value === 'hourly' || value === 'daily' || value === 'weekly'
}

function isAllowedMatchMode(value: unknown): value is SavedSearchMatchMode {
  return value === 'strict' || value === 'balanced' || value === 'broad'
}

function booleanFlag(value: unknown, defaultValue = false) {
  return value === undefined ? defaultValue : Boolean(value)
}

function textBundle(values: unknown[]) {
  return values.map(value => normalize(value)).join(' ')
}

function hasSignal(text: string, signals: string[]) {
  return signals.some(signal => containsPhrase(text, signal))
}

function jobHasEarlyCareerSignal(title: string, text: string) {
  return EARLY_CAREER_SIGNALS.some(signal => containsPhrase(title, signal) || containsPhrase(text, signal))
}

function jobHasSenioritySignal(title: string, text: string) {
  return SENIORITY_BLOCKERS.some(signal => containsPhrase(title, signal) || containsPhrase(text, signal))
}

function jobLooksContract(job: any) {
  const text = textBundle([job.title, job.description, job.category, job.employment_type, job.source])
  return hasSignal(text, CONTRACT_SIGNALS)
}

function jobLooksLikeStaffingAgency(job: any) {
  const company = normalize(job.company)
  const text = textBundle([job.title, job.description, job.company, job.source])
  return hasSignal(company, STAFFING_COMPANY_SIGNALS) || hasSignal(text, STAFFING_TEXT_SIGNALS)
}

function requestedSdet(keywordTokens: string[]) {
  return keywordTokens.some(token => token.includes('sdet') || token.includes('software development engineer in test'))
}

export function validateSavedSearchInput(input: Record<string, unknown>) {
  const name = cleanText(input.name, 120)
  const keywords = cleanText(input.keywords, 300)
  const location = cleanText(input.location, 120) || null
  const category = cleanText(input.category, 80) || null
  const workMode = cleanText(input.workMode, 40) || null
  const companies = normalizeArray(input.companies)
  const sources = normalizeArray(input.sources)
  const minimumMatchScore = Number(input.minimumMatchScore ?? 0)
  const frequency = isAllowedFrequency(input.frequency) ? input.frequency : 'daily'
  const matchMode = isAllowedMatchMode(input.matchMode) ? input.matchMode : 'balanced'
  const excludeSeniorRoles = booleanFlag(input.excludeSeniorRoles)
  const preferJuniorRoles = booleanFlag(input.preferJuniorRoles)
  const excludeContract = booleanFlag(input.excludeContract)
  const excludeStaffingAgencies = booleanFlag(input.excludeStaffingAgencies)
  const enabled = input.enabled === undefined ? true : Boolean(input.enabled)

  if (!name) throw new Error('Search name is required')
  if (!keywords) throw new Error('Keywords are required')
  if (!Number.isFinite(minimumMatchScore) || minimumMatchScore < 0 || minimumMatchScore > 100) {
    throw new Error('Minimum match score must be between 0 and 100')
  }
  if (workMode && !['Remote', 'Hybrid', 'On-site', 'Unknown'].includes(workMode)) {
    throw new Error('Invalid work mode')
  }

  return {
    name,
    keywords,
    location,
    category,
    workMode,
    companies,
    sources,
    minimumMatchScore: Math.round(minimumMatchScore),
    frequency,
    matchMode,
    excludeSeniorRoles,
    preferJuniorRoles,
    excludeContract,
    excludeStaffingAgencies,
    enabled,
  }
}

async function fetchAllJobsSnapshot() {
  const cacheKey = 'all-jobs'
  const cached = jobsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items
  }

  const firstPage = await getJobHunterJobs({ page: 1, limit: JOBS_PAGE_LIMIT, sort: 'first_seen_desc' })
  const totalPages = Math.min(
    Number(firstPage?.total_pages || Math.ceil((Number(firstPage?.total) || 0) / JOBS_PAGE_LIMIT) || 1),
    JOBS_MAX_PAGES,
  )

  const responses = [firstPage]
  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => getJobHunterJobs({
        page: index + 2,
        limit: JOBS_PAGE_LIMIT,
        sort: 'first_seen_desc',
      })),
    )
    responses.push(...remaining)
  }

  const unique = new Map<string, any>()
  for (const item of responses.flatMap(response => response?.items || [])) {
    if (item?.id && !unique.has(item.id)) unique.set(item.id, item)
  }

  const items = Array.from(unique.values())
  jobsCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, items })
  return items
}

export async function getSavedSearchById(userId: string, searchId: string) {
  return prisma.savedSearch.findFirst({
    where: { id: searchId, userId },
  })
}

function parseArrayField(value: unknown) {
  return Array.isArray(value) ? value.map(item => cleanText(item, 80)).filter(Boolean) : []
}

function searchLookbackMs(frequency: string) {
  switch (frequency) {
    case 'hourly':
      return 60 * 60 * 1000
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000
    case 'daily':
    default:
      return 24 * 60 * 60 * 1000
  }
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function splitKeywordTokens(keywords: string) {
  return normalize(keywords)
    .split(/[\n,]/)
    .map(token => token.trim())
    .filter(Boolean)
}

function familiesForKeywords(keywordTokens: string[]) {
  return SEARCH_ROLE_FAMILIES.filter(family =>
    keywordTokens.some(token => family.triggers.some(trigger => token.includes(trigger) || trigger.includes(token)))
  )
}

function expandedKeywordTokens(keywordTokens: string[]) {
  const families = familiesForKeywords(keywordTokens)
  return unique([
    ...keywordTokens,
    ...families.flatMap(family => family.aliases),
  ])
}

function includesNormalized(text: string, needle: string) {
  return text.includes(normalize(needle))
}

function escapeRegex(value: string) {
  return value.replace(/[-\/\^$*+?.()|[\]{}]/g, '\\$&')
}

function containsPhrase(text: string, phrase: string) {
  const normalizedPhrase = normalize(phrase)
  if (!normalizedPhrase) return false
  const pattern = escapeRegex(normalizedPhrase).replace(/\s+/g, '\\s+')
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(text)
}

function softwareTitleMatch(title: string) {
  return SOFTWARE_TITLE_REQUIRED_ALIASES.some(alias => includesNormalized(title, alias))
}

function normalizedMatchMode(search: any): SavedSearchMatchMode {
  return isAllowedMatchMode(search?.matchMode) ? search.matchMode : 'balanced'
}

function savedSearchRelevance(job: any, search: any) {
  const title = normalize(job.title)
  const description = normalize(job.description)
  const category = normalize(job.category)
  const text = [job.title, job.company, job.location, job.description, job.category, job.source]
    .map(value => normalize(value))
    .join(' ')

  const keywordTokens = splitKeywordTokens(search.keywords)
  const families = familiesForKeywords(keywordTokens)
  const expandedTokens = expandedKeywordTokens(keywordTokens)

  let score = 0
  let titleMatches = 0
  let textMatches = 0

  for (const token of expandedTokens) {
    if (includesNormalized(title, token)) {
      score += token.includes('junior') || token.includes('developer') || token.includes('engineer') ? 28 : 22
      titleMatches += 1
      continue
    }

    if (includesNormalized(category, token)) {
      score += 16
      continue
    }

    if (includesNormalized(text, token)) {
      score += token.length >= 12 ? 10 : 6
      textMatches += 1
    }
  }

  for (const family of families) {
    const familyTitleMatches = family.aliases.filter(alias => includesNormalized(title, alias)).length
    const familyCategoryMatch = family.categoryAliases.some(alias => includesNormalized(category, alias))
    const adjacentSignals = family.adjacentSignals.filter(alias => includesNormalized(text, alias)).length
    const unrelatedSignals = family.unrelatedSignals.filter(alias => includesNormalized(title, alias)).length

    if (familyTitleMatches > 0) score += 42 + (familyTitleMatches * 8)
    if (familyCategoryMatch) score += 26
    if (adjacentSignals >= 2) score += 14
    if (title.includes('junior') || title.includes('entry')) score += 10
    if (unrelatedSignals > 0 && familyTitleMatches === 0) score -= 36

    if (family.key === 'software_engineering') {
      const hasSoftwareTitle = softwareTitleMatch(title)
      if (hasSoftwareTitle) {
        score += 28
      } else if (familyCategoryMatch && adjacentSignals >= 3) {
        score += 6
      } else {
        score -= 55
      }
    }
  }

  return {
    score,
    titleMatches,
    textMatches,
    hasRoleFamily: families.length > 0,
  }
}

function jobMatchesSavedSearch(job: any, search: any) {
  const relevance = savedSearchRelevance(job, search)
  const keywordTokens = splitKeywordTokens(search.keywords)
  const families = familiesForKeywords(keywordTokens)
  const title = normalize(job.title)
  const category = normalize(job.category)
  const text = [job.title, job.description, job.category].map(value => normalize(value)).join(' ')
  const matchMode = normalizedMatchMode(search)
  const excludeSeniorRoles = Boolean(search.excludeSeniorRoles)
  const preferJuniorRoles = Boolean(search.preferJuniorRoles)
  const excludeContract = Boolean(search.excludeContract)
  const excludeStaffingAgencies = Boolean(search.excludeStaffingAgencies)

  if (keywordTokens.length > 0) {
    if (relevance.hasRoleFamily) {
      const minimumScore = matchMode === 'strict' ? 55 : matchMode === 'balanced' ? 38 : 22
      const minimumTextMatches = matchMode === 'strict' ? 2 : 1
      if (relevance.score < minimumScore || (relevance.titleMatches === 0 && relevance.textMatches < minimumTextMatches)) {
        return false
      }
    } else if (relevance.score <= 0) {
      return false
    }
  }

  const softwareFamilyRequested = families.some(family => family.key === 'software_engineering')
  if (softwareFamilyRequested) {
    const hasSoftwareTitle = softwareTitleMatch(title)
    const hasSoftwareCategory = includesNormalized(category, 'software engineering')
    const developerSignalCount = ['javascript', 'typescript', 'react', 'node', 'python', 'java', 'api', 'frontend', 'backend', 'full stack', 'web application']
      .filter(signal => includesNormalized(text, signal)).length
    const requestedEarlyCareer = keywordTokens.some(token => EARLY_CAREER_SIGNALS.some(signal => token.includes(signal)))
    const hasEarlyCareerSignal = jobHasEarlyCareerSignal(title, text)
    const hasBlockedSeniority = jobHasSenioritySignal(title, text)
    const explicitlyRequestedSdet = requestedSdet(keywordTokens)
    const titleIsSdetOnly = includesNormalized(title, 'sdet') || includesNormalized(title, 'software development engineer in test')

    const softwareGatePass = matchMode === 'strict'
      ? hasSoftwareTitle
      : matchMode === 'balanced'
        ? (hasSoftwareTitle || (hasSoftwareCategory && developerSignalCount >= 2) || developerSignalCount >= 4)
        : (hasSoftwareTitle || hasSoftwareCategory || developerSignalCount >= 3)

    if (!softwareGatePass) {
      return false
    }

    if (matchMode === 'strict' && titleIsSdetOnly && !explicitlyRequestedSdet) {
      return false
    }

    if (requestedEarlyCareer) {
      if (matchMode === 'strict') {
        if (!hasEarlyCareerSignal || hasBlockedSeniority) {
          return false
        }
      } else if (matchMode === 'balanced') {
        if (hasBlockedSeniority) {
          return false
        }
      }
    }

    if (['helpdesk', 'support technician', 'customer support', 'offboarding', 'analyst'].some(signal => includesNormalized(title, signal)) && !hasSoftwareTitle) {
      return false
    }
  }

  if (excludeSeniorRoles && jobHasSenioritySignal(title, text)) {
    return false
  }

  if (excludeContract && jobLooksContract(job)) {
    return false
  }

  if (excludeStaffingAgencies && jobLooksLikeStaffingAgency(job)) {
    return false
  }

  if (preferJuniorRoles && !jobHasEarlyCareerSignal(title, text) && jobHasSenioritySignal(title, text)) {
    return false
  }

  if (search.location && !normalize(job.location).includes(normalize(search.location))) {
    return false
  }

  if (search.category && normalize(job.category) !== normalize(search.category)) {
    return false
  }

  if (search.workMode && normalize(job.work_mode) !== normalize(search.workMode)) {
    return false
  }

  if (Number(job.score || 0) < Number(search.minimumMatchScore || 0)) {
    return false
  }

  const companies = parseArrayField(search.companies)
  if (companies.length > 0 && !companies.some(company => normalize(job.company).includes(normalize(company)))) {
    return false
  }

  const sources = parseArrayField(search.sources)
  if (sources.length > 0 && !sources.some(source => normalize(job.source) === normalize(source))) {
    return false
  }

  return true
}

function buildAlertPayload(search: any, job: any) {
  return {
    searchId: search.id,
    searchName: search.name,
    frequency: search.frequency,
    generatedAt: new Date().toISOString(),
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      category: job.category,
      workMode: job.work_mode,
      score: job.score,
      firstSeen: job.first_seen,
      posted: job.posted,
      link: job.link,
    },
  }
}

function parseSearchKeywords(keywords: string) {
  return normalize(keywords)
    .split(/[\n,]/)
    .map(token => token.trim())
    .filter(Boolean)
}

function textValue(value: unknown) {
  return String(value || '').trim()
}

function normalizeStatus(value: unknown) {
  return textValue(value).toUpperCase()
}

function scoreValue(job: any) {
  if (typeof job?.saved_search_match_score === 'number') {
    return Number(job.saved_search_match_score) || 0
  }
  const score = Number(job?.score || 0)
  return Number.isFinite(score) ? score : 0
}

function sortSavedSearchJobs(items: any[], sort: string) {
  const sortValue = String(sort || 'first_seen_desc')
  let resolvedField = 'first_seen'
  let direction = 'desc'

  if (sortValue === 'first_seen_desc') {
    resolvedField = 'first_seen'
    direction = 'desc'
  } else if (sortValue === 'first_seen_asc') {
    resolvedField = 'first_seen'
    direction = 'asc'
  } else if (sortValue === 'date_posted_desc') {
    resolvedField = 'date_posted'
    direction = 'desc'
  } else if (sortValue === 'date_posted_asc') {
    resolvedField = 'date_posted'
    direction = 'asc'
  } else if (sortValue === 'score_desc') {
    resolvedField = 'score'
    direction = 'desc'
  } else if (sortValue === 'score_asc') {
    resolvedField = 'score'
    direction = 'asc'
  } else if (sortValue === 'company_asc') {
    resolvedField = 'company'
    direction = 'asc'
  } else if (sortValue === 'company_desc') {
    resolvedField = 'company'
    direction = 'desc'
  }

  const multiplier = direction === 'asc' ? 1 : -1

  return [...items].sort((left, right) => {
    if (resolvedField === 'score') {
      return (scoreValue(left) - scoreValue(right)) * multiplier
    }

    if (resolvedField === 'first_seen' || resolvedField === 'date_posted') {
      const leftDate = Date.parse(String(left?.[resolvedField] || '')) || 0
      const rightDate = Date.parse(String(right?.[resolvedField] || '')) || 0
      return (leftDate - rightDate) * multiplier
    }

    if (SORTABLE_TEXT_FIELDS.has(resolvedField)) {
      const leftValue = normalize(left?.[resolvedField])
      const rightValue = normalize(right?.[resolvedField])
      return leftValue.localeCompare(rightValue) * multiplier
    }

    return 0
  })
}

function lastUpdatedForJobs(items: any[]) {
  for (const item of items) {
    if (item?.updated_at) return item.updated_at
    if (item?.first_seen) return item.first_seen
    if (item?.posted) return item.posted
  }
  return null
}

function applyAdditionalSavedSearchFilters(items: any[], query: JobHunterJobsQuery) {
  const searchText = normalize(query.q)
  const source = normalize(query.source)
  const category = normalize(query.category)
  const workMode = normalize(query.work_mode)
  const priority = normalize(query.priority)
  const status = normalizeStatus(query.status)

  return items.filter(item => {
    if (source && normalize(item.source) !== source) return false
    if (category && normalize(item.category) !== category) return false
    if (workMode && normalize(item.work_mode) !== workMode) return false
    if (priority && normalize(item.priority) !== priority) return false
    if (status && normalizeStatus(item.workflow?.status) !== status) return false

    if (searchText) {
      const haystack = [item.title, item.company, item.location, item.source, item.description]
        .map(value => normalize(value))
        .join(' ')
      if (!haystack.includes(searchText)) return false
    }

    return true
  })
}

export async function getSavedSearchMatches(userId: string, searchId: string, query: JobHunterJobsQuery & { workflowById?: Map<string, any> }) {
  const search = await getSavedSearchById(userId, searchId)
  if (!search) {
    throw new Error('Saved search not found')
  }

  const jobs = await fetchAllJobsSnapshot()
  const matchingJobs = jobs.filter(job => jobMatchesSavedSearch(job, search))
  const workflowById = query.workflowById || new Map<string, any>()
  const enriched = matchingJobs.map(job => ({
    ...job,
    saved_search_match_score: savedSearchRelevance(job, search).score,
    workflow: workflowById.get(String(job.id)) || null,
  }))

  const filtered = applyAdditionalSavedSearchFilters(enriched, query)
  const sorted = sortSavedSearchJobs(filtered, String(query.sort || 'first_seen_desc'))

  const requestedLimit = Math.min(Math.max(Number(query.limit || 25), 1), 100)
  const requestedPage = Math.max(Number(query.page || 1), 1)
  const offset = Math.max(Number(query.offset || 0), 0)
  const effectiveOffset = query.page !== undefined
    ? (requestedPage - 1) * requestedLimit
    : offset
  const pagedItems = sorted.slice(effectiveOffset, effectiveOffset + requestedLimit)
  const total = sorted.length
  const totalPages = total > 0 ? Math.ceil(total / requestedLimit) : 0

  return {
    saved_search: {
      id: search.id,
      name: search.name,
      keywords: search.keywords,
      location: search.location,
      category: search.category,
      workMode: search.workMode,
      minimumMatchScore: search.minimumMatchScore,
      companies: parseArrayField(search.companies),
      sources: parseArrayField(search.sources),
      frequency: search.frequency,
      matchMode: normalizedMatchMode(search),
      excludeSeniorRoles: Boolean(search.excludeSeniorRoles),
      preferJuniorRoles: Boolean(search.preferJuniorRoles),
      excludeContract: Boolean(search.excludeContract),
      excludeStaffingAgencies: Boolean(search.excludeStaffingAgencies),
      enabled: search.enabled,
      lastEvaluatedAt: search.lastEvaluatedAt,
    },
    items: pagedItems,
    total,
    limit: requestedLimit,
    offset: effectiveOffset,
    page: requestedPage,
    total_pages: totalPages,
    has_prev: requestedPage > 1,
    has_next: requestedPage < totalPages,
    last_updated: lastUpdatedForJobs(sorted),
  }
}

function parseJobTimestamp(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function evaluateSavedSearchesForUser(userId: string) {
  const [searches, jobs] = await Promise.all([
    prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    }),
    fetchAllJobsSnapshot(),
  ])

  const results = []

  for (const search of searches) {
    const matches = jobs.filter(job => jobMatchesSavedSearch(job, search))
    const lookbackThreshold = Date.now() - searchLookbackMs(search.frequency)
    const previousEvaluatedAt = search.lastEvaluatedAt ? new Date(search.lastEvaluatedAt) : null
    const matchingToday = matches.filter(job => {
      const firstSeen = job.first_seen ? new Date(job.first_seen) : null
      return firstSeen && !Number.isNaN(firstSeen.getTime()) && firstSeen.getTime() >= lookbackThreshold
    })

    const newMatchesSinceLastRun = matches.filter(job => {
      if (!previousEvaluatedAt) return true
      const firstSeen = parseJobTimestamp(job.first_seen)
      return Boolean(firstSeen && firstSeen.getTime() > previousEvaluatedAt.getTime())
    })

    const newMatches = search.enabled
      ? newMatchesSinceLastRun.filter(job => true)
      : []

    if (search.enabled && newMatches.length > 0) {
      await prisma.savedSearchAlert.createMany({
        data: newMatches.map(job => ({
          savedSearchId: search.id,
          externalJobId: String(job.id),
          payload: buildAlertPayload(search, job),
        })),
        skipDuplicates: true,
      })
    }

    const evaluatedAt = new Date()
    await prisma.savedSearch.update({
      where: { id: search.id },
      data: { lastEvaluatedAt: evaluatedAt },
    })

    const pendingAlerts = await prisma.savedSearchAlert.count({
      where: {
        savedSearchId: search.id,
        notifiedAt: null,
      },
    })

    results.push({
      ...search,
      companies: parseArrayField(search.companies),
      sources: parseArrayField(search.sources),
      matchingJobsCount: matches.length,
      matchingJobsToday: matchingToday.length,
      newMatchingJobsSinceLastRun: newMatchesSinceLastRun.length,
      pendingAlerts,
      lastEvaluatedAt: evaluatedAt.toISOString(),
      latestMatches: matchingToday.slice(0, 5).map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        source: job.source,
        link: job.link,
        first_seen: job.first_seen,
        score: job.score,
        saved_search_match_score: savedSearchRelevance(job, search).score,
      })),
    })
  }

  const enabledSearches = results.filter(search => search.enabled)
  return {
    searches: results,
    summary: {
      total: results.length,
      enabled: enabledSearches.length,
      disabled: results.length - enabledSearches.length,
      jobsMatchingToday: results.reduce((sum, search) => sum + search.matchingJobsToday, 0),
      newMatchingJobsSinceLastRun: results.reduce((sum, search) => sum + search.newMatchingJobsSinceLastRun, 0),
      pendingAlerts: results.reduce((sum, search) => sum + search.pendingAlerts, 0),
      alertStatus: enabledSearches.length > 0 ? 'active' : 'paused',
    },
  }
}

export const __savedSearchTestUtils = {
  savedSearchRelevance,
  jobMatchesSavedSearch,
}
