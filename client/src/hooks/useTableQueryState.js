import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

const STORAGE_PREFIX = 'tableState:'

const parseValue = (raw, defaultValue) => {
  if (raw === null || raw === '') return defaultValue
  if (typeof defaultValue === 'number') {
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }
  return raw
}

const readStored = (pathname, keys) => {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + pathname)
    if (!raw) return null
    const saved = JSON.parse(raw)
    const params = new URLSearchParams()
    for (const key of keys) {
      if (saved[key] !== undefined) params.set(key, String(saved[key]))
    }
    return params.toString() ? params : null
  } catch {
    return null
  }
}

const writeStored = (pathname, params, keys) => {
  try {
    const saved = {}
    for (const key of keys) {
      if (params.has(key)) saved[key] = params.get(key)
    }
    if (Object.keys(saved).length) {
      sessionStorage.setItem(STORAGE_PREFIX + pathname, JSON.stringify(saved))
    } else {
      sessionStorage.removeItem(STORAGE_PREFIX + pathname)
    }
  } catch {
    // Storage can be unavailable (private mode); the URL still carries the state.
  }
}

// Call on logout so the next user does not inherit the previous user's table views.
export const clearTableStates = () => {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key))
  } catch {
    // ignore
  }
}

/**
 * Keeps table state (search, filters, sort, page) so the view survives both a
 * refresh and navigating to another page and back.
 *
 * - The URL query string is the source of truth (shareable, survives refresh).
 * - The last state is also saved per page in sessionStorage; when you come back
 *   to a page whose URL has no table params (e.g. via the sidebar), it is restored.
 *
 * const [table, updateTable] = useTableQueryState({
 *   search: '', department: '', sortBy: 'createdAt', sortOrder: 'DESC', page: 1,
 * })
 *
 * updateTable({ department: 'Finance' }, { resetPage: true })
 * updateTable({ page: 2 })
 */
export function useTableQueryState(defaults) {
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const keys = Object.keys(defaults)
  const urlHasState = keys.some((key) => searchParams.has(key))

  // State restored from storage that the URL has not caught up with yet.
  const restoredRef = useRef(undefined)
  if (restoredRef.current === undefined) {
    restoredRef.current = urlHasState ? null : readStored(pathname, keys)
  }
  if (urlHasState && restoredRef.current) {
    restoredRef.current = null
  }

  const source = restoredRef.current || searchParams

  const state = {}
  for (const key of keys) {
    state[key] = parseValue(source.get(key), defaults[key])
  }

  useEffect(() => {
    const restored = restoredRef.current
    if (!restored) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of restored) next.set(key, value)
        return next
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Remember state that arrived through the URL (refresh, shared link).
  useEffect(() => {
    if (urlHasState) writeStored(pathname, searchParams, keys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()])

  const updateState = (patch, { resetPage = false } = {}) => {
    const pendingRestore = restoredRef.current
    restoredRef.current = null

    setSearchParams(
      (prev) => {
        const prevHasState = keys.some((key) => prev.has(key))
        const next = new URLSearchParams(prevHasState || !pendingRestore ? prev : pendingRestore)

        // Only jump back to page 1 when a filter/search/sort value really changed.
        // (Debounced search effects call this on mount with an unchanged value.)
        const changed = Object.entries(patch).some(([key, value]) => {
          const incoming = value === undefined || value === null || value === '' ? defaults[key] : value
          return String(incoming) !== String(parseValue(next.get(key), defaults[key]))
        })
        const applied = resetPage && changed && !('page' in patch) ? { ...patch, page: defaults.page } : patch

        for (const [key, value] of Object.entries(applied)) {
          if (value === undefined || value === null || value === '' || value === defaults[key]) {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
        }

        writeStored(pathname, next, keys)
        return next
      },
      { replace: true }
    )
  }

  return [state, updateState]
}
