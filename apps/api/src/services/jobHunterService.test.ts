import assert from 'node:assert/strict'
import test from 'node:test'
import {
  jobPassesProfileEligibility,
  scoreJobForUser,
  type JobHunterJob,
  type UserProfileForMatching,
} from './jobHunterService'

const softwareProfile: UserProfileForMatching = {
  resumeText: 'Junior software developer with TypeScript, React, Node.js, SQL, Git, API, and testing projects in Vancouver, Canada.',
  searches: [{ role: 'Junior Software Developer', location: 'Vancouver, BC' }],
}

const supportProfile: UserProfileForMatching = {
  resumeText: 'IT support analyst with service desk, troubleshooting, Active Directory, Microsoft 365, ticketing, networking, and customer support experience.',
  searches: [{ role: 'IT Support', location: 'Vancouver, BC' }],
}

function job(values: Partial<JobHunterJob> & Pick<JobHunterJob, 'id' | 'title'>): JobHunterJob {
  return {
    company: 'Example Company',
    location: 'Vancouver, BC, Canada',
    description: '',
    category: 'Other',
    ...values,
  }
}

test('Active Directory does not trigger the Director seniority penalty', () => {
  const result = scoreJobForUser(job({
    id: 'support-1',
    title: 'IT Support Technician',
    category: 'IT Support',
    description: 'Troubleshoot Microsoft 365 and Active Directory issues through the service desk.',
  }), supportProfile)

  assert.equal(result.match_reasons.some(reason => reason.includes('director role penalty')), false)
})

test('software profile ranks relevant early-career software roles above unrelated and senior roles', () => {
  const candidates = [
    job({ id: 'software-local', title: 'Junior Software Developer', category: 'Software Engineering', description: 'Build TypeScript React and Node.js APIs.' }),
    job({ id: 'support-local', title: 'IT Support Technician', category: 'IT Support', description: 'Service desk and endpoint troubleshooting.' }),
    job({ id: 'analyst-local', title: 'Business Analyst', category: 'Business Analysis', description: 'Requirements gathering and reporting.' }),
    job({ id: 'software-senior', title: 'Senior Principal Software Engineer', location: 'Bengaluru, India', category: 'Software Engineering', description: '10+ years of distributed systems experience.' }),
  ]

  const scored = candidates
    .map(candidate => ({ id: candidate.id, score: scoreJobForUser(candidate, softwareProfile).user_match_score }))
    .sort((left, right) => right.score - left.score)

  assert.equal(scored[0].id, 'software-local')
  assert.ok(scored.find(item => item.id === 'software-local')!.score >= 80)
  assert.ok(scored.find(item => item.id === 'software-senior')!.score < scored[0].score)
})

test('IT support profile ranks support work above software development', () => {
  const support = scoreJobForUser(job({
    id: 'support',
    title: 'Service Desk Analyst',
    category: 'IT Support',
    description: 'Troubleshooting, Active Directory, ticketing, and customer support.',
  }), supportProfile)
  const software = scoreJobForUser(job({
    id: 'software',
    title: 'Software Developer',
    category: 'Software Engineering',
    description: 'Build Java backend services.',
  }), supportProfile)

  assert.ok(support.user_match_score > software.user_match_score)
})

test('early-career Canada eligibility rejects senior and clearly foreign-only roles', () => {
  assert.equal(jobPassesProfileEligibility(job({
    id: 'senior',
    title: 'Senior Software Engineer',
    category: 'Software Engineering',
  }), softwareProfile), false)

  assert.equal(jobPassesProfileEligibility(job({
    id: 'foreign',
    title: 'Junior Software Developer',
    location: 'Bengaluru, India',
    category: 'Software Engineering',
  }), softwareProfile), false)

  assert.equal(jobPassesProfileEligibility(job({
    id: 'local',
    title: 'Junior Software Developer',
    category: 'Software Engineering',
  }), softwareProfile), true)
})
