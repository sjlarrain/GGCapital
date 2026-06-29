import type { ZodSchema } from 'zod'

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T | Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    return Response.json({ error: 'Validation error', details: result.error.flatten() }, { status: 422 })
  }
  return result.data
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response
}
