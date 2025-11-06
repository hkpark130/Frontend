import { useCallback, useEffect, useMemo, useState } from 'react';
import SearchIcon from '@/components/icons/SearchIcon';
import { fetchLdapUsers } from '@/api/ldapUsers';

const FILTER_OPTIONS = [
  { value: 'ou', label: '부서' },
  { value: 'cn', label: '유저 아이디' },
  { value: 'uid', label: '유저 이름' },
  { value: 'uidNumber', label: '사원번호' },
];

export default function LdapUserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterField, setFilterField] = useState('ou');
  const [search, setSearch] = useState('');
  const [chipValue, setChipValue] = useState('ALL');

  const [sortKey, setSortKey] = useState('uidNumber');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLdapUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('LDAP 유저 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const chipOptions = useMemo(() => {
    if (filterField === 'ou') {
      return ['ALL', ...Array.from(new Set(users.map((u) => u?.ou).filter(Boolean))).sort()];
    }
    if (filterField === 'uidNumber') {
      return ['ALL'];
    }
    if (filterField === 'uid') {
      return ['ALL'];
    }
    if (filterField === 'cn') {
      return ['ALL'];
    }
    return ['ALL'];
  }, [filterField, users]);

  useEffect(() => {
    setChipValue('ALL');
  }, [filterField]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const list = users.filter((user) => {
      if (chipValue !== 'ALL') {
        if (filterField === 'ou' && (user.ou ?? '') !== chipValue) return false;
      }

      if (!keyword) return true;

      const value = (() => {
        if (filterField === 'uidNumber') return user.uidNumber?.toString() ?? '';
        if (filterField === 'uid') return user.uid ?? '';
        if (filterField === 'cn') return user.cn ?? '';
        if (filterField === 'ou') return user.ou ?? '';
        return '';
      })();

      return value.toString().toLowerCase().includes(keyword);
    });

    const sorted = [...list].sort((a, b) => {
      const direction = sortOrder === 'asc' ? 1 : -1;
      const toValue = (item, key) => {
        const v = item?.[key];
        if (v === null || v === undefined) return '';
        return v;
      };
      const avRaw = toValue(a, sortKey);
      const bvRaw = toValue(b, sortKey);

      if (sortKey === 'uidNumber') {
        const av = Number(avRaw) || 0;
        const bv = Number(bvRaw) || 0;
        return (av - bv) * direction;
      }

      return avRaw.toString().localeCompare(bvRaw.toString(), 'ko') * direction;
    });

    return sorted;
  }, [users, chipValue, filterField, search, sortKey, sortOrder]);

  const handleSort = (key) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortOrder(key === 'uidNumber' ? 'asc' : 'asc');
      return key;
    });
  };

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h2>유저 목록</h2>
          <p className="muted">LDAP 디렉토리에 등록된 사원 계정을 조회합니다.</p>
        </div>
      </div>

      <div className="card-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, marginBottom: 16 }}>
        <div className="filter-row" style={{ width: '100%' }}>
          <select
            className="filter-select"
            value={filterField}
            onChange={(event) => setFilterField(event.target.value)}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="search-group" style={{ flexBasis: '50%' }}>
            <span className="search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              type="search"
              placeholder={`${FILTER_OPTIONS.find((opt) => opt.value === filterField)?.label ?? '검색'} 검색`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="chip-row" role="tablist" aria-label="필터 옵션">
          {chipOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${chipValue === option ? 'chip-active' : ''}`}
              onClick={() => setChipValue(option)}
            >
              {option === 'ALL' ? 'All' : option}
            </button>
          ))}
        </div>
      </div>

      {loading && <p>불러오는 중입니다...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th
                  className="sortable"
                  onClick={() => handleSort('uidNumber')}
                >
                  사원번호 {sortKey === 'uidNumber' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('cn')}
                >
                  유저 아이디 {sortKey === 'cn' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('uid')}
                >
                  유저 이름 {sortKey === 'uid' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th>이메일</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('ou')}
                >
                  부서 {sortKey === 'ou' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">조건에 맞는 유저가 없습니다.</td>
                </tr>
              )}
              {filteredUsers.map((user) => (
                <tr key={user.cn ?? user.uidNumber}>
                  <td>{user.uidNumber ?? '-'}</td>
                  <td>{user.cn ?? '-'}</td>
                  <td>{user.uid ?? '-'}</td>
                  <td>{user.mail ?? '-'}</td>
                  <td>{user.ou ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
