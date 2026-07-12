import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listApiTokens } from '@/lib/actions/tokens'
import { isNetworkUser } from '@/lib/network/allowlist'
import TokensClient from './TokensClient'

export default async function TokensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const tokens = await listApiTokens()

  return (
    <TokensClient
      initialTokens={tokens as Parameters<typeof TokensClient>[0]['initialTokens']}
      userRole={(profile?.role ?? 'user') as 'admin' | 'user'}
      canGrantNetwork={isNetworkUser(user.id)}
    />
  )
}
