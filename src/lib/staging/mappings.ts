/**
 * Free-text → tag mapping (stub — filled in A6).
 *
 * A6 will port the maps used by `scripts/import_bbdd.mjs` here so the agent,
 * the import script, and the server gates all map free text to catalog tag
 * values the same way. Until then this exposes the contract `rules.ts` and the
 * MCP layer will call, with a conservative default: nothing is auto-mapped, so
 * unknown free text surfaces as a `needs_info: unmapped_tag` blocking reason
 * rather than being silently invented.
 */

export type TagCatalog = 'industry' | 'region' | 'stage' | 'type' | 'status'

export interface TagMatch {
  /** Catalog id when confidently resolved, else null. */
  id: string | null
  /** Canonical catalog name of the nearest match, for the reviewer. */
  nearest: string | null
  /** True only when we resolved an exact/aliased catalog value. */
  resolved: boolean
}

const UNRESOLVED: TagMatch = { id: null, nearest: null, resolved: false }

/**
 * Map a single free-text value to a catalog tag.
 * TODO(A6): load alias maps from the shared mapping table / import script and
 * resolve against the live catalog. For now everything is unresolved.
 */
export function mapTag(catalog: TagCatalog, value: string): TagMatch {
  void catalog
  void value
  return UNRESOLVED
}
