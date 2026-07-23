import axios from 'axios'
import { createHash } from 'crypto'

const JOB_HUNTER_URL = process.env.JOB_HUNTER_URL || 'http://localhost:8010'
const NLP_URL = process.env.NLP_URL || 'http://localhost:8002'
const MAX_MATCH_JOBS = 100
const PERSONALIZED_CANDIDATE_POOL_SIZE = 300
const PERSONALIZED_RECENT_CANDIDATES = 175
const PERSONALIZED_POSTED_CANDIDATES = 175
const JOB_HUNTER_API_KEY = process.env.JOB_HUNTER_API_KEY || ''
const NLP_API_KEY = process.env.NLP_API_KEY || ''
const PERSONALIZED_MATCH_CACHE_TTL_MS = 5 * 60 * 1000

export type JobHunterJobsQuery = {
  page?: string | number
  limit?: string | number
  offset?: string | number
  source?: string
  category?: string
  priority?: string
  status?: string
  work_mode?: string
  q?: string
  sort?: string
}

export type JobHunterJob = {
  id: string
  source?: string
  title?: string
  company?: string
  location?: string
  posted?: string
  link?: string
  description?: string
  salary?: string | null
  category?: string
  priority?: string
  score?: number
  fitReason?: string
  status?: string
}

export type UserProfileForMatching = {
  resumeText?: string | null
  searches?: Array<{
    role: string
    location: string
  }>
}

type RuleMatch = ReturnType<typeof scoreJobForUser>

type KeywordSignal = {
  keyword: string
  weight: number
  reason: string
}

type PersonalizedMatchCacheEntry = {
  expiresAt: number
  value: any
}

type ConceptDefinition = {
  key: string
  label: string
  aliases: string[]
  improvementHint: string
}

type ConceptAnalysis = {
  concept: string
  label: string
  confidence: 'High Confidence' | 'Medium Confidence' | 'Low Confidence'
  present: boolean
  matched_aliases: string[]
  job_evidence: string[]
  resume_evidence: string[]
  summary: string
}

type ResumeRecommendation = {
  concept: string
  label: string
  confidence: 'High Confidence' | 'Medium Confidence' | 'Low Confidence'
  recommendation: string
  rationale: string
}

type RoleIntentFamily = {
  key: string
  triggers: string[]
  aliases: string[]
  categoryAliases?: string[]
  adjacentSignals?: string[]
  mismatchSignals?: string[]
}

const personalizedMatchCache = new Map<string, PersonalizedMatchCacheEntry>()

const ROLE_FAMILY_SEARCH_PROBES: Record<string, string[]> = {
  software_engineering: ['developer', 'software', 'engineer'],
  business_analysis: ['business analyst', 'operations analyst', 'project coordinator'],
  it_support: ['technical support', 'application support', 'service desk'],
  systems_analysis: ['systems analyst', 'application analyst'],
  customer_success: ['customer success', 'implementation'],
  sales_development: ['sales representative', 'sales development', 'business development'],
}

const ROLE_INTENT_FAMILIES: RoleIntentFamily[] = [
  {
    key: 'software_engineering',
    triggers: ['software', 'software engineer', 'software developer', 'web developer', 'web development', 'developer', 'frontend', 'backend', 'full stack', 'full-stack'],
    aliases: [
      'software engineer',
      'software developer',
      'junior software engineer',
      'junior software developer',
      'junior developer',
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
      'software development engineer',
      'mobile developer',
      'sdet',
    ],
    categoryAliases: ['software engineering'],
    adjacentSignals: ['javascript', 'typescript', 'react', 'node', 'python', 'java', 'api', 'web application', 'full stack', 'frontend', 'backend'],
    mismatchSignals: ['helpdesk', 'customer support', 'business analyst', 'operations analyst', 'customer success'],
  },
  {
    key: 'business_analysis',
    triggers: ['business analyst', 'business analysis', 'operations analyst', 'project coordinator'],
    aliases: ['business analyst', 'business analysis', 'operations analyst', 'business operations', 'project coordinator', 'implementation consultant'],
    categoryAliases: ['business analysis', 'operations'],
    adjacentSignals: ['requirements gathering', 'stakeholder management', 'process mapping', 'reporting'],
  },
  {
    key: 'it_support',
    triggers: ['it support', 'technical support', 'service desk', 'help desk', 'helpdesk', 'application support'],
    aliases: ['it support', 'technical support', 'service desk analyst', 'help desk analyst', 'helpdesk analyst', 'application support analyst', 'desktop support', 'support technician'],
    categoryAliases: ['it support'],
    adjacentSignals: ['troubleshooting', 'ticketing', 'active directory', 'windows', 'networking', 'customer support'],
    mismatchSignals: ['software engineer', 'software developer', 'account executive'],
  },
  {
    key: 'systems_analysis',
    triggers: ['systems analyst', 'business systems analyst', 'application analyst'],
    aliases: ['systems analyst', 'business systems analyst', 'application analyst', 'information systems analyst', 'technical analyst'],
    categoryAliases: ['business analysis', 'it support', 'data analytics'],
    adjacentSignals: ['requirements gathering', 'process mapping', 'sql', 'reporting', 'systems integration'],
  },
  {
    key: 'customer_success',
    triggers: ['customer success', 'client success', 'account management', 'implementation'],
    aliases: ['customer success', 'customer success specialist', 'customer success manager', 'client success', 'implementation specialist', 'implementation consultant', 'onboarding specialist'],
    categoryAliases: ['customer success'],
    adjacentSignals: ['onboarding', 'retention', 'adoption', 'crm', 'renewals'],
  },
  {
    key: 'sales_development',
    triggers: ['sales representative', 'sales development', 'business development', 'bdr', 'sdr'],
    aliases: ['sales representative', 'sales development representative', 'business development representative', 'bdr', 'sdr', 'inside sales representative'],
    categoryAliases: ['sales / bdr'],
    adjacentSignals: ['crm', 'pipeline', 'prospecting', 'lead generation', 'salesforce'],
  },
]

const ROLE_SIGNALS: KeywordSignal[] = [
  { keyword: 'software engineer', weight: 16, reason: 'software engineering role match' },
  { keyword: 'software developer', weight: 16, reason: 'software development role match' },
  { keyword: 'web developer', weight: 14, reason: 'web development role match' },
  { keyword: 'frontend developer', weight: 14, reason: 'frontend development role match' },
  { keyword: 'backend developer', weight: 14, reason: 'backend development role match' },
  { keyword: 'full stack developer', weight: 14, reason: 'full-stack development role match' },
  { keyword: 'application developer', weight: 13, reason: 'application development role match' },
  { keyword: 'business analyst', weight: 16, reason: 'business analysis role match' },
  { keyword: 'business operations', weight: 14, reason: 'business operations role match' },
  { keyword: 'operations analyst', weight: 14, reason: 'operations role match' },
  { keyword: 'project coordinator', weight: 14, reason: 'project coordination role match' },
  { keyword: 'customer success', weight: 14, reason: 'customer success role match' },
  { keyword: 'implementation consultant', weight: 13, reason: 'implementation role match' },
  { keyword: 'solutions engineer', weight: 12, reason: 'solutions role match' },
  { keyword: 'technical support', weight: 12, reason: 'technical support role match' },
  { keyword: 'it support', weight: 12, reason: 'IT support role match' },
  { keyword: 'sales development', weight: 11, reason: 'sales development role match' },
  { keyword: 'business development', weight: 11, reason: 'business development role match' },
  { keyword: 'bdr', weight: 11, reason: 'BDR role match' },
  { keyword: 'sdr', weight: 11, reason: 'SDR role match' },
  { keyword: 'ai automation', weight: 12, reason: 'AI automation role match' },
  { keyword: 'junior developer', weight: 9, reason: 'junior technical role match' },
]

const SKILL_SIGNALS: KeywordSignal[] = [
  { keyword: 'stakeholder management', weight: 8, reason: 'stakeholder management' },
  { keyword: 'requirements gathering', weight: 8, reason: 'requirements gathering' },
  { keyword: 'process mapping', weight: 8, reason: 'process mapping' },
  { keyword: 'reporting', weight: 7, reason: 'reporting' },
  { keyword: 'dashboard', weight: 6, reason: 'dashboard/reporting work' },
  { keyword: 'excel', weight: 5, reason: 'spreadsheet analysis' },
  { keyword: 'sql', weight: 5, reason: 'data querying' },
  { keyword: 'jira', weight: 5, reason: 'delivery tooling' },
  { keyword: 'agile', weight: 5, reason: 'agile delivery' },
  { keyword: 'crm', weight: 5, reason: 'CRM exposure' },
  { keyword: 'salesforce', weight: 5, reason: 'Salesforce exposure' },
  { keyword: 'hubspot', weight: 5, reason: 'HubSpot exposure' },
  { keyword: 'onboarding', weight: 5, reason: 'customer onboarding' },
  { keyword: 'customer operations', weight: 6, reason: 'customer operations' },
  { keyword: 'telecommunications', weight: 6, reason: 'telecommunications experience' },
  { keyword: 'telus', weight: 8, reason: 'TELUS-related experience' },
]

const LOCATION_SIGNALS: KeywordSignal[] = [
  { keyword: 'vancouver', weight: 10, reason: 'Vancouver location match' },
  { keyword: 'surrey', weight: 10, reason: 'Surrey location match' },
  { keyword: 'burnaby', weight: 10, reason: 'Burnaby location match' },
  { keyword: 'richmond', weight: 8, reason: 'Metro Vancouver location match' },
  { keyword: 'british columbia', weight: 8, reason: 'BC location match' },
  { keyword: 'bc', weight: 6, reason: 'BC location match' },
  { keyword: 'canada', weight: 8, reason: 'Canada location match' },
  { keyword: 'remote', weight: 8, reason: 'remote-friendly role' },
]

const PENALTY_SIGNALS: KeywordSignal[] = [
  { keyword: 'senior', weight: -16, reason: 'senior role penalty' },
  { keyword: 'sr.', weight: -16, reason: 'senior role penalty' },
  { keyword: 'staff', weight: -16, reason: 'staff-level role penalty' },
  { keyword: 'principal', weight: -18, reason: 'principal-level role penalty' },
  { keyword: 'director', weight: -18, reason: 'director role penalty' },
  { keyword: 'manager', weight: -12, reason: 'manager role penalty' },
  { keyword: 'phd', weight: -18, reason: 'PhD/research role penalty' },
  { keyword: 'research scientist', weight: -18, reason: 'research scientist penalty' },
  { keyword: 'clinical', weight: -12, reason: 'clinical role penalty' },
  { keyword: 'lab', weight: -10, reason: 'lab role penalty' },
  { keyword: 'trades', weight: -10, reason: 'trades role penalty' },
]

const EXPERIENCE_SIGNALS = [
  'intern',
  'internship',
  'new grad',
  'entry level',
  'junior',
  'associate',
  'intermediate',
  'senior',
  'manager',
  'director',
]

const EDUCATION_SIGNALS = [
  'bachelor',
  'degree',
  'diploma',
  'university',
  'college',
  'business administration',
  'computer science',
  'information systems',
  'commerce',
]

const CONCEPT_GROUPS: ConceptDefinition[] = [
  {
    key: 'business_analysis',
    label: 'Business Analysis',
    aliases: [
      'business analyst',
      'business analytics',
      'business analysis',
      'analyst',
      'requirements gathering',
      'requirements elicitation',
      'stakeholder management',
      'process mapping',
      'reporting',
    ],
    improvementHint: 'Emphasize requirements gathering, stakeholder communication, and process improvement outcomes.',
  },
  {
    key: 'customer_success',
    label: 'Customer Success',
    aliases: [
      'customer success',
      'account management',
      'customer retention',
      'customer support',
      'client success',
      'renewals',
      'adoption',
      'onboarding',
    ],
    improvementHint: 'Highlight onboarding, retention, renewals, or adoption outcomes tied to customer relationships.',
  },
  {
    key: 'crm',
    label: 'CRM',
    aliases: [
      'salesforce',
      'hubspot',
      'zoho',
      'crm',
      'customer relationship management',
      'pipeline',
    ],
    improvementHint: 'Name the CRM tools and reporting workflows you used, especially pipeline or account-tracking work.',
  },
  {
    key: 'telecommunications',
    label: 'Telecommunications',
    aliases: [
      'telus',
      'telecom',
      'telecommunications',
      'wireless',
      'mobility',
      'internet',
      'fibre',
    ],
    improvementHint: 'Surface telecom products, customer usage analysis, or service troubleshooting outcomes more clearly.',
  },
  {
    key: 'location_bc',
    label: 'British Columbia',
    aliases: [
      'british columbia',
      'bc',
      'vancouver',
      'burnaby',
      'surrey',
      'richmond',
      'victoria',
    ],
    improvementHint: 'If accurate, make your BC location explicit in your header or recent experience so local hiring teams see the fit immediately.',
  },
  {
    key: 'sales_bdr',
    label: 'Sales / BDR',
    aliases: [
      'sales',
      'sales development',
      'business development',
      'bdr',
      'sdr',
      'prospecting',
      'lead generation',
      'outbound',
    ],
    improvementHint: 'Show pipeline generation, prospecting, or quota-facing achievements with concrete numbers where accurate.',
  },
  {
    key: 'it_support',
    label: 'IT Support',
    aliases: [
      'it support',
      'technical support',
      'help desk',
      'troubleshooting',
      'ticketing',
      'desktop support',
    ],
    improvementHint: 'Call out troubleshooting, issue resolution speed, ticket volume, or user-support tooling where accurate.',
  },
  {
    key: 'project_coordination',
    label: 'Project Coordination',
    aliases: [
      'project coordinator',
      'project coordination',
      'project management',
      'cross-functional',
      'agile',
      'jira',
      'timeline',
    ],
    improvementHint: 'Highlight cross-functional delivery, timelines, Jira workflows, and coordination outcomes.',
  },
]

function endpoint(path: string) {
  return `${JOB_HUNTER_URL}${path}`
}

function nlpEndpoint(path: string) {
  return `${NLP_URL}${path}`
}

function requiredServiceKey(name: 'JOB_HUNTER_API_KEY' | 'NLP_API_KEY', value: string) {
  if (!value || value.length < 24) {
    throw new Error(`${name} must be set to a strong shared secret`)
  }

  return value
}

function jobHunterHeaders() {
  return {
    'x-internal-api-key': requiredServiceKey('JOB_HUNTER_API_KEY', JOB_HUNTER_API_KEY),
  }
}

function nlpHeaders() {
  return {
    'x-internal-api-key': requiredServiceKey('NLP_API_KEY', NLP_API_KEY),
  }
}

export async function getJobHunterHealth() {
  const response = await axios.get(endpoint('/health'), {
    headers: jobHunterHeaders(),
  })
  return response.data
}

export async function getJobHunterSummary() {
  const response = await axios.get(endpoint('/summary'), {
    headers: jobHunterHeaders(),
  })
  return response.data
}

export async function runJobHunterRefresh() {
  const response = await axios.post(endpoint('/run-working'), {}, {
    headers: jobHunterHeaders(),
    timeout: 1000 * 60 * 20,
  })
  return response.data
}

export async function getJobHunterJobs(query: JobHunterJobsQuery) {
  const response = await axios.get(endpoint('/jobs'), {
    params: query,
    headers: jobHunterHeaders(),
  })
  return response.data
}

export async function getJobHunterJob(id: string) {
  const response = await axios.get(endpoint(`/jobs/${encodeURIComponent(id)}`), {
    headers: jobHunterHeaders(),
  })
  return response.data
}

function dedupeJobsById(jobs: JobHunterJob[]) {
  const uniqueJobs = new Map<string, JobHunterJob>()

  for (const job of jobs) {
    if (!job?.id) continue
    if (!uniqueJobs.has(job.id)) {
      uniqueJobs.set(job.id, job)
    }
  }

  return Array.from(uniqueJobs.values())
}

async function getPersonalizedCandidateJobs(query: JobHunterJobsQuery, profile: UserProfileForMatching) {
  const sharedQuery = {
    source: query.source,
    category: query.category,
    priority: query.priority,
    status: query.status,
    work_mode: query.work_mode,
    q: query.q,
    page: 1,
    offset: 0,
  }

  const roleIntent = roleIntentAliases(profile)
  const roleQueries = unique([
    ...roleIntent.families.flatMap(family => ROLE_FAMILY_SEARCH_PROBES[family.key] || []),
    ...roleIntent.terms,
  ]).slice(0, 6)

  const responses = await Promise.all([
    getJobHunterJobs({
      ...sharedQuery,
      limit: PERSONALIZED_RECENT_CANDIDATES,
      sort: 'first_seen_desc',
    }),
    getJobHunterJobs({
      ...sharedQuery,
      limit: PERSONALIZED_POSTED_CANDIDATES,
      sort: 'date_posted_desc',
    }),
    ...roleQueries.map(role => getJobHunterJobs({
      ...sharedQuery,
      q: role,
      limit: 80,
      sort: 'first_seen_desc',
    })),
  ])

  const [recentResponse, postedResponse, ...roleResponses] = responses

  const merged = dedupeJobsById([
    ...roleResponses.flatMap(response => (response.items || []) as JobHunterJob[]),
    ...((recentResponse.items || []) as JobHunterJob[]),
    ...((postedResponse.items || []) as JobHunterJob[]),
  ])

  return {
    jobs: merged.slice(0, PERSONALIZED_CANDIDATE_POOL_SIZE),
    lastUpdated:
      recentResponse.last_updated ||
      postedResponse.last_updated ||
      roleResponses.find(response => response.last_updated)?.last_updated ||
      null,
  }
}

function normalize(value?: string | null) {
  return String(value || '').toLowerCase()
}

function includesKeyword(text: string, keyword: string) {
  const normalizedKeyword = normalize(keyword)
  if (!normalizedKeyword) return false
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(normalize(text))
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function rawJobText(job: JobHunterJob) {
  return [
    job.title,
    job.company,
    job.location,
    job.description,
    job.category,
    job.source,
  ].filter(Boolean).join(' ')
}

function splitEvidenceSegments(text: string) {
  return text
    .split(/\n+|[•·]|(?<=[.!?])\s+/)
    .map(segment => segment.replace(/\s+/g, ' ').trim())
    .filter(segment => segment.length >= 8)
}

function matchedAliasesInText(text: string, aliases: string[]) {
  const normalizedText = normalize(text)
  return unique(aliases.filter(alias => includesKeyword(normalizedText, alias)))
}

function evidenceSnippets(text: string, aliases: string[], limit = 2) {
  const snippets: string[] = []
  for (const segment of splitEvidenceSegments(text)) {
    if (aliases.some(alias => includesKeyword(normalize(segment), alias))) {
      snippets.push(segment)
    }
    if (snippets.length >= limit) break
  }
  return unique(snippets).slice(0, limit)
}

function conceptConfidence(present: boolean, jobAliases: string[], resumeAliases: string[], semanticScore: number): 'High Confidence' | 'Medium Confidence' | 'Low Confidence' {
  if (present) {
    if (resumeAliases.length >= 2 || (resumeAliases.length >= 1 && (jobAliases.length >= 2 || semanticScore >= 72))) {
      return 'High Confidence'
    }
    return semanticScore >= 55 ? 'Medium Confidence' : 'Low Confidence'
  }

  if (jobAliases.length >= 2 || semanticScore >= 75) return 'High Confidence'
  if (jobAliases.length >= 1 || semanticScore >= 55) return 'Medium Confidence'
  return 'Low Confidence'
}

function confidenceWeight(confidence: 'High Confidence' | 'Medium Confidence' | 'Low Confidence') {
  if (confidence === 'High Confidence') return 9
  if (confidence === 'Medium Confidence') return 6
  return 3
}

function conceptSummary(label: string, present: boolean, resumeAliases: string[], jobAliases: string[]) {
  if (present) {
    return `Resume already signals ${label.toLowerCase()} through ${resumeAliases.slice(0, 3).join(', ')}.`
  }
  return `Job emphasizes ${label.toLowerCase()} through ${jobAliases.slice(0, 3).join(', ')}, but the resume does not surface that concept clearly yet.`
}

function evaluateConcept(concept: ConceptDefinition, jobTextValue: string, resumeText: string, semanticScore: number): ConceptAnalysis | null {
  const jobAliases = matchedAliasesInText(jobTextValue, concept.aliases)
  if (jobAliases.length === 0) return null

  const resumeAliases = matchedAliasesInText(resumeText, concept.aliases)
  const present = resumeAliases.length > 0
  const confidence = conceptConfidence(present, jobAliases, resumeAliases, semanticScore)

  return {
    concept: concept.key,
    label: concept.label,
    confidence,
    present,
    matched_aliases: present ? resumeAliases : jobAliases,
    job_evidence: evidenceSnippets(jobTextValue, concept.aliases),
    resume_evidence: evidenceSnippets(resumeText, concept.aliases),
    summary: conceptSummary(concept.label, present, resumeAliases, jobAliases),
  }
}

function strengthNarrative(concept: ConceptAnalysis) {
  return `${concept.label} is already supported by your resume evidence.`
}

function weaknessNarrative(concept: ConceptAnalysis) {
  return `${concept.label} is relevant for this job, but the resume does not make it explicit enough yet.`
}

function buildRecommendation(concept: ConceptDefinition, analysis: ConceptAnalysis, resumeText: string, presentConcepts: ConceptAnalysis[]): ResumeRecommendation {
  const hasTelecomEvidence = presentConcepts.some(item => item.concept === 'telecommunications') || includesKeyword(resumeText, 'telus')
  const hasCrmEvidence = presentConcepts.some(item => item.concept === 'crm')
  let recommendation = concept.improvementHint

  if (concept.key === 'business_analysis' && (hasTelecomEvidence || hasCrmEvidence)) {
    recommendation = 'Your TELUS experience demonstrates customer relationship management. Consider emphasizing requirements gathering and stakeholder communication to strengthen Business Analyst positioning.'
  } else if (concept.key === 'customer_success' && hasCrmEvidence) {
    recommendation = 'You already show CRM-adjacent work. Reframe that experience around onboarding, retention, adoption, or renewal outcomes to strengthen Customer Success positioning.'
  } else if (concept.key === 'crm' && hasTelecomEvidence) {
    recommendation = 'Your telecom experience likely involved customer relationship management. Name the CRM, pipeline, account-tracking, or reporting workflows you used where accurate.'
  }

  return {
    concept: concept.key,
    label: concept.label,
    confidence: analysis.confidence,
    recommendation,
    rationale: analysis.summary,
  }
}

function blendedAnalysisScore(conceptCoverageScore: number, semanticScore: number) {
  if (!semanticScore) return conceptCoverageScore
  return Math.round((0.55 * semanticScore) + (0.45 * conceptCoverageScore))
}

function potentialScoreAfterImprovements(currentScore: number, recommendations: ResumeRecommendation[]) {
  const lift = recommendations
    .slice(0, 4)
    .reduce((total, recommendation) => total + confidenceWeight(recommendation.confidence), 0)
  return Math.max(currentScore, Math.min(100, currentScore + lift))
}

function nowMs() {
  return Date.now()
}

function formatDuration(startedAt: number) {
  return `${nowMs() - startedAt}ms`
}

function logTiming(label: string, startedAt: number, details?: Record<string, unknown>) {
  const suffix = details ? ` ${JSON.stringify(details)}` : ''
  console.info(`[timing] ${label} ${formatDuration(startedAt)}${suffix}`)
}

function normalizedQuery(query: JobHunterJobsQuery) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function hashResumeText(resumeText: string) {
  return createHash('sha256').update(resumeText).digest('hex')
}

function personalizedMatchCacheKey(userId: string, profile: UserProfileForMatching, query: JobHunterJobsQuery) {
  return JSON.stringify({
    userId,
    resumeHash: hashResumeText(profile.resumeText || ''),
    searches: (profile.searches || [])
      .map(search => ({ role: normalize(search.role), location: normalize(search.location) }))
      .sort((left, right) => `${left.role}|${left.location}`.localeCompare(`${right.role}|${right.location}`)),
    query: normalizedQuery(query),
  })
}

function getCachedPersonalizedMatches(cacheKey: string) {
  const entry = personalizedMatchCache.get(cacheKey)
  if (!entry) return null
  if (entry.expiresAt <= nowMs()) {
    personalizedMatchCache.delete(cacheKey)
    return null
  }
  return entry.value
}

function setCachedPersonalizedMatches(cacheKey: string, value: any) {
  personalizedMatchCache.set(cacheKey, {
    value,
    expiresAt: nowMs() + PERSONALIZED_MATCH_CACHE_TTL_MS,
  })
}

export function clearPersonalizedMatchesCache(userId?: string) {
  if (!userId) {
    personalizedMatchCache.clear()
    return
  }

  for (const cacheKey of personalizedMatchCache.keys()) {
    if (cacheKey.includes(`"userId":"${userId}"`)) {
      personalizedMatchCache.delete(cacheKey)
    }
  }
}

function jobText(job: JobHunterJob) {
  return normalize([
    job.title,
    job.company,
    job.location,
    job.description,
    job.category,
    job.source,
  ].filter(Boolean).join(' '))
}

function profileKeywords(profile: UserProfileForMatching) {
  const resume = normalize(profile.resumeText)
  const explicitSearchTerms = (profile.searches || []).flatMap(search => [
    search.role,
    search.location,
  ])

  const detected = [...ROLE_SIGNALS, ...SKILL_SIGNALS, ...LOCATION_SIGNALS]
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(resume, keyword))

  return unique([...detected, ...explicitSearchTerms.map(normalize).filter(Boolean)])
}

function roleFamiliesForTerms(terms: string[]) {
  return ROLE_INTENT_FAMILIES.filter(family =>
    terms.some(term => family.triggers.some(trigger => includesKeyword(term, trigger) || includesKeyword(trigger, term)))
  )
}

function roleIntentAliases(profile: UserProfileForMatching) {
  const explicitRoles = (profile.searches || [])
    .map(search => normalize(search.role))
    .filter(Boolean)

  const resume = normalize(profile.resumeText)
  const resumeSignals = ROLE_SIGNALS
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(resume, keyword))

  const terms = unique([...explicitRoles, ...resumeSignals])
  const families = roleFamiliesForTerms(terms)

  return {
    terms,
    aliases: unique([
      ...terms,
      ...families.flatMap(family => family.aliases),
    ]),
    families,
  }
}

function roleIntentScore(job: JobHunterJob, profile: UserProfileForMatching) {
  const title = normalize(job.title)
  const description = normalize(job.description)
  const category = normalize(job.category)
  const text = jobText(job)
  const intent = roleIntentAliases(profile)
  const reasons: string[] = []
  let score = 0

  if (intent.aliases.length === 0) {
    return { score, reasons }
  }

  for (const alias of intent.aliases) {
    if (includesKeyword(title, alias)) {
      score += alias.includes('junior') || alias.includes('developer') || alias.includes('engineer') ? 14 : 10
      reasons.push(`title matches target role: ${alias}`)
      continue
    }

    if (includesKeyword(category, alias)) {
      score += 8
      reasons.push(`category aligns with target role: ${alias}`)
      continue
    }

    if (includesKeyword(description, alias)) {
      score += 4
    }
  }

  for (const family of intent.families) {
    const familyTitleHits = family.aliases.filter(alias => includesKeyword(title, alias)).length
    const familyCategoryHit = (family.categoryAliases || []).some(alias => includesKeyword(category, alias))
    const adjacentHits = (family.adjacentSignals || []).filter(alias => includesKeyword(text, alias)).length
    const mismatchHits = (family.mismatchSignals || []).filter(alias => includesKeyword(title, alias)).length

    if (familyTitleHits > 0) score += 18 + (familyTitleHits * 3)
    if (familyCategoryHit) score += 10
    if (adjacentHits >= 2) score += 8
    if (family.key === 'software_engineering' && familyTitleHits === 0 && !familyCategoryHit && adjacentHits < 2) {
      score -= 16
      reasons.push('software intent weak in title/category')
    }
    if (mismatchHits > 0 && familyTitleHits === 0) {
      score -= 12
      reasons.push('title leans away from target role family')
    }
  }

  return {
    score: Math.max(-20, Math.min(40, score)),
    reasons: unique(reasons).slice(0, 4),
  }
}

const SENIOR_TITLE_SIGNALS = [
  'senior', 'sr.', 'staff', 'principal', 'lead', 'manager', 'director',
  'head of', 'vice president', 'vp', 'smts', 'lmts',
]

const EARLY_CAREER_INTENT_SIGNALS = [
  'junior', 'entry level', 'entry-level', 'new grad', 'graduate', 'intern',
]

const CANADA_LOCATION_SIGNALS = [
  'canada', 'british columbia', 'bc', 'vancouver', 'surrey', 'burnaby',
  'richmond', 'coquitlam', 'langley', 'toronto', 'ontario', 'gta',
]

const CLEARLY_NON_CANADA_LOCATIONS = [
  'india', 'hyderabad', 'bengaluru', 'bangalore', 'united states', 'usa',
  'us', 'san francisco', 'delaware',
  'california', 'texas', 'new york', 'ireland', 'united kingdom', 'germany',
  'france', 'spain', 'argentina', 'australia', 'singapore',
  'alabama', 'alaska', 'arizona', 'arkansas', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana',
  'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
  'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'north carolina', 'north dakota', 'ohio', 'oklahoma',
  'oregon', 'pennsylvania', 'rhode island', 'south carolina',
  'south dakota', 'tennessee', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming',
]

export function jobPassesProfileEligibility(job: JobHunterJob, profile: UserProfileForMatching) {
  const title = normalize(job.title)
  const category = normalize(job.category)
  const location = normalize(job.location)
  const explicitRoles = (profile.searches || []).map(search => normalize(search.role)).filter(Boolean)
  const explicitLocations = (profile.searches || []).map(search => normalize(search.location)).filter(Boolean)
  const targetFamilies = roleFamiliesForTerms(explicitRoles)

  if (targetFamilies.length > 0) {
    const roleFamilyMatch = targetFamilies.some(family =>
      family.aliases.some(alias => includesKeyword(title, alias))
      || (family.categoryAliases || []).some(alias => includesKeyword(category, alias))
    )
    if (!roleFamilyMatch) return false
  }

  const earlyCareerIntent = explicitRoles.some(role =>
    EARLY_CAREER_INTENT_SIGNALS.some(signal => includesKeyword(role, signal))
  )
  if (earlyCareerIntent && SENIOR_TITLE_SIGNALS.some(signal => includesKeyword(title, signal))) {
    return false
  }

  const canadaTarget = explicitLocations.some(target =>
    CANADA_LOCATION_SIGNALS.some(signal => includesKeyword(target, signal))
  )
  const geographicText = `${title} ${location}`
  const clearlyOutsideCanada = CLEARLY_NON_CANADA_LOCATIONS.some(signal => includesKeyword(geographicText, signal))
  const explicitlyCanada = CANADA_LOCATION_SIGNALS.some(signal => includesKeyword(location, signal))
  if (canadaTarget && clearlyOutsideCanada && !explicitlyCanada) {
    return false
  }

  return true
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase())
}

function matchedFromSignals(text: string, resume: string, signals: KeywordSignal[]) {
  return signals
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(text, keyword) && includesKeyword(resume, keyword))
}

function missingFromSignals(text: string, resume: string, signals: KeywordSignal[]) {
  return signals
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(text, keyword) && !includesKeyword(resume, keyword))
}

function allJobSignals() {
  return unique([...ROLE_SIGNALS, ...SKILL_SIGNALS, ...LOCATION_SIGNALS, ...EDUCATION_SIGNALS.map(keyword => ({
    keyword,
    weight: 4,
    reason: `${keyword} education signal`,
  }))])
}

function matchedPlainSignals(text: string, resume: string, signals: string[]) {
  return signals.filter(signal => includesKeyword(text, signal) && includesKeyword(resume, signal))
}

function locationMatches(job: JobHunterJob, profile: UserProfileForMatching) {
  const text = jobText(job)
  const savedLocations = (profile.searches || [])
    .map(search => search.location)
    .filter(Boolean)
  const matchedSaved = savedLocations.filter(location => includesKeyword(text, location))
  const matchedSignals = LOCATION_SIGNALS
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(text, keyword))

  return unique([...matchedSaved, ...matchedSignals]).map(titleCase)
}

function confidenceForMatch(score: number, matchedKeywords: string[], missingKeywords: string[], job: JobHunterJob) {
  let confidence = Math.round(score * 0.65)
  confidence += Math.min(20, matchedKeywords.length * 4)
  confidence -= Math.min(15, missingKeywords.length * 3)

  if (job.description && job.description.length > 200) {
    confidence += 8
  }

  if (job.title && job.company && job.location) {
    confidence += 7
  }

  return Math.max(0, Math.min(100, confidence))
}

function resumeSuggestions(missingKeywords: string[], matchedKeywords: string[]) {
  if (missingKeywords.length === 0) {
    return ['Resume already covers the main detected job keywords.']
  }

  return missingKeywords.slice(0, 5).map(keyword => {
    if (keyword.includes('requirements')) {
      return 'Add a bullet showing requirements gathering, user needs analysis, or business requirement documentation.'
    }
    if (keyword.includes('process')) {
      return 'Add a bullet showing process mapping, workflow improvement, or operational analysis.'
    }
    if (keyword.includes('salesforce') || keyword.includes('hubspot') || keyword.includes('crm')) {
      return 'Mention CRM tools or customer pipeline/reporting work where accurate.'
    }
    if (keyword.includes('sql') || keyword.includes('dashboard') || keyword.includes('reporting')) {
      return 'Highlight reporting, dashboard, Excel, SQL, or KPI tracking experience where accurate.'
    }
    if (keyword.includes('telecommunications') || keyword.includes('telus')) {
      return 'Connect customer-facing telecom experience to business, support, or implementation outcomes.'
    }
    return `Add a truthful example that demonstrates ${keyword}.`
  }).concat(
    matchedKeywords.length > 0
      ? [`Keep emphasizing existing strengths: ${matchedKeywords.slice(0, 3).join(', ')}.`]
      : []
  )
}

function freshnessLocationSourceBonus(job: JobHunterJob, profile: UserProfileForMatching) {
  const text = jobText(job)
  let bonus = 0

  const explicitLocations = (profile.searches || []).map(search => normalize(search.location)).filter(Boolean)
  const resume = normalize(profile.resumeText)
  const resumeLocations = LOCATION_SIGNALS
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(resume, keyword))

  if (explicitLocations.some(location => includesKeyword(text, location))) {
    bonus += 35
  } else if (resumeLocations.some(location => includesKeyword(text, location))) {
    bonus += 25
  }

  const source = normalize(job.source)
  if (['linkedin', 'remoteok', 'city_of_vancouver', 'bc_public_service', 'ubc', 'hubspot', 'salesforce', 'remote.com'].some(name => source.includes(name))) {
    bonus += 20
  }

  if (job.posted) {
    const postedAt = new Date(job.posted)
    if (!Number.isNaN(postedAt.getTime())) {
      const ageDays = (Date.now() - postedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays <= 1) bonus += 30
      else if (ageDays <= 3) bonus += 22
      else if (ageDays <= 7) bonus += 14
      else if (ageDays <= 14) bonus += 8
    }
  }

  return Math.max(0, Math.min(100, bonus))
}

function blendedScore(nlpScore: number, ruleScore: number, bonus: number) {
  return Math.max(0, Math.min(100, Math.round(
    (0.6 * nlpScore) +
    (0.3 * ruleScore) +
    (0.1 * bonus)
  )))
}

function labelForScore(score: number) {
  if (score >= 70) return '🔥 Excellent match'
  if (score >= 50) return '✅ Strong match'
  if (score >= 35) return '👍 Good match'
  if (score >= 20) return '🔎 Possible match'
  return '📋 Low match'
}

function toNlpJob(job: JobHunterJob) {
  return {
    id: job.id,
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    description: [job.title || '', job.title || '', job.category || '', job.description || ''].filter(Boolean).join(' '),
    link: job.link || '',
    salary: job.salary || '',
    posted: job.posted || '',
  }
}

async function scoreJobsWithNlp(jobs: JobHunterJob[], resumeText: string) {
  const startedAt = nowMs()
  const response = await axios.post(
    nlpEndpoint('/score/batch'),
    {
      resume_text: resumeText,
      jobs: jobs.map(toNlpJob),
    },
    {
      timeout: 20_000,
      headers: nlpHeaders(),
    }
  )

  logTiming('nlp.score.batch', startedAt, { jobs: jobs.length })

  return response.data.jobs || []
}

async function scoreSingleJobWithNlp(job: JobHunterJob, resumeText: string) {
  const response = await axios.post(
    nlpEndpoint('/score'),
    {
      resume_text: resumeText,
      job_text: [
        job.title,
        job.title,
        job.company,
        job.location,
        job.category,
        job.description,
      ].filter(Boolean).join(' '),
    },
    {
      timeout: 10_000,
      headers: nlpHeaders(),
    }
  )

  return response.data
}

function buildRuleFallbackItem(match: RuleMatch, profile: UserProfileForMatching) {
  const ruleScore = match.user_match_score
  const bonus = freshnessLocationSourceBonus(match.job, profile)

  return {
    ...match,
    nlp_score: null,
    rule_score: ruleScore,
    final_match_score: ruleScore,
    user_match_score: ruleScore,
    scoring_method: 'rule_fallback',
    match_label: labelForScore(ruleScore),
    reasons: match.match_reasons,
    fallback_warning: 'NLP service unavailable; using rule-based matching.',
    freshness_location_source_bonus: bonus,
  }
}

function buildSemanticItem(match: RuleMatch, nlpJob: any, profile: UserProfileForMatching) {
  const nlpScore = Number(nlpJob?.score || 0)
  const ruleScore = match.user_match_score
  const bonus = freshnessLocationSourceBonus(match.job, profile)
  const finalScore = blendedScore(nlpScore, ruleScore, bonus)

  return {
    ...match,
    nlp_score: nlpScore,
    rule_score: ruleScore,
    final_match_score: finalScore,
    user_match_score: finalScore,
    scoring_method: 'nlp_semantic',
    nlp_method: nlpJob?.method || 'unknown',
    match_label: nlpJob?.match_label || labelForScore(finalScore),
    exp_label: nlpJob?.exp_label || '',
    is_early_career: Boolean(nlpJob?.is_early_career),
    reasons: unique([
      ...(match.match_reasons || []),
      nlpJob?.match_label ? `NLP semantic ranking: ${nlpJob.match_label}` : 'NLP semantic ranking applied',
      nlpJob?.exp_label || '',
    ].filter(Boolean)),
    freshness_location_source_bonus: bonus,
  }
}

function compareOptionalStrings(left?: string | null, right?: string | null, direction: 'asc' | 'desc' = 'asc') {
  const leftValue = String(left || '')
  const rightValue = String(right || '')
  const result = leftValue.localeCompare(rightValue)
  return direction === 'asc' ? result : -result
}

function sortMatchedItems(items: any[], sort: string) {
  const sorted = [...items]

  const compareByScore = (left: any, right: any) =>
    Number(right.final_match_score || right.user_match_score || 0) - Number(left.final_match_score || left.user_match_score || 0)

  if (sort === 'company_asc') {
    return sorted.sort((left, right) => {
      const companyResult = compareOptionalStrings(left.job?.company, right.job?.company, 'asc')
      if (companyResult !== 0) return companyResult
      return compareOptionalStrings(left.job?.title, right.job?.title, 'asc')
    })
  }

  if (sort === 'first_seen_desc') {
    return sorted.sort((left, right) => {
      const firstSeenResult = compareOptionalStrings(left.job?.first_seen, right.job?.first_seen, 'desc')
      if (firstSeenResult !== 0) return firstSeenResult
      return compareByScore(left, right)
    })
  }

  if (sort === 'date_posted_desc') {
    return sorted.sort((left, right) => {
      const postedResult = compareOptionalStrings(left.job?.posted, right.job?.posted, 'desc')
      if (postedResult !== 0) return postedResult
      return compareByScore(left, right)
    })
  }

  return sorted.sort(compareByScore)
}

export function scoreJobForUser(job: JobHunterJob, profile: UserProfileForMatching) {
  const text = jobText(job)
  const resume = normalize(profile.resumeText)
  const profileTerms = profileKeywords(profile)
  const matchReasons: string[] = []
  const missingKeywords: string[] = []
  let score = 25

  const applySignal = (signal: KeywordSignal, source: 'job' | 'resume') => {
    if (!includesKeyword(text, signal.keyword)) return

    if (signal.weight > 0 && source === 'resume' && !includesKeyword(resume, signal.keyword)) {
      missingKeywords.push(signal.keyword)
      return
    }

    score += signal.weight
    if (signal.weight > 0) {
      matchReasons.push(signal.reason)
    } else {
      matchReasons.push(signal.reason)
    }
  }

  SKILL_SIGNALS.forEach(signal => applySignal(signal, 'resume'))
  const explicitLocations = (profile.searches || []).map(search => normalize(search.location)).filter(Boolean)
  const resumeLocations = LOCATION_SIGNALS
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(resume, keyword))
  LOCATION_SIGNALS.forEach(signal => {
    const isPreferred = explicitLocations.some(location => includesKeyword(location, signal.keyword) || includesKeyword(signal.keyword, location))
      || resumeLocations.includes(signal.keyword)
    if (isPreferred && includesKeyword(text, signal.keyword)) {
      score += signal.weight
      matchReasons.push(signal.reason)
    }
  })
  PENALTY_SIGNALS.forEach(signal => applySignal(signal, 'job'))

  for (const search of profile.searches || []) {
    const role = normalize(search.role)
    const location = normalize(search.location)

    if (role && includesKeyword(text, role)) {
      score += 12
      matchReasons.push(`matches saved role search: ${search.role}`)
    }

    if (location && includesKeyword(text, location)) {
      score += 8
      matchReasons.push(`matches saved location search: ${search.location}`)
    }
  }

  for (const term of profileTerms) {
    if (term && includesKeyword(text, term)) {
      score += 3
    }
  }

  const intent = roleIntentScore(job, profile)
  score += intent.score
  matchReasons.push(...intent.reasons)

  const userMatchScore = Math.max(0, Math.min(100, Math.round(score)))
  const matchedKeywords = unique([
    ...matchedFromSignals(text, resume, ROLE_SIGNALS),
    ...matchedFromSignals(text, resume, SKILL_SIGNALS),
  ])
  const explanationMissingKeywords = unique([
    ...missingKeywords,
    ...missingFromSignals(text, resume, SKILL_SIGNALS),
  ])
  const matchedExperience = matchedPlainSignals(text, resume, EXPERIENCE_SIGNALS)
  const matchedEducation = matchedPlainSignals(text, resume, EDUCATION_SIGNALS)
  const matchedLocation = locationMatches(job, profile)
  const confidenceScore = confidenceForMatch(
    userMatchScore,
    matchedKeywords,
    explanationMissingKeywords,
    job
  )

  return {
    job,
    user_match_score: userMatchScore,
    match_reasons: unique(matchReasons).slice(0, 8),
    missing_keywords: explanationMissingKeywords.slice(0, 8),
    matched_keywords: matchedKeywords.slice(0, 12),
    matched_experience: matchedExperience.length > 0 ? matchedExperience.map(titleCase) : ['No explicit experience match detected'],
    matched_location: matchedLocation.length > 0 ? matchedLocation : ['No explicit location match detected'],
    matched_education: matchedEducation.length > 0 ? matchedEducation.map(titleCase) : ['No explicit education match detected'],
    confidence_score: confidenceScore,
    resume_improvement_suggestions: resumeSuggestions(explanationMissingKeywords, matchedKeywords),
  }
}

function topMissingKeywords(items: Array<{ missing_keywords?: string[] }>) {
  const counts = new Map<string, number>()

  for (const item of items) {
    for (const keyword of item.missing_keywords || []) {
      counts.set(keyword, (counts.get(keyword) || 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }))
}

function extractRequiredExperience(text: string) {
  const patterns = [
    /(\d+)\s*\+\s*years?\s*(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?\s*(?:of\s+)?(?:experience|exp)/i,
    /(?:minimum|min|at\s+least)\s+(\d+)\s*years?\s*(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*years?\s*(?:of\s+)?(?:relevant\s+)?(?:experience|exp)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1])
  }

  return null
}

function extractResumeYears(resumeText: string) {
  const years = Array.from(resumeText.matchAll(/(\d+)\s*\+?\s*years?/gi))
    .map(match => Number(match[1]))
    .filter(Number.isFinite)

  return years.length ? Math.max(...years) : null
}

function experienceGaps(jobTextValue: string, resumeText: string) {
  const requiredYears = extractRequiredExperience(jobTextValue)
  const resumeYears = extractResumeYears(resumeText)
  const senioritySignals = PENALTY_SIGNALS
    .map(signal => signal.keyword)
    .filter(keyword => includesKeyword(jobTextValue, keyword))

  if (requiredYears === null && senioritySignals.length === 0) {
    return {
      required_years: null,
      resume_years_detected: resumeYears,
      gaps: [],
      summary: 'No explicit experience requirement detected.',
    }
  }

  const gaps: string[] = []
  if (requiredYears !== null && resumeYears === null) {
    gaps.push(`Job mentions ${requiredYears}+ years, but years of experience were not clearly detected in the resume.`)
  } else if (requiredYears !== null && resumeYears !== null && resumeYears < requiredYears) {
    gaps.push(`Job mentions ${requiredYears}+ years; resume shows about ${resumeYears} years.`)
  }

  if (senioritySignals.length > 0) {
    gaps.push(`Seniority signals found in job: ${senioritySignals.join(', ')}.`)
  }

  return {
    required_years: requiredYears,
    resume_years_detected: resumeYears,
    gaps,
    summary: gaps.length > 0 ? 'Potential experience gap detected.' : 'Resume appears to satisfy the detected experience requirement.',
  }
}

function educationMatch(jobTextValue: string, resumeText: string) {
  const required = EDUCATION_SIGNALS.filter(signal => includesKeyword(jobTextValue, signal))
  const matched = required.filter(signal => includesKeyword(resumeText, signal))
  const missing = required.filter(signal => !includesKeyword(resumeText, signal))

  return {
    required,
    matched,
    missing,
    summary: required.length === 0
      ? 'No explicit education requirement detected.'
      : missing.length === 0
        ? 'Detected education requirements appear covered.'
        : 'Some education keywords were not detected in the resume.',
  }
}

function gapSuggestions(importantMissing: string[], missing: string[], matched: string[]) {
  const terms = importantMissing.length > 0 ? importantMissing : missing

  return resumeSuggestions(terms, matched).concat(
    terms.slice(0, 4).map(keyword => `Surface ${keyword} in a concrete achievement bullet if it is accurate.`)
  ).slice(0, 8)
}

export async function analyzeResumeGap(jobId: string, profile: UserProfileForMatching) {
  if (!profile.resumeText?.trim()) {
    return {
      message: 'Upload resume to analyze fit.',
      strengths: [],
      concepts_present: [],
      concepts_missing: [],
      evidence_found: [],
      resume_weaknesses: [],
      improvement_opportunities: [],
      recommended_resume_changes: [],
      potential_match_score_after_improvements: 0,
      semantic_alignment_score: 0,
      matched_keywords: [],
      missing_keywords: [],
      important_missing_keywords: [],
      experience_gaps: {
        required_years: null,
        resume_years_detected: null,
        gaps: [],
        summary: 'Resume not available.',
      },
      education_match: {
        required: [],
        matched: [],
        missing: [],
        summary: 'Resume not available.',
      },
      skill_match_score: 0,
      suggested_bullet_improvements: [],
      suggested_skills_to_surface: [],
      suggested_experiences_to_emphasize: [],
    }
  }

  const job = await getJobHunterJob(jobId) as JobHunterJob
  const jobTextValue = rawJobText(job)
  const resumeText = String(profile.resumeText || '')
  const normalizedResume = normalize(resumeText)

  let semanticScore = 0
  let nlpMethod = 'keyword_fallback'
  try {
    const nlpScore = await scoreSingleJobWithNlp(job, resumeText)
    semanticScore = Math.round(Number(nlpScore.score || 0))
    nlpMethod = nlpScore.method || 'semantic'
  } catch (_error) {
    semanticScore = 0
  }

  const conceptAnalyses = CONCEPT_GROUPS
    .map(concept => ({ concept, analysis: evaluateConcept(concept, jobTextValue, resumeText, semanticScore) }))
    .filter((entry): entry is { concept: ConceptDefinition, analysis: ConceptAnalysis } => Boolean(entry.analysis))

  const presentConcepts = conceptAnalyses.filter(entry => entry.analysis.present)
  const missingConcepts = conceptAnalyses.filter(entry => !entry.analysis.present)
  const relevantConceptCount = conceptAnalyses.length
  const conceptCoverageScore = relevantConceptCount > 0
    ? Math.round((presentConcepts.length / relevantConceptCount) * 100)
    : semanticScore
  const skillMatchScore = blendedAnalysisScore(conceptCoverageScore, semanticScore)

  const strengths = presentConcepts.map(({ analysis }) => ({
    title: analysis.label,
    detail: strengthNarrative(analysis),
    confidence: analysis.confidence,
  }))

  const evidenceFound = conceptAnalyses.map(({ analysis }) => ({
    concept: analysis.concept,
    label: analysis.label,
    confidence: analysis.confidence,
    job_evidence: analysis.job_evidence,
    resume_evidence: analysis.resume_evidence,
  }))

  const resumeWeaknesses = missingConcepts.map(({ analysis }) => weaknessNarrative(analysis))
  const recommendedResumeChanges = missingConcepts.map(({ concept, analysis }) =>
    buildRecommendation(concept, analysis, normalizedResume, presentConcepts.map(item => item.analysis))
  )

  const improvementOpportunities = recommendedResumeChanges.map(change => ({
    label: change.label,
    detail: change.recommendation,
    confidence: change.confidence,
  }))

  const suggestions = recommendedResumeChanges.map(change => `${change.recommendation} (${change.confidence})`)

  return {
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      link: job.link,
    },
    strengths,
    concepts_present: presentConcepts.map(({ analysis }) => analysis.label),
    concepts_missing: missingConcepts.map(({ analysis }) => analysis.label),
    evidence_found: evidenceFound,
    resume_weaknesses: resumeWeaknesses,
    improvement_opportunities: improvementOpportunities,
    recommended_resume_changes: recommendedResumeChanges,
    potential_match_score_after_improvements: potentialScoreAfterImprovements(skillMatchScore, recommendedResumeChanges),
    semantic_alignment_score: semanticScore,
    matched_keywords: presentConcepts.map(({ analysis }) => analysis.label),
    missing_keywords: missingConcepts.map(({ analysis }) => analysis.label),
    important_missing_keywords: missingConcepts
      .filter(({ analysis }) => analysis.confidence !== 'Low Confidence')
      .map(({ analysis }) => analysis.label),
    experience_gaps: experienceGaps(jobTextValue, normalizedResume),
    education_match: educationMatch(jobTextValue, normalizedResume),
    skill_match_score: skillMatchScore,
    scoring_method: nlpMethod,
    suggested_bullet_improvements: suggestions,
    suggested_skills_to_surface: missingConcepts.map(({ analysis }) => analysis.label),
    suggested_experiences_to_emphasize: presentConcepts.map(({ analysis }) => analysis.label),
  }
}

export async function getJobHunterMatches(query: JobHunterJobsQuery, profile: UserProfileForMatching, userId?: string) {
  const requestedLimit = Math.min(Math.max(Number(query.limit || 50), 1), MAX_MATCH_JOBS)
  const requestedOffset = Math.max(Number(query.offset || 0), 0)
  const requestedPage = Math.max(Number(query.page || 1), 1)
  const effectiveOffset = query.page !== undefined
    ? (requestedPage - 1) * requestedLimit
    : requestedOffset

  if (!profile.resumeText?.trim()) {
    return {
      message: 'Upload resume to personalize matches.',
      items: [],
      total: 0,
      limit: requestedLimit,
      offset: effectiveOffset,
      page: requestedPage,
      total_pages: 0,
      has_prev: false,
      has_next: false,
      last_updated: null,
    }
  }

  if (userId) {
    const cacheKey = personalizedMatchCacheKey(userId, profile, query)
    const cachedValue = getCachedPersonalizedMatches(cacheKey)
    if (cachedValue) {
      console.info(`[cache] personalized matches hit user=${userId} ttl=${PERSONALIZED_MATCH_CACHE_TTL_MS}ms`)
      return cachedValue
    }
  }

  const candidateSet = await getPersonalizedCandidateJobs(query, profile)
  const jobs = candidateSet.jobs
  const ruleMatches = jobs
    .filter(job => jobPassesProfileEligibility(job, profile))
    .map(job => scoreJobForUser(job, profile))
  let items
  let scoringMethod = 'nlp_semantic'
  let fallbackWarning = ''

  try {
    const nlpJobs = await scoreJobsWithNlp(jobs, profile.resumeText)
    const nlpById = new Map(nlpJobs.map((job: any) => [job.id, job]))

    items = ruleMatches
      .map(match => buildSemanticItem(match, nlpById.get(match.job.id), profile))
      .sort((a, b) => b.final_match_score - a.final_match_score)
  } catch (error: any) {
    scoringMethod = 'rule_fallback'
    fallbackWarning = error.response?.data?.detail || error.message || 'NLP service unavailable; using rule-based matching.'
    items = ruleMatches
      .map(match => buildRuleFallbackItem(match, profile))
  }

  const sortedItems = sortMatchedItems(items, String(query.sort || 'score_desc'))
  const pagedItems = sortedItems.slice(effectiveOffset, effectiveOffset + requestedLimit)
  const total = sortedItems.length
  const totalPages = total > 0 ? Math.ceil(total / requestedLimit) : 0
  const response = {
    items: pagedItems,
    top_missing_keywords: topMissingKeywords(sortedItems),
    scoring_method: scoringMethod,
    fallback_warning: fallbackWarning,
    total,
    limit: requestedLimit,
    offset: effectiveOffset,
    page: requestedPage,
    total_pages: totalPages,
    has_prev: requestedPage > 1,
    has_next: requestedPage < totalPages,
    last_updated: candidateSet.lastUpdated || sortedItems[0]?.job?.updated_at || sortedItems[0]?.job?.first_seen || null,
  }

  if (userId) {
    const cacheKey = personalizedMatchCacheKey(userId, profile, query)
    setCachedPersonalizedMatches(cacheKey, response)
    console.info(`[cache] personalized matches store user=${userId} ttl=${PERSONALIZED_MATCH_CACHE_TTL_MS}ms`)
  }

  return response
}
