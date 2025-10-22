import { useEffect, useMemo, useRef, useState } from "react";
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

const normalizeToArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.value)) return payload.value;
  return [];
};

const containsKeyword = (value, keyword) => {
  if (!value) return false;
  return value.toString().toLowerCase().includes(keyword);
};

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState("all");
  const [chipFilter, setChipFilter] = useState("ALL");
  const [requestedCategory, setRequestedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const lastAppliedKeyRef = useRef(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        setIsLoading(true);
        const data = await fetchAvailableDevices();
        setDevices(normalizeToArray(data));
      } catch (err) {
        console.error(err);
        setError("장비 목록을 불러오는 중 문제가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDevices();
  }, []);

  const chipOptions = useMemo(() => {
    if (filterField === "categoryName") {
      const preferred = ["노트북", "서버"];
      const categorySet = new Set();
      devices.forEach((device) => {
        if (device?.categoryName) {
          categorySet.add(device.categoryName);
        }
      });
      const prioritized = preferred.filter((item) => categorySet.has(item));
      const others = Array.from(categorySet).filter((item) => !preferred.includes(item));
      return ["ALL", ...prioritized, ...others];
    }
    if (filterField === "purpose") {
      const preferred = ["개발", "사무"];
      const purposeSet = new Set();
      devices.forEach((device) => {
        if (device?.purpose) {
          purposeSet.add(device.purpose);
        }
      });
      const prioritized = preferred.filter((item) => purposeSet.has(item));
      const others = Array.from(purposeSet).filter((item) => !preferred.includes(item));
      return ["ALL", ...prioritized, ...others];
    }
    return [];
  }, [devices, filterField]);

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

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return devices.filter((device) => {
      if (filterField === "categoryName" && chipFilter !== "ALL" && device.categoryName !== chipFilter) {
        return false;
      }

      if (filterField === "purpose" && chipFilter !== "ALL" && device.purpose !== chipFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      if (filterField === "all") {
        const values = [
          device.categoryName,
          device.id,
          device.purpose,
          device.description,
          ...(device.tags ?? []),
        ];
        return values.filter(Boolean).some((value) => containsKeyword(value, keyword));
      }

      if (filterField === "tags") {
        return (device.tags ?? []).some((tag) => containsKeyword(tag, keyword));
      }

      return containsKeyword(device[filterField], keyword);
    });
  }, [devices, search, filterField, chipFilter]);

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
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="empty">
                    조건에 맞는 장비가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
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
