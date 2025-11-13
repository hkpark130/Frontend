import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import SearchIcon from '@/components/icons/SearchIcon';
import Pagination from '@/components/Pagination';
import Tooltip from "@/components/Tooltip";
import { cancelApproval, fetchMyApprovals } from "@/api/approvals";
import { useUser } from "@/context/UserProvider";
import {
  APPROVAL_STATUS_PRIORITY,
  computeStageLabel,
  computeUrgency,
  extractUsername,
  formatDate,
  getStatusClass,
} from "@/utils/approvals";

const FILTER_OPTIONS = [
  { value: "approvalId", label: "신청번호" },
  { value: "categoryName", label: "신청장비" },
  { value: "approvalInfo", label: "신청정보" },
  { value: "deviceId", label: "관리번호" },
  { value: "type", label: "구분" },
];

const normalizeString = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

const matchesKeyword = (item, field, keyword) => {
  if (!keyword) return true;
  const lower = keyword.toLowerCase();
  switch (field) {
    case "approvalId":
      return normalizeString(item.approvalId).toLowerCase().includes(lower);
    case "categoryName":
      return normalizeString(item.categoryName).toLowerCase().includes(lower);
    case "deviceId":
      if (normalizeString(item.deviceId).toLowerCase().includes(lower)) {
        return true;
      }
      return normalizeDeviceEntries(item).some((entry) =>
        normalizeString(entry.id).toLowerCase().includes(lower),
      );
    case "approvalInfo": {
      const combined = `${normalizeString(item.type)} ${normalizeString(item.approvalInfo)}`.trim();
      return combined.toLowerCase().includes(lower);
    }
    case "type":
      return normalizeString(item.type).toLowerCase().includes(lower);
    default:
      return true;
  }
};

const matchesChip = (item, field, chipValue) => {
  if (!chipValue || chipValue === "ALL") return true;
  switch (field) {
    case "categoryName":
      return normalizeString(item.categoryName) === chipValue;
    case "approvalInfo":
      return normalizeString(item.approvalInfo) === chipValue;
    case "type":
      return normalizeString(item.type) === chipValue;
    default:
      return true;
  }
};

const sortApprovals = (list, field, order) => {
  const sorted = [...list];
  const direction = order === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    const left = a ?? {};
    const right = b ?? {};
    switch (field) {
      case "approvalId":
        return direction * ((left.approvalId ?? 0) - (right.approvalId ?? 0));
      case "deviceId":
        return direction * normalizeString(left.deviceId).localeCompare(normalizeString(right.deviceId), 'ko');
      case "deadline": {
        const leftTime = left.deadline ? new Date(left.deadline).getTime() : Number.NEGATIVE_INFINITY;
        const rightTime = right.deadline ? new Date(right.deadline).getTime() : Number.NEGATIVE_INFINITY;
        return direction * (leftTime - rightTime);
      }
      case "type":
        return direction * normalizeString(left.type).localeCompare(normalizeString(right.type), 'ko');
      case "approvalStatus":
        return direction * (
          (APPROVAL_STATUS_PRIORITY[left.approvalStatus] ?? 99)
          - (APPROVAL_STATUS_PRIORITY[right.approvalStatus] ?? 99)
        );
      case "submittedAt":
      default: {
        const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
        const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
        return direction * (leftTime - rightTime);
      }
    }
  });
  return sorted;
};

const normalizeDeviceEntries = (approval) => {
  if (!approval || typeof approval !== "object") {
    return [];
  }

  const entries = [];
  const seen = new Set();

  const pushEntry = (deviceId, categoryName) => {
    const rawId = deviceId != null ? String(deviceId).trim() : "";
    const rawCategory = categoryName != null ? String(categoryName).trim() : "";
    if (!rawId && !rawCategory) {
      return;
    }
    const key = rawId || `${rawCategory || "unknown"}-${entries.length}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    entries.push({
      id: rawId || null,
      category: rawCategory || null,
      key,
    });
  };

  const nestedCollections = [
    approval.deviceItems,
    approval.devices,
    approval.deviceList,
    approval.approvalDevices,
  ];

  nestedCollections.forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }
    collection.forEach((device) => {
      if (!device) {
        return;
      }
      const id =
        device.deviceId ??
        device.id ??
        device.manageId ??
        device.deviceCode ??
        device.deviceNo ??
        device.serialNumber ??
        device.code;
      const category =
        device.categoryName ??
        device.category ??
        device.itemName ??
        device.productName ??
        device.name ??
        device.model ??
        device.type;
      pushEntry(id, category);
    });
  });

  const idCollections = [
    approval.deviceIds,
    approval.deviceIdList,
    approval.deviceCodes,
  ];
  const categoryCollections = [
    approval.categoryNames,
    approval.categoryList,
    approval.deviceCategories,
  ];

  idCollections.forEach((ids, idx) => {
    if (!Array.isArray(ids)) {
      return;
    }
    ids.forEach((deviceId, index) => {
      const categories = categoryCollections[idx];
      const categoryName = Array.isArray(categories)
        ? categories[index]
        : approval.categoryName;
      pushEntry(deviceId, categoryName);
    });
  });

  if (entries.length === 0 && typeof approval.deviceId === "string") {
    const raw = approval.deviceId
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (raw.length > 1) {
      raw.forEach((id) => pushEntry(id, approval.categoryName));
    } else {
      pushEntry(approval.deviceId, approval.categoryName);
    }
  } else if (entries.length === 0 && typeof approval.deviceId === "number") {
    pushEntry(approval.deviceId, approval.categoryName);
  }

  if (entries.length === 0 && approval.categoryName) {
    pushEntry(null, approval.categoryName);
  }

  return entries;
};

const buildDeviceSummary = (approval) => {
  const entries = normalizeDeviceEntries(approval);
  if (entries.length === 0) {
    const fallbackId = approval?.deviceId != null ? String(approval.deviceId) : "-";
    return {
      entries,
      count: 0,
      hasMultiple: false,
      primary: null,
      primaryId: fallbackId || "-",
      plusCount: 0,
      secondaryLabel: approval?.categoryName ?? "-",
    };
  }

  const [primary] = entries;
  const count = entries.length;
  const hasMultiple = count > 1;
  const primaryId = primary.id && primary.id.length > 0 ? primary.id : "-";
  const plusCount = hasMultiple ? count - 1 : 0;

  let secondaryLabel;
  if (hasMultiple) {
    const base = primary.category ?? approval?.categoryName ?? "";
    secondaryLabel = base
      ? `${base} 외 ${plusCount}대`
      : `${count}대 신청`;
  } else {
    secondaryLabel = primary.category ?? approval?.categoryName ?? "-";
  }

  return {
    entries,
    count,
    hasMultiple,
    primary,
    primaryId,
    plusCount,
    secondaryLabel,
  };
};

export default function MyApprovalRequests() {
  const navigate = useNavigate();
  const { user } = useUser();
  const currentUsername = useMemo(() => extractUsername(user?.profile), [user]);

  const [rawApprovals, setRawApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterField, setFilterField] = useState("categoryName");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [chipValue, setChipValue] = useState("ALL");
  const [sortField, setSortField] = useState("submittedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const loadApprovals = useCallback(async () => {
    if (!currentUsername) {
      setRawApprovals([]);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchMyApprovals(currentUsername);
      if (Array.isArray(data)) {
        setRawApprovals(data);
      } else if (data?.content && Array.isArray(data.content)) {
        setRawApprovals(data.content);
      } else {
        setRawApprovals([]);
      }
    } catch (err) {
      console.error(err);
      setError("신청 내역을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUsername]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const approvals = useMemo(() => (Array.isArray(rawApprovals) ? rawApprovals : []), [rawApprovals]);

  const uniqueCategories = useMemo(() => {
    const values = new Set();
    approvals.forEach((item) => {
      const category = normalizeString(item.categoryName);
      if (category) values.add(category);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [approvals]);

  const uniqueStatuses = useMemo(() => {
    const values = new Set();
    approvals.forEach((item) => {
      const status = normalizeString(item.approvalInfo);
      if (status) values.add(status);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [approvals]);

  const uniqueTypes = useMemo(() => {
    const values = new Set();
    approvals.forEach((item) => {
      const type = normalizeString(item.type);
      if (type) values.add(type);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [approvals]);

  const chipOptions = useMemo(() => {
    if (filterField === "categoryName") return ["ALL", ...uniqueCategories];
    if (filterField === "approvalInfo") return ["ALL", ...uniqueStatuses];
    if (filterField === "type") return ["ALL", ...uniqueTypes];
    return ["ALL"];
  }, [filterField, uniqueCategories, uniqueStatuses, uniqueTypes]);

  useEffect(() => {
    setChipValue("ALL");
  }, [filterField]);

  useEffect(() => {
    if (!chipOptions.includes(chipValue)) {
      setChipValue("ALL");
    }
  }, [chipOptions, chipValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterField, chipValue, sortField, sortOrder, pageSize, debouncedQuery]);

  const processedApprovals = useMemo(() => {
    const keyword = debouncedQuery;
    let list = approvals.filter((item) => matchesChip(item, filterField, chipValue));
    list = list.filter((item) => matchesKeyword(item, filterField, keyword));
    return sortApprovals(list, sortField, sortOrder);
  }, [approvals, chipValue, debouncedQuery, filterField, sortField, sortOrder]);

  const totalItems = processedApprovals.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedApprovals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return processedApprovals.slice(start, end);
  }, [processedApprovals, currentPage, pageSize]);

  const enhancedApprovals = useMemo(() => pagedApprovals.map((item) => {
    const urgency = computeUrgency(item.deadline, item.approvalInfo);
    const stageLabel = computeStageLabel(item.approvalInfo, item.approvers);
    const nextPending = (item.approvers || []).find((approver) => !approver?.isApproved);
    const canCancel = ["PENDING", "IN_PROGRESS"].includes(item.approvalStatus);
    const deviceSummary = buildDeviceSummary(item);

    return {
      raw: item,
      approvalId: item.approvalId,
      type: item.type,
      deviceId: item.deviceId,
      categoryName: item.categoryName,
      approvalInfo: item.approvalInfo,
      approvalStatus: item.approvalStatus,
      createdDate: item.createdDate,
      submittedAt: item.submittedAt,
      deadline: item.deadline,
      userName: item.userName,
      deadlineLabel: formatDate(item.deadline),
      createdLabel: formatDate(item.createdDate, true),
      statusClass: getStatusClass(item.approvalInfo),
      urgency,
      stageLabel,
      approvers: item.approvers || [],
      nextPending,
      canCancel,
      deviceSummary,
    };
  }), [pagedApprovals]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    const defaultOrderByField = {
      approvalId: "desc",
      deviceId: "asc",
      deadline: "asc",
      type: "asc",
      approvalStatus: "asc",
      submittedAt: "desc",
    };
    setSortField(field);
    setSortOrder(defaultOrderByField[field] ?? "asc");
  };

  const handleOpenDetail = (approvalId) => {
    navigate(`/mypage/requests/${approvalId}`);
  };

  const handleCancel = async (item) => {
    if (!currentUsername) {
      alert("로그인 정보를 확인할 수 없습니다. 다시 로그인 후 시도해 주세요.");
      return;
    }
    const confirmed = window.confirm(`신청 ID ${item.approvalId}를 취소하시겠습니까?`);
    if (!confirmed) return;
    try {
      await cancelApproval(item.approvalId, currentUsername);
      alert("취소 처리되었습니다.");
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert("취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  if (!currentUsername) {
    return (
      <div className="card">
        <p>로그인 후 신청 내역을 확인할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="card approval-management">
      <div className="card-header">
        <div>
          <h2>
            <div style={{ display: "flex", alignItems: "center" }}>
              <AssignmentTurnedInIcon fontSize="large" style={{ marginRight: 8 }} />
              신청 내역
            </div>
          </h2>
          <p className="muted">내가 신청한 장비 결재 진행 현황을 확인하고 관리합니다.</p>
        </div>
        <div className="card-actions" style={{ flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div className="filter-row" style={{ width: "100%" }}>
            <select className="filter-select" value={filterField} onChange={(e) => setFilterField(e.target.value)}>
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="search-group">
              <span className="search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <input
                className="search-input"
                type="search"
                placeholder={`${(FILTER_OPTIONS.find((option) => option.value === filterField) ?? FILTER_OPTIONS[0]).label} 검색`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="chip-row" role="tablist" aria-label="필터 옵션">
            {chipOptions.map((opt) => {
              const label = opt === 'ALL' ? 'All' : opt;
              const active = chipValue === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="tab"
                  className={`chip ${active ? 'chip-active' : ''}`}
                  onClick={() => setChipValue(opt)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading && <p>불러오는 중입니다...</p>}
      {error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <div className="table-wrapper approval-table">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('type')}>
                  구분 {sortField === 'type' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('approvalId')}>
                  신청번호 {sortField === 'approvalId' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('deviceId')}>
                  관리번호 / 품목 {sortField === 'deviceId' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th>신청일</th>
                <th className="sortable" onClick={() => handleSort('deadline')}>
                  마감일 {sortField === 'deadline' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('approvalStatus')}>
                  상태 {sortField === 'approvalStatus' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th>결재선</th>
                <th>다음 결재자</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {enhancedApprovals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    신청한 결재 요청이 없습니다.
                  </td>
                </tr>
              ) : (
                enhancedApprovals.map((item) => (
                  <tr key={item.approvalId} className={item.urgency.urgent ? "row-urgent" : undefined}>
                    <td>
                      <div className="taglist-wrap">
                        {item.urgency.urgent && item.urgency.label && (
                          <span className="tag tag-danger">{item.urgency.label}</span>
                        )}
                        <span className="tag tag-outline">{item.type ?? "-"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack">
                        <strong>{item.approvalId}</strong>
                        <span className="muted small">{item.createdLabel}</span>
                      </div>
                    </td>
                    <td>
                      {item.deviceSummary.count > 1 ? (
                        <Tooltip
                          content={(
                            <div className="device-tooltip-list">
                              {item.deviceSummary.entries.map((device) => (
                                <div key={device.key} className="device-tooltip-item">
                                  <strong>{device.id ?? "-"}</strong>
                                  <span>{device.category ?? "-"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        >
                          <div className="stack device-stack">
                            <strong>
                              {item.deviceSummary.primaryId}
                              {item.deviceSummary.hasMultiple && (
                                <span className="device-extra-count">+{item.deviceSummary.plusCount}</span>
                              )}
                            </strong>
                            <span className="muted small">{item.deviceSummary.secondaryLabel}</span>
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="stack">
                          <strong>{item.deviceId ?? "-"}</strong>
                          <span className="muted small">{item.categoryName ?? "-"}</span>
                        </div>
                      )}
                    </td>
                    <td>{formatDate(item.createdDate, true)}</td>
                    <td>{item.deadlineLabel}</td>
                    <td>
                      <span className={`status-chip ${item.statusClass}`}>
                        {item.stageLabel ?? item.approvalInfo ?? "-"}
                      </span>
                    </td>
                    <td>
                      <div className="approver-inline">
                        {item.approvers.length === 0 && <span className="muted small">결재선 미지정</span>}
                        {item.approvers.map((approver) => (
                          <span
                            key={`${item.approvalId}-${approver.step}-${approver.username}`}
                            className={`approver-badge ${approver.isApproved ? "approved" : "pending"}`}
                            title={`${approver.step}차 · ${approver.username}`}
                          >
                            {approver.step}차 {approver.isApproved ? "승인" : "대기"}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{item.nextPending?.username ?? "-"}</td>
                    <td>
                      <div className="table-actions">
                        {item.canCancel && (
                          <button type="button" className="danger" onClick={() => handleCancel(item)}>
                            취소
                          </button>
                        )}
                        <button type="button" className="outline" onClick={() => handleOpenDetail(item.approvalId)}>
                          상세
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            totalItems={totalItems}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}
