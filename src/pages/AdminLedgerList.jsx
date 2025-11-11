import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Tooltip from '@/components/Tooltip';
import SearchIcon from '@/components/icons/SearchIcon';
import Pagination from '@/components/Pagination';
import { disposeDeviceByAdmin, fetchAdminDevices, forceReturnDeviceByAdmin } from '@/api/devices';
import { useUser } from '@/context/UserProvider';
import './AdminDeviceTables.css';

const tableColumns = [
  { key: 'categoryName', label: '품목', sortable: true },
  { key: 'id', label: '관리번호', sortable: true },
  { key: 'username', label: '사용자', sortable: true },
  { key: 'status', label: '상태', sortable: true },
  { key: 'manageDepName', label: '관리부서', sortable: true },
  { key: 'projectName', label: '프로젝트', sortable: true },
  { key: 'purpose', label: '용도', sortable: true },
  { key: 'purchaseDate', label: '구입일자', sortable: true },
  { key: 'model', label: '모델명', sortable: true },
  { key: 'company', label: '제조사', sortable: true },
  { key: 'sn', label: 'S/N', sortable: true },
  { key: 'actions', label: 'Action', sortable: false },
];

const filterableColumns = [
  { value: 'categoryName', label: '품목' },
  { value: 'id', label: '관리번호' },
  { value: 'username', label: '사용자' },
  { value: 'status', label: '상태' },
  { value: 'manageDepName', label: '관리부서' },
  { value: 'projectName', label: '프로젝트' },
  { value: 'purpose', label: '용도' },
];

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR');
};

const getDisplayUser = (device) => {
  const name = device.realUser && device.realUser.trim().length > 0
    ? device.realUser.trim()
    : device.username ?? device.user;
  return name ?? '';
};

const escapeForCsv = (value) => {
  if (value === null || value === undefined) return '';
  const text = value.toString();
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const HistoryTable = ({ history }) => {
  if (!history || history.length === 0) {
    return <span>이력 정보가 없습니다.</span>;
  }

  return (
    <table className="admin-history-table">
      <thead>
        <tr>
          <th className="admin-history-table__head admin-history-table__head--user">사용자</th>
          <th className="admin-history-table__head admin-history-table__head--type">타입</th>
          <th className="admin-history-table__head admin-history-table__head--project">프로젝트</th>
          <th className="admin-history-table__head admin-history-table__head--date">날짜</th>
        </tr>
      </thead>
      <tbody>
        {history.map((item, index) => (
          <tr key={`${item.username ?? 'unknown'}-${index}`} className="admin-history-table__row">
            <td className="admin-history-table__cell">{item.username ?? '-'}</td>
            <td className="admin-history-table__cell">{item.type ?? '-'}</td>
            <td className="admin-history-table__cell">{item.projectName ?? '-'}</td>
            <td className="admin-history-table__cell admin-history-table__cell--date">
              {item.modifiedDate ? new Date(item.modifiedDate).toLocaleString('ko-KR') : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default function AdminLedgerList() {
  const [devices, setDevices] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterKey, setFilterKey] = useState(filterableColumns[0].value);
  const [selectedFilterValue, setSelectedFilterValue] = useState('');
  const [sortKey, setSortKey] = useState('categoryName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: Math.max(0, currentPage - 1),
        size: pageSize,
        filterField: filterKey,
        sortField: sortKey,
        sortDirection,
      };
      if (debouncedSearch) {
        params.keyword = debouncedSearch;
      }
      if (selectedFilterValue) {
        params.filterValue = selectedFilterValue;
      }

      const response = await fetchAdminDevices(params);
      const content = Array.isArray(response?.content) ? response.content : [];
      const totalElements = Number(response?.totalElements ?? 0);
      const totalPagesValue = Number(response?.totalPages ?? 1);
      setDevices(content);
      setTotalItems(Number.isNaN(totalElements) ? 0 : totalElements);
      setTotalPages(Math.max(1, Number.isNaN(totalPagesValue) ? 1 : totalPagesValue));
      setMetadata(response?.metadata ?? {});
    } catch (err) {
      console.error(err);
      setError('장비 목록을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, filterKey, pageSize, selectedFilterValue, sortDirection, sortKey]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    setSelectedFilterValue('');
  }, [filterKey]);

  useEffect(() => {
    setCurrentPage((prev) => (prev === 1 ? prev : 1));
  }, [debouncedSearch, filterKey, pageSize, selectedFilterValue]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageSizeOptions = useMemo(() => {
    const raw = metadata?.pageSizeOptions;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
    }
    return [10, 25, 50];
  }, [metadata]);

  const uniqueFilterValues = useMemo(() => {
    if (filterKey === 'id') {
      return [];
    }
    const filters = metadata?.filters;
    if (filters && Array.isArray(filters[filterKey])) {
      return filters[filterKey];
    }
    return [];
  }, [metadata, filterKey]);

  useEffect(() => {
    if (selectedFilterValue && !uniqueFilterValues.includes(selectedFilterValue)) {
      setSelectedFilterValue('');
    }
  }, [selectedFilterValue, uniqueFilterValues]);

  const handlePageSizeChange = (size) => {
    if (!Number.isFinite(size)) {
      return;
    }
    setPageSize(size);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }
    setCurrentPage(page);
  };

  const toggleSort = (columnKey, sortable) => {
    if (!sortable) {
      return;
    }

    if (sortKey === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(columnKey);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const downloadCsv = useCallback(async () => {
    try {
      setIsExporting(true);

      if (totalItems === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
      }

      const targetSize = Math.max(totalItems, pageSize);
      const params = {
        page: 0,
        size: targetSize,
        filterField: filterKey,
        sortField: sortKey,
        sortDirection,
      };
      if (debouncedSearch) {
        params.keyword = debouncedSearch;
      }
      if (selectedFilterValue) {
        params.filterValue = selectedFilterValue;
      }

      const response = await fetchAdminDevices(params);
      const rowsSource = Array.isArray(response?.content) ? response.content : [];
      if (rowsSource.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
      }

      const headers = tableColumns
        .filter((column) => column.key !== 'actions')
        .map((column) => column.label)
        .join(',');

      const rows = rowsSource.map((device) => {
        const values = tableColumns
          .filter((column) => column.key !== 'actions')
          .map((column) => {
            switch (column.key) {
              case 'username':
                return getDisplayUser(device) || '-';
              case 'purchaseDate':
                return formatDate(device.purchaseDate) || '-';
              default:
                return device[column.key] ?? '-';
            }
          });
        return values.map(escapeForCsv).join(',');
      });

      const BOM = String.fromCharCode(0xfeff);
      const csvContents = [BOM + headers, ...rows].join('\r\n');
      const blob = new Blob([csvContents], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `device-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('데이터 내보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearch, filterKey, pageSize, selectedFilterValue, sortDirection, sortKey, totalItems]);

  const renderSortIndicator = (columnKey) => {
    if (sortKey !== columnKey) {
      return null;
    }
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const renderUserCell = (device) => {
    const name = getDisplayUser(device) || '-';
    // 사용자 칼럼에서는 툴팁 제거: 단순 텍스트로 표시합니다.
    return <span>{name}</span>;
  };

  const renderPurposeCell = (device) => {
    if (!device.purpose) {
      return '-';
    }

    const tooltipContent = (
      <div className="admin-tooltip-pre">
        {device.spec ? (
          <div>
            <strong>스펙</strong>
            <div>{device.spec}</div>
          </div>
        ) : null}
        {device.adminDescription ? (
          <div style={{ marginTop: device.spec ? 8 : 0 }}>{device.adminDescription}</div>
        ) : null}
      </div>
    );

    if (!device.spec && !device.adminDescription) {
      return device.purpose;
    }

    return (
      <Tooltip content={tooltipContent}>
        <span className="table-link">{device.purpose}</span>
      </Tooltip>
    );
  };

  const renderHistoryCell = (device) => {
    if (!device.history || device.history.length === 0) {
      return device.id;
    }

    return (
      <Tooltip content={<HistoryTable history={device.history} />}>
        <span className="table-link">{device.id}</span>
      </Tooltip>
    );
  };

  const handleDispose = async (device) => {
    if (!window.confirm(`정말로 장비 "${device.id}" 를 폐기 처리하시겠습니까?`)) {
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      const operatorUsername = user?.profile?.preferred_username || user?.profile?.email || null;
      const payload = operatorUsername ? { operatorUsername } : {};
      await disposeDeviceByAdmin(device.id, payload);
      alert('폐기 처리되었습니다.');
      await loadDevices();
    } catch (err) {
      console.error(err);
      setError('폐기 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceReturn = async (device) => {
    if (!window.confirm(`장비 "${device.id}" 를 즉시 반납 처리하시겠습니까?`)) {
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      const operatorUsername = user?.profile?.preferred_username || user?.profile?.email || null;
      const payload = operatorUsername ? { operatorUsername } : {};
      await forceReturnDeviceByAdmin(device.id, payload);
      alert('강제 반납 처리되었습니다.');
      await loadDevices();
    } catch (err) {
      console.error(err);
      setError('강제 반납 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="card admin-device-page">
      <div className="card-header admin-card-header">
        <div>
          <h2>장비 리스트</h2>
          <p className="muted">관리자는 가용 장비와 대여 중인 장비를 한 눈에 확인할 수 있습니다.</p>
        </div>
        <div className="card-actions admin-card-actions">
          <button
            type="button"
            className="secondary"
            onClick={downloadCsv}
            disabled={isProcessing || isExporting}
          >
            Export
          </button>
          <Link to="/admin/register" className="primary">장비 등록</Link>
        </div>
      </div>

      <div className="card-controls">
        <div className="filter-row">
          <select
            value={filterKey}
            onChange={(event) => setFilterKey(event.target.value)}
            className="filter-select"
          >
            {filterableColumns.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="search-group">
            <span className="search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="search"
              className="search-input"
              placeholder="검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {uniqueFilterValues.length > 0 && (
          <div className="chip-row" role="group" aria-label="상세 필터">
            <button
              type="button"
              className={`chip ${selectedFilterValue === '' ? 'chip-active' : ''}`}
              onClick={() => setSelectedFilterValue('')}
            >
              전체
            </button>
            {uniqueFilterValues.map((value) => (
              <button
                type="button"
                key={value}
                className={`chip ${selectedFilterValue === value ? 'chip-active' : ''}`}
                onClick={() => setSelectedFilterValue(value)}
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && <p>불러오는 중입니다...</p>}
      {error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {tableColumns.map((column) => (
                    <th
                      key={column.key}
                      onClick={() => toggleSort(column.key, column.sortable)}
                      className={column.sortable ? 'sortable-header' : undefined}
                    >
                      {column.label}
                      {renderSortIndicator(column.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="empty">
                      조건에 맞는 장비가 없습니다.
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.categoryName ?? '-'}</td>
                      <td>{renderHistoryCell(device)}</td>
                      <td>{renderUserCell(device)}</td>
                      <td>{device.status ?? '-'}</td>
                      <td>{device.manageDepName ?? '-'}</td>
                      <td>{device.projectName ?? '-'}</td>
                      <td>{renderPurposeCell(device)}</td>
                      <td>{formatDate(device.purchaseDate) || '-'}</td>
                      <td>{device.model ?? '-'}</td>
                      <td>{device.company ?? '-'}</td>
                      <td>{device.sn ?? '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => navigate(`/admin/edit/${device.id}`)}
                            disabled={isProcessing}
                          >
                            편집
                          </button>
                          {device.isUsable === false && device.status !== '폐기' && (
                            <button
                              type="button"
                              className="outline"
                              onClick={() => handleForceReturn(device)}
                              disabled={isProcessing}
                            >
                              강제 반납
                            </button>
                          )}
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDispose(device)}
                            disabled={isProcessing}
                          >
                            폐기
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            totalItems={totalItems}
            disabled={isProcessing}
          />
        </>
      )}
    </div>
  );
}
