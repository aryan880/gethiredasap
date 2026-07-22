import { proxyAuthRequest } from '@/lib/server/authProxy'

export async function POST(request: Request) {
  return proxyAuthRequest(request, '/auth/register')
}
