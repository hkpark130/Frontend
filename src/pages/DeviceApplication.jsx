import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
    const projectDropdownRefs = useRef(new Map());
    const [projectDropdownState, setProjectDropdownState] = useState({ deviceId: null, search: "" });

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
      const activeId = projectDropdownState.deviceId;
      if (!activeId) {
        return;
      }
      const container = projectDropdownRefs.current.get(activeId);
      if (container && !container.contains(event.target)) {
        setProjectDropdownState({ deviceId: null, search: "" });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [projectDropdownState.deviceId]);

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
            departmentName: device?.manageDepName ?? form.departmentName ?? "",
            projectName: device?.projectName ?? form.projectName ?? "",
            projectCode: device?.projectCode ?? form.projectCode ?? "",
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
  };

  const filterProjectsByTerm = (term) => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      return projects;
    }
    return projects.filter((project) => {
      const name = project.name?.toLowerCase() ?? "";
      const code = project.code?.toLowerCase() ?? "";
      return name.includes(normalized) || code.includes(normalized);
    });
  };

  const toggleDeviceProjectDropdown = (deviceId) => {
    setProjectDropdownState((prev) =>
      prev.deviceId === deviceId
        ? { deviceId: null, search: "" }
        : { deviceId, search: "" }
    );
  };

  const updateProjectSearchTerm = (value) => {
    setProjectDropdownState((prev) => {
      if (!prev.deviceId) {
        return prev;
      }
      return { deviceId: prev.deviceId, search: value };
    });
  };

  const closeProjectDropdown = () => {
    setProjectDropdownState({ deviceId: null, search: "" });
  };

  const handleDeviceProjectSelect = (deviceId, project) => {
    updateDeviceOverride(deviceId, {
      projectName: project.name ?? "",
      projectCode: project.code ?? "",
    });
    closeProjectDropdown();
  };

  const handleDeviceProjectClear = (deviceId) => {
    updateDeviceOverride(deviceId, { projectName: "", projectCode: "" });
    closeProjectDropdown();
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
      const detail = selectedDeviceMap.get(deviceId);
      const department = normalize(
        override.departmentName ?? form.departmentName ?? detail?.manageDepName ?? ""
      );
      const projectName = normalize(
        override.projectName ?? form.projectName ?? detail?.projectName ?? ""
      );
      const projectCode = normalize(
        override.projectCode ?? form.projectCode ?? detail?.projectCode ?? ""
      );
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
      realUser: primaryDevicePayload.realUser
        || (form.realUserMode === "manual" ? normalize(form.realUser ?? "") : null),
      realUserMode: primaryDevicePayload.realUserMode || form.realUserMode || "auto",
    };

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
                      const isProjectDropdownOpen = projectDropdownState.deviceId === id;
                      const projectSearchValue = isProjectDropdownOpen ? projectDropdownState.search : "";
                      const projectOptions = isProjectDropdownOpen
                        ? filterProjectsByTerm(projectSearchValue)
                        : [];
                      const projectLabel = (() => {
                        const name = override.projectName ?? "";
                        const code = override.projectCode ?? "";
                        if (name && code) {
                          return `${name} (${code})`;
                        }
                        if (name) {
                          return name;
                        }
                        if (code) {
                          return code;
                        }
                        return "";
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
                              <div
                                className="combobox-wrapper"
                                ref={(node) => {
                                  if (node) {
                                    projectDropdownRefs.current.set(id, node);
                                  } else {
                                    projectDropdownRefs.current.delete(id);
                                  }
                                }}
                              >
                                <div className={`combobox${isProjectDropdownOpen ? " open" : ""}`}>
                                  <button
                                    type="button"
                                    className="combobox-trigger"
                                    onClick={() => toggleDeviceProjectDropdown(id)}
                                  >
                                    <span>{projectLabel || "프로젝트를 선택하세요"}</span>
                                    <span className="combobox-caret" aria-hidden="true">
                                      ▾
                                    </span>
                                  </button>
                                  {isProjectDropdownOpen && (
                                    <div className="combobox-panel combobox-panel--stretch">
                                      <input
                                        type="text"
                                        className="combobox-search combobox-search--full"
                                        placeholder="프로젝트 이름 또는 코드를 검색하세요"
                                        value={projectSearchValue}
                                        onChange={(event) => updateProjectSearchTerm(event.target.value)}
                                      />
                                      <ul className="combobox-options combobox-options--scroll">
                                        <li
                                          className="combobox-option"
                                          onClick={() => handleDeviceProjectClear(id)}
                                        >
                                          선택 해제
                                        </li>
                                        {projectOptions.length === 0 ? (
                                          <li className="combobox-option" aria-disabled>
                                            검색 결과가 없습니다.
                                          </li>
                                        ) : (
                                          projectOptions.map((project) => (
                                            <li
                                              key={project.id ?? project.code ?? project.name}
                                              className="combobox-option"
                                              onClick={() => handleDeviceProjectSelect(id, project)}
                                            >
                                              <span className="combobox-option-label">{project.name}</span>
                                              <span className="combobox-option-description">
                                                {project.code || "프로젝트 코드 없음"}
                                              </span>
                                            </li>
                                          ))
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <select
                              value={override.departmentName ?? ""}
                              onChange={(event) => updateDeviceOverride(id, { departmentName: event.target.value })}
                            >
                              <option value="">선택하세요</option>
                              {departments.map((department) => (
                                <option key={department.id} value={department.name}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
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
                                      ? override.realUser ?? form.realUser ?? ""
                                      : "",
                                  });
                                }}
                              >
                                <option value="auto">자동</option>
                                <option value="manual">직접 입력</option>
                              </select>
                              <input
                                type="text"
                                value={override.realUser ?? ""}
                                onChange={(event) => updateDeviceOverride(id, { realUser: event.target.value })}
                                placeholder={mode === "manual" ? "실제 사용자 이름" : "자동 지정"}
                                disabled={manualDisabled}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="device-overrides-current">
                              <span>프로젝트: {deviceDetail?.projectName ?? "-"}</span>
                              <span>부서: {deviceDetail?.manageDepName ?? "-"}</span>
                              <span>실사용자: {deviceDetail?.realUser ?? "-"}</span>
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
