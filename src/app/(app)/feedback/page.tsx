import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

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
  let profileMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds)
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p.email]))
  }

  return (
    <div className="gg-detail">
      <div className="mb-6">
        <h1 className="title is-3">Feedback</h1>
        <p className="subtitle is-6 has-text-grey">
          {feedbackList?.length ?? 0} submissions from users
        </p>
      </div>

      {(feedbackList ?? []).length === 0 && (
        <div className="notification is-light">
          No feedback submitted yet.
        </div>
      )}

      <div>
        {(feedbackList ?? []).map((f) => (
          <div key={f.id} className="box mb-3">
            <p className="mb-3" style={{ whiteSpace: 'pre-wrap' }}>{f.description}</p>
            <div className="level is-mobile">
              <div className="level-left">
                <span className="tag is-light is-size-7">
                  {profileMap.get(f.created_by as string) ?? 'Unknown user'}
                </span>
              </div>
              <div className="level-right">
                <span className="is-size-7 has-text-grey">{formatDate(f.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
