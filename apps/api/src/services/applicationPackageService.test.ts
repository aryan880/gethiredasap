import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canTransitionPackage,
  canonicalJobKey,
  clampScore,
  evaluatePackageGate,
} from './applicationPackageService'

test('canonical identity merges aggregator mirrors with the same employer application URL', () => {
  const common = {
    company: 'Example Corp',
    title: 'Software Engineer I',
    location: 'Toronto, ON',
    publishedAt: new Date('2026-07-22T10:00:00Z'),
    applicationUrl: 'https://jobs.example.com/job/123?utm_source=linkedin',
    canonicalEmployerUrl: null,
    requisitionId: null,
    sourceNativeId: null,
  }

  const linkedin = canonicalJobKey({
    ...common,
    source: 'linkedin',
    externalJobId: 'li-123',
    detailUrl: 'https://linkedin.com/jobs/view/123',
  })
  const jobBank = canonicalJobKey({
    ...common,
    source: 'job-bank',
    externalJobId: 'jb-456',
    detailUrl: 'https://jobbank.gc.ca/jobsearch/jobposting/456',
  })

  assert.equal(linkedin, jobBank)
})

test('canonical identity prioritizes employer requisition id', () => {
  const first = canonicalJobKey({
    source: 'linkedin',
    externalJobId: 'one',
    company: 'Capital One',
    title: 'Associate Software Engineer',
    location: 'Toronto',
    requisitionId: 'R247320',
    detailUrl: 'https://linkedin.com/jobs/view/one',
  })
  const second = canonicalJobKey({
    source: 'workday',
    externalJobId: 'two',
    company: 'Capital One',
    title: 'Associate Software Engineer, New Grad',
    location: 'Toronto, Ontario',
    requisitionId: 'r247320',
    detailUrl: 'https://capitalone.wd1.myworkdayjobs.com/job/two',
  })

  assert.equal(first, second)
})

test('generation gate requires verified direct employer route, score, and no blockers', () => {
  assert.deepEqual(evaluatePackageGate({
    verificationStatus: 'VERIFIED_OPEN',
    fitScore: 84,
    hardBlockers: [],
    applicationUrl: 'https://jobs.example.com/apply/123',
    urlProvenance: 'EMPLOYER_ATS',
  }), { eligible: true, reasons: [], blockers: [] })

  const rejected = evaluatePackageGate({
    verificationStatus: 'UNVERIFIED',
    fitScore: 79,
    hardBlockers: ['Requires security clearance'],
    applicationUrl: 'https://linkedin.com/jobs/view/123',
    urlProvenance: 'AGGREGATOR_DETAIL',
  })
  assert.equal(rejected.eligible, false)
  assert.equal(rejected.reasons.length, 4)
})

test('scores are clamped and package transitions are explicit', () => {
  assert.equal(clampScore(107), 100)
  assert.equal(clampScore(-9), 0)
  assert.equal(clampScore('84.4'), 84)
  assert.equal(canTransitionPackage('READY_FOR_WORK', 'GENERATING'), true)
  assert.equal(canTransitionPackage('NEEDS_REVIEW', 'APPLIED'), false)
})
