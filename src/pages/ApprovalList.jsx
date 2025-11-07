import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveApproval,
  fetchPendingApprovals,
  rejectApproval,
} from "@/api/approvals";
import { useUser } from "@/context/UserProvider";
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import SearchIcon from '@/components/icons/SearchIcon';
import Pagination from '@/components/Pagination';
import {
  computeStageLabel,
  computeUrgency,
  extractUsername,
  formatDate,
  getStatusClass,
  isCurrentApprover,
} from "@/utils/approvals";
import Spinner from "@/components/Spinner";

const FILTER_OPTIONS = [
  { value: "approvalId", label: "신청번호" },
  { value: "categoryName", label: "신청장비" },
  { value: "userName", label: "신청자" },
  { value: "approvalInfo", label: "신청정보" },
  { value: "deviceId", label: "관리번호" },
];

export default function ApprovalList() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Filters
  const [filterField, setFilterField] = useState("categoryName");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [chipValue, setChipValue] = useState("ALL");
  // Sorting
  const [sortField, setSortField] = useState("submittedAt"); // approvalId | deviceId | deadline | submittedAt
  const [sortOrder, setSortOrder] = useState("asc"); // asc | desc

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metadata, setMetadata] = useState({ categories: [], applicants: [] });
  const [actioningApprovalId, setActioningApprovalId] = useState(null);

  const currentUsername = useMemo(() => extractUsername(user?.profile), [user]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const loadApprovals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        size: pageSize,
        filterField,
        sortField,
        sortOrder,
      };
      if (debouncedQuery) {
        params.keyword = debouncedQuery;
      }
      if (chipValue !== "ALL") {
        params.chipValue = chipValue;
      }
      const data = await fetchPendingApprovals(params);
      const content = Array.isArray(data?.content) ? data.content : [];
      setApprovals(content);
      setTotalItems(Number(data?.totalElements ?? 0));
      setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));
      const meta = data?.metadata ?? {};
      setMetadata({
        categories: Array.isArray(meta?.categories) ? meta.categories : [],
        applicants: Array.isArray(meta?.applicants) ? meta.applicants : [],
      });
    } catch (err) {
      console.error(err);
      setError("결재 목록을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [chipValue, currentPage, debouncedQuery, filterField, pageSize, sortField, sortOrder]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const approvalsList = useMemo(() => (Array.isArray(approvals) ? approvals : []), [approvals]);

  // Unique sources for dynamic chips
  const uniqueCategories = useMemo(
    () => (Array.isArray(metadata?.categories) ? metadata.categories : []),
    [metadata],
  );
  const uniqueApplicants = useMemo(
    () => (Array.isArray(metadata?.applicants) ? metadata.applicants : []),
    [metadata],
  );

  // Dynamic chips based on filterField
  const chipOptions = useMemo(() => {
    if (filterField === "categoryName") return ["ALL", ...uniqueCategories];
    if (filterField === "userName") return ["ALL", ...uniqueApplicants];
    if (filterField === "approvalInfo") return ["ALL", "승인대기", "1차승인완료", "승인완료", "반려", "취소"];
    return ["ALL"]; // approvalId, deviceId
  }, [filterField, uniqueCategories, uniqueApplicants]);

  const currentFilterOption = useMemo(
    () => FILTER_OPTIONS.find((option) => option.value === filterField) ?? FILTER_OPTIONS[0],
    [filterField],
  );

  // Reset chip when filter field changes
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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const enhancedApprovals = useMemo(
    () =>
      approvalsList.map((item) => {
        const urgency = computeUrgency(item.deadline, item.approvalInfo);
        const stageLabel = computeStageLabel(item.approvalInfo, item.approvers);
        const nextPending = (item.approvers || []).find(
          (approver) => approver && !approver.isApproved && !approver.isRejected,
        );
        const isMine = isCurrentApprover(item.approvers, currentUsername);
        return {
          raw: item,
          approvalId: item.approvalId,
          userName: item.userName,
          type: item.type,
          deviceId: item.deviceId,
          categoryName: item.categoryName,
          approvalInfo: item.approvalInfo,
          createdDate: item.createdDate,
          deadline: item.deadline,
          deadlineLabel: formatDate(item.deadline),
          createdLabel: formatDate(item.createdDate, true),
          statusClass: getStatusClass(item.approvalInfo),
          urgency,
          stageLabel,
          approvers: item.approvers || [],
          nextPending,
          isMine,
          isTerminal: ["승인완료", "반려", "취소"].includes(item.approvalInfo ?? ""),
        };
      }),
    [approvalsList, currentUsername],
  );

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
    };
    setSortField(field);
    setSortOrder(defaultOrderByField[field] ?? "asc");
  };

  const handleOpenDetail = (approvalId) => {
    navigate(`/admin/approvals/${approvalId}`);
  };

  const handleQuickApprove = async (item) => {
    if (actioningApprovalId === item.approvalId) {
      return;
    }
    if (item.isTerminal) {
      alert("이미 완료되거나 취소된 결재입니다.");
      return;
    }
    if (!currentUsername) {
      alert("로그인 정보를 확인할 수 없습니다. 상세 화면에서 처리해주세요.");
      return;
    }
    const confirmed = window.confirm(`승인 ID ${item.approvalId}를 승인하시겠습니까?`);
    if (!confirmed) return;
    const comment = window.prompt("승인 의견을 입력하세요 (선택)", "");
    setActioningApprovalId(item.approvalId);
    try {
      await approveApproval(item.approvalId, {
        approverUsername: currentUsername,
        comment: comment ?? "",
      });
      alert("승인되었습니다.");
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert("승인 처리 중 오류가 발생했습니다. 상세 화면에서 다시 시도해 주세요.");
    } finally {
      setActioningApprovalId(null);
    }
  };

  const handleQuickReject = async (item) => {
    if (actioningApprovalId === item.approvalId) {
      return;
    }
    if (item.isTerminal) {
      alert("이미 완료되거나 취소된 결재입니다.");
      return;
    }
    if (!currentUsername) {
      alert("로그인 정보를 확인할 수 없습니다. 상세 화면에서 처리해주세요.");
      return;
    }
    const comment = window.prompt("반려 사유를 입력하세요 (선택)", "");
    if (comment === null) {
      return;
    }
    setActioningApprovalId(item.approvalId);
    try {
      await rejectApproval(item.approvalId, {
        approverUsername: currentUsername,
        comment: comment ?? "",
      });
      alert("반려 처리되었습니다.");
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert("반려 처리 중 오류가 발생했습니다. 상세 화면에서 다시 시도해 주세요.");
    } finally {
      setActioningApprovalId(null);
    }
  };

  return (
    <div className="card approval-management">
      <div className="card-header">
        <div>
          
          <h2>
            <div style={{ display: "flex", alignItems: "center" }}>
              <AssignmentTurnedInIcon fontSize="large" style={{ marginRight: 8 }} />
              결재 관리
            </div>
          </h2>
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
                placeholder={`${currentFilterOption.label} 검색`}
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
                <th>신청자</th>
                <th className="sortable" onClick={() => handleSort('deadline')}>
                  마감일 {sortField === 'deadline' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('approvalStatus')}>
                  상태 {sortField === 'approvalStatus' && <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th>결재선</th>
                <th>처리자</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {approvalsList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    조건에 맞는 결재 요청이 없습니다.
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
                    <div className="stack">
                      <strong>{item.deviceId ?? "-"}</strong>
                      <span className="muted small">{item.categoryName ?? "-"}</span>
                    </div>
                  </td>
                  <td>{item.userName ?? "-"}</td>
                  <td>{item.deadlineLabel}</td>
                  <td>
                    <span className={`status-chip ${item.statusClass}`}>
                      {item.stageLabel ?? item.approvalInfo ?? "-"}
                    </span>
                  </td>
                  <td>
                    <div className="approver-inline">
                      {item.approvers.length === 0 && <span className="muted small">결재선 미지정</span>}
                      {item.approvers.map((approver) => {
                        const badgeClass = approver.isRejected
                          ? "rejected"
                          : approver.isApproved
                            ? "approved"
                            : "pending";
                        const badgeLabel = approver.isRejected
                          ? "반려"
                          : approver.isApproved
                            ? "승인"
                            : "대기";
                        return (
                          <span
                            key={`${item.approvalId}-${approver.step}-${approver.username}`}
                            className={`approver-badge ${badgeClass}`}
                            title={`${approver.step}차 · ${approver.username ?? "-"} · ${badgeLabel}`}
                          >
                            {approver.step}차 {badgeLabel}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>{item.nextPending?.username ?? "-"}</td>
                  <td>
                    <div className="table-actions">
                      {item.isMine && !item.isTerminal && (
                        <button
                          type="button"
                          className="primary"
                          onClick={() => handleQuickApprove(item)}
                          disabled={actioningApprovalId === item.approvalId}
                        >
                          {actioningApprovalId === item.approvalId ? (<><Spinner size={12} /> 처리중...</>) : '즉시 승인'}
                        </button>
                      )}
                      {item.isMine && !item.isTerminal && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleQuickReject(item)}
                          disabled={actioningApprovalId === item.approvalId}
                        >
                          {actioningApprovalId === item.approvalId ? (<><Spinner size={12} /> 처리중...</>) : '반려'}
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
          {/* Pagination controls */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            totalItems={totalItems}
            disabled={false}
          />
        </div>
      )}
    </div>
  );
}
