'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSavedSearch,
  DEFAULT_PERSONALIZED_MATCHES_QUERY,
  getJobHunterMatches,
  getJobHunterResumeGap,
  getJobHunterSummary,
  jobHunterQueryKeys,
  refreshJobHunter,
} from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import JobWorkflowActions, { StatusBadge } from '@/components/JobWorkflowActions'
import AIJobBrowser from '@/components/AIJobBrowser'
import AIJobMatchesBrowser from '@/components/AIJobMatchesBrowser'
import SavedSearchDialog, { type SavedSearchFormValues } from '@/components/SavedSearchDialog'

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '22px',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: 'var(--muted2)',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        marginBottom: '10px',
      }}>{label}</div>
      <div style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: '40px',
        fontWeight: 700,
        color,
        lineHeight: 1,
      }}>{value.toLocaleString()}</div>
    </div>
  )
}

function JobHunterCard({ job, index, isPersonalized }: { job: any; index: number; isPersonalized: boolean }) {
  const score = Math.round(job.score || 0)
  const scoreColor = score >= 90 ? '#00FF88' : score >= 75 ? '#60A5FA' : score >= 60 ? '#F59E0B' : '#6B7280'

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '18px 22px',
      display: 'grid',
      gridTemplateColumns: '72px 1fr auto',
      gap: '18px',
      alignItems: 'center',
      animation: `fadeUp 0.35s ease ${index * 0.04}s both`,
    }}>
      <div style={{
        width: '58px',
        height: '58px',
        borderRadius: '50%',
        border: `1px solid ${scoreColor}40`,
        background: `${scoreColor}10`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: scoreColor,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
      }}>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div>{score}</div>
          <div style={{
            fontSize: '8px',
            color: scoreColor,
            opacity: 0.75,
            marginTop: '3px',
            letterSpacing: '0.6px',
          }}>
            GLOBAL
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {isPersonalized && job.priority && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: scoreColor,
              background: `${scoreColor}10`,
              border: `1px solid ${scoreColor}25`,
              borderRadius: '999px',
              padding: '3px 10px',
              textTransform: 'uppercase',
            }}>{job.priority}</span>
          )}
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            color: 'var(--muted2)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '999px',
            padding: '3px 10px',
          }}>{job.source}</span>
          {job.category && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--muted2)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '999px',
              padding: '3px 10px',
            }}>{job.category}</span>
          )}
          <StatusBadge workflow={job.workflow} />
        </div>
        <a href={job.link} target="_blank" rel="noopener noreferrer" style={{
          display: 'block',
          fontFamily: 'Playfair Display, serif',
          fontSize: '19px',
          fontWeight: 700,
          color: 'var(--text)',
          textDecoration: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '6px',
        }}>
          {job.title}
        </a>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--muted2)', fontSize: '13px' }}>
          <span>{job.company}</span>
          <span>{job.location}</span>
          {job.posted && <span>{job.posted}</span>}
        </div>
        <JobWorkflowActions job={job} workflow={job.workflow} />
      </div>

      <a href={job.link} target="_blank" rel="noopener noreferrer" style={{
        color: 'var(--accent)',
        border: '1px solid rgba(0,255,136,0.2)',
        background: 'rgba(0,255,136,0.07)',
        borderRadius: '10px',
        padding: '10px 16px',
        textDecoration: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        whiteSpace: 'nowrap',
      }}>
        Open
      </a>
    </div>
  )
}

function MatchCard({ match, index }: { match: any; index: number }) {
  const job = match.job || {}
  const [gapReport, setGapReport] = useState<any>(null)
  const [gapLoading, setGapLoading] = useState(false)
  const [gapError, setGapError] = useState('')
  const score = Math.round(match.final_match_score || match.user_match_score || 0)
  const scoreColor = score >= 90 ? '#00FF88' : score >= 75 ? '#60A5FA' : score >= 60 ? '#F59E0B' : '#6B7280'
  const reasons = match.reasons || match.match_reasons || []
  const missing = match.missing_keywords || []
  const matchedKeywords = match.matched_keywords || []
  const matchedExperience = match.matched_experience || []
  const matchedLocation = match.matched_location || []
  const matchedEducation = match.matched_education || []
  const suggestions = match.resume_improvement_suggestions || []
  const confidence = Math.round(match.confidence_score || 0)
  const nlpScore = match.nlp_score === null || match.nlp_score === undefined ? null : Math.round(match.nlp_score)
  const ruleScore = Math.round(match.rule_score || 0)
  const scoringMethod = match.scoring_method === 'nlp_semantic' ? 'NLP semantic' : 'Rule fallback'

  const analyzeResumeFit = async () => {
    if (!job.id || gapLoading) return
    setGapLoading(true)
    setGapError('')
    try {
      const report = await getJobHunterResumeGap(job.id)
      setGapReport(report)
    } catch (error: any) {
      setGapError(error.response?.data?.detail || error.message || 'Unable to analyze resume fit.')
    } finally {
      setGapLoading(false)
    }
  }

  const renderList = (items: string[], emptyText: string) => (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {(items.length > 0 ? items : [emptyText]).map((item: string, itemIndex: number) => (
        <span key={`${item}-${itemIndex}`} style={{
          color: 'var(--text2)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '999px',
          padding: '4px 9px',
          fontSize: '12px',
        }}>
          {item}
        </span>
      ))}
    </div>
  )

  const renderConfidenceBadge = (value?: string) => (
    <span style={{
      color: value === 'High Confidence' ? '#00FF88' : value === 'Medium Confidence' ? '#F59E0B' : 'var(--muted2)',
      background: value === 'High Confidence' ? 'rgba(0,255,136,0.08)' : value === 'Medium Confidence' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${value === 'High Confidence' ? 'rgba(0,255,136,0.22)' : value === 'Medium Confidence' ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.08)'}` ,
      borderRadius: '999px',
      padding: '3px 9px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono, monospace',
      whiteSpace: 'nowrap',
    }}>
      {value || 'Confidence pending'}
    </span>
  )

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '18px 22px',
      display: 'grid',
      gridTemplateColumns: '76px 1fr auto',
      gap: '18px',
      alignItems: 'start',
      animation: `fadeUp 0.35s ease ${index * 0.04}s both`,
    }}>
      <div style={{
        width: '62px',
        height: '62px',
        borderRadius: '50%',
        border: `1px solid ${scoreColor}40`,
        background: `${scoreColor}10`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: scoreColor,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
      }}>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div>{score}</div>
          <div style={{
            fontSize: '8px',
            color: scoreColor,
            opacity: 0.75,
            marginTop: '3px',
            letterSpacing: '0.6px',
          }}>
            FINAL
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            color: scoreColor,
            background: `${scoreColor}10`,
            border: `1px solid ${scoreColor}25`,
            borderRadius: '999px',
            padding: '3px 10px',
            textTransform: 'uppercase',
          }}>{scoringMethod}</span>
          {match.match_label && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--text2)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '999px',
              padding: '3px 10px',
            }}>{match.match_label}</span>
          )}
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            color: 'var(--muted2)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '999px',
            padding: '3px 10px',
          }}>{job.source}</span>
          {job.category && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--muted2)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '999px',
              padding: '3px 10px',
            }}>{job.category}</span>
          )}
          <StatusBadge workflow={job.workflow} />
        </div>
        <a href={job.link} target="_blank" rel="noopener noreferrer" style={{
          display: 'block',
          fontFamily: 'Playfair Display, serif',
          fontSize: '19px',
          fontWeight: 700,
          color: 'var(--text)',
          textDecoration: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '6px',
        }}>
          {job.title}
        </a>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--muted2)', fontSize: '13px', marginBottom: '12px' }}>
          <span>{job.company}</span>
          <span>{job.location}</span>
          {job.posted && <span>{job.posted}</span>}
        </div>
        <JobWorkflowActions job={job} workflow={job.workflow} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {[
            ['Final Match Score', score],
            ['NLP score', nlpScore === null ? 'N/A' : nlpScore],
            ['Rule score', ruleScore],
          ].map(([label, value]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              padding: '9px 10px',
            }}>
              <div style={{
                color: 'var(--muted2)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.7px',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>{label}</div>
              <div style={{
                color: label === 'Final Match Score' ? scoreColor : 'var(--text)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '16px',
                fontWeight: 700,
              }}>{value}</div>
            </div>
          ))}
        </div>
        {match.fallback_warning && (
          <div style={{
            color: '#F59E0B',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.18)',
            borderRadius: '10px',
            padding: '9px 10px',
            fontSize: '13px',
            marginBottom: '10px',
          }}>
            {match.fallback_warning}
          </div>
        )}
        {reasons.length > 0 && (
          <div style={{ color: 'var(--text2)', fontSize: '13px', lineHeight: 1.5, marginBottom: '8px' }}>
            <strong style={{ color: 'var(--text)' }}>Reasons:</strong> {reasons.join(', ')}
          </div>
        )}
        {missing.length > 0 && (
          <div style={{ color: 'var(--muted2)', fontSize: '13px', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text2)' }}>Improvement opportunities:</strong> {missing.join(', ')}
          </div>
        )}
        <button
          onClick={analyzeResumeFit}
          disabled={gapLoading}
          style={{
            color: '#07080C',
            background: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: '10px',
            padding: '9px 12px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            cursor: gapLoading ? 'wait' : 'pointer',
            marginTop: '12px',
          }}
        >
          {gapLoading ? 'Analyzing...' : 'Analyze Resume Fit'}
        </button>
        {gapError && (
          <div style={{
            color: '#EF4444',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: '10px',
            padding: '9px 10px',
            fontSize: '13px',
            marginTop: '10px',
          }}>
            {gapError}
          </div>
        )}
        {gapReport && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '14px',
            marginTop: '12px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: 'var(--accent)',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}>
                Resume fit analysis
              </div>
              <div style={{
                color: scoreColor,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                Skill match {Math.round(gapReport.skill_match_score || 0)}%
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>✓ Strengths</div>
                {renderList(gapReport.concepts_present || gapReport.matched_keywords || [], 'No clear strengths detected yet')}
              </div>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>↗ Improvement opportunities</div>
                {renderList(gapReport.concepts_missing || gapReport.missing_keywords || [], 'No major improvement opportunities detected')}
              </div>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Evidence found</div>
                {(gapReport.evidence_found || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {gapReport.evidence_found.slice(0, 6).map((item: any, itemIndex: number) => (
                      <div key={`${item.label}-${itemIndex}`} style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '9px 10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--text)', fontSize: '12px' }}>{item.label}</strong>
                          {renderConfidenceBadge(item.confidence)}
                        </div>
                        <div style={{ color: 'var(--muted2)', fontSize: '12px', lineHeight: 1.5 }}>
                          <div><strong style={{ color: 'var(--text2)' }}>Job:</strong> {(item.job_evidence || []).join(' | ') || 'No explicit job evidence snippet captured.'}</div>
                          <div style={{ marginTop: '4px' }}><strong style={{ color: 'var(--text2)' }}>Resume:</strong> {(item.resume_evidence || []).join(' | ') || 'Resume does not yet surface this concept clearly.'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : renderList([], 'No concept evidence captured yet')}
              </div>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Recommended resume changes</div>
                {(gapReport.recommended_resume_changes || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {gapReport.recommended_resume_changes.slice(0, 6).map((change: any, changeIndex: number) => (
                      <div key={`${change.label}-${changeIndex}`} style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '9px 10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--text)', fontSize: '12px' }}>{change.label}</strong>
                          {renderConfidenceBadge(change.confidence)}
                        </div>
                        <div style={{ color: 'var(--muted2)', fontSize: '12px', lineHeight: 1.5 }}>{change.recommendation}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.5, marginTop: '4px' }}>{change.rationale}</div>
                      </div>
                    ))}
                  </div>
                ) : renderList([], 'No resume changes recommended yet')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '10px',
              }}>
                <div style={{ color: 'var(--muted2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>Current fit</div>
                <div style={{ color: scoreColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 700 }}>{Math.round(gapReport.skill_match_score || 0)}%</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '10px',
              }}>
                <div style={{ color: 'var(--muted2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>Semantic alignment</div>
                <div style={{ color: '#60A5FA', fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 700 }}>{Math.round(gapReport.semantic_alignment_score || 0)}%</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '10px',
              }}>
                <div style={{ color: 'var(--muted2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>After improvements</div>
                <div style={{ color: '#00FF88', fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 700 }}>{Math.round(gapReport.potential_match_score_after_improvements || 0)}%</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div style={{ color: 'var(--muted2)', fontSize: '13px', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>Resume weaknesses:</strong>
                {(gapReport.resume_weaknesses || []).length > 0 ? (
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                    {gapReport.resume_weaknesses.slice(0, 6).map((weakness: string, weaknessIndex: number) => <li key={`${weakness}-${weaknessIndex}`}>{weakness}</li>)}
                  </ul>
                ) : (
                  <div style={{ marginTop: '6px' }}>No major weaknesses flagged by the current analyzer.</div>
                )}
              </div>
              <div style={{ color: 'var(--muted2)', fontSize: '13px', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>Experience and education:</strong>
                <div style={{ marginTop: '6px' }}><strong style={{ color: 'var(--text2)' }}>Experience:</strong> {gapReport.experience_gaps?.summary}</div>
                <div style={{ marginTop: '6px' }}><strong style={{ color: 'var(--text2)' }}>Education:</strong> {gapReport.education_match?.summary}</div>
              </div>
            </div>
          </div>
        )}
        <details style={{
          marginTop: '14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '12px',
        }}>
          <summary style={{
            color: 'var(--accent)',
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            marginBottom: '12px',
          }}>
            Why this matched
          </summary>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '14px',
            marginTop: '12px',
          }}>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Strengths</div>
              {renderList(matchedKeywords, 'No direct keyword overlap detected')}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Improvement opportunities</div>
              {renderList(missing.slice(0, 5), 'No major keyword gaps detected')}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Matched experience</div>
              {renderList(matchedExperience, 'No explicit experience match detected')}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Matched location</div>
              {renderList(matchedLocation, 'No explicit location match detected')}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Matched education</div>
              {renderList(matchedEducation, 'No explicit education match detected')}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Confidence score</div>
              <div style={{
                color: scoreColor,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '20px',
                fontWeight: 700,
              }}>
                {confidence}%
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Scoring method</div>
              <div style={{ color: 'var(--text2)', fontSize: '13px', lineHeight: 1.5 }}>
                {scoringMethod}
                {match.nlp_method ? ` (${match.nlp_method})` : ''}
              </div>
            </div>
          </div>
          {suggestions.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>Resume improvement suggestions</div>
              <ul style={{
                margin: 0,
                paddingLeft: '18px',
                color: 'var(--muted2)',
                fontSize: '13px',
                lineHeight: 1.6,
              }}>
                {suggestions.slice(0, 5).map((suggestion: string, suggestionIndex: number) => (
                  <li key={`${suggestion}-${suggestionIndex}`}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </details>
      </div>

      <a href={job.link} target="_blank" rel="noopener noreferrer" style={{
        color: 'var(--accent)',
        border: '1px solid rgba(0,255,136,0.2)',
        background: 'rgba(0,255,136,0.07)',
        borderRadius: '10px',
        padding: '10px 16px',
        textDecoration: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        whiteSpace: 'nowrap',
      }}>
        Open
      </a>
    </div>
  )
}

export default function JobHunterPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const isPersonalized = Boolean(user?.resumeText?.trim())
  const [activeTab, setActiveTab] = useState<'global' | 'personalized'>('global')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveError, setSaveError] = useState('')

  const summaryQuery = useQuery({
    queryKey: ['job-hunter-summary'],
    queryFn: getJobHunterSummary,
  })

  const matchesQuery = useQuery({
    queryKey: jobHunterQueryKeys.personalizedMatches(DEFAULT_PERSONALIZED_MATCHES_QUERY),
    queryFn: () => getJobHunterMatches(DEFAULT_PERSONALIZED_MATCHES_QUERY),
    enabled: isPersonalized,
  })

  const saveSearchMutation = useMutation({
    mutationFn: createSavedSearch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-searches'] })
      setSaveError('')
    },
  })

  const refreshJobsMutation = useMutation({
    mutationFn: refreshJobHunter,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ predicate: query => typeof query.queryKey?.[0] === 'string' && String(query.queryKey[0]).startsWith('job-hunter') })
      qc.invalidateQueries({ queryKey: ['saved-searches'] })
      toast.success(`Fetched new jobs${typeof data?.inserted_new_jobs === 'number' || typeof data?.updated_existing_jobs === 'number' ? ` · ${data?.inserted_new_jobs ?? 0} new, ${data?.updated_existing_jobs ?? 0} updated` : ''}`)
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail
      const message = (typeof detail === 'string' && detail) || detail?.error || error?.response?.data?.error || error?.message || 'Unable to fetch new jobs right now'
      toast.error(message)
    },
  })

  const summary = summaryQuery.data
  const matches = matchesQuery.data?.items || []
  const topMissingKeywords = matchesQuery.data?.top_missing_keywords || []
  const fallbackWarning = matchesQuery.data?.fallback_warning

  return (
    <div>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      <div style={{ marginBottom: '36px', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: 'var(--accent)',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}>// ai job hunter</p>
        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(34px,4vw,54px)',
          fontWeight: 700,
          lineHeight: 1.05,
          color: 'var(--text)',
          marginBottom: '8px',
        }}>
          {isPersonalized ? 'Discovery engine' : 'General Job Feed'}<br />
          <span style={{ color: 'var(--accent)' }}>
            {isPersonalized ? 'connected.' : 'from AI Job Hunter.'}
          </span>
        </h1>
        <p style={{ color: 'var(--muted2)', fontSize: '15px' }}>
          {isPersonalized
            ? 'Read-only view from AI Job Hunter. Personalized matching can use your uploaded resume.'
            : 'A read-only global feed from AI Job Hunter. Upload your resume to personalize matches.'}
        </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => refreshJobsMutation.mutate()} disabled={refreshJobsMutation.isPending} style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(0,255,136,0.18)', background: refreshJobsMutation.isPending ? 'rgba(0,255,136,0.4)' : 'rgba(0,255,136,0.08)', color: refreshJobsMutation.isPending ? '#07080C' : 'var(--accent)', fontWeight: 700, cursor: refreshJobsMutation.isPending ? 'wait' : 'pointer' }}>{refreshJobsMutation.isPending ? 'Fetching new jobs…' : 'Fetch new jobs'}</button>
          <a href="/saved-searches" style={{ textDecoration: 'none', borderRadius: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text2)', fontWeight: 700 }}>Manage saved searches</a>
          <button onClick={() => setSaveDialogOpen(true)} style={{ borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#07080C', fontWeight: 700, cursor: 'pointer' }}>Save Search</button>
        </div>
      </div>

      {!isPersonalized && (
        <div style={{
          background: 'rgba(0,255,136,0.06)',
          border: '1px solid rgba(0,255,136,0.18)',
          borderRadius: '16px',
          padding: '20px 22px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '18px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--accent)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              General job feed
            </div>
            <div style={{ color: 'var(--text2)', fontSize: '14px' }}>
              Scores here are global feed rankings. Upload your resume to personalize matches.
            </div>
          </div>
          <a href="/settings" style={{
            color: '#07080C',
            background: 'var(--accent)',
            borderRadius: '10px',
            padding: '10px 16px',
            textDecoration: 'none',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            Upload your resume to personalize matches
          </a>
        </div>
      )}

      {saveError && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '16px', padding: '16px 18px', color: '#FCA5A5', marginBottom: '18px' }}>{saveError}</div>
      )}

      {summaryQuery.isError && (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: '16px',
          padding: '22px',
          color: '#EF4444',
          marginBottom: '24px',
        }}>
          AI Job Hunter API is not reachable. Check that port 8010 is running.
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '14px',
        marginBottom: '34px',
      }}>
        <StatCard label="Total jobs" value={summary?.total_jobs || 0} color="#00FF88" />
        <StatCard label="Valid jobs" value={summary?.valid_jobs || 0} color="#60A5FA" />
        <StatCard label="Saved jobs" value={summary?.saved_jobs || 0} color="#F59E0B" />
        <StatCard label="Applied jobs" value={summary?.applied_jobs || 0} color="#a78bfa" />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '14px',
        marginBottom: '34px',
      }}>
        {[
          ['Top sources', summary?.jobs_by_source],
          ['Top categories', summary?.jobs_by_category],
          [isPersonalized ? 'Priority bands' : 'Feed status', isPersonalized ? summary?.jobs_by_priority : []],
        ].map(([title, rows]: any) => (
          <div key={title} style={{
            background: 'var(--bg2)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '20px',
          }}>
            <h2 style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: 'var(--text2)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginBottom: '14px',
            }}>{title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {isPersonalized || title !== 'Feed status' ? (rows || []).slice(0, 6).map((row: any) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                  <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{row.count}</span>
                </div>
              )) : (
                <div style={{ color: 'var(--muted2)', fontSize: '13px', lineHeight: 1.5 }}>
                  Personal priority bands are hidden until a resume is uploaded.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}>
          {[
            ['global', 'Global Job Feed'],
            ['personalized', 'Personalized Matches'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'global' | 'personalized')}
              style={{
                color: activeTab === tab ? '#07080C' : 'var(--text2)',
                background: activeTab === tab ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                border: activeTab === tab ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <h2 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '28px',
          color: 'var(--text)',
          marginBottom: '6px',
        }}>{activeTab === 'personalized' ? 'Personalized matches' : (isPersonalized ? 'Top AI Job Hunter jobs' : 'Global ranked jobs')}</h2>
        <p style={{ color: 'var(--muted2)', fontSize: '14px' }}>
          {activeTab === 'personalized'
            ? 'Ranked against your uploaded resume and saved search preferences.'
            : isPersonalized
              ? 'Sorted by AI Job Hunter global ranking. Use Personalized Matches for your resume-based ranking.'
              : 'Sorted by global ranking from the AI Job Hunter feed.'}
        </p>
      </div>

      {activeTab === 'personalized' && !isPersonalized ? (
        <div style={{
          background: 'rgba(0,255,136,0.06)',
          border: '1px solid rgba(0,255,136,0.18)',
          borderRadius: '16px',
          padding: '22px',
          color: 'var(--text2)',
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>
            Upload resume to personalize matches.
          </div>
          <a href="/settings" style={{
            color: 'var(--accent)',
            textDecoration: 'none',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
          }}>
            Go to settings
          </a>
        </div>
      ) : activeTab === 'personalized' ? (
        <>
          {fallbackWarning && (
            <div style={{
              color: '#F59E0B',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)',
              borderRadius: '16px',
              padding: '14px 18px',
              fontSize: '14px',
              marginBottom: '14px',
            }}>
              {fallbackWarning}
            </div>
          )}
          {topMissingKeywords.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '14px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: 'var(--text2)',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}>
                Top missing keywords
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {topMissingKeywords.map((item: any) => (
                  <span key={item.keyword} style={{
                    color: 'var(--text2)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '999px',
                    padding: '5px 10px',
                    fontSize: '12px',
                  }}>
                    {item.keyword} ({item.count})
                  </span>
                ))}
              </div>
            </div>
          )}
          <AIJobMatchesBrowser
            queryKeyPrefix="job-hunter-personalized-browser"
            summary={summary}
            title="Browse personalized matches"
            subtitle="Browse your AI-ranked matches with filters, search, and pagination."
            emptyTitle="No personalized matches found for this filter."
            emptyBody="Try clearing a filter or broadening your search."
            showExplainability
          />
        </>
      ) : (
        <AIJobBrowser
          queryKeyPrefix="job-hunter-browser"
          summary={summary}
          title={isPersonalized ? 'Browse all AI Job Hunter jobs' : 'Browse the global job feed'}
          subtitle={
            isPersonalized
              ? 'Paginate through the full AI Job Hunter feed with server-side filters and sorting.'
              : 'Browse the complete AI Job Hunter feed with filters, search, and pagination.'
          }
        />
      )}
      <SavedSearchDialog
        open={saveDialogOpen}
        title="Save search from Hunter"
        submitLabel={saveSearchMutation.isPending ? 'Saving…' : 'Save search'}
        initialValues={{
          name: activeTab === 'personalized' ? 'Personalized search' : 'Global feed search',
          keywords: '',
          minimumMatchScore: activeTab === 'personalized' ? 60 : 0,
          frequency: 'daily',
          enabled: true,
        }}
        onClose={() => setSaveDialogOpen(false)}
        onSubmit={async (values: SavedSearchFormValues) => {
          try {
            await saveSearchMutation.mutateAsync(values as unknown as Record<string, unknown>)
          } catch (error: any) {
            setSaveError(error?.response?.data?.error || 'Unable to save search')
            throw error
          }
        }}
      />
    </div>
  )
}
