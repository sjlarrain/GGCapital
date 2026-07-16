import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Connecting an AI Agent — GG Capital CRM',
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="box mb-4">
      <h3 className="title is-6 mb-3">
        <span
          className="tag is-primary is-rounded mr-2"
          style={{ minWidth: '1.5rem' }}
        >
          {n}
        </span>
        {title}
      </h3>
      {children}
    </div>
  )
}

export default async function McpGuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="container" style={{ maxWidth: 760, padding: '2.5rem 1rem 4rem' }}>
      <p className="mb-2">
        <Link href="/settings/mcp" className="has-text-grey is-size-7" style={{ textDecoration: 'none' }}>
          ← AI Agent (MCP) settings
        </Link>
      </p>
      <h1 className="title is-3 mb-2">Connecting an AI Agent to the CRM</h1>
      <p className="subtitle is-6 mb-5">
        A plain-language guide to letting Claude (or another MCP-compatible AI agent) read and
        update the GG Capital CRM on your behalf. No coding required.
      </p>

      <div className="notification is-light mb-5">
        <p className="mb-2"><strong>Two different things live under Settings, and it&apos;s easy to mix them up:</strong></p>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem' }}>
          <li className="mb-1">
            <strong>API Tokens</strong> — for developers writing their own scripts against the
            REST API. You won&apos;t need this to connect an AI agent.
          </li>
          <li>
            <strong>AI Agent (MCP)</strong> — what this guide covers. You connect as yourself by
            signing in, the same way you sign in to the CRM in a browser. There is no token or
            secret key to copy anywhere.
          </li>
        </ul>
      </div>

      <h2 className="title is-5 mb-3">What you&apos;ll need</h2>
      <ul className="mb-5" style={{ listStyle: 'disc', paddingLeft: '1.25rem' }}>
        <li className="mb-1">A GG Capital CRM account (the one you use to log in here).</li>
        <li className="mb-1">
          An AI client that supports MCP &quot;connectors&quot; or &quot;integrations&quot; — for example
          Claude.ai, Claude Desktop, or Cowork. (MCP stands for <em>Model Context Protocol</em> —
          it&apos;s the standard way AI apps connect to outside tools like this CRM.)
        </li>
      </ul>

      <h2 className="title is-5 mb-3">Part 1 — Connect the agent</h2>

      <Step n={1} title="Get the connector address">
        <p>
          Open <Link href="/settings/mcp">Settings → AI Agent (MCP)</Link> in the CRM and copy
          the address shown there. It looks like a website address ending in <code>/api/mcp</code>.
        </p>
      </Step>

      <Step n={2} title="Add it in your AI client">
        <p className="mb-2">
          In your AI client, look for a section called <strong>Connectors</strong>,{' '}
          <strong>Integrations</strong>, or <strong>MCP servers</strong> (usually under the
          app&apos;s Settings menu). Choose to add a new / custom connector and paste in the
          address from Step 1.
        </p>
        <p className="has-text-grey is-size-7">
          Exact menu names vary slightly between Claude.ai, Claude Desktop, and Cowork, and
          change over time — if you can&apos;t find it, search the client&apos;s help docs for
          &quot;MCP connector&quot; or &quot;custom connector&quot;.
        </p>
      </Step>

      <Step n={3} title="Sign in and approve access">
        <p>
          A browser window will pop up asking you to log in to GG Capital (if you aren&apos;t
          already) and then approve the connection. This is the <strong>only</strong> sign-in
          step — once approved, the agent acts as you, with your own permissions. If you ever
          want to disconnect it, remove the connector from your AI client&apos;s settings, or
          revoke access from your account.
        </p>
      </Step>

      <h2 className="title is-5 mb-3 mt-6">Part 2 — Install a Skill (recommended)</h2>
      <p className="mb-4">
        The connector alone lets an agent read and write CRM records. A <strong>Skill</strong>{' '}
        is a set of instructions that teaches it to do a specific job well.{' '}
        <Link href="/settings/mcp">Settings → AI Agent (MCP)</Link> has a &quot;Which skill do I
        need?&quot; table and a download button for each — install whichever ones are relevant to
        you (you can install more than one):
      </p>
      <ul className="mb-4" style={{ listStyle: 'disc', paddingLeft: '1.25rem' }}>
        <li className="mb-1">
          <strong>CRM Skill</strong> — general add/enrich/de-duplicate work: uses the right tags,
          fills required fields, and sends anything it&apos;s unsure about to <strong>Triage</strong>{' '}
          for a human to check instead of guessing.
        </li>
        <li className="mb-1">
          <strong>Company Enrichment Skill</strong> — fills in one company/fund&apos;s Description
          and Founded year by browsing its LinkedIn page live (you may need to log in yourself
          when the agent hits a sign-in wall) and proposing the values for your approval before
          writing anything.
        </li>
      </ul>

      <Step n={4} title="Download the Skill(s) you need">
        <p>
          From <Link href="/settings/mcp">Settings → AI Agent (MCP)</Link>, click the download
          button for each skill you want. Each saves a small <code>.zip</code> file to your
          computer — it doesn&apos;t contain any of your data, only instructions for the agent.
        </p>
      </Step>

      <Step n={5} title="Upload it to your AI client">
        <p>
          Look for a <strong>Skills</strong> or <strong>Capabilities</strong> section in your AI
          client&apos;s settings and upload the <code>.zip</code> file(s) you just downloaded.
        </p>
        <p className="has-text-grey is-size-7">
          It doesn&apos;t matter where you save it — your browser&apos;s default{' '}
          <strong>Downloads</strong> folder is fine. Once it&apos;s uploaded to your AI client,
          you can delete the file; it&apos;s only read at upload time.
        </p>
      </Step>

      <h2 className="title is-5 mb-3 mt-6">Try it</h2>
      <p className="mb-2">Once connected, you can ask the agent things like:</p>
      <ul className="mb-5" style={{ listStyle: 'disc', paddingLeft: '1.25rem' }}>
        <li className="mb-1">&quot;Add a contact for Jane Doe at Acme Ventures, jane@acme.vc&quot;</li>
        <li className="mb-1">&quot;Here&apos;s a list of 20 companies from a CSV — add the ones that aren&apos;t already in the CRM&quot;</li>
        <li className="mb-1">&quot;Log a meeting with Acme Ventures from yesterday, notes attached&quot;</li>
        <li className="mb-1">&quot;Look up Acme Ventures on LinkedIn and fill in its description and founded year&quot; (Company Enrichment Skill)</li>
      </ul>

      <h2 className="title is-5 mb-3">Is this safe?</h2>
      <ul className="mb-5" style={{ listStyle: 'disc', paddingLeft: '1.25rem' }}>
        <li className="mb-1">The agent only has the same permissions your account already has.</li>
        <li className="mb-1">
          Anything the agent isn&apos;t confident about — an unclear tag, a possible duplicate, a
          missing field — is staged in <strong>Triage</strong> for a person to approve, rather
          than written straight to the live CRM.
        </li>
        <li className="mb-1">You can disconnect the connector at any time from your AI client&apos;s settings.</li>
      </ul>

      <h2 className="title is-5 mb-3">Troubleshooting</h2>
      <div className="content">
        <p><strong>The browser sign-in window never appears.</strong> Check your AI client allows pop-ups, then try adding the connector again.</p>
        <p><strong>I approved access but the agent says it can&apos;t find anything.</strong> Make sure the connector address ends in <code>/api/mcp</code> exactly as shown in Settings.</p>
        <p><strong>My data isn&apos;t showing up after the agent added it.</strong> Check the <Link href="/triage">Triage</Link> queue — the agent may have staged it for review instead of creating it directly.</p>
      </div>
    </div>
  )
}
