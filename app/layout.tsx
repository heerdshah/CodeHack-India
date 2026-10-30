import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter_Tight, Space_Grotesk } from 'next/font/google'
import './globals.css'

const sans = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight' })
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'ResourcX — Institutional Resource Sharing',
  description: 'Share labs, equipment, and studios across colleges, research labs, and makerspaces with job-based verification.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/resourcx-favicon.png', type: 'image/png' },
    ],
    apple: '/resourcx-favicon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#111111',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${display.variable} scroll-smooth bg-ink`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}