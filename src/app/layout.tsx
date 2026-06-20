import type { Metadata } from 'next'
import 'bulma/css/bulma.min.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'GG Capital CRM',
  description: 'CRM, Contacts & Meetings platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
