import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function encryptionKey() {
  const encoded = process.env.DOCUMENT_ENCRYPTION_KEY || ''
  let key: Buffer

  try {
    key = Buffer.from(encoded, 'base64')
  } catch {
    throw new Error('DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }

  if (key.length !== 32) {
    throw new Error('DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }

  return key
}

export function sha256(data: Buffer) {
  return createHash('sha256').update(data).digest('hex')
}

export function encryptDocument(data: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])

  return {
    ciphertext,
    iv,
    authTag: cipher.getAuthTag(),
    sha256: sha256(data),
  }
}

export function decryptDocument(ciphertext: Buffer, iv: Buffer, authTag: Buffer) {
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
