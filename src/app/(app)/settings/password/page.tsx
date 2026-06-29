import Link from 'next/link'
import PasswordForm from './PasswordForm'

export default function ChangePasswordPage() {
  return (
    <div className="container" style={{ maxWidth: 640, padding: '2rem 1rem' }}>
      <Link href="/settings" className="has-text-grey is-size-7" style={{ textDecoration: 'none' }}>
        ← Settings
      </Link>
      <h1 className="title is-4 mt-3 mb-5">Change Password</h1>
      <PasswordForm />
    </div>
  )
}
