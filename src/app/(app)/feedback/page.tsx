import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FeedbackList from '@/components/FeedbackList'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/not-found')
  }

  const { data: feedbackList } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  const userIds = [...new Set((feedbackList ?? []).map((f) => f.created_by as string))]
  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds)
    profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]))
  }

  return (
    <div className="gg-detail">
      <div className="mb-6">
        <h1 className="title is-3">Feedback</h1>
        <p className="subtitle is-6 has-text-grey">
          {feedbackList?.length ?? 0} submissions from users
        </p>
      </div>

      <FeedbackList feedbackList={feedbackList ?? []} profileMap={profileMap} />
    </div>
  )
}
