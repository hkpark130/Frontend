import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, isValid } from "date-fns";
import "dayjs/locale/ko";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  fetchDepartments,
  fetchDeviceDetail,
  fetchProjects,
  submitDeviceApplication,
} from "@/api/devices";
import { useUser } from "@/context/UserProvider";
import { RangeDateInput, DeadlineDateField } from "@/components/form/DateInputs";
import { fetchDefaultApprovers } from "@/api/approvals";
import Spinner from "@/components/Spinner";

const toDateString = (value) => (value && isValid(value) ? format(value, "yyyy-MM-dd") : "");

const extractDateString = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    return toDateString(value);
  }
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return "";
};

const initialPayload = (deviceId, userName) => ({
  deviceId,
  userName,
  realUser: userName,
  realUserMode: "auto",
  departmentName: "",
  projectName: "",
  projectCode: "",
  reason: "",
  type: "대여",
  isUsable: false,
  usageStartDate: "",
  usageEndDate: "",
  deadlineDate: toDateString(new Date()),
  description: "",
  categoryName: "",
  approvers: [],
});

export default function DeviceApplication() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useUser();
  const defaultUserName = useMemo(() => {
    if (!user) return "";
    return (
      user?.profile?.preferred_username ||
      user?.profile?.email ||
      user?.profile?.name ||
      ""
    );
  }, [user]);

  const [device, setDevice] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [defaultApprovers, setDefaultApprovers] = useState([]);
  const [isApproverLoading, setIsApproverLoading] = useState(true);
  const [approverFetchError, setApproverFetchError] = useState(null);
  const [form, setForm] = useState(() => initialPayload(deviceId, defaultUserName));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const projectComboRef = useRef(null);

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
        const normalized = Array.isArray(data) ? data.filter(Boolean) : [];
        const sorted = normalized
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
        setDefaultApprovers(sorted);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setApproverFetchError("결재자 목록을 불러오지 못했습니다. 관리자에게 문의해 주세요.");
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
    const handleClickOutside = (event) => {
      if (!projectComboRef.current) return;
      if (!projectComboRef.current.contains(event.target)) {
        setIsProjectDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isProjectDropdownOpen) {
      setProjectSearchTerm("");
    }
  }, [isProjectDropdownOpen]);

  useEffect(() => {
    setForm(initialPayload(deviceId, defaultUserName));
  }, [deviceId, defaultUserName]);

  useEffect(() => {
    if (defaultApprovers.length === 0) {
      return;
    }
    setForm((prev) => {
      if (Array.isArray(prev.approvers) && prev.approvers.length > 0) {
        return prev;
      }
      const usernames = defaultApprovers
        .map((item) => item.username)
        .filter((name) => !!name);
      if (usernames.length === 0) {
        return prev;
      }
      return { ...prev, approvers: usernames };
    });
  }, [defaultApprovers]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceData, departmentData, projectData] = await Promise.all([
          fetchDeviceDetail(deviceId),
          fetchDepartments(),
          fetchProjects(),
        ]);

        setDevice(deviceData);
        setDepartments(departmentData);
        setProjects(projectData);
        setForm((prev) => ({
          ...prev,
          description: deviceData?.description ?? "",
          categoryName: deviceData?.categoryName ?? "",
          departmentName: deviceData?.manageDepName ?? "",
          projectName: deviceData?.projectName ?? "",
          projectCode: deviceData?.projectCode ?? "",
          usageStartDate: extractDateString(deviceData?.usageStartDate) || prev.usageStartDate,
          usageEndDate: extractDateString(deviceData?.usageEndDate) || prev.usageEndDate,
        }));
      } catch (err) {
        console.error(err);
        setError("신청서를 불러오는 중 문제가 발생했습니다.");
      }
    };

    if (deviceId) {
      loadData();
    }
  }, [deviceId]);

  const filteredProjects = useMemo(() => {
    const term = projectSearchTerm.trim().toLowerCase();
    if (!term) {
      return projects;
    }
    return projects.filter((project) => {
      const name = project.name?.toLowerCase() ?? "";
      const code = project.code?.toLowerCase() ?? "";
      return name.includes(term) || code.includes(term);
    });
  }, [projects, projectSearchTerm]);

  const selectedProjectLabel = useMemo(() => {
    if (!form.projectName && !form.projectCode) {
      return "";
    }
    if (!form.projectCode) {
      return form.projectName;
    }
    return `${form.projectName} (${form.projectCode})`;
  }, [form.projectCode, form.projectName]);

  const approverDisplayList = useMemo(() => {
    if (defaultApprovers.length > 0) {
      return defaultApprovers;
    }
    if (Array.isArray(form.approvers) && form.approvers.length > 0) {
      return form.approvers.map((username, index) => ({
        stage: index + 1,
        label: `${index + 1}차 승인자`,
        username,
        displayName: username,
        keycloakId: null,
        locked: true,
      }));
    }
    return [];
  }, [defaultApprovers, form.approvers]);

  const toggleProjectDropdown = () => {
    setIsProjectDropdownOpen((prev) => !prev);
    setProjectSearchTerm("");
  };

  const handleProjectSelect = (project) => {
    setForm((prev) => ({
      ...prev,
      projectName: project.name,
      projectCode: project.code,
    }));
    setProjectSearchTerm("");
    setIsProjectDropdownOpen(false);
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => {
      if (field === "userName" && prev.realUserMode !== "manual") {
        return { ...prev, [field]: value, realUser: value };
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleRealUserMode = (mode) => {
    if (mode === "auto") {
      setForm((prev) => ({ ...prev, realUser: prev.userName, realUserMode: mode }));
    } else {
      setForm((prev) => ({ ...prev, realUserMode: mode }));
    }
  };

  const handleUsagePeriodChange = (start, end) => {
    setForm((prev) => ({ ...prev, usageStartDate: start, usageEndDate: end }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!form.reason.trim()) {
      alert("신청 사유를 입력해 주세요.");
      setError("신청 사유를 입력해 주세요.");
      return;
    }

    if (!form.usageStartDate) {
      alert("사용 시작일을 선택해 주세요.");
      setError("사용 시작일을 선택해 주세요.");
      return;
    }

    if (!form.usageEndDate) {
      alert("사용 종료일을 선택해 주세요.");
      setError("사용 종료일을 선택해 주세요.");
      return;
    }

    if (form.usageStartDate > form.usageEndDate) {
      alert("사용 종료일은 시작일 이후여야 합니다.");
      setError("사용 종료일은 시작일 이후여야 합니다.");
      return;
    }

    if (!form.deadlineDate) {
      alert("신청 마감일을 선택해 주세요.");
      setError("신청 마감일을 선택해 주세요.");
      return;
    }

    const defaultApproverUsernames = defaultApprovers
      .map((item) => item.username)
      .filter((name) => !!name);

    const resolvedApprovers =
      Array.isArray(form.approvers) && form.approvers.length > 0
        ? form.approvers
        : defaultApproverUsernames;

    if (!resolvedApprovers.length) {
      alert("결재자 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
      setError("결재자 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
      return;
    }

    const payload = {
      ...form,
      approvers: resolvedApprovers,
      deadline: `${form.deadlineDate}T00:00:00`,
      usageStartDate: `${form.usageStartDate}T00:00:00`,
      usageEndDate: `${form.usageEndDate}T00:00:00`,
      description: device?.description ?? "",
      status: device?.status ?? "정상",
      deviceStatus: device?.status ?? "정상",
      devicePurpose: device?.purpose ?? "",
      categoryName: form.categoryName ?? device?.categoryName ?? "",
    };

    try {
      setIsSaving(true);
      await submitDeviceApplication(payload);
      alert("신청이 완료되었습니다.");
      navigate("/device/list");
    } catch (err) {
      alert("신청 처리 중 문제가 발생했습니다. 다시 시도해 주세요.");
      console.error(err);
      setError("신청 처리 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="card">
        <h2>장비 사용 신청</h2>
        <p className="muted">장비 신청을 하려면 로그인해 주세요.</p>
      </div>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>장비 사용 신청</h2>
            <p className="muted">선택한 장비에 대한 사용 신청서를 작성해 주세요.</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <form className="form form-layout" onSubmit={handleSubmit}>
          <section className="form-section">
            <div className="form-section-header">
              <h3>신청자 정보</h3>
            </div>
            <div className="form-section-grid applicant-grid">
              <div className="applicant-column">
                <label>
                  사용자
                  <input type="text" value={form.userName} readOnly />
                </label>
                <label className="real-user-field">
                  실제 사용자
                  <div className="input-group real-user-group">
                    <input
                      type="text"
                      value={form.realUser ?? ""}
                      onChange={handleChange("realUser")}
                      placeholder="실제 사용자 이름"
                      disabled={form.realUserMode !== "manual"}
                    />
                    <div className="group-buttons real-user-buttons">
                      <button
                        type="button"
                        className={form.realUserMode !== "manual" ? "primary" : "outline"}
                        onClick={() => toggleRealUserMode("auto")}
                      >
                        자동
                      </button>
                      <button
                        type="button"
                        className={form.realUserMode === "manual" ? "primary" : "outline"}
                        onClick={() => toggleRealUserMode("manual")}
                      >
                        직접 입력
                      </button>
                    </div>
                  </div>
                </label>
              </div>
              <div className="applicant-column">
                <RangeDateInput
                  startDate={form.usageStartDate}
                  endDate={form.usageEndDate}
                  onChange={handleUsagePeriodChange}
                />
                <DeadlineDateField
                  value={form.deadlineDate}
                  onChange={(date) =>
                    setForm((prev) => ({ ...prev, deadlineDate: date ?? "" }))
                  }
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
                <input type="text" value={form.deviceId} readOnly />
              </label>
              <label className="device-info-label">
                품목
                <input type="text" value={form.categoryName ?? ""} readOnly />
              </label>
              <label className="device-info-label">
                관리부서
                <select value={form.departmentName ?? ""} onChange={handleChange("departmentName")}> 
                  <option value="">선택하세요</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="device-info-label">
                프로젝트
                <div className="combobox-wrapper" ref={projectComboRef}>
                  <div className={`combobox${isProjectDropdownOpen ? " open" : ""}`} style={{width: '100%'}}>
                    <button
                      type="button"
                      className="combobox-trigger"
                      onClick={toggleProjectDropdown}
                      style={{width: '100%'}}
                    >
                      <span>{selectedProjectLabel || "프로젝트를 선택하세요"}</span>
                      <span className="combobox-caret" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                    {isProjectDropdownOpen && (
                      <div className="combobox-panel" style={{width: '100%', minWidth: 0}}>
                        <input
                          type="text"
                          className="combobox-search"
                          placeholder="프로젝트 이름 또는 코드를 검색하세요"
                          value={projectSearchTerm}
                          onChange={(event) => setProjectSearchTerm(event.target.value)}
                          autoFocus
                          style={{width: '100%'}}
                        />
                        <div className="combobox-list">
                          {filteredProjects.length === 0 && (
                            <p className="combobox-empty">검색 결과가 없습니다.</p>
                          )}
                          {filteredProjects.map((project) => (
                            <button
                              type="button"
                              key={project.id}
                              className="combobox-option"
                              onClick={() => handleProjectSelect(project)}
                            >
                              <span className="combobox-option-name">{project.name}</span>
                              {project.code && (
                                <span className="combobox-option-code">{project.code}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            </div>
            <style jsx>{`
              .device-info-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 24px 32px;
                margin-bottom: 8px;
                align-items: flex-end;
              }
              .device-info-label {
                display: flex;
                flex-direction: column;
                min-width: 180px;
                margin-bottom: 0;
                margin-right: 0;
                gap: 6px;
                flex: 1 1 220px;
                max-width: 260px;
              }
              .device-info-label input,
              .device-info-label select,
              .device-info-label .combobox-wrapper {
                width: 100%;
                box-sizing: border-box;
              }
              .device-info-label input,
              .device-info-label select {
                margin-top: 4px;
                padding: 8px 10px;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                font-size: 15px;
                background: #f9fafb;
                min-width: 0;
                transition: border-color 0.2s;
              }
              /* Combobox(프로젝트 선택)도 동일한 radius 적용 */
              .combobox-trigger {
                border-radius: 8px !important;
                border: 1px solid #d1d5db;
                background: #f9fafb;
                padding: 8px 10px;
                font-size: 15px;
                width: 100%;
                text-align: left;
                transition: border-color 0.2s;
              }
              .combobox.open .combobox-trigger {
                border-bottom-left-radius: 0 !important;
                border-bottom-right-radius: 0 !important;
              }
              .combobox-panel {
                width: 100% !important;
                min-width: 0 !important;
                box-sizing: border-box;
                border-radius: 0 0 8px 8px !important;
                border: 1px solid #d1d5db;
                border-top: none;
                background: #fff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                overflow: hidden;
              }
              .combobox-search {
                width: 100% !important;
                box-sizing: border-box;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                margin-bottom: 6px;
                padding: 8px 10px;
                font-size: 15px;
                background: #f9fafb;
              }
              /* combobox-option도 radius 살짝 */
              .combobox-option {
                border-radius: 6px;
                transition: background 0.15s;
              }
              .combobox-option:focus,
              .combobox-option:hover {
                background: #f1f5f9;
              }
              .approver-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 16px 24px;
              }
              .approver-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-width: 180px;
                flex: 1 1 220px;
                max-width: 260px;
              }
              .approver-field input {
                padding: 8px 10px;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                font-size: 15px;
                background: #f9fafb;
              }
              @media (max-width: 900px) {
                .device-info-grid {
                  flex-direction: column;
                  gap: 16px 0;
                }
                .device-info-label {
                  max-width: 100%;
                }
                .approver-grid {
                  flex-direction: column;
                  gap: 12px 0;
                }
              }
              @media (max-width: 900px) {
                .device-info-grid {
                  flex-direction: column;
                  gap: 16px 0;
                }
                .device-info-label {
                  max-width: 100%;
                }
              }
            `}</style>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h3>결재자</h3>
              {isApproverLoading && (
                <p className="muted">결재자 정보를 불러오는 중입니다...</p>
              )}
              {approverFetchError && <p className="error">{approverFetchError}</p>}
            </div>
            <div className="approver-grid">
              {approverDisplayList.map((approver) => (
                <label
                  key={`${approver.stage}-${approver.username || approver.displayName}`}
                  className="approver-field"
                >
                  {approver.label ?? `${approver.stage}차 승인자`}
                  <input
                    type="text"
                    value={approver.displayName ?? approver.username ?? ""}
                    readOnly
                  />
                </label>
              ))}
              {!isApproverLoading && approverDisplayList.length === 0 && !approverFetchError && (
                <div className="muted">표시할 결재자가 없습니다.</div>
              )}
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h3>사용 사유</h3>
            </div>
            <label className="stretch">
              신청 사유
              <textarea
                value={form.reason}
                onChange={handleChange("reason")}
                rows={4}
                placeholder="상세 사유를 입력해 주세요."
              />
            </label>
          </section>

          <div className="form-actions">
            <button type="button" onClick={() => navigate(-1)} className="outline">
              취소
            </button>
            <button type="submit" className="primary" disabled={isSaving}>
              {isSaving ? (<><Spinner size={14} />신청 중...</>) : ("신청하기")}
            </button>
          </div>
        </form>
      </div>
    </LocalizationProvider>
  );
}
