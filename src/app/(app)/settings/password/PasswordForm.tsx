'use client'
import { useActionState } from 'react'
import { changePassword } from '@/lib/actions/auth'

type State = { success?: boolean; error?: string } | null

export default function PasswordForm() {
  const [state, action, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const newPassword = formData.get('new_password') as string
      const confirm    = formData.get('confirm_password') as string
      if (newPassword !== confirm) return { error: 'Passwords do not match.' }
      if (newPassword.length < 8)  return { error: 'Password must be at least 8 characters.' }
      try {
        await changePassword(newPassword)
        return { success: true }
      } catch (e) {
        return { error: String(e) }
      }
    },
    null
  )

  return (
    <form action={action} style={{ maxWidth: 400 }}>
      <div className="field">
        <label className="label">New password</label>
        <div className="control">
          <input
            className="input"
            type="password"
            name="new_password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="field">
        <label className="label">Confirm new password</label>
        <div className="control">
          <input
            className="input"
            type="password"
            name="confirm_password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      {state?.error && (
        <div className="notification is-danger is-light">{state.error}</div>
      )}
      {state?.success && (
        <div className="notification is-success is-light">Password updated successfully.</div>
      )}

      <div className="field">
        <div className="control">
          <button className="button is-primary" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </div>
    </form>
  )
}
