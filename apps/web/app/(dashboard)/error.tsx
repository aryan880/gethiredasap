'use client'

import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Dashboard rendering failed', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <section style={{ width: '100%', maxWidth: '560px', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '8px', background: 'var(--bg2)', padding: '28px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#F87171', background: 'rgba(248,113,113,0.08)', marginBottom: '18px' }}>
          <AlertTriangle size={20} />
        </div>
        <h1 style={{ margin: 0, color: 'var(--text)', fontSize: '24px' }}>This page could not load</h1>
        <p style={{ color: 'var(--muted2)', lineHeight: 1.6, margin: '10px 0 22px' }}>
          Your session is still active. Retry the page, or return to the command center.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: 0, borderRadius: '8px', padding: '10px 14px', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={16} /> Retry
          </button>
          <button onClick={() => router.push('/dashboard')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px', padding: '10px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text2)', fontWeight: 700, cursor: 'pointer' }}>
            <Home size={16} /> Command center
          </button>
        </div>
      </section>
    </main>
  )
}
