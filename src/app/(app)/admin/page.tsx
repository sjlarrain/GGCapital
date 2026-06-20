import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InviteForm from '@/components/InviteForm'

export default async function AdminPage() {
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

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at')

  return (
    <div className="gg-detail">
      <div className="mb-6">
        <h1 className="title is-3">Admin</h1>
      </div>

      <div className="box mb-5">
        <p className="is-size-6 has-text-weight-semibold mb-4">Invite user</p>
        <InviteForm />
      </div>

      <div className="box">
        <p className="is-size-6 has-text-weight-semibold mb-4">
          Users ({users?.length ?? 0})
        </p>
        <table className="table is-fullwidth">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <span className={`tag ${u.role === 'admin' ? 'is-primary is-light' : 'is-light'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="is-size-7 has-text-grey">
                  {new Date(u.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
