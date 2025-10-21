import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPendingApprovals } from "@/api/approvals";

const columns = [
  { key: "approvalId", label: "ID" },
  { key: "userName", label: "신청자" },
  { key: "type", label: "구분" },
  { key: "approvalInfo", label: "상태" },
  { key: "deviceId", label: "장비" },
  { key: "deadline", label: "사용기한" },
  { key: "createdDate", label: "신청일" },
];

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export default function ApprovalList() {
  const [approvals, setApprovals] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const normalizeToArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.value)) return payload.value;
    return [];
  };

  useEffect(() => {
    const loadApprovals = async () => {
      try {
        setIsLoading(true);
        const data = await fetchPendingApprovals();
        setApprovals(normalizeToArray(data));
      } catch (err) {
        console.error(err);
        setError("결재 목록을 불러오는 중 문제가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    loadApprovals();
  }, []);

  const approvalsList = useMemo(() => (Array.isArray(approvals) ? approvals : []), [approvals]);

  const filteredApprovals = useMemo(() => {
    if (!search) return approvalsList;
    const keyword = search.trim().toLowerCase();
    return approvalsList.filter((approval) =>
      [
        approval.approvalId?.toString(),
        approval.userName,
        approval.type,
        approval.approvalInfo,
        approval.deviceId,
        approval.categoryName,
      ]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(keyword)),
    );
  }, [approvalsList, search]);

  const handleOpenDetail = (approvalId) => {
    navigate(`/admin/approvals/${approvalId}`);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>결재 요청 목록</h2>
          <p className="muted">대기 및 진행 중인 장비 결재 현황입니다.</p>
        </div>
        <div className="card-actions">
          <input
            type="search"
            placeholder="검색 (신청자, 장비, 상태 등)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
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
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="empty">
                    조건에 맞는 결재 요청이 없습니다.
                  </td>
                </tr>
              )}
              {filteredApprovals.map((approval) => (
                <tr key={approval.approvalId}>
                  <td>{approval.approvalId}</td>
                  <td>{approval.userName ?? "-"}</td>
                  <td>{approval.type ?? "-"}</td>
                  <td>{approval.approvalInfo ?? "-"}</td>
                  <td>{approval.deviceId ?? "-"}</td>
                  <td>{formatDateTime(approval.deadline)}</td>
                  <td>{formatDateTime(approval.createdDate)}</td>
                  <td>
                    <button type="button" className="primary" onClick={() => handleOpenDetail(approval.approvalId)}>
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
