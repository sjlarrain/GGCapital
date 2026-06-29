export const metadata = { title: 'API Reference — GG Capital CRM' }

export default function ApiDocsPage() {
  return (
    <>
      <div id="app" />
      {/* Scalar API Reference loaded from CDN — reads openapi.json at runtime */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-prefetch */}
      <script
        id="api-reference"
        data-url="/api/v1/openapi.json"
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
      />
    </>
  )
}
