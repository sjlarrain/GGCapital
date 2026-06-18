import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="text-gray-600 mt-2">Page not found</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
          Go home
        </Link>
      </div>
    </div>
  )
}
