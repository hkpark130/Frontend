import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { addDays, format, isValid } from "date-fns";
import "dayjs/locale/ko";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  fetchDepartments,
  fetchDeviceDetail,
  submitDeviceApplication,
} from "@/api/devices";
import { fetchProjects } from "@/api/projects";
import { useUser } from "@/context/UserProvider";
import { RangeDateInput, DeadlineDateField } from "@/components/form/DateInputs";
import { fetchDefaultApprovers } from "@/api/approvals";
import Spinner from "@/components/Spinner";
import ProjectCombobox from "@/components/form/ProjectCombobox";
import "./DeviceFormStyles.css";

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

const normalizeName = (value) => (typeof value === "string" ? value.trim() : "");

const defaultDeadlineDate = () => toDateString(addDays(new Date(), 7));

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
  deadlineDate: defaultDeadlineDate(),
  description: "",
  categoryName: "",
  approvers: [],
});

export default function DeviceApplication() {
  const { deviceId: routeDeviceId } = useParams();
  const location = useLocation();
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

    const stateDeviceIds = useMemo(() => {
      const raw = location.state?.deviceIds;
      if (!raw) {
        return [];
      }
      if (Array.isArray(raw)) {
        return raw.map((id) => id?.toString?.() ?? String(id)).filter(Boolean);
      }
      return [raw?.toString?.() ?? String(raw)];
    }, [location.state]);

    const queryDeviceIds = useMemo(() => {
      if (!location.search) {
        return [];
      }
      const params = new URLSearchParams(location.search);
      const raw = params.get("deviceIds") ?? params.get("ids");
      if (!raw) {
        return [];
      }
      return raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }, [location.search]);

    const derivedDeviceIds = useMemo(() => {
      if (stateDeviceIds.length > 0) {
        return Array.from(new Set(stateDeviceIds));
      }
      if (routeDeviceId) {
        return [String(routeDeviceId)];
      }
      if (queryDeviceIds.length > 0) {
        return Array.from(new Set(queryDeviceIds));
      }
      return [];
    }, [stateDeviceIds, routeDeviceId, queryDeviceIds]);

    const primaryDeviceId = derivedDeviceIds[0] ?? "";

    const [selectedDevices, setSelectedDevices] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [projects, setProjects] = useState([]);
    const [defaultApprovers, setDefaultApprovers] = useState([]);
    const [isApproverLoading, setIsApproverLoading] = useState(true);
    const [approverFetchError, setApproverFetchError] = useState(null);
    const [form, setForm] = useState(() => initialPayload(primaryDeviceId, defaultUserName));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isDeviceLoading, setIsDeviceLoading] = useState(false);
  const [deviceOverrides, setDeviceOverrides] = useState({});
  const [deviceValidation, setDeviceValidation] = useState({});

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
    setForm(initialPayload(primaryDeviceId, defaultUserName));
  }, [primaryDeviceId, defaultUserName]);

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
    let cancelled = false;

    const loadBackgroundData = async () => {
      try {
        const [departmentData, projectData] = await Promise.all([
          fetchDepartments(),
          fetchProjects(),
        ]);
        if (cancelled) {
          return;
        }
        setDepartments(departmentData);
        setProjects(projectData);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("신청서를 불러오는 중 문제가 발생했습니다.");
        }
      }
    };

    loadBackgroundData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (derivedDeviceIds.length === 0) {
      setSelectedDevices([]);
      setIsDeviceLoading(false);
      return;
    }

    const loadDeviceDetails = async () => {
      setIsDeviceLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled(
          derivedDeviceIds.map((id) => fetchDeviceDetail(id))
        );
        if (cancelled) {
          return;
        }
        const nextDevices = [];
        const failedIds = [];
        results.forEach((result, index) => {
          const targetId = derivedDeviceIds[index];
          if (result.status === "fulfilled" && result.value) {
            const detail = result.value;
            nextDevices.push({
              ...detail,
              id: detail?.id ?? targetId,
            });
          } else {
            failedIds.push(targetId);
          }
        });
        setSelectedDevices(nextDevices);
        if (failedIds.length > 0) {
          setError(`일부 장비 정보를 불러오지 못했습니다: ${failedIds.join(", ")}`);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("선택한 장비 정보를 불러오는 중 문제가 발생했습니다.");
          setSelectedDevices([]);
        }
      } finally {
        if (!cancelled) {
          setIsDeviceLoading(false);
        }
      }
    };

    loadDeviceDetails();

    return () => {
      cancelled = true;
    };
  }, [derivedDeviceIds]);

  useEffect(() => {
    if (selectedDevices.length === 0) {
      return;
    }
    const primary = selectedDevices[0];
    setForm((prev) => ({
      ...prev,
      deviceId: prev.deviceId || primary?.id || "",
      description: primary?.description ?? prev.description,
      categoryName: prev.categoryName || primary?.categoryName || "",
      departmentName: prev.departmentName || primary?.manageDepName || "",
      projectName: prev.projectName || primary?.projectName || "",
      projectCode: prev.projectCode || primary?.projectCode || "",
      usageStartDate:
        prev.usageStartDate || extractDateString(primary?.usageStartDate) || "",
      usageEndDate:
        prev.usageEndDate || extractDateString(primary?.usageEndDate) || "",
    }));
  }, [selectedDevices]);

  useEffect(() => {
    setDeviceOverrides((prev) => {
      const next = { ...prev };
      const currentIds = new Set();
      selectedDevices.forEach((device) => {
        const id = device?.id != null ? String(device.id) : null;
        if (!id) {
          return;
        }
        currentIds.add(id);
        if (!next[id]) {
          next[id] = {
            deviceId: id,
            departmentName: "",
            projectName: "",
            projectCode: "",
            realUserMode: form.realUserMode ?? "auto",
            realUser: form.realUserMode === "manual" ? form.realUser ?? "" : "",
          };
        }
      });
      Object.keys(next).forEach((id) => {
        if (!currentIds.has(id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [selectedDevices, form.departmentName, form.projectName, form.projectCode, form.realUser, form.realUserMode]);

  const selectedDeviceMap = useMemo(() => {
    const map = new Map();
    selectedDevices.forEach((deviceItem) => {
      if (deviceItem && deviceItem.id != null) {
        map.set(String(deviceItem.id), deviceItem);
      }
    });
    return map;
  }, [selectedDevices]);

  const hasSelection = derivedDeviceIds.length > 0;

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

  const updateDeviceOverride = (deviceId, patch) => {
    if (!deviceId) {
      return;
    }
    setDeviceOverrides((prev) => {
      const current = prev[deviceId] ?? { deviceId };
      return {
        ...prev,
        [deviceId]: { ...current, ...patch, deviceId },
      };
    });
    // clear validation flags for fields that were updated
    setDeviceValidation((prev) => {
      const next = { ...prev };
      const entry = { ...(next[deviceId] || {}) };
      if (Object.prototype.hasOwnProperty.call(patch, "departmentName")) {
        delete entry.department;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "projectName")) {
        delete entry.project;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "realUser")) {
        delete entry.realUser;
      }
      if (Object.keys(entry).length === 0) {
        delete next[deviceId];
      } else {
        next[deviceId] = entry;
      }
      return next;
    });
  };

  const validateDevices = () => {
    const errors = {};
    selectedDevices.forEach((device) => {
      const id = device?.id != null ? String(device.id) : null;
      if (!id) return;
  const override = deviceOverrides[id] ?? {};
  const department = (override.departmentName ?? "").toString().trim();
  const projectName = (override.projectName ?? "").toString().trim();
      if (!department) {
        errors[id] = { ...(errors[id] || {}), department: true };
      }
      if (!projectName) {
        errors[id] = { ...(errors[id] || {}), project: true };
      }
    });
    if (Object.keys(errors).length > 0) {
      setDeviceValidation(errors);
      const missing = Object.entries(errors).map(([id, e]) => {
        const parts = [];
        if (e.project) parts.push("프로젝트");
        if (e.department) parts.push("부서");
        return `${id}(${parts.join(",")})`;
      });
      alert(`다음 장비에 필수 항목이 누락되었습니다: ${missing.join(", ")}`);
      setError("필수 항목을 입력해 주세요.");
      return false;
    }
    setDeviceValidation({});
    return true;
  };

  const applyOverrideToAll = (deviceId) => {
    setDeviceOverrides((prev) => {
      const source = prev[deviceId];
      if (!source) {
        return prev;
      }
      const next = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (id === deviceId) {
          next[id] = { ...value };
          return;
        }
        const mode = source.realUserMode ?? "auto";
        next[id] = {
          ...value,
          departmentName: source.departmentName ?? "",
          projectName: source.projectName ?? "",
          projectCode: source.projectCode ?? "",
          realUserMode: mode,
          realUser: mode === "manual" ? (source.realUser ?? "") : "",
        };
      });
      return next;
    });
    // Clear per-device validation after applying overrides to all
    setDeviceValidation({});
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

  const handleUsagePeriodChange = (start, end) => {
    setForm((prev) => ({ ...prev, usageStartDate: start, usageEndDate: end }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validateDevices()) {
      return;
    }

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

    const targetDeviceIds = derivedDeviceIds.length > 0
      ? derivedDeviceIds
      : form.deviceId
      ? [form.deviceId]
      : [];

    if (targetDeviceIds.length === 0) {
      alert("선택된 장비가 없습니다.");
      setError("선택된 장비가 없습니다.");
      return;
    }

    const uniqueDeviceIds = Array.from(new Set(targetDeviceIds.map((rawId) => String(rawId))));
    const primaryDeviceIdForSubmission = uniqueDeviceIds[0];
    const primaryDetail = primaryDeviceIdForSubmission
      ? selectedDeviceMap.get(primaryDeviceIdForSubmission)
      : null;

    const normalize = (value) => (typeof value === "string" ? value.trim() : "");

    const devicePayloads = uniqueDeviceIds.map((deviceId) => {
      const override = deviceOverrides[deviceId] ?? {};
      const department = normalize(override.departmentName ?? "");
      const projectName = normalize(override.projectName ?? "");
      const projectCode = normalize(override.projectCode ?? "");
      const mode = (override.realUserMode ?? form.realUserMode ?? "auto").toLowerCase();
      const realUserValue = mode === "manual"
        ? normalize(override.realUser ?? form.realUser ?? "")
        : "";
      return {
        deviceId,
        departmentName: department || null,
        projectName: projectName || null,
        projectCode: projectCode || null,
        realUser: realUserValue || null,
        realUserMode: mode,
      };
    });

    const primaryDevicePayload = devicePayloads[0] ?? {};

    const payload = {
      ...form,
      deviceId: primaryDeviceIdForSubmission,
      deviceIds: uniqueDeviceIds,
      devices: devicePayloads,
      approvers: resolvedApprovers,
      deadline: `${form.deadlineDate}T00:00:00`,
      usageStartDate: `${form.usageStartDate}T00:00:00`,
      usageEndDate: `${form.usageEndDate}T00:00:00`,
      description: primaryDetail?.description ?? form.description ?? "",
      status: primaryDetail?.status ?? "정상",
      deviceStatus: primaryDetail?.status ?? "정상",
      devicePurpose: primaryDetail?.purpose ?? form.devicePurpose ?? "",
      categoryName: form.categoryName || primaryDetail?.categoryName || "",
      departmentName: primaryDevicePayload.departmentName || null,
      projectName: primaryDevicePayload.projectName || null,
      projectCode: primaryDevicePayload.projectCode || null,
    };

    delete payload.realUser;
    delete payload.realUserMode;

    setIsSaving(true);
    try {
      await submitDeviceApplication(payload);
      alert(
        uniqueDeviceIds.length > 1
          ? "선택한 장비에 대한 신청이 완료되었습니다."
          : "신청이 완료되었습니다."
      );
      navigate("/device/list");
      return;
    } catch (err) {
      console.error(err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "신청 처리 중 문제가 발생했습니다.";
      alert(message);
      setError(message);
      return;
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
              <h3>선택한 장비</h3>
              {hasSelection && (
                <p className="muted">총 {derivedDeviceIds.length}대 선택됨</p>
              )}
              {isDeviceLoading && hasSelection && (
                <p className="muted">장비 정보를 불러오는 중입니다...</p>
              )}
            </div>
            {!hasSelection ? (
              <p className="muted">선택된 장비가 없습니다. 목록에서 장비를 선택해 주세요.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>품목</th>
                      <th>관리번호</th>
                      <th>용도</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivedDeviceIds.map((id) => {
                      const detail = selectedDeviceMap.get(String(id));
                      const statusText = detail
                        ? detail.status ?? "정상"
                        : isDeviceLoading
                        ? "불러오는 중"
                        : "정보 없음";
                      return (
                        <tr key={id}>
                          <td>{detail?.categoryName ?? "-"}</td>
                          <td>{id}</td>
                          <td>{detail?.purpose ?? "-"}</td>
                          <td>{statusText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h3>신청자 정보</h3>
            </div>
            <div className="form-section-grid applicant-grid">
              <div className="applicant-column applicant-column--user">
                <label>
                  사용자
                  <input type="text" value={form.userName} readOnly />
                </label>
              </div>
              <div className="applicant-column applicant-column--usage">
                <RangeDateInput
                  startDate={form.usageStartDate}
                  endDate={form.usageEndDate}
                  onChange={handleUsagePeriodChange}
                />
              </div>
              <div className="applicant-column applicant-column--deadline">
                <DeadlineDateField
                  value={form.deadlineDate}
                  onChange={(date) =>
                    setForm((prev) => ({ ...prev, deadlineDate: date ?? "" }))
                  }
                />
              </div>
            </div>
          </section>

          {hasSelection && (
            <section className="form-section">
              <div className="form-section-header">
                <h3>장비별 설정</h3>
                <p className="muted">각 장비마다 프로젝트, 관리부서, 실제 사용자 정보를 개별로 조정할 수 있습니다.</p>
              </div>
              <div className="table-wrapper table-wrapper--device-overrides">
                <div className="table-wrapper__scroll">
                  <table className="device-overrides-table">
                  <thead>
                    <tr>
                      <th>관리번호</th>
                      <th>요청 프로젝트</th>
                      <th>요청 부서</th>
                      <th>실제 사용자</th>
                      <th>현재 정보</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivedDeviceIds.map((rawId) => {
                      const id = String(rawId);
                      const override = deviceOverrides[id] ?? { deviceId: id };
                      const deviceDetail = selectedDeviceMap.get(id);
                      const mode = (override.realUserMode ?? form.realUserMode ?? "auto").toLowerCase();
                      const manualDisabled = mode !== "manual";
                      const applicantName = normalizeName(form.userName ?? defaultUserName ?? "");
                      const autoRealUserDisplay = applicantName;
                      const manualRealUser = normalizeName(override.realUser ?? "");
                      const resolvedRealUserValue = mode === "manual"
                        ? manualRealUser || ""
                        : autoRealUserDisplay;
                      const resolvedDepartmentName = normalizeName(override.departmentName ?? "");
                      const selectedProject = (() => {
                        const overrideName = typeof override.projectName === "string"
                          ? override.projectName.trim()
                          : "";
                        const overrideCode = typeof override.projectCode === "string"
                          ? override.projectCode.trim()
                          : "";
                        if (!overrideName && !overrideCode) {
                          return null;
                        }
                        return { name: overrideName, code: overrideCode };
                      })();
                      return (
                        <tr key={id}>
                          <td>
                            <div className="device-overrides-meta">
                              <strong>{id}</strong>
                              <span>{deviceDetail?.categoryName ?? "-"}</span>
                              <span className="muted">{deviceDetail?.status ?? "-"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="device-overrides-project">
                              <ProjectCombobox
                                projects={projects}
                                selectedProject={selectedProject}
                                onSelect={(project) => {
                                  updateDeviceOverride(id, {
                                    projectName: project?.name ?? "",
                                    projectCode: project?.code ?? "",
                                  });
                                }}
                                allowClear
                                autoSelectFirst={false}
                                placeholder="프로젝트를 선택하세요"
                                disabled={projects.length === 0}
                                searchPlaceholder="프로젝트 이름 또는 코드를 검색하세요"
                                panelClassName="combobox-panel--stretch"
                                searchInputClassName="combobox-search--full"
                                listClassName="combobox-options combobox-options--scroll"
                              />
                              {deviceValidation[id]?.project && (
                                <div className="error">프로젝트는 필수입니다</div>
                              )}
                            </div>
                          </td>
                          <td>
                            <select
                              value={resolvedDepartmentName}
                              onChange={(event) => updateDeviceOverride(id, { departmentName: event.target.value })}
                            >
                              <option value="">부서를 선택하세요</option>
                              {departments.map((department) => (
                                <option key={department.id} value={department.name}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                            {deviceValidation[id]?.department && (
                              <div className="error">부서는 필수입니다</div>
                            )}
                          </td>
                          <td>
                            <div className="device-overrides-user">
                              <select
                                value={mode}
                                onChange={(event) => {
                                  const nextMode = event.target.value;
                                  updateDeviceOverride(id, {
                                    realUserMode: nextMode,
                                    realUser: nextMode === "manual"
                                      ? (manualRealUser || "")
                                      : null,
                                  });
                                }}
                              >
                                <option value="auto">자동</option>
                                <option value="manual">직접 입력</option>
                              </select>
                              <input
                                type="text"
                                value={resolvedRealUserValue}
                                onChange={(event) => updateDeviceOverride(id, { realUser: event.target.value })}
                                placeholder={mode === "manual" ? "실제 사용자 이름" : "자동 지정"}
                                disabled={manualDisabled}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="device-overrides-current">
                              <span>프로젝트: {override?.projectName ?? deviceDetail?.projectName ?? "-"}</span>
                              <span>부서: {resolvedDepartmentName || "-"}</span>
                              <span>
                                실사용자: {mode === "manual"
                                  ? (manualRealUser || "" )
                                  : applicantName || "-"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="device-overrides-actions">
                              <button
                                type="button"
                                className="outline small-button"
                                onClick={() => applyOverrideToAll(id)}
                              >
                                전체 적용
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
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
            <button type="submit" className="primary" disabled={isSaving || !hasSelection}>
              {isSaving ? (<><Spinner size={14} />신청 중...</>) : ("신청하기")}
            </button>
          </div>
        </form>
      </div>
    </LocalizationProvider>
  );
}
