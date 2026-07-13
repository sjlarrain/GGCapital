import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isNetworkUser } from '@/lib/network/allowlist'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  // /settings/mcp and /docs/mcp are reachable by admins (rollout/testing) OR
  // network-allowlisted users (who may not be admins, but need the connector
  // instructions + Network Intelligence Skill download).
  const showMcp = isAdmin || isNetworkUser(user!.id)

  return (
    <div className="container" style={{ maxWidth: 640, padding: '2rem 1rem' }}>
      <h1 className="title is-4 mb-5">Settings</h1>

      <div className="columns is-multiline">
        <div className="column is-full">
          <Link href="/settings/password" className="box" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔐</span>
              <div>
                <p className="has-text-weight-semibold">Change Password</p>
                <p className="has-text-grey is-size-7">Update your account password.</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="column is-full">
          <Link href="/settings/tokens" className="box" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔑</span>
              <div>
                <p className="has-text-weight-semibold">API Tokens</p>
                <p className="has-text-grey is-size-7">Create and revoke personal access tokens for the REST API.</p>
              </div>
            </div>
          </Link>
        </div>

        {showMcp && (
          <div className="column is-full">
            <Link href="/settings/mcp" className="box" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <div>
                  <p className="has-text-weight-semibold">AI Agent (MCP)</p>
                  <p className="has-text-grey is-size-7">Connect Claude / Cowork and download Skills.</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        <div className="column is-full">
          <a href="/docs/api" target="_blank" rel="noopener noreferrer" className="box" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📄</span>
              <div>
                <p className="has-text-weight-semibold">API Documentation <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>↗</span></p>
                <p className="has-text-grey is-size-7">OpenAPI reference for all CRM endpoints.</p>
              </div>
            </div>
          </a>
        </div>

        {showMcp && (
          <div className="column is-full">
            <a href="/docs/mcp" target="_blank" rel="noopener noreferrer" className="box" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📘</span>
                <div>
                  <p className="has-text-weight-semibold">AI Agent Setup Guide <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>↗</span></p>
                  <p className="has-text-grey is-size-7">Step-by-step manual for connecting an AI agent — no technical background needed.</p>
                </div>
              </div>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
