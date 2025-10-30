import { useCallback, useEffect, useMemo, useState } from "react";
import Tooltip from "@/components/Tooltip";
import Pagination from "@/components/Pagination";
import { fetchMyDevices, updateMyDeviceMemo } from "@/api/devices";
import { useUser } from "@/context/UserProvider";

const filterOptions = [
  { value: "all", label: "전체" },
  { value: "categoryName", label: "품목" },
  { value: "id", label: "관리번호" },
  { value: "displayUser", label: "사용자" },
  { value: "manageDepName", label: "관리부서" },
  { value: "projectName", label: "프로젝트" },
  { value: "purpose", label: "용도" },
  { value: "statusLabel", label: "진행 상태" },
];

const sortableColumns = [
  { key: "categoryName", label: "품목" },
  { key: "id", label: "관리번호" },
  { key: "displayUser", label: "사용자" },
  { key: "manageDepName", label: "관리부서" },
  { key: "projectName", label: "프로젝트" },
  { key: "purpose", label: "용도" },
  { key: "statusLabel", label: "진행 상태" },
];

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  body: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.55)",
    padding: "24px",
    color: "#F9FAFB",
  },
  textarea: {
    width: "94%",
    minHeight: 140,
    resize: "vertical",
    borderRadius: 10,
    border: "1px solid rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(17, 24, 39, 0.85)",
    color: "#F9FAFB",
    padding: "10px 12px",
    fontSize: 14,
    lineHeight: 1.5,
  },
  actions: {
    marginTop: 18,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
};

function EditMemoModal({ open, value, onChange, onCancel, onConfirm, isSaving }) {
  if (!open) {
    return null;
  }

  return (
    <div style={modalStyles.backdrop} role="dialog" aria-modal="true">
      <div style={modalStyles.body}>
        <header style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>비고 수정</h3>
          <p className="muted" style={{ marginTop: 6 }}>장비 비고를 입력해 주세요.</p>
        </header>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={modalStyles.textarea}
          placeholder="장비 상태, 용도 등의 메모를 남겨주세요."
        />
        <div style={modalStyles.actions}>
          <button type="button" className="secondary" onClick={onCancel} disabled={isSaving}>
            취소
          </button>
          <button type="button" className="primary" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

const collator = new Intl.Collator("ko-KR", { sensitivity: "base" });

const enrichDevice = (device) => {
  if (!device || typeof device !== "object") {
    return device;
  }

  const displayUser = device.realUser?.trim().length
    ? device.realUser.trim()
    : device.username ?? "";

  let statusLabel = device.status ?? "";
  if (device.approvalInfo && device.approvalType) {
    statusLabel = device.approvalInfo === "승인완료"
      ? device.approvalInfo
      : `${device.approvalType} ${device.approvalInfo}`.trim();
  } else if (device.approvalInfo) {
    statusLabel = device.approvalInfo;
  }

  return {
    ...device,
    displayUser,
    statusLabel,
  };
};

const normalizeToText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  return String(value);
};

const extractFieldValue = (device, key) => {
  switch (key) {
    case "categoryName":
      return device.categoryName ?? "";
    case "id":
      return device.id ?? "";
    case "displayUser":
      return device.displayUser ?? "";
    case "manageDepName":
      return device.manageDepName ?? "";
    case "projectName":
      return device.projectName ?? "";
    case "purpose":
      return device.purpose ?? "";
    case "statusLabel":
      return device.statusLabel ?? "";
    case "description":
      return device.description ?? "";
    case "spec":
      return device.spec ?? "";
    default:
      return normalizeToText(device[key]);
  }
};

const matchesSearch = (device, key, needle) => {
  const value = normalizeToText(extractFieldValue(device, key)).toLowerCase();
  return value.includes(needle);
};

const truncate = (value, limit = 40) => {
  if (!value) {
    return "";
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...`;
};

export default function MyAssets() {
  const { isLoggedIn } = useUser();
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] = useState("all");
  const [sortKey, setSortKey] = useState("categoryName");
  const [sortDirection, setSortDirection] = useState("asc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalState, setModalState] = useState({ open: false, device: null, description: "" });

  const loadDevices = useCallback(async () => {
    if (!isLoggedIn) {
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchMyDevices();
      const source = Array.isArray(data) ? data : [];
      setDevices(source.map(enrichDevice));
    } catch (err) {
      console.error(err);
      setError("나의 장비 목록을 불러오는 중 문제가 발생했습니다.");
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setDevices([]);
      return;
    }
    loadDevices();
  }, [isLoggedIn, loadDevices]);

  const searchNeedle = useMemo(() => search.trim().toLowerCase(), [search]);

  const filteredDevices = useMemo(() => {
    if (!searchNeedle) {
      return devices;
    }

    const keys = filterKey === "all"
      ? [
          "categoryName",
          "id",
          "purpose",
          "projectName",
          "manageDepName",
          "displayUser",
          "statusLabel",
          "description",
          "spec",
        ]
      : [filterKey];

    return devices.filter((device) => keys.some((key) => matchesSearch(device, key, searchNeedle)));
  }, [devices, filterKey, searchNeedle]);

  const sortedDevices = useMemo(() => {
    const items = [...filteredDevices];
    items.sort((a, b) => {
      const aValue = extractFieldValue(a, sortKey);
      const bValue = extractFieldValue(b, sortKey);
      const comparison = collator.compare(normalizeToText(aValue), normalizeToText(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return items;
  }, [filteredDevices, sortDirection, sortKey]);

  const totalItems = sortedDevices.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey, searchNeedle, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDevices.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedDevices]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleOpenModal = (device) => {
    setModalState({
      open: true,
      device,
      description: device.description ?? "",
    });
  };

  const handleCloseModal = () => {
    setModalState({ open: false, device: null, description: "" });
  };

  const handleMemoSave = async () => {
    if (!modalState.device) {
      return;
    }
    try {
      setIsSaving(true);
      const payload = {
        description: modalState.description ?? "",
      };
      const updated = await updateMyDeviceMemo(modalState.device.id, payload);
      setDevices((prev) => prev.map((item) => (
        item.id === updated.id ? enrichDevice(updated) : item
      )));
      handleCloseModal();
      alert("수정되었습니다.");
    } catch (err) {
      console.error(err);
      alert("비고 수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="card">
        <h2>나의 장비</h2>
        <p className="muted">장비 목록을 확인하려면 로그인해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header" style={{ gap: 16 }}>
        <div>
          <h2>나의 장비</h2>
          <p className="muted">내게 배정된 장비와 진행 상태를 확인할 수 있습니다.</p>
        </div>
      </div>

      <div className="card-controls">
        <div className="filter-row">
          <select
            value={filterKey}
            onChange={(event) => setFilterKey(event.target.value)}
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
              placeholder="검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="filter-row">
          <span className="muted">정렬</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
            className="filter-select"
            style={{ maxWidth: 180 }}
          >
            {sortableColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
          >
            {sortDirection === "asc" ? "오름차순" : "내림차순"}
          </button>
        </div>
      </div>

      {isLoading && <p>불러오는 중입니다...</p>}
      {error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort("categoryName")} style={{ cursor: "pointer" }}>
                  품목 {sortKey === "categoryName" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th onClick={() => toggleSort("id")} style={{ cursor: "pointer" }}>
                  관리번호 {sortKey === "id" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th onClick={() => toggleSort("displayUser")} style={{ cursor: "pointer" }}>
                  사용자 {sortKey === "displayUser" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th onClick={() => toggleSort("manageDepName")} style={{ cursor: "pointer" }}>
                  관리부서 {sortKey === "manageDepName" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th onClick={() => toggleSort("projectName")} style={{ cursor: "pointer" }}>
                  프로젝트 {sortKey === "projectName" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th onClick={() => toggleSort("purpose")} style={{ cursor: "pointer" }}>
                  용도 {sortKey === "purpose" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th onClick={() => toggleSort("statusLabel")} style={{ cursor: "pointer" }}>
                  진행 상태 {sortKey === "statusLabel" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </th>
                <th>비고</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">등록된 장비가 없습니다.</td>
                </tr>
              ) : (
                paginatedDevices.map((device) => {
                  const description = device.description ?? "";
                  const truncated = truncate(description, 50);
                  const purposeContent = device.spec ? (
                    <Tooltip
                      content={(
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          <div>{device.purpose ?? "-"}</div>
                          <hr style={{ margin: "8px 0", borderColor: "rgba(255,255,255,0.12)" }} />
                          <div>{device.spec}</div>
                        </div>
                      )}
                      maxWidth={480}
                    >
                      <span className="table-link">{device.purpose ?? "-"}</span>
                    </Tooltip>
                  ) : (
                    device.purpose ?? "-"
                  );

                  const descriptionCell = description ? (
                    <Tooltip
                      content={<div style={{ whiteSpace: "pre-wrap" }}>{description}</div>}
                      maxWidth={480}
                      maxHeight={320}
                    >
                      <span className="table-link">{truncated}</span>
                    </Tooltip>
                  ) : (
                    "-"
                  );

                  return (
                    <tr key={device.id}>
                      <td>{device.categoryName ?? "-"}</td>
                      <td>{device.id ?? "-"}</td>
                      <td>{device.displayUser || "-"}</td>
                      <td>{device.manageDepName ?? "-"}</td>
                      <td>{device.projectName ?? "-"}</td>
                      <td>{purposeContent}</td>
                      <td>{device.statusLabel ?? "-"}</td>
                      <td>{descriptionCell}</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => handleOpenModal(device)}>
                          메모 수정
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={[7, 10, 25, 50]}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => setPageSize(size)}
            totalItems={totalItems}
            disabled={isLoading}
          />
        </div>
      )}

      <EditMemoModal
        open={modalState.open}
        value={modalState.description}
        onChange={(value) => setModalState((prev) => ({ ...prev, description: value }))}
        onCancel={handleCloseModal}
        onConfirm={handleMemoSave}
        isSaving={isSaving}
      />
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
