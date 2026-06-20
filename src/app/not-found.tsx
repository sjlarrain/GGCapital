import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="gg-login-page">
      <div className="has-text-centered">
        <p className="title is-1 has-text-grey-lighter">404</p>
        <p className="subtitle is-6 has-text-grey">Page not found</p>
        <Link href="/" className="button is-primary is-small mt-4">
          Go home
        </Link>
      </div>
    </div>
  )
}
