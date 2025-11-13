import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Tooltip from "@/components/Tooltip";
import Pagination from "@/components/Pagination";
import { fetchMyDevices, updateMyDeviceMemo } from "@/api/devices";
import { useUser } from "@/context/UserProvider";
import SearchIcon from "@/components/icons/SearchIcon";

const filterOptions = [
  { value: "all", label: "전체" },
  { value: "categoryName", label: "품목" },
  { value: "id", label: "관리번호" },
  { value: "manageDepName", label: "관리부서" },
  { value: "projectName", label: "프로젝트" },
  { value: "purpose", label: "용도" },
  { value: "statusLabel", label: "진행 상태" },
  { value: "displayUser", label: "사용자" },
];

const emptyMetadata = {
  categories: [],
  projects: [],
  departments: [],
};

const defaultPageSizeOptions = [7, 10, 25, 50];

const chipFilterFields = new Set(["categoryName", "projectName", "manageDepName"]);

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

const enrichDevice = (device) => {
  if (!device || typeof device !== "object") {
    return device;
  }

  const displayUser = device.realUser?.trim().length
    ? device.realUser.trim()
    : device.username ?? "";

  const approvalInfo = device.approvalInfo?.trim();
  const approvalType = device.approvalType?.trim();

  let statusLabel = device.status ?? "";
  if (approvalInfo && approvalType) {
    statusLabel = approvalInfo === "승인완료"
      ? approvalInfo
      : `${approvalType} ${approvalInfo}`.trim();
  } else if (approvalInfo) {
    statusLabel = approvalInfo;
  }

  return {
    ...device,
    displayUser,
    statusLabel,
  };
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

const pendingApprovalStatuses = new Set(["승인대기", "대기중", "진행중", "1차승인완료", "2차승인완료"]);

const canSubmitMyAssetFollowup = (device) => {
  if (!device) {
    return false;
  }
  const normalizedStatus = (device.approvalInfo || "").replace(/\s+/g, "");
  const hasPendingApproval = pendingApprovalStatuses.has(normalizedStatus);
  const isInUse = device.isUsable === false;
  return isInUse && !hasPendingApproval;
};

export default function MyAssets() {
  const { isLoggedIn } = useUser();
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [pageSizeOptions, setPageSizeOptions] = useState(defaultPageSizeOptions);
  const [chipFilter, setChipFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filterKey, setFilterKey] = useState("all");
  const [sortKey, setSortKey] = useState("categoryName");
  const [sortDirection, setSortDirection] = useState("asc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modalState, setModalState] = useState({ open: false, device: null, description: "" });

  useEffect(() => {
    const handle = setTimeout(() => {
      setKeyword(searchValue.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchValue]);

  useEffect(() => {
    if (!chipFilterFields.has(filterKey) && chipFilter !== "ALL") {
      setChipFilter("ALL");
    }
  }, [filterKey, chipFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey, keyword, chipFilter, pageSize]);

  const loadDevices = useCallback(async () => {
    if (!isLoggedIn) {
      setDevices([]);
      setMetadata(emptyMetadata);
      setPageSizeOptions(defaultPageSizeOptions);
      setTotalItems(0);
      setTotalPages(1);
      setSelectedDeviceIds([]);
      return;
    }

    const params = {
      page: currentPage,
      size: pageSize,
      filterField: filterKey,
      sortField: sortKey,
      sortDirection,
    };

    if (keyword) {
      params.keyword = keyword;
    }

    if (chipFilterFields.has(filterKey) && chipFilter && chipFilter !== "ALL") {
      params.chipValue = chipFilter;
    }

    try {
      setIsLoading(true);
      setError(null);
      const pageData = await fetchMyDevices(params);

      const content = Array.isArray(pageData?.content) ? pageData.content : [];
      const enriched = content.map(enrichDevice);
      setDevices(enriched);
      setSelectedDeviceIds((prev) => {
        const deduped = Array.from(new Set(prev.filter((value) => typeof value === "string" && value.trim())));
        if (deduped.length === 0) {
          return deduped;
        }
        return deduped.filter((id) => {
          const match = enriched.find((device) => device?.id != null && device.id.toString() === id);
          if (!match) {
            return true;
          }
          return canSubmitMyAssetFollowup(match);
        });
      });

      const totalElements = Number(pageData?.totalElements ?? 0);
      setTotalItems(Number.isNaN(totalElements) ? 0 : totalElements);
      setTotalPages(pageData?.totalPages > 0 ? pageData.totalPages : 1);

      if (typeof pageData?.page === "number" && pageData.page > 0 && pageData.page !== currentPage) {
        setCurrentPage(pageData.page);
      }

      if (typeof pageData?.size === "number" && pageData.size > 0 && pageData.size !== pageSize) {
        setPageSize(pageData.size);
      }

      const meta = pageData?.metadata ?? {};
      const categories = Array.isArray(meta.categories) ? meta.categories : [];
      const projects = Array.isArray(meta.projects) ? meta.projects : [];
      const departments = Array.isArray(meta.departments) ? meta.departments : [];
      const sizeOptions = Array.isArray(meta.pageSizeOptions) && meta.pageSizeOptions.length > 0
        ? meta.pageSizeOptions
        : defaultPageSizeOptions;

      setMetadata({ categories, projects, departments });
      setPageSizeOptions(sizeOptions);
    } catch (err) {
      console.error(err);
      setError("나의 장비 목록을 불러오는 중 문제가 발생했습니다.");
      setDevices([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [chipFilter, currentPage, filterKey, isLoggedIn, keyword, pageSize, sortDirection, sortKey]);

  useEffect(() => {
    if (!isLoggedIn) {
      setDevices([]);
      return;
    }
    loadDevices();
  }, [isLoggedIn, loadDevices]);

  const chipOptions = useMemo(() => {
    if (!chipFilterFields.has(filterKey)) {
      return [];
    }
    if (filterKey === "categoryName") {
      return ["ALL", ...(metadata.categories ?? [])];
    }
    if (filterKey === "projectName") {
      return ["ALL", ...(metadata.projects ?? [])];
    }
    if (filterKey === "manageDepName") {
      return ["ALL", ...(metadata.departments ?? [])];
    }
    return [];
  }, [filterKey, metadata]);

  useEffect(() => {
    if (chipFilter === "ALL") {
      return;
    }
    if (chipOptions.length === 0 || !chipOptions.includes(chipFilter)) {
      setChipFilter("ALL");
    }
  }, [chipFilter, chipOptions]);

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
      const payload = { description: modalState.description ?? "" };
      const updated = await updateMyDeviceMemo(modalState.device.id, payload);
      setDevices((prev) => prev.map((item) => (item.id === updated.id ? enrichDevice(updated) : item)));
      handleCloseModal();
      alert("수정되었습니다.");
    } catch (err) {
      console.error(err);
      alert("비고 수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const toggleSelection = (deviceId, selectable = true) => {
    if (!selectable || deviceId == null) {
      return;
    }
    const normalizedId = deviceId.toString();
    setSelectedDeviceIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId]
    );
  };

  const handleBulkAction = (action) => {
    if (selectedDeviceIds.length === 0) {
      return;
    }
    const uniqueIds = Array.from(new Set(selectedDeviceIds));
    const query = new URLSearchParams({ ids: uniqueIds.join(",") }).toString();
    navigate(`/mypage/my-assets/${action}?${query}`, { state: { deviceIds: uniqueIds } });
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
        <div
          className="card-actions"
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}
        >
          {selectedDeviceIds.length > 0 && (
            <span className="muted" style={{ fontSize: 13 }}>
              선택 {selectedDeviceIds.length}대
            </span>
          )}
          <button
            type="button"
            className="outline"
            onClick={() => handleBulkAction("return")}
            disabled={selectedDeviceIds.length === 0}
          >
            반납
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleBulkAction("disposal")}
            disabled={selectedDeviceIds.length === 0}
          >
            폐기
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
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
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
                <th aria-label="선택" />
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
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">등록된 장비가 없습니다.</td>
                </tr>
              ) : (
                devices.map((device) => {
                  const normalizedId = device.id != null ? device.id.toString() : "";
                  const description = device.description ?? "";
                  const truncated = truncate(description, 50);
                  const normalizedStatus = (device.approvalInfo || "").replace(/\s+/g, "");
                  const hasPendingApproval = pendingApprovalStatuses.has(normalizedStatus);
                  const canSubmitFollowup = canSubmitMyAssetFollowup(device);
                  const isSelected = normalizedId && selectedDeviceIds.includes(normalizedId);

                  const handleRowClick = (event) => {
                    if (event.target.closest('input,button,a,select,textarea')) {
                      return;
                    }
                    toggleSelection(device.id, canSubmitFollowup);
                  };

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
                    <tr
                      key={device.id}
                      className={isSelected ? "selected-row" : ""}
                      onClick={handleRowClick}
                      style={{
                        cursor: canSubmitFollowup ? "pointer" : "default",
                        backgroundColor: isSelected ? "#f3f9ff" : undefined,
                      }}
                    >
                      <td>
                        <input
                          type="radio"
                          name={`my-assets-selection-${device.id}`}
                          className="selection-radio"
                          checked={isSelected}
                          disabled={!canSubmitFollowup}
                          aria-disabled={!canSubmitFollowup}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelection(device.id, canSubmitFollowup);
                          }}
                          onChange={() => {}}
                          aria-label={`${device.categoryName ?? "장비"} ${device.id} 선택`}
                          style={{ width: 20, height: 20 }}
                        />
                      </td>
                      <td>{device.categoryName ?? "-"}</td>
                      <td>{device.id ?? "-"}</td>
                      <td>{device.displayUser || "-"}</td>
                      <td>{device.manageDepName ?? "-"}</td>
                      <td>{device.projectName ?? "-"}</td>
                      <td>{purposeContent}</td>
                      <td>{device.statusLabel ?? "-"}</td>
                      <td>{descriptionCell}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenModal(device);
                            }}
                          >
                            비고 수정
                          </button>
                        </div>
                        {!canSubmitFollowup && hasPendingApproval && (
                          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                            결재 진행 중입니다.
                          </div>
                        )}
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
            pageSizeOptions={pageSizeOptions}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
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
