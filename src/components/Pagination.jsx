import React from 'react';
import './Pagination.css';

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
    <div className="pagination-wrapper">
      <div className="pagination-info">
        <span className="muted">총 {totalItems}건</span>
        <label className="pagination-size-label">
          <span className="muted">페이지당</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="pagination-select"
            disabled={disabled}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || disabled}
          className="pagination-button"
        >
          {'<<'}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1 || disabled}
          className="pagination-button"
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
              className={`pagination-button${isActive ? ' is-active' : ''}`}
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
          className="pagination-button"
        >
          {'>'}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || disabled}
          className="pagination-button"
        >
          {'>>'}
        </button>
      </div>
    </div>
  );
}
