import { useSearchParams } from 'react-router-dom'

const parseValue = (raw, defaultValue) => {
  if (raw === null || raw === '') return defaultValue
  if (typeof defaultValue === 'number') {
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }
  return raw
}

/**
 * Keeps table state (search, filters, sort, page) in the URL query string so a
 * refresh (or a shared link) lands back on the same view instead of resetting.
 *
 * const [table, updateTable] = useTableQueryState({
 *   search: '', department: '', sortBy: 'createdAt', sortOrder: 'DESC', page: 1,
 * })
 *
 * updateTable({ department: 'Finance' }, { resetPage: true })
 * updateTable({ page: 2 })
 */
export function useTableQueryState(defaults) {
  const [searchParams, setSearchParams] = useSearchParams()

  const state = {}
  for (const key of Object.keys(defaults)) {
    state[key] = parseValue(searchParams.get(key), defaults[key])
  }

  const updateState = (patch, { resetPage = false } = {}) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const applied = resetPage && !('page' in patch) ? { ...patch, page: defaults.page } : patch

        for (const [key, value] of Object.entries(applied)) {
          if (value === undefined || value === null || value === '' || value === defaults[key]) {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
        }
        return next
      },
      { replace: true }
    )
  }

  return [state, updateState]
}
