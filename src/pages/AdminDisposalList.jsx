import { useCallback, useEffect, useMemo, useState } from 'react';
import Tooltip from '@/components/Tooltip';
import { fetchDisposedDevices, recoverDeviceByAdmin } from '@/api/devices';
import { useUser } from '@/context/UserProvider';

const tableColumns = [
  { key: 'categoryName', label: '품목', sortable: true },
  { key: 'id', label: '관리번호', sortable: true },
  { key: 'username', label: '사용자', sortable: true },
  { key: 'manageDepName', label: '관리부서', sortable: true },
  { key: 'projectName', label: '프로젝트', sortable: true },
  { key: 'purpose', label: '용도', sortable: true },
  { key: 'purchaseDate', label: '구입일자', sortable: true },
  { key: 'model', label: '모델명', sortable: true },
  { key: 'company', label: '제조사', sortable: true },
  { key: 'sn', label: 'S/N', sortable: true },
  { key: 'description', label: '비고', sortable: false },
  { key: 'actions', label: 'Action', sortable: false },
];

const filterableColumns = [
  { value: 'categoryName', label: '품목' },
  { value: 'id', label: '관리번호' },
  { value: 'username', label: '사용자' },
  { value: 'manageDepName', label: '관리부서' },
  { value: 'projectName', label: '프로젝트' },
  { value: 'purpose', label: '용도' },
  { value: 'company', label: '제조사' },
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

const getFilterValue = (device, key) => {
  switch (key) {
    case 'username':
      return getDisplayUser(device);
    case 'purchaseDate':
      return formatDate(device.purchaseDate);
    default:
      return device[key] ?? '';
  }
};

const getComparableValue = (device, key) => {
  switch (key) {
    case 'purchaseDate': {
      const date = device.purchaseDate ? new Date(device.purchaseDate) : null;
      return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
    }
    case 'username':
      return getDisplayUser(device).toLowerCase();
    case 'price':
      return typeof device.price === 'number' ? device.price : 0;
    default: {
      const value = device[key];
      if (value === null || value === undefined) {
        return '';
      }
      return value.toString().toLowerCase();
    }
  }
};

const escapeForCsv = (value) => {
  if (value === null || value === undefined) return '';
  const text = value.toString();
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const historyTableStyles = {
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    color: '#f9fafb',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.35)',
  },
  headCell: {
    textAlign: 'left',
    padding: '6px 10px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },
  bodyCell: {
    padding: '6px 10px',
    fontSize: '13px',
    color: '#f3f4f6',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
};

const historyRowStyle = (index) => ({
  backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
});

const HistoryTable = ({ history }) => {
  if (!history || history.length === 0) {
    return <span>이력 정보가 없습니다.</span>;
  }

  return (
    <table className="history-table" style={historyTableStyles.table}>
      <thead>
        <tr>
          <th style={{ ...historyTableStyles.headCell, width: '15%' }}>사용자</th>
          <th style={{ ...historyTableStyles.headCell, width: '15%' }}>타입</th>
          <th style={{ ...historyTableStyles.headCell, width: '40%' }}>프로젝트</th>
          <th style={{ ...historyTableStyles.headCell, width: '30%' }}>날짜</th>
        </tr>
      </thead>
      <tbody>
        {history.map((item, index) => (
          <tr key={`${item.username ?? 'unknown'}-${index}`} style={historyRowStyle(index)}>
            <td style={historyTableStyles.bodyCell}>{item.username ?? '-'}</td>
            <td style={historyTableStyles.bodyCell}>{item.type ?? '-'}</td>
            <td style={historyTableStyles.bodyCell}>{item.projectName ?? '-'}</td>
            <td style={{ ...historyTableStyles.bodyCell, color: '#e5e7eb' }}>
              {item.modifiedDate ? new Date(item.modifiedDate).toLocaleString('ko-KR') : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default function AdminDisposalList() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState(filterableColumns[0].value);
  const [selectedFilterValue, setSelectedFilterValue] = useState('');
  const [sortKey, setSortKey] = useState('categoryName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchDisposedDevices();
      setDevices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('폐기 장비 목록을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    setSelectedFilterValue('');
  }, [filterKey]);

  const uniqueFilterValues = useMemo(() => {
    if (filterKey === 'id') {
      return [];
    }
    const values = devices
      .map((device) => getFilterValue(device, filterKey))
      .filter((value) => value !== null && value !== undefined && `${value}`.trim().length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [devices, filterKey]);

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return devices.filter((device) => {
      if (selectedFilterValue) {
        const value = getFilterValue(device, filterKey);
        if (value !== selectedFilterValue) {
          return false;
        }
      }

      if (!keyword) {
        return true;
      }

      const target = getFilterValue(device, filterKey);
      return target && target.toString().toLowerCase().includes(keyword);
    });
  }, [devices, filterKey, search, selectedFilterValue]);

  const sortedDevices = useMemo(() => {
    const copy = [...filteredDevices];
    if (!sortKey) {
      return copy;
    }

    copy.sort((a, b) => {
      const valueA = getComparableValue(a, sortKey);
      const valueB = getComparableValue(b, sortKey);
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredDevices, sortDirection, sortKey]);

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
  };

  const downloadCsv = () => {
    if (sortedDevices.length === 0) {
      return;
    }

    const headers = tableColumns
      .filter((column) => column.key !== 'actions')
      .map((column) => column.label)
      .join(',');

    const rows = sortedDevices.map((device) => {
      const values = tableColumns
        .filter((column) => column.key !== 'actions')
        .map((column) => {
          switch (column.key) {
            case 'username':
              return getDisplayUser(device) || '-';
            case 'purchaseDate':
              return formatDate(device.purchaseDate) || '-';
            case 'description':
              return device.description ?? '-';
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
    anchor.download = `disposed-devices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const renderSortIndicator = (columnKey) => {
    if (sortKey !== columnKey) {
      return null;
    }
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const renderHistoryCell = (device) => {
    if (!device.history || device.history.length === 0) {
      return device.id ?? '-';
    }

    return (
      <Tooltip content={<HistoryTable history={device.history} />}>
        <span className="table-link">{device.id}</span>
      </Tooltip>
    );
  };

  const renderPurposeCell = (device) => {
    if (!device.purpose) {
      return '-';
    }

    const tooltipContent = (
      <div style={{ whiteSpace: 'pre-wrap' }}>
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

  const renderDescriptionCell = (device) => {
    if (!device.description) {
      return '-';
    }

    if (device.description.length < 30) {
      return device.description;
    }

    return (
      <Tooltip content={<div style={{ whiteSpace: 'pre-wrap' }}>{device.description}</div>}>
        <span className="table-link">자세히</span>
      </Tooltip>
    );
  };

  const renderUserCell = (device) => {
    const name = getDisplayUser(device) || '-';
    return name;
  };

  const handleRecover = async (device) => {
    if (!window.confirm(`장비 "${device.id}" 을(를) 복구 처리하시겠습니까?`)) {
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      const operatorUsername = user?.profile?.preferred_username || user?.profile?.email || null;
      const payload = operatorUsername ? { operatorUsername } : {};
      await recoverDeviceByAdmin(device.id, payload);
      alert('복구 처리되었습니다.');
      await loadDevices();
    } catch (err) {
      console.error(err);
      setError('복구 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ gap: 16 }}>
        <div>
          <h2>폐기 장비 리스트</h2>
          <p className="muted">폐기된 장비 이력을 확인하고 필요한 경우 복구할 수 있습니다.</p>
        </div>
        <div className="card-actions" style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={downloadCsv} disabled={isProcessing}>
            Export
          </button>
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
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => toggleSort(column.key, column.sortable)}
                    style={{ cursor: column.sortable ? 'pointer' : 'default' }}
                  >
                    {column.label}
                    {renderSortIndicator(column.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDevices.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="empty">
                    조건에 맞는 폐기 장비가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedDevices.map((device) => (
                  <tr key={device.id}>
                    <td>{device.categoryName ?? '-'}</td>
                    <td>{renderHistoryCell(device)}</td>
                    <td>{renderUserCell(device)}</td>
                    <td>{device.manageDepName ?? device.manageDep ?? '-'}</td>
                    <td>{device.projectName ?? device.project ?? '-'}</td>
                    <td>{renderPurposeCell(device)}</td>
                    <td>{formatDate(device.purchaseDate) || '-'}</td>
                    <td>{device.model ?? '-'}</td>
                    <td>{device.company ?? '-'}</td>
                    <td>{device.sn ?? '-'}</td>
                    <td>{renderDescriptionCell(device)}</td>
                    <td>
                      <div className="table-actions" style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => handleRecover(device)}
                          disabled={isProcessing}
                        >
                          복구
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11 4a7 7 0 1 1-4.95 11.95A7 7 0 0 1 11 4Zm0-2a9 9 0 1 0 5.66 15.86l4.24 4.24a1 1 0 1 0 1.41-1.41l-4.24-4.24A9 9 0 0 0 11 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
