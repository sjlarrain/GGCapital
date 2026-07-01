import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function McpSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/not-found')
  }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const mcpUrl = `${proto}://${host}/api/mcp`

  return (
    <div className="container" style={{ maxWidth: 800, padding: '2rem 1rem' }}>
      <Link href="/settings" className="has-text-grey is-size-7" style={{ textDecoration: 'none' }}>
        ← Settings
      </Link>
      <h1 className="title is-4 mt-3">AI Agent (MCP)</h1>
      <p className="subtitle is-6 mb-4">
        Let Claude / Cowork populate the CRM for you. Add the connector, sign in once in the
        browser, and download the Skill that teaches the agent how to enter data well.
      </p>

      <div className="box">
        <h2 className="title is-6 mb-3">1. Add the MCP connector</h2>
        <p className="mb-2">
          In your MCP client, add a connector pointing at:
        </p>
        <pre className="mb-4"><code>{mcpUrl}</code></pre>
        <p className="mb-4 has-text-grey">
          The client opens a browser window to sign in with your GG Capital account and asks
          you to approve access. No API key to copy — it connects as <strong>you</strong>.
        </p>

        <h2 className="title is-6 mb-3">2. Install the Skill</h2>
        <p className="mb-3">
          The Skill teaches the agent the required fields, the tag catalogs, and when to send
          data to Triage instead of the live CRM.
        </p>
        <a className="button is-primary" href="/gg-crm-skill.zip" download>
          Download the CRM Skill
        </a>
      </div>

      <p className="has-text-grey is-size-7">
        First time doing this? The <Link href="/docs/mcp" target="_blank" rel="noopener noreferrer">step-by-step guide</Link> walks
        through both steps with no technical background assumed.
      </p>
    </div>
  )
}
