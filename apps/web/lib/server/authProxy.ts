import { NextResponse } from 'next/server'

function backendUrl(path: string) {
  const base =
    process.env.SERVER_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'

  return `${base.replace(/\/$/, '')}${path}`
}

export async function proxyAuthRequest(request: Request, path: string) {
  const contentType = request.headers.get('content-type') || 'application/json'
  const body = await request.text()

  try {
    const response = await fetch(backendUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body,
      cache: 'no-store',
    })

    const responseText = await response.text()

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 503 },
    )
  }
}
