import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Providers from './providers'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title:       'GetHiredASAP',
  description: 'AI-powered job alerts personalised to your resume',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={geist.className}>
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}