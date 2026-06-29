// Serves the Scalar API reference as a standalone HTML page, completely
// outside Next.js layouts so Bulma CSS never conflicts with Scalar's styles.
export function GET() {
  const config = JSON.stringify({
    layout: 'classic',
    darkMode: false,
    withDefaultFonts: true,
    hideModels: false,
    hideDownloadButton: false,
    customCss: `
      :root {
        --scalar-font-size-1: 13px;
        --scalar-font-size-2: 12px;
        --scalar-font-size-3: 11px;
        --scalar-sidebar-width: 220px;
      }
      .scalar-api-reference {
        font-size: 13px;
      }
      .t-doc__sidebar {
        width: 220px !important;
        min-width: 220px !important;
      }
    `,
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Reference — GG Capital CRM</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="/api/v1/openapi.json"
    data-configuration=${JSON.stringify(config)}
    src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
  ></script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
