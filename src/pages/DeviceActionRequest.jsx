import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/ko";
import { format } from "date-fns";
import { fetchDeviceDetail, fetchDevicesByIds, submitDeviceApplication } from "@/api/devices";
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

const PENDING_APPROVAL_STATUSES = new Set(["승인대기", "진행중", "1차승인완료", "2차승인완료"]);

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

const RETURN_STATUS_CHOICES = ["정상", "노후"];

const normalizeReturnStatus = (value) => {
  if (typeof value !== "string") {
    return RETURN_STATUS_CHOICES[0];
  }
  const trimmed = value.trim();
  return RETURN_STATUS_CHOICES.includes(trimmed) ? trimmed : RETURN_STATUS_CHOICES[0];
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
  const location = useLocation();
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

  const [selectedDevices, setSelectedDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [defaultApprovers, setDefaultApprovers] = useState([]);
  const [isApproverLoading, setIsApproverLoading] = useState(true);
  const [approverFetchError, setApproverFetchError] = useState(null);
  const [prefilled, setPrefilled] = useState(false);

  const stateDeviceIds = useMemo(() => {
    const state = location.state;
    if (!state) {
      return [];
    }
    const raw = state.deviceIds ?? state.deviceId ?? null;
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw
        .map((id) => (id != null && typeof id.toString === "function" ? id.toString() : String(id ?? "")))
        .filter((value) => value.trim().length > 0);
    }
    const resolved = raw != null && typeof raw.toString === "function" ? raw.toString() : String(raw ?? "");
    return resolved.trim().length > 0 ? [resolved.trim()] : [];
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
    const ordered = [];
    const pushUnique = (value) => {
      if (value == null) {
        return;
      }
      const normalized = value.toString().trim();
      if (!normalized || ordered.includes(normalized)) {
        return;
      }
      ordered.push(normalized);
    };

    stateDeviceIds.forEach(pushUnique);
    if (ordered.length === 0 && deviceId) {
      pushUnique(deviceId);
    } else if (deviceId) {
      pushUnique(deviceId);
    }
    queryDeviceIds.forEach(pushUnique);
    return ordered;
  }, [stateDeviceIds, deviceId, queryDeviceIds]);

  const targetDeviceIds = useMemo(() => {
    if (derivedDeviceIds.length > 0) {
      return derivedDeviceIds;
    }
    return [];
  }, [derivedDeviceIds]);

  const deviceMap = useMemo(() => {
    const map = new Map();
    selectedDevices.forEach((item) => {
      if (!item) {
        return;
      }
      const id = item.id != null ? item.id.toString() : null;
      if (id) {
        map.set(id, item);
      }
    });
    return map;
  }, [selectedDevices]);

  const primaryDevice = selectedDevices.length > 0 ? selectedDevices[0] : null;

  const [form, setForm] = useState(() => ({
    reason: "",
    description: "",
    deadlineDate: today,
    // 액션 타입에 따라 기본 상태 지정 (폐기는 '폐기'로 고정)
    status: actionType === "폐기" ? "폐기" : config?.defaultStatus ?? "",
  }));
  const [deviceInputs, setDeviceInputs] = useState({});
  const [tagOptions, setTagOptions] = useState(() =>
    isReturnAction ? dedupeTagNames(DEFAULT_TAG_SUGGESTIONS) : []
  );
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [tagFetchError, setTagFetchError] = useState(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      reason: "",
      description: "",
      deadlineDate: today,
      status: actionType === "폐기" ? "폐기" : config?.defaultStatus ?? "",
    }));
    setPrefilled(false);
  }, [actionType, config?.defaultStatus, derivedDeviceIds, today]);

  useEffect(() => {
    if (!isReturnAction) {
      setTagOptions([]);
      setTagFetchError(null);
      setIsTagLoading(false);
      setDeviceInputs((prev) => {
        if (!prev || Object.keys(prev).length === 0) {
          return prev;
        }
        const next = {};
        Object.entries(prev).forEach(([id, entry]) => {
          next[id] = {
            ...entry,
            tags: [],
            tagInput: "",
          };
        });
        return next;
      });
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

    const loadDevices = async () => {
      if (targetDeviceIds.length === 0) {
        setSelectedDevices([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const bulkResult = await fetchDevicesByIds(targetDeviceIds);
        if (cancelled) {
          return;
        }

        const resolved = [];
        const resolvedIds = new Set();
        if (Array.isArray(bulkResult)) {
          bulkResult.forEach((detail) => {
            const idValue = detail?.id != null ? detail.id.toString() : null;
            if (!idValue) {
              return;
            }
            resolvedIds.add(idValue);
            resolved.push({
              ...detail,
              id: detail?.id != null ? detail.id : idValue,
            });
          });
        }

        const missing = targetDeviceIds.filter((id) => !resolvedIds.has(id));
        if (missing.length > 0) {
          const fallbackResults = await Promise.allSettled(
            missing.map((id) => fetchDeviceDetail(id))
          );
          fallbackResults.forEach((result, index) => {
            const fallbackId = missing[index];
            if (result.status === "fulfilled" && result.value) {
              const detail = result.value;
              resolvedIds.add(fallbackId);
              resolved.push({
                ...detail,
                id: detail?.id != null ? detail.id : fallbackId,
              });
            }
          });
        }

        const ordered = targetDeviceIds
          .map((id) => resolved.find((item) => (item?.id != null ? item.id.toString() : "") === id))
          .filter(Boolean);

        setSelectedDevices(ordered);

        if (targetDeviceIds.length !== ordered.length) {
          const unresolved = targetDeviceIds.filter(
            (id) => !ordered.some((item) => item?.id != null && item.id.toString() === id)
          );
          if (unresolved.length > 0) {
            setError(`다음 장비 정보를 불러오지 못했습니다: ${unresolved.join(", ")}`);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("장비 정보를 불러오는 중 문제가 발생했습니다.");
          setSelectedDevices([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDevices();
    return () => {
      cancelled = true;
    };
  }, [targetDeviceIds]);

  useEffect(() => {
    if (!isReturnAction || selectedDevices.length === 0) {
      return;
    }
    const aggregatedTags = dedupeTagNames(
      selectedDevices.flatMap((item) => (Array.isArray(item?.tags) ? item.tags : []))
    );
    if (aggregatedTags.length > 0) {
      setTagOptions((prev) => mergeTagOptions(prev, aggregatedTags));
    }
  }, [selectedDevices, isReturnAction]);

  useEffect(() => {
    if (selectedDevices.length === 0) {
      setDeviceInputs({});
      return;
    }

    setDeviceInputs((prev) => {
      const next = {};
      selectedDevices.forEach((detail) => {
        if (!detail) {
          return;
        }
        const idValue = detail.id != null ? detail.id.toString() : "";
        if (!idValue) {
          return;
        }
        const previous = prev?.[idValue];
        const defaultStatus = actionType === "폐기"
          ? "폐기"
          : detail?.status ?? config?.defaultStatus ?? "";
        const defaultTags = isReturnAction
          ? dedupeTagNames(Array.isArray(detail?.tags) ? detail.tags : [])
          : [];
        const resolvedStatus = isReturnAction
          ? normalizeReturnStatus(previous?.status ?? detail?.status)
          : previous?.status ?? defaultStatus;
        next[idValue] = {
          status: resolvedStatus,
          tags: isReturnAction ? (previous ? previous.tags : defaultTags) : [],
          tagInput: previous?.tagInput ?? "",
        };
      });
      return next;
    });
  }, [selectedDevices, actionType, config?.defaultStatus, isReturnAction]);

  useEffect(() => {
    if (!primaryDevice || prefilled) {
      return;
    }
    setForm((prev) => {
      const previousStatus = typeof prev.status === "string" && prev.status.trim()
        ? prev.status
        : null;
      const resolvedStatus = actionType === "폐기"
        ? "폐기"
        : primaryDevice.status ?? previousStatus ?? config?.defaultStatus ?? "";
      return {
        ...prev,
        status: resolvedStatus,
        description: primaryDevice.description ?? prev.description,
      };
    });
    setPrefilled(true);
  }, [primaryDevice, prefilled, config?.defaultStatus, actionType]);

  const applicantName = useMemo(() => {
    const normalized = (defaultUserName || "").trim();
    if (normalized) {
      return normalized;
    }
    if (typeof primaryDevice?.realUser === "string" && primaryDevice.realUser.trim()) {
      return primaryDevice.realUser.trim();
    }
    if (typeof primaryDevice?.username === "string" && primaryDevice.username.trim()) {
      return primaryDevice.username.trim();
    }
    return "";
  }, [defaultUserName, primaryDevice]);

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

  const blockingDevices = useMemo(() => {
    if (!selectedDevices || selectedDevices.length === 0) {
      return [];
    }
    return selectedDevices
      .map((item) => {
        const typeLabel = typeof item?.approvalType === "string" ? item.approvalType.trim() : "";
        if (!typeLabel || !["반납", "폐기"].includes(typeLabel)) {
          return null;
        }
        const statusLabel = typeof item?.approvalInfo === "string" ? item.approvalInfo.trim() : "";
        if (!statusLabel) {
          return null;
        }
        const normalizedStatus = statusLabel.replace(/\s+/g, "");
        if (!PENDING_APPROVAL_STATUSES.has(normalizedStatus)) {
          return null;
        }
        return {
          deviceId: item?.id != null ? item.id.toString() : "",
          type: typeLabel,
          status: statusLabel,
        };
      })
      .filter(Boolean);
  }, [selectedDevices]);

  const isSubmissionBlocked = blockingDevices.length > 0;

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 실제 사용자 직접 입력 UI는 제거되어 함수 사용하지 않음

  const handleRadioChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, status: value }));
  };

  const handleDeviceStatusChange = (deviceId, value) => {
    const normalized = normalizeReturnStatus(value);
    setDeviceInputs((prev) => {
      const current = prev?.[deviceId];
      if (!current) {
        return prev;
      }
      if (current.status === normalized) {
        return prev;
      }
      return {
        ...prev,
        [deviceId]: {
          ...current,
          status: normalized,
        },
      };
    });
  };

  const handleDeviceTagInputChange = (deviceId, value) => {
    setDeviceInputs((prev) => {
      const current = prev?.[deviceId];
      if (!current) {
        return prev;
      }
      if (current.tagInput === value) {
        return prev;
      }
      return {
        ...prev,
        [deviceId]: {
          ...current,
          tagInput: value,
        },
      };
    });
  };

  const handleDeviceTagSubmit = (deviceId) => {
    let normalizedValue = null;
    let shouldAddToOptions = false;
    setDeviceInputs((prev) => {
      const current = prev?.[deviceId];
      if (!current) {
        return prev;
      }
      normalizedValue = normalizeTagName(current.tagInput);
      if (!normalizedValue) {
        if (!current.tagInput) {
          return prev;
        }
        return {
          ...prev,
          [deviceId]: {
            ...current,
            tagInput: "",
          },
        };
      }
      const already = hasTag(current.tags, normalizedValue);
      shouldAddToOptions = !already;
      return {
        ...prev,
        [deviceId]: {
          ...current,
          tags: already ? current.tags : [...current.tags, normalizedValue],
          tagInput: "",
        },
      };
    });
    if (shouldAddToOptions && normalizedValue) {
      setTagOptions((prev) => mergeTagOptions(prev, [normalizedValue]));
    }
  };

  const handleDeviceTagInputKeyDown = (deviceId) => (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleDeviceTagSubmit(deviceId);
    }
  };

  const toggleDeviceTagSelection = (deviceId, tag) => {
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setDeviceInputs((prev) => {
      const current = prev?.[deviceId];
      if (!current) {
        return prev;
      }
      const selected = hasTag(current.tags, normalized);
      const nextTags = selected
        ? removeTag(current.tags, normalized)
        : dedupeTagNames([...current.tags, normalized]);
      return {
        ...prev,
        [deviceId]: {
          ...current,
          tags: nextTags,
        },
      };
    });
    setTagOptions((prev) => mergeTagOptions(prev, [normalized]));
  };

  const removeDeviceTag = (deviceId, tag) => {
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setDeviceInputs((prev) => {
      const current = prev?.[deviceId];
      if (!current || !hasTag(current.tags, normalized)) {
        return prev;
      }
      return {
        ...prev,
        [deviceId]: {
          ...current,
          tags: removeTag(current.tags, normalized),
        },
      };
    });
  };

  const handleRemoveTagOption = (tag) => {
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setTagOptions((prev) => prev.filter((item) => tagKey(item) !== tagKey(normalized)));
    setDeviceInputs((prev) => {
      if (!prev || Object.keys(prev).length === 0) {
        return prev;
      }
      const next = {};
      Object.entries(prev).forEach(([id, entry]) => {
        next[id] = {
          ...entry,
          tags: removeTag(entry.tags ?? [], normalized),
        };
      });
      return next;
    });
  };

  const applyDeviceSettingsToAll = (deviceId) => {
    if (!deviceId) {
      return;
    }
    const source = deviceInputs[deviceId];
    if (!source) {
      return;
    }
    const normalizedTags = dedupeTagNames(source.tags ?? []);
    const sourceStatus = typeof source.status === "string" ? source.status.trim() : "";

    setDeviceInputs((prev) => {
      if (!prev || Object.keys(prev).length === 0) {
        return prev;
      }
      const next = {};
      Object.entries(prev).forEach(([id, entry]) => {
        if (!entry) {
          return;
        }
        next[id] = {
          ...entry,
          status: sourceStatus,
          tags: [...normalizedTags],
        };
      });
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (isSubmissionBlocked) {
      const summary = blockingDevices
        .map((entry) => `${entry.deviceId} (${entry.type} ${entry.status})`)
        .join(", ");
      const message = blockingDevices.length === 1
        ? `이미 ${blockingDevices[0].type} 신청이 ${blockingDevices[0].status} 상태입니다. 기존 신청이 완료된 후 다시 신청해 주세요.`
        : `다음 장비에 진행 중인 반납/폐기 신청이 있습니다: ${summary}. 기존 신청이 완료된 후 다시 신청해 주세요.`;
      setError(message);
      alert(message);
      return;
    }

    if (!config) {
      setError("지원되지 않는 신청 유형입니다.");
      alert("지원되지 않는 신청 유형입니다.");
      return;
    }

    if (targetDeviceIds.length === 0 || selectedDevices.length === 0) {
      setError("선택한 장비 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
      alert("선택한 장비 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    const unresolvedIds = targetDeviceIds.filter((id) => !deviceMap.has(id));
    if (unresolvedIds.length > 0) {
      const missing = unresolvedIds.join(", ");
      const message = `일부 장비 상세 정보를 불러오지 못했습니다: ${missing}`;
      setError(message);
      alert(message);
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

    if (isReturnAction) {
      const missingStatusIds = targetDeviceIds.filter((id) => {
        const entry = deviceInputs[id];
        const status = typeof entry?.status === "string" ? entry.status.trim() : "";
        return !status;
      });
      if (missingStatusIds.length > 0) {
        const message = `장비 상태를 선택해 주세요: ${missingStatusIds.join(", ")}`;
        setError(message);
        alert(message);
        return;
      }
    }

    // 실제 사용자 입력은 필요하지 않으므로 서버로는 null을 전달합니다.
    const primaryDetail = primaryDevice ?? deviceMap.get(targetDeviceIds[0]);
    const primaryInput = targetDeviceIds.length > 0 ? deviceInputs[targetDeviceIds[0]] : null;
    const statusValue = isReturnAction
      ? ((typeof primaryInput?.status === "string" ? primaryInput.status.trim() : "")
        || primaryDetail?.status
        || config.defaultStatus
        || "")
      : ((form.status ?? "").trim()
        || primaryDetail?.status
        || config.defaultStatus
        || "");
    const descriptionValue = (form.description ?? "").trim();
    const deviceSelections = targetDeviceIds.map((id) => {
      const detail = deviceMap.get(id);
      const entry = deviceInputs[id] ?? {};
      const selection = {
        deviceId: id,
        departmentName: detail?.manageDepName ?? "",
        projectName: detail?.projectName ?? "",
        projectCode: detail?.projectCode ?? "",
        realUser: detail?.realUser ?? "",
        realUserMode: "auto",
      };
      const perDeviceStatus = typeof entry?.status === "string" ? entry.status.trim() : "";
      if (perDeviceStatus) {
        selection.status = perDeviceStatus;
      }
      if (isReturnAction) {
        selection.tags = dedupeTagNames(entry?.tags ?? []);
      }
      return selection;
    });

    const aggregatedTags = isReturnAction
      ? dedupeTagNames(deviceSelections.flatMap((item) => item.tags ?? []))
      : [];

    const payload = {
      deviceId: targetDeviceIds[0],
      deviceIds: targetDeviceIds,
      devices: deviceSelections,
      userName: applicant,
      realUser: null,
      reason,
      type: actionType,
      approvers: resolvedApprovers,
      description: descriptionValue || primaryDetail?.description || "",
      status: statusValue,
      deviceStatus: statusValue,
      devicePurpose: primaryDetail?.purpose ?? "",
      departmentName: primaryDetail?.manageDepName ?? "",
      projectName: primaryDetail?.projectName ?? "",
      projectCode: primaryDetail?.projectCode ?? "",
      isUsable: config.isUsableOnSubmit,
      usageStartDate: null,
      usageEndDate: null,
    };

    if (form.deadlineDate) {
      payload.deadline = `${form.deadlineDate}T00:00:00`;
    }

    if (isReturnAction) {
      payload.tag = aggregatedTags;
    }

    try {
      setIsSaving(true);
      await submitDeviceApplication(payload);
      const successMessage = targetDeviceIds.length > 1
        ? `선택한 ${targetDeviceIds.length}대 장비의 ${actionType} 신청이 접수되었습니다.`
        : config.successMessage;
      alert(successMessage);
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
            {targetDeviceIds.length > 1 && (
              <p className="muted" style={{ marginTop: 4 }}>
                선택된 장비 {targetDeviceIds.length}대
              </p>
            )}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {isLoading ? (
          <p>불러오는 중입니다...</p>
        ) : targetDeviceIds.length === 0 ? (
          <p className="muted">선택된 장비가 없습니다.</p>
        ) : selectedDevices.length === 0 ? (
          <p className="error">장비 정보를 찾을 수 없습니다.</p>
        ) : (
          <form className="form form-layout" onSubmit={handleSubmit}>
            {isSubmissionBlocked && (
              <p className="error" role="alert">
                {blockingDevices.length === 1
                  ? `이미 ${blockingDevices[0].type} 신청이 ${blockingDevices[0].status} 상태입니다. 기존 신청이 완료된 후 다시 신청해 주세요.`
                  : `다음 장비에 기존 반납/폐기 신청이 있습니다: ${blockingDevices
                      .map((entry) => `${entry.deviceId} (${entry.type} ${entry.status})`)
                      .join(", ")}. 기존 신청이 완료된 후 다시 신청해 주세요.`}
              </p>
            )}
            <section className="form-section">
              <div className="form-section-header">
                <h3>신청자 정보</h3>
              </div>
              <div
                className={`form-section-grid applicant-grid${isReturnAction ? " applicant-grid--return" : actionType === "폐기" ? " applicant-grid--disposal" : ""}`}
              >
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
              {targetDeviceIds.length === 1 ? (
                <div className="device-info-grid">
                  <label className="device-info-label">
                    관리번호
                    <input type="text" value={primaryDevice?.id ?? ""} readOnly />
                  </label>
                  <label className="device-info-label">
                    품목
                    <input type="text" value={primaryDevice?.categoryName ?? ""} readOnly />
                  </label>
                  <label className="device-info-label">
                    현재 상태
                    <input type="text" value={primaryDevice?.status ?? ""} readOnly />
                  </label>
                  <label className="device-info-label">
                    프로젝트
                    <input type="text" value={primaryDevice?.projectName ?? ""} readOnly />
                  </label>
                  <label className="device-info-label">
                    관리부서
                    <input type="text" value={primaryDevice?.manageDepName ?? ""} readOnly />
                  </label>
                </div>
              ) : (
                <div className="selected-device-list" style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>품목</th>
                        <th>관리번호</th>
                        <th>현재 상태</th>
                        <th>프로젝트</th>
                        <th>관리부서</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetDeviceIds.map((id) => {
                        const detail = deviceMap.get(id);
                        return (
                          <tr key={id}>
                            <td>{detail?.categoryName ?? "-"}</td>
                            <td>{id}</td>
                            <td>{detail?.status ?? "-"}</td>
                            <td>{detail?.projectName ?? "-"}</td>
                            <td>{detail?.manageDepName ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {isReturnAction && targetDeviceIds.length > 0 && (
                <div className="form-section-subcontent">
                  <div className="form-section-subheader">
                    <div>
                      <h4>장비별 상태 및 태그</h4>
                      <p className="muted">
                        각 장비마다 반납 상태와 태그를 조정한 뒤 전체 적용 버튼으로 다른 장비에 복사할 수 있습니다.
                      </p>
                    </div>
                    <div className="tag-meta">
                      {isTagLoading && (
                        <span className="tag-status loading">태그를 불러오는 중입니다...</span>
                      )}
                      {tagFetchError && <span className="tag-status error">{tagFetchError}</span>}
                    </div>
                  </div>
                  <div className="table-wrapper table-wrapper--device-overrides">
                    <div className="table-wrapper__scroll">
                      <table className="device-overrides-table device-action-table">
                        <thead>
                          <tr>
                            <th>장비 정보</th>
                            <th>현재 정보</th>
                            <th>장비 상태</th>
                            <th>태그</th>
                            <th>작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {targetDeviceIds.map((id) => {
                            const detail = deviceMap.get(id);
                            const entry = deviceInputs[id] ?? { status: "", tags: [], tagInput: "" };
                            const currentStatus = detail?.status ?? "-";
                            const tagInputValue = entry.tagInput ?? "";
                            const deviceTags = Array.isArray(entry.tags) ? entry.tags : [];
                            return (
                              <tr key={id}>
                                <td>
                                  <div className="device-overrides-meta">
                                    <strong>{detail?.categoryName ?? `장비 ${id}`}</strong>
                                    <span>{id}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="device-overrides-current">
                                    <div>
                                      <span className="device-overrides-current-label">현재 상태</span>
                                      <span className="device-overrides-current-value">{currentStatus}</span>
                                    </div>
                                    <div>
                                      <span className="device-overrides-current-label">프로젝트</span>
                                      <span className="device-overrides-current-value">{detail?.projectName ?? "-"}</span>
                                    </div>
                                    <div>
                                      <span className="device-overrides-current-label">관리부서</span>
                                      <span className="device-overrides-current-value">{detail?.manageDepName ?? "-"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className="status-select"
                                    value={entry.status}
                                    onChange={(event) => handleDeviceStatusChange(id, event.target.value)}
                                  >
                                    {RETURN_STATUS_CHOICES.map((option) => (
                                      <option key={`${id}-status-${option}`} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <div className="tag-section">
                                    <div className="tag-input-row">
                                      <input
                                        type="text"
                                        value={tagInputValue}
                                        onChange={(event) => handleDeviceTagInputChange(id, event.target.value)}
                                        onKeyDown={handleDeviceTagInputKeyDown(id)}
                                        placeholder="태그를 입력하고 Enter 키 또는 추가 버튼을 눌러주세요."
                                      />
                                      <button
                                        type="button"
                                        className="outline tag-add-button"
                                        onClick={() => handleDeviceTagSubmit(id)}
                                        disabled={!normalizeTagName(tagInputValue)}
                                      >
                                        태그 추가
                                      </button>
                                    </div>
                                    <div className="tag-view-list">
                                      {deviceTags.length === 0 ? (
                                        <span className="tag-status muted">선택된 태그가 없습니다.</span>
                                      ) : (
                                        deviceTags.map((tag) => {
                                          const normalizedTag = normalizeTagName(tag);
                                          if (!normalizedTag) {
                                            return null;
                                          }
                                          return (
                                            <div
                                              key={`${id}-selected-${tagKey(normalizedTag)}`}
                                              className="tag-chip selected"
                                            >
                                              <span className="tag-label">{normalizedTag}</span>
                                              <button
                                                type="button"
                                                className="remove-btn"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  removeDeviceTag(id, normalizedTag);
                                                }}
                                                aria-label={`태그 ${normalizedTag} 삭제`}
                                              >
                                                ×
                                              </button>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                    {tagOptions.length > 0 && (
                                      <div className="tag-options">
                                        {tagOptions.map((option) => {
                                          const normalized = normalizeTagName(option);
                                          if (!normalized) {
                                            return null;
                                          }
                                          const selected = hasTag(deviceTags, normalized);
                                          return (
                                            <div
                                              key={`${id}-option-${tagKey(normalized)}`}
                                              className={`tag-chip${selected ? " selected" : ""}`}
                                              onClick={() => toggleDeviceTagSelection(id, normalized)}
                                              role="button"
                                              tabIndex={0}
                                              aria-pressed={selected}
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                  event.preventDefault();
                                                  toggleDeviceTagSelection(id, normalized);
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
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="device-overrides-actions">
                                    <button
                                      type="button"
                                      className="outline small-button"
                                      onClick={() => applyDeviceSettingsToAll(id)}
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
                </div>
              )}
            </section>

            <section className="form-section">
              <div className="form-section-header">
                <h3>요청 상세</h3>
              </div>
              <div className={`form-section-grid status-grid${isReturnAction ? " status-grid--return" : ""}`}>
                {!isReturnAction && (
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
                )}
                <label className="stretch">
                  신청 사유
                  <textarea
                    value={form.reason}
                    onChange={handleChange("reason")}
                    rows={4}
                    placeholder={config.reasonPlaceholder}
                  />
                </label>
              </div>
            </section>


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
