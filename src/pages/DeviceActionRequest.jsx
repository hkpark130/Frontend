import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/ko";
import { format } from "date-fns";
import { fetchDeviceDetail, submitDeviceApplication } from "@/api/devices";
import { fetchDefaultApprovers } from "@/api/approvals";
import { fetchTags } from "@/api/tags";
import { DeadlineDateField } from "@/components/form/DateInputs";
import { useUser } from "@/context/UserProvider";
import Spinner from "@/components/Spinner";
import "./DeviceFormStyles.css";

const ACTION_CONFIG = {
  반납: {
    pageTitle: "장비 반납 신청",
    description: "보유 중인 장비의 반납을 요청합니다. 반납 사유와 처리 희망일을 입력해 주세요.",
    statusLabel: "승인 완료 후 장비 상태",
    statusPlaceholder: "예: 반납 요청",
    defaultStatus: "반납 요청",
    deadlineLabel: "반납 예정일",
    reasonPlaceholder: "반납 사유를 입력해 주세요.",
    successMessage: "반납 신청이 접수되었습니다.",
    isUsableOnSubmit: false,
  },
  폐기: {
    pageTitle: "장비 폐기 신청",
    description: "사용이 어려운 장비의 폐기를 요청합니다. 폐기 사유와 처리 희망일을 입력해 주세요.",
    statusLabel: "승인 완료 후 장비 상태",
    statusPlaceholder: "예: 폐기 요청",
    defaultStatus: "폐기 요청",
    deadlineLabel: "요청 완료 희망일",
    reasonPlaceholder: "폐기 사유를 입력해 주세요.",
    successMessage: "폐기 신청이 접수되었습니다.",
    isUsableOnSubmit: false,
  },
};

const DEFAULT_TAG_SUGGESTIONS = ["OS 미설치", "포맷완료"];

const normalizeTagName = (value) => (typeof value === "string" ? value.trim() : "");

const tagKey = (value) => {
  const normalized = normalizeTagName(value);
  return normalized ? normalized.toLowerCase() : "";
};

const dedupeTagNames = (values = []) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = normalizeTagName(value);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(normalized);
  });
  return result;
};

const hasTag = (collection, candidate) => {
  const key = tagKey(candidate);
  if (!key) {
    return false;
  }
  return collection.some((item) => tagKey(item) === key);
};

const removeTag = (collection, candidate) =>
  collection.filter((item) => tagKey(item) !== tagKey(candidate));

const mergeTagOptions = (base = [], additions = []) =>
  dedupeTagNames([...(base ?? []), ...(additions ?? [])]);

const normalizeApprovers = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter(Boolean)
    .map((item) => ({
      stage: Number.isFinite(item?.stage)
        ? item.stage
        : Number.parseInt(item?.stage ?? 0, 10) || 0,
      label: item?.label || null,
      username: item?.username || "",
      displayName: item?.displayName || item?.username || "",
      keycloakId: item?.keycloakId || null,
      locked: item?.locked ?? true,
    }))
    .sort((a, b) => a.stage - b.stage);
};

function DeviceActionRequest({ actionType }) {
  const config = ACTION_CONFIG[actionType] ?? null;
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useUser();
  const isReturnAction = actionType === "반납";

  const defaultUserName = useMemo(() => {
    if (!user) return "";
    return (
      user?.profile?.preferred_username ||
      user?.profile?.email ||
      user?.profile?.name ||
      ""
    );
  }, [user]);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const [device, setDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [defaultApprovers, setDefaultApprovers] = useState([]);
  const [isApproverLoading, setIsApproverLoading] = useState(true);
  const [approverFetchError, setApproverFetchError] = useState(null);
  const [prefilled, setPrefilled] = useState(false);

  const [form, setForm] = useState(() => ({
    reason: "",
    description: "",
    deadlineDate: today,
    // 액션 타입에 따라 기본 상태 지정 (폐기는 '폐기'로 고정)
    status: actionType === "폐기" ? "폐기" : config?.defaultStatus ?? "",
  }));
  const [tagOptions, setTagOptions] = useState(() => (isReturnAction ? dedupeTagNames(DEFAULT_TAG_SUGGESTIONS) : []));
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [tagFetchError, setTagFetchError] = useState(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      reason: "",
      description: "",
      deadlineDate: today,
    }));
    setPrefilled(false);
  }, [deviceId, today]);

  useEffect(() => {
    if (!isReturnAction) {
      setTagOptions([]);
      setSelectedTags([]);
      setTagInput("");
      setTagFetchError(null);
      setIsTagLoading(false);
      return undefined;
    }

    let cancelled = false;
    setTagOptions(dedupeTagNames(DEFAULT_TAG_SUGGESTIONS));

    const loadTags = async () => {
      setTagFetchError(null);
      setIsTagLoading(true);
      try {
        const data = await fetchTags();
        if (cancelled) {
          return;
        }
        if (Array.isArray(data)) {
          setTagOptions((prev) => mergeTagOptions(prev, data));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setTagFetchError("태그를 불러오지 못했습니다. 필요하면 직접 추가해 주세요.");
        }
      } finally {
        if (!cancelled) {
          setIsTagLoading(false);
        }
      }
    };

    loadTags();
    return () => {
      cancelled = true;
    };
  }, [isReturnAction]);

  useEffect(() => {
    let cancelled = false;

    const loadApprovers = async () => {
      setApproverFetchError(null);
      setIsApproverLoading(true);
      try {
        const data = await fetchDefaultApprovers();
        if (cancelled) {
          return;
        }
        setDefaultApprovers(normalizeApprovers(data));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setApproverFetchError("결재자 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
          setDefaultApprovers([]);
        }
      } finally {
        if (!cancelled) {
          setIsApproverLoading(false);
        }
      }
    };

    loadApprovers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDevice = async () => {
      if (!deviceId) {
        setDevice(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchDeviceDetail(deviceId);
        if (cancelled) {
          return;
        }
        setDevice(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("장비 정보를 불러오는 중 문제가 발생했습니다.");
          setDevice(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDevice();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!isReturnAction) {
      setSelectedTags([]);
      return;
    }
    if (!device) {
      setSelectedTags([]);
      return;
    }
    const deviceTags = dedupeTagNames(device.tags ?? []);
    setSelectedTags(deviceTags);
    setTagOptions((prev) => mergeTagOptions(prev, deviceTags));
  }, [device, isReturnAction]);

  useEffect(() => {
    if (!device || prefilled) {
      return;
    }
    setForm((prev) => {
      const previousStatus = typeof prev.status === "string" && prev.status.trim()
        ? prev.status
        : null;
      // 폐기 신청일 경우 상태를 '폐기'로 고정
      const resolvedStatus = actionType === "폐기"
        ? "폐기"
        : device.status ?? previousStatus ?? config?.defaultStatus ?? "";
      return {
        ...prev,
        status: resolvedStatus,
        description: device.description ?? prev.description,
      };
    });
    setPrefilled(true);
  }, [device, prefilled, config?.defaultStatus, actionType]);

  const applicantName = useMemo(() => {
    const normalized = (defaultUserName || "").trim();
    if (normalized) {
      return normalized;
    }
    if (typeof device?.realUser === "string" && device.realUser.trim()) {
      return device.realUser.trim();
    }
    if (typeof device?.username === "string" && device.username.trim()) {
      return device.username.trim();
    }
    return "";
  }, [defaultUserName, device]);

  const approverDisplayList = useMemo(() => {
    if (defaultApprovers.length > 0) {
      return defaultApprovers;
    }
    return [];
  }, [defaultApprovers]);

  const statusOptions = useMemo(() => {
    if (actionType === "반납") return ["정상", "노후"];
    if (actionType === "폐기") return ["폐기"];
    return ["정상", "노후", "폐기"];
  }, [actionType]);

  const blockingApproval = useMemo(() => {
    if (!device) {
      return null;
    }
    const typeLabel = typeof device.approvalType === "string" ? device.approvalType.trim() : "";
    if (!typeLabel || !["반납", "폐기"].includes(typeLabel)) {
      return null;
    }
    const statusLabel = typeof device.approvalInfo === "string" ? device.approvalInfo.trim() : "";
    if (!statusLabel) {
      return null;
    }
    const normalizedStatus = statusLabel.replace(/\s+/g, "");
    const activeStatuses = ["승인대기", "1차승인완료", "진행중"];
    const isActive = activeStatuses.some((status) =>
      normalizedStatus === status || normalizedStatus.includes(status)
    );
    if (!isActive) {
      return null;
    }
    return { type: typeLabel, status: statusLabel };
  }, [device]);

  const isSubmissionBlocked = useMemo(() => Boolean(blockingApproval), [blockingApproval]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 실제 사용자 직접 입력 UI는 제거되어 함수 사용하지 않음

  const handleRadioChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, status: value }));
  };

  const handleTagSubmit = () => {
    const normalized = normalizeTagName(tagInput);
    if (!normalized) {
      setTagInput("");
      return;
    }
    setSelectedTags((prev) => {
      if (hasTag(prev, normalized)) {
        return prev;
      }
      return [...prev, normalized];
    });
    setTagOptions((prev) => mergeTagOptions(prev, [normalized]));
    setTagInput("");
  };

  const handleTagInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleTagSubmit();
    }
  };

  const toggleTagSelection = (tag) => {
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setSelectedTags((prev) =>
      hasTag(prev, normalized) ? removeTag(prev, normalized) : [...prev, normalized]
    );
    setTagOptions((prev) => mergeTagOptions(prev, [normalized]));
  };

  const handleRemoveTagOption = (tag) => {
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setTagOptions((prev) => prev.filter((item) => tagKey(item) !== tagKey(normalized)));
    setSelectedTags((prev) => removeTag(prev, normalized));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (isSubmissionBlocked) {
      const message = blockingApproval
        ? `이미 ${blockingApproval.type} 신청이 ${blockingApproval.status} 상태입니다. 기존 신청이 완료된 후 다시 신청해 주세요.`
        : "이미 처리 중인 반납/폐기 신청이 있습니다. 기존 신청이 완료된 후 다시 신청해 주세요.";
      setError(message);
      alert(message);
      return;
    }

    if (!config) {
      setError("지원되지 않는 신청 유형입니다.");
      alert("지원되지 않는 신청 유형입니다.");
      return;
    }

    if (!device) {
      setError("장비 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
      alert("장비 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    const applicant = applicantName;
    if (!applicant) {
      setError("신청자 정보를 확인할 수 없습니다. 로그인 상태를 확인해 주세요.");
      alert("신청자 정보를 확인할 수 없습니다. 로그인 상태를 확인해 주세요.");
      return;
    }

    const reason = (form.reason ?? "").trim();
    if (!reason) {
      setError("신청 사유를 입력해 주세요.");
      alert("신청 사유를 입력해 주세요.");
      return;
    }

    const resolvedApprovers = approverDisplayList
      .map((item) => item.username)
      .filter((name) => !!name);

    if (!resolvedApprovers.length) {
      setError("결재자 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
      alert("결재자 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
      return;
    }

    // 실제 사용자 입력은 필요하지 않으므로 서버로는 null을 전달합니다.
    const statusValue = (form.status ?? "").trim() || device.status || config.defaultStatus || "";
    const descriptionValue = (form.description ?? "").trim();
    const payload = {
      deviceId: device.id ?? deviceId,
  userName: applicant,
  realUser: null,
      reason,
      type: actionType,
      approvers: resolvedApprovers,
      description: descriptionValue || device.description || "",
      status: statusValue,
      deviceStatus: statusValue,
      devicePurpose: device.purpose ?? "",
      departmentName: device.manageDepName ?? "",
      projectName: device.projectName ?? "",
      projectCode: device.projectCode ?? "",
      isUsable: config.isUsableOnSubmit,
      usageStartDate: null,
      usageEndDate: null,
    };

    if (form.deadlineDate) {
      payload.deadline = `${form.deadlineDate}T00:00:00`;
    }

    if (isReturnAction) {
      payload.tag = dedupeTagNames(selectedTags);
    }

    try {
      setIsSaving(true);
      await submitDeviceApplication(payload);
      alert(config.successMessage);
      navigate("/mypage/my-assets");
    } catch (err) {
      alert("신청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      console.error(err);
      setError("신청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="card">
        <h2>잘못된 요청</h2>
        <p className="muted">지원되지 않는 장비 신청 유형입니다.</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="card">
        <h2>{config.pageTitle}</h2>
        <p className="muted">신청을 진행하려면 로그인해 주세요.</p>
      </div>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>{config.pageTitle}</h2>
            <p className="muted">{config.description}</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {isLoading ? (
          <p>불러오는 중입니다...</p>
        ) : !device ? (
          <p className="error">장비 정보를 찾을 수 없습니다.</p>
        ) : (
          <form className="form form-layout" onSubmit={handleSubmit}>
            {isSubmissionBlocked && (
              <p className="error" role="alert">
                {blockingApproval
                  ? `이미 ${blockingApproval.type} 신청이 ${blockingApproval.status} 상태입니다. 기존 신청이 완료된 후 다시 신청해 주세요.`
                  : "이미 처리 중인 반납/폐기 신청이 있습니다. 기존 신청이 완료된 후 다시 신청해 주세요."}
              </p>
            )}
            <section className="form-section">
              <div className="form-section-header">
                <h3>신청자 정보</h3>
              </div>
              <div className="form-section-grid applicant-grid">
                <div className="applicant-column">
                  <label>
                    사용자
                    <input type="text" value={applicantName} readOnly />
                  </label>
                </div>
                <div className="applicant-column applicant-column--compact">
                  <DeadlineDateField
                    value={form.deadlineDate}
                    onChange={(date) => setForm((prev) => ({ ...prev, deadlineDate: date ?? "" }))}
                    label={config.deadlineLabel}
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-header">
                <h3>장비 정보</h3>
              </div>
              <div className="device-info-grid">
                <label className="device-info-label">
                  관리번호
                  <input type="text" value={device.id ?? ""} readOnly />
                </label>
                <label className="device-info-label">
                  품목
                  <input type="text" value={device.categoryName ?? ""} readOnly />
                </label>
                <label className="device-info-label">
                  현재 상태
                  <input type="text" value={device.status ?? ""} readOnly />
                </label>
                <label className="device-info-label">
                  프로젝트
                  <input type="text" value={device.projectName ?? ""} readOnly />
                </label>
                <label className="device-info-label">
                  관리부서
                  <input type="text" value={device.manageDepName ?? ""} readOnly />
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-header">
                <h3>요청 상세</h3>
              </div>
              <div className="form-section-grid status-grid">
                <label>
                  {config.statusLabel}
                  <div className="status-radio-group">
                    {statusOptions.map((opt) => {
                      const checked = form.status === opt;
                      const singleOption = statusOptions.length === 1;
                      const radioClass = `status-radio${singleOption ? " status-radio--disabled" : ""}`;
                      return (
                        <label
                          key={opt}
                          className={radioClass}
                        >
                          <input
                            type="radio"
                            name="status"
                            value={opt}
                            checked={checked}
                            onChange={handleRadioChange}
                            className="status-radio-input"
                            disabled={singleOption}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </label>
                <label className="stretch">
                  신청 사유
                  <textarea
                    value={form.reason}
                    onChange={handleChange("reason")}
                    rows={4}
                    placeholder={config.reasonPlaceholder}
                  />
                </label>
                {/* 추가 메모 섹션은 요구에 따라 제거되었습니다. */}
              </div>
            </section>

            {isReturnAction && (
              <section className="form-section">
                <div className="form-section-header">
                  <h3>태그</h3>
                  <div className="tag-meta">
                    <span className="tag-status">
                      {selectedTags.length > 0
                        ? `선택된 태그 ${selectedTags.length}개`
                        : "선택된 태그가 없습니다."}
                    </span>
                    {isTagLoading && (
                      <span className="tag-status loading">태그를 불러오는 중입니다...</span>
                    )}
                    {tagFetchError && <span className="tag-status error">{tagFetchError}</span>}
                  </div>
                </div>
                <div className="tag-section">
                  <div className="tag-input-row">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="새 태그를 입력하고 Enter 키 또는 추가 버튼을 눌러주세요."
                    />
                    <button
                      type="button"
                      className="outline tag-add-button"
                      onClick={handleTagSubmit}
                      disabled={!normalizeTagName(tagInput)}
                    >
                      태그 추가
                    </button>
                  </div>
                  <p className="tag-hint">
                    태그는 반납 신청 시 장비 상태를 빠르게 파악하는 데 사용됩니다. 자주 쓰는 태그를 선택하거나 직접 추가할 수 있어요.
                  </p>
                  <div className="tag-options">
                    {tagOptions.length === 0 ? (
                      <span className="tag-status muted">표시할 태그가 없습니다.</span>
                    ) : (
                      tagOptions.map((option) => {
                        const normalized = normalizeTagName(option);
                        if (!normalized) {
                          return null;
                        }
                        const selected = hasTag(selectedTags, normalized);
                        return (
                          <div
                            key={tagKey(normalized)}
                            className={`tag-chip${selected ? " selected" : ""}`}
                            onClick={() => toggleTagSelection(normalized)}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleTagSelection(normalized);
                              }
                            }}
                          >
                            <span className="tag-label">{normalized}</span>
                            <button
                              type="button"
                              className="remove-btn"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleRemoveTagOption(normalized);
                              }}
                              aria-label={`태그 ${normalized} 삭제`}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="form-section">
              <div className="form-section-header">
                <h3>결재자</h3>
                {isApproverLoading && (
                  <p className="muted">결재자 정보를 불러오는 중입니다...</p>
                )}
                {approverFetchError && <p className="error">{approverFetchError}</p>}
              </div>
              <div className="approver-grid approver-grid--spaced">
                {approverDisplayList.map((approver) => (
                  <label
                    key={`${approver.stage}-${approver.username || approver.displayName}`}
                    className="approver-field"
                  >
                    {approver.label ?? `${approver.stage}차 승인자`}
                    <input type="text" value={approver.displayName ?? approver.username ?? ""} readOnly />
                  </label>
                ))}
                {!isApproverLoading && approverDisplayList.length === 0 && !approverFetchError && (
                  <div className="muted">표시할 결재자가 없습니다.</div>
                )}
              </div>
            </section>

            <div className="form-actions">
              <button type="button" onClick={() => navigate(-1)} className="outline">
                취소
              </button>
              <button
                type="submit"
                className="primary"
                disabled={isSaving || isApproverLoading || isSubmissionBlocked}
              >
                {isSaving ? (<><Spinner size={14} />신청 중...</>) : ("신청하기")}
              </button>
            </div>
          </form>
        )}
      </div>
    </LocalizationProvider>
  );
}

export function DeviceReturnRequest() {
  return <DeviceActionRequest actionType="반납" />;
}

export function DeviceDisposalRequest() {
  return <DeviceActionRequest actionType="폐기" />;
}
