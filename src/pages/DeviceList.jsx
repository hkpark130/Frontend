import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Tooltip from "@/components/Tooltip";
import { fetchAvailableDevices } from "@/api/devices";

const columns = [
  { key: "categoryName", label: "품목" },
  { key: "id", label: "관리번호" },
  { key: "purpose", label: "용도" },
  { key: "tags", label: "태그" },
  { key: "description", label: "비고" },
  { key: "statusLabel", label: "신청정보" },
];

const filterOptions = [
  { value: "all", label: "전체" },
  { value: "categoryName", label: "품목" },
  { value: "id", label: "관리번호" },
  { value: "purpose", label: "용도" },
  { value: "tags", label: "태그" },
];

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterField, setFilterField] = useState("all");
  const [chipFilter, setChipFilter] = useState("ALL");
  const [requestedCategory, setRequestedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({ categories: [], purposes: [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();
  const lastAppliedKeyRef = useRef(null);

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
        page: currentPage,
        size: pageSize,
        filterField,
      };
      if (debouncedSearch) {
        params.keyword = debouncedSearch;
      }
      if (chipFilter !== "ALL") {
        params.chipValue = chipFilter;
      }
      const data = await fetchAvailableDevices(params);
      const content = Array.isArray(data?.content) ? data.content : [];
      setDevices(content);
      setTotalItems(Number(data?.totalElements ?? 0));
      setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));
      const meta = data?.metadata ?? {};
      setMetadata({
        categories: Array.isArray(meta?.categories) ? meta.categories : [],
        purposes: Array.isArray(meta?.purposes) ? meta.purposes : [],
      });
    } catch (err) {
      console.error(err);
      setError("장비 목록을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [chipFilter, currentPage, debouncedSearch, filterField, pageSize]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const chipOptions = useMemo(() => {
    if (filterField === "categoryName") {
      const preferred = ["노트북", "서버"];
      const categories = Array.isArray(metadata?.categories) ? metadata.categories : [];
      const prioritized = preferred.filter((item) => categories.includes(item));
      const others = categories.filter((item) => !preferred.includes(item));
      return ["ALL", ...prioritized, ...others];
    }
    if (filterField === "purpose") {
      const preferred = ["개발", "사무"];
      const purposes = Array.isArray(metadata?.purposes) ? metadata.purposes : [];
      const prioritized = preferred.filter((item) => purposes.includes(item));
      const others = purposes.filter((item) => !preferred.includes(item));
      return ["ALL", ...prioritized, ...others];
    }
    return [];
  }, [filterField, metadata]);

  useEffect(() => {
    if (filterField !== "categoryName" && filterField !== "purpose") {
      setChipFilter("ALL");
    }
  }, [filterField]);

  useEffect(() => {
    if (chipOptions.length > 0 && !chipOptions.includes(chipFilter)) {
      setChipFilter("ALL");
    }
  }, [chipOptions, chipFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterField, chipFilter, pageSize, debouncedSearch]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const categoryFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("category");
    return raw ? decodeURIComponent(raw) : null;
  }, [location.search]);

  useEffect(() => {
    const category = categoryFromQuery ?? location.state?.category;
    if (!category) {
      return;
    }

    const appliedKey = `${location.key}:${category}`;
    if (lastAppliedKeyRef.current === appliedKey) {
      return;
    }

    setFilterField("categoryName");
    setSearch("");
    setChipFilter("ALL");
    setRequestedCategory(category);
    lastAppliedKeyRef.current = appliedKey;
  }, [categoryFromQuery, location.key, location.state?.category]);

  useEffect(() => {
    if (!requestedCategory || chipOptions.length === 0) {
      return;
    }

    const normalized = requestedCategory.trim().toLowerCase();
    const matchedOption = chipOptions.find((option) => {
      const candidate = option.trim().toLowerCase();
      if (candidate === normalized) {
        return true;
      }
      return candidate.includes(normalized) || normalized.includes(candidate);
    });
    if (matchedOption) {
      setChipFilter(matchedOption);
      setRequestedCategory(null);
    } else {
      const hasRealOptions = chipOptions.some((option) => option !== "ALL");
      if (!hasRealOptions) {
        // Wait for actual chip options to load before clearing the request
        return;
      }
      setRequestedCategory(null);
    }
  }, [requestedCategory, chipOptions]);

  const handleApply = (deviceId) => {
    navigate(`/device/${deviceId}/apply`);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>가용 장비 목록</h2>
        </div>
      </div>

      <div className="card-controls">
        <div className="filter-row">
          <select
            value={filterField}
            onChange={(event) => setFilterField(event.target.value)}
            className="filter-select"
          >
            {filterOptions.map((option) => (
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
              placeholder="검색 (품목, 관리번호, 용도 등)"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {chipOptions.length > 0 && (
          <div className="chip-row" role="group" aria-label="상세 필터">
            {chipOptions.map((option) => (
              <button
                type="button"
                key={option}
                className={`chip ${chipFilter === option ? "chip-active" : ""}`}
                onClick={() => setChipFilter(option)}
              >
                {option === "ALL" ? "All" : option}
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
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>신청</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="empty">
                    조건에 맞는 장비가 없습니다.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id}>
                    <td>{device.categoryName ?? "-"}</td>
                    <td>{device.id}</td>
                    <td>
                      {device.purpose ? (
                        (device.spec && device.spec.toString().trim()) ? (
                          <Tooltip content={<div style={{ whiteSpace: 'pre-wrap' }}>{device.spec}</div>}>
                            <div style={{ display: 'block', width: '100%' }}>{device.purpose}</div>
                          </Tooltip>
                        ) : (
                          <div style={{ display: 'block', width: '100%' }}>{device.purpose}</div>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {(device.tags ?? []).length > 0 ? (
                        <div className="tags-list">
                          {device.tags.map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {device.description ? (
                        <Tooltip
                          content={<div style={{ whiteSpace: 'pre-wrap' }}>{device.description}</div>}
                          maxWidth={480}
                          maxHeight={320}
                        >
                          <div style={{ display: 'block', width: '100%' }}>
                            <span
                              title={typeof device.description === 'string' ? '' : undefined}
                              style={{
                                display: 'inline-block',
                                maxWidth: 300,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                verticalAlign: 'bottom',
                              }}
                            >
                              {device.description}
                            </span>
                          </div>
                        </Tooltip>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {device.approvalInfo === "승인대기" && device.approvalType === "반납"
                        ? `반납 예정 (${device.deadline ?? "미정"})`
                        : "사용 가능"}
                    </td>
                    <td>
                      <button type="button" onClick={() => handleApply(device.id)} className="primary">
                        사용 신청
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="muted">총 {totalItems}건</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted">페이지당</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value);
                    setPageSize(nextSize);
                    setCurrentPage(1);
                  }}
                >
                  {[10, 25, 50].map((sizeOption) => (
                    <option key={sizeOption} value={sizeOption}>{sizeOption}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="outline" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                ◀◀
              </button>
              <button
                type="button"
                className="outline"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ◀
              </button>
              <span className="muted">{currentPage} / {totalPages}</span>
              <button
                type="button"
                className="outline"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                ▶
              </button>
              <button
                type="button"
                className="outline"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                ▶▶
              </button>
            </div>
          </div>
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
