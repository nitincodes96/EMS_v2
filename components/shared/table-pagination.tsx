"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** Number of page buttons rendered around the current page. */
const WINDOW = 5

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Pass alongside onPageSizeChange to show a "rows per page" selector. */
  pageSizeOptions?: number[]
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  const pages = useMemo(() => {
    const end = Math.min(pageCount, Math.max(1, page - Math.floor(WINDOW / 2)) + WINDOW - 1)
    const start = Math.max(1, end - WINDOW + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, pageCount])

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-500">
          {total === 0 ? (
            "No records"
          ) : (
            <>
              Showing <span className="font-medium text-slate-700">{first}</span>–
              <span className="font-medium text-slate-700">{last}</span> of{" "}
              <span className="font-medium text-slate-700">{total}</span>
            </>
          )}
        </p>

        {pageSizeOptions && onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 outline-none focus:border-indigo-400"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageButton>

        {pages.map((p) => (
          <PageButton key={p} onClick={() => onPageChange(p)} active={p === page} label={`Page ${p}`}>
            {p}
          </PageButton>
        ))}

        <PageButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageButton>
      </div>
    </div>
  )
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-500"
      )}
    >
      {children}
    </button>
  )
}
