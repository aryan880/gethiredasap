import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptDocument, encryptDocument } from './documentCrypto'

test('document vault encryption round-trips without storing plaintext', () => {
  const previousKey = process.env.DOCUMENT_ENCRYPTION_KEY
  process.env.DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

  try {
    const plaintext = Buffer.from('private resume content')
    const encrypted = encryptDocument(plaintext)

    assert.notDeepEqual(encrypted.ciphertext, plaintext)
    assert.deepEqual(
      decryptDocument(encrypted.ciphertext, encrypted.iv, encrypted.authTag),
      plaintext,
    )
  } finally {
    if (previousKey === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY
    else process.env.DOCUMENT_ENCRYPTION_KEY = previousKey
  }
})

test('document vault rejects ciphertext tampering', () => {
  const previousKey = process.env.DOCUMENT_ENCRYPTION_KEY
  process.env.DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64')

  try {
    const encrypted = encryptDocument(Buffer.from('candidate data'))
    const tampered = Buffer.from(encrypted.ciphertext)
    tampered[0] ^= 1

    assert.throws(() => decryptDocument(tampered, encrypted.iv, encrypted.authTag))
  } finally {
    if (previousKey === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY
    else process.env.DOCUMENT_ENCRYPTION_KEY = previousKey
  }
})
