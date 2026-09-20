import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const getPageNumbers = (current, total) => {
  const delta = 1
  const range = []

  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i += 1) {
    range.push(i)
  }

  if (current - delta > 2) range.unshift('...')
  if (current + delta < total - 1) range.push('...')

  range.unshift(1)
  if (total > 1) range.push(total)

  return range
}

function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null

  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row">
      <span>
        Showing {start}-{end} of {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiChevronLeft size={16} />
        </button>

        {pageNumbers.map((p, index) =>
          p === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition ${
                p === page
                  ? 'bg-quaternary text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default Pagination
