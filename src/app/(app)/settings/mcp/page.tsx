import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { canUseNetwork } from '@/lib/network/allowlist'

export default async function McpSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canGrantNetwork = canUseNetwork(user.id, profile?.role)

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
        <h2 className="title is-6 mb-3">Which skill do I need?</h2>
        <table className="table is-fullwidth is-narrow mb-0">
          <tbody>
            <tr>
              <td style={{ whiteSpace: 'nowrap' }}><strong>CRM Skill</strong></td>
              <td>
                General-purpose. Add/enrich/de-duplicate companies, contacts, and meetings,
                using the tag catalogs correctly and staging anything uncertain for Triage.
              </td>
            </tr>
            <tr>
              <td style={{ whiteSpace: 'nowrap' }}><strong>Company Enrichment Skill</strong></td>
              <td>
                Fills in a specific company/fund&apos;s Description and Founded year by
                browsing its LinkedIn page live (you may need to log in yourself when
                prompted) and proposing the values for your approval before writing them.
                One company at a time.
              </td>
            </tr>
            {canGrantNetwork && (
              <tr>
                <td style={{ whiteSpace: 'nowrap' }}><strong>Network Intelligence Skill</strong></td>
                <td>
                  Internal — loads introductions into the relationship constellation graph.
                  Requires the <code>network:read</code>/<code>network:write</code> scopes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

        <h2 className="title is-6 mb-3">2. Install the Skill(s) you need</h2>
        <p className="mb-3">
          The Skill teaches the agent the required fields, the tag catalogs, and when to send
          data to Triage instead of the live CRM.
        </p>
        <a className="button is-primary" href="/gg-crm-skill.zip" download>
          Download the CRM Skill
        </a>
      </div>

      <div className="box">
        <h2 className="title is-6 mb-3">3. Install the Company Enrichment Skill</h2>
        <p className="mb-3">
          Looks up a company/fund on LinkedIn (with general web search as a fallback) and
          proposes a Description and Founded year for you to approve before it writes
          anything back. Requires a browser-capable AI client (e.g. Claude Code or Cowork).
        </p>
        <a className="button is-primary" href="/company-enrichment-skill.zip" download>
          Download the Company Enrichment Skill
        </a>
      </div>

      {canGrantNetwork && (
        <div className="box">
          <h2 className="title is-6 mb-3">4. Install the Network Intelligence Skill</h2>
          <p className="mb-3">
            Internal — for loading introductions into the relationship constellation. Requires the{' '}
            <code>network:read</code>/<code>network:write</code> scopes, which you can grant when
            connecting since your account is authorized for Network Intelligence.
          </p>
          <a className="button is-primary" href="/network-intelligence-skill.zip" download>
            Download the Network Intelligence Skill
          </a>
        </div>
      )}

      <p className="has-text-grey is-size-7">
        First time doing this? The <Link href="/docs/mcp" target="_blank" rel="noopener noreferrer">step-by-step guide</Link> walks
        through both steps with no technical background assumed.
      </p>
    </div>
  )
}
