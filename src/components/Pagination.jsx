import React from 'react';

const buildPageNumbers = (currentPage, totalPages, windowSize = 5) => {
  if (totalPages <= 0) return [1];
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }
  const pages = [];
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
};

const paginationStyles = {
  wrapper: {
    marginTop: 16,
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoGroup: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    color: '#f9fafb',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    borderRadius: 8,
    padding: '6px 12px',
    minWidth: 44,
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.12s ease',
    cursor: 'pointer',
  },
  buttonActive: {
    /* Make the active (current) page visually distinct (gray) so users can
       immediately see which page they're on. Keep it non-clickable look. */
    backgroundColor: '#e5e7eb',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#111827',
    boxShadow: 'none',
    cursor: 'default',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    filter: 'grayscale(20%)',
  },
  select: {
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    color: '#f9fafb',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    borderRadius: 8,
    padding: '4px 10px',
  },
};

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  onPageChange = () => {},
  onPageSizeChange = () => {},
  totalItems = 0,
  disabled = false,
}) {
  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div style={paginationStyles.wrapper}>
      <div style={paginationStyles.infoGroup}>
        <span className="muted">총 {totalItems}건</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted">페이지당</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={paginationStyles.select}
            disabled={disabled}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={paginationStyles.controlsGroup}>
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || disabled}
          style={{
            ...paginationStyles.button,
            ...(currentPage === 1 || disabled ? paginationStyles.buttonDisabled : {}),
          }}
        >
          {'<<'}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1 || disabled}
          style={{
            ...paginationStyles.button,
            ...(currentPage === 1 || disabled ? paginationStyles.buttonDisabled : {}),
          }}
        >
          {'<'}
        </button>

        {pages.map((page) => {
          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              style={{
                ...paginationStyles.button,
                ...(isActive ? paginationStyles.buttonActive : {}),
                ...(disabled ? paginationStyles.buttonDisabled : {}),
              }}
              aria-current={isActive ? 'page' : undefined}
              disabled={isActive || disabled}
            >
              {page}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages || disabled}
          style={{
            ...paginationStyles.button,
            ...(currentPage === totalPages || disabled ? paginationStyles.buttonDisabled : {}),
          }}
        >
          {'>'}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || disabled}
          style={{
            ...paginationStyles.button,
            ...(currentPage === totalPages || disabled ? paginationStyles.buttonDisabled : {}),
          }}
        >
          {'>>'}
        </button>
      </div>
    </div>
  );
}
