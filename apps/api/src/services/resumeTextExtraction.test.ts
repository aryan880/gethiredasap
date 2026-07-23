import assert from 'node:assert/strict'
import test from 'node:test'
import { extractResumeText } from './resumeTextExtraction'

test('plain-text resumes are normalized for matching', async () => {
  const text = await extractResumeText(
    Buffer.from('Junior software developer\r\n\r\nTypeScript   React\n\n\nNode.js and SQL experience.'),
    'text/plain',
  )

  assert.equal(
    text,
    'Junior software developer\n\nTypeScript React\n\nNode.js and SQL experience.',
  )
})

test('documents without meaningful resume text are rejected', async () => {
  await assert.rejects(
    extractResumeText(Buffer.from('too short'), 'text/plain'),
    /enough extractable text/,
  )
})
