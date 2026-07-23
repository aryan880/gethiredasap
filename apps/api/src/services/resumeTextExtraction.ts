const MAX_RESUME_TEXT_LENGTH = 100_000

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_RESUME_TEXT_LENGTH)
}

export async function extractResumeText(data: Buffer, mimeType: string) {
  let text = ''

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    text = data.toString('utf8')
  } else if (mimeType === 'application/pdf') {
    const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text?: string }>
    const parsed = await pdfParse(data)
    text = parsed.text || ''
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth') as {
      extractRawText(input: { buffer: Buffer }): Promise<{ value?: string }>
    }
    const parsed = await mammoth.extractRawText({ buffer: data })
    text = parsed.value || ''
  }

  const normalized = normalizeExtractedText(text)
  if (normalized.length < 40) {
    throw new Error('The resume did not contain enough extractable text')
  }

  return normalized
}
