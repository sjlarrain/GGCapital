import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFeedback } from '@/lib/actions/interactions'
import { formatDate } from '@/lib/utils'
import FeedbackForm from '@/components/FeedbackForm'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  // Admin-only route — return 404 for non-admins per spec
  if (profile?.role !== 'admin') {
    redirect('/not-found')
  }

  const feedbackList = await getFeedback()

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>

      <FeedbackForm userId={user!.id} />

      <div className="space-y-3">
        {feedbackList.length === 0 && (
          <p className="text-sm text-gray-400">No feedback submitted yet.</p>
        )}
        {feedbackList.map((f) => (
          <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-800">{f.description}</p>
            <p className="text-xs text-gray-400 mt-2">{formatDate(f.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
