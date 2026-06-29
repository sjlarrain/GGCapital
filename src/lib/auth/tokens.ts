import { createHash, randomBytes } from 'crypto'

const PREFIX = 'ggc_'

export function mintToken(): { raw: string; hash: string } {
  const raw = PREFIX + randomBytes(32).toString('hex')
  return { raw, hash: hashToken(raw) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isPAT(token: string): boolean {
  return token.startsWith(PREFIX)
}
