import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addApprovalComment,
  approveApproval,
  fetchApprovalComments,
  fetchApprovalDetail,
  rejectApproval,
  updateApprovalComment,
  deleteApprovalComment,
  updateApprovalApplication,
} from "@/api/approvals";
import { useUser } from "@/context/UserProvider";
import { fetchDepartments, fetchProjects, fetchDeviceDetail } from "@/api/devices";
import { fetchTags } from "@/api/tags";
import { RangeDateInput, DeadlineDateField } from "@/components/form/DateInputs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/ko";
import Spinner from "@/components/Spinner";
import ProjectCombobox from "@/components/form/ProjectCombobox";
import "./DeviceFormStyles.css";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const statusClassMap = {
  승인대기: "status-progress",
  진행중: "status-progress",
  "1차승인완료": "status-progress",
  승인완료: "status-complete",
  반려: "status-reject",
  반납: "status-return",
  취소: "status-unknown",
};

const getStatusClass = (status) => {
  if (!status) return "status-unknown";
  if (typeof status === "string") {
    const trimmed = status.trim();
    if (!trimmed) {
      return "status-unknown";
    }
    if (/^\d+차승인완료$/.test(trimmed)) {
      return "status-progress";
    }
    return statusClassMap[trimmed] ?? "status-unknown";
  }
  return "status-unknown";
};

const computeStageLabel = (approvalInfo, approvers = []) => {
  if (!Array.isArray(approvers) || approvers.length === 0) return null;
  if (approvalInfo !== "승인대기" && !(typeof approvalInfo === "string" && approvalInfo.includes("승인완료"))) {
    return null;
  }
  const approvedSteps = approvers
    .filter((item) => item?.isApproved)
    .map((item) => Number(item.step) || 0)
    .filter((step) => step > 0);
  if (approvedSteps.length === 0) return null;
  const highest = Math.max(...approvedSteps);
  if (!Number.isFinite(highest) || highest <= 0) return null;
  return `${highest}차승인완료`;
};

const computeUrgency = (deadline, approvalInfo) => {
  if (!deadline) return { urgent: false, label: null };
  const active = approvalInfo === "승인대기"
    || (typeof approvalInfo === "string" && /^\d+차승인완료$/.test(approvalInfo.trim()));
  if (!active) return { urgent: false, label: null };
  const now = new Date();
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return { urgent: false, label: null };
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 5) {
    return { urgent: false, label: null };
  }
  if (diffDays > 0) {
    return { urgent: true, label: `긴급 D-${diffDays}` };
  }
  if (diffDays === 0) {
    return { urgent: true, label: "긴급 오늘 마감" };
  }
  return { urgent: true, label: `긴급 ${Math.abs(diffDays)}일 지연` };
};

const statusLabel = (status) => {
  if (!status) return "-";
  if (typeof status !== "string") {
    return String(status);
  }
  const trimmed = status.trim();
  return trimmed || "-";
};

const extractDateString = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return "";
};

const todayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateOnly = (value) => {
  const dateString = extractDateString(value);
  if (!dateString) {
    return "-";
  }
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString();
};

const normalizeTagName = (value) => (typeof value === "string" ? value.trim() : "");

const tagKey = (value) => {
  const normalized = normalizeTagName(value);
  return normalized ? normalized.toLowerCase() : "";
};

const dedupeTagNames = (values = []) => {
  const seen = new Set();
  const result = [];
  (values ?? []).forEach((value) => {
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

const hasTag = (collection = [], candidate) => {
  const key = tagKey(candidate);
  if (!key) {
    return false;
  }
  return (collection ?? []).some((item) => tagKey(item) === key);
};

const removeTag = (collection = [], candidate) =>
  (collection ?? []).filter((item) => tagKey(item) !== tagKey(candidate));

const mergeTagOptions = (base = [], additions = []) =>
  dedupeTagNames([...(base ?? []), ...(additions ?? [])]);

const normalizeName = (value) => (typeof value === "string" ? value.trim() : "");

const DEFAULT_RETURN_STATUS_OPTIONS = ["정상", "노후"];
const DEFAULT_RETURN_TAG_SUGGESTIONS = ["정상", "점검필요", "부속품확인", "데이터삭제", "파손"];
const DEFAULT_METADATA_PROJECT = "본사";
const DEFAULT_METADATA_DEPARTMENT = "경영지원부";
const DEFAULT_METADATA_REAL_USER = "-";

export default function ApprovalDetail() {
  const { approvalId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const defaultUsername =
    user?.profile?.preferred_username || user?.profile?.name || user?.profile?.email || "";

  const [approval, setApproval] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const actionUsername = useMemo(() => (defaultUsername ?? "").trim(), [defaultUsername]);
  const [actionComment, setActionComment] = useState("");
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [metadataError, setMetadataError] = useState(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [tagFetchError, setTagFetchError] = useState(null);
  const [associatedDevices, setAssociatedDevices] = useState([]);
  const [isAssociatedDevicesLoading, setIsAssociatedDevicesLoading] = useState(false);
  const [associatedDevicesError, setAssociatedDevicesError] = useState(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [deviceOverrides, setDeviceOverrides] = useState({});

  const normalizedUsername = useMemo(() => (defaultUsername ?? "").trim(), [defaultUsername]);
  const currentUserExternalId = useMemo(() => {
    const candidate = user?.profile?.sub || user?.profile?.id;
    return typeof candidate === "string" ? candidate.trim() : "";
  }, [user]);

  // comment author is not an editable field anymore; we use `normalizedUsername`
  const approvalDeviceIds = useMemo(() => {
    if (!approval) {
      return [];
    }
    const collected = [];
    const seen = new Set();
    const rawIds = Array.isArray(approval.deviceIds) ? approval.deviceIds : [];
    rawIds
      .map((value) => (value != null ? String(value).trim() : ""))
      .filter((value) => value.length > 0)
      .forEach((value) => {
        if (!seen.has(value)) {
          seen.add(value);
          collected.push(value);
        }
      });
    const fallbackId = approval.deviceId != null ? String(approval.deviceId).trim() : "";
    if (fallbackId && !seen.has(fallbackId)) {
      collected.unshift(fallbackId);
    }
    return collected;
  }, [approval]);

  const deviceItems = useMemo(
    () => (Array.isArray(approval?.deviceItems) ? approval.deviceItems : []),
    [approval],
  );

  const isReturnRequest = approval?.type === "반납";
  const isDisposalRequest = approval?.type === "폐기";
  const isReturnEditing = isReturnRequest && isEditing;

  const initialTags = useMemo(
    () => dedupeTagNames(Array.isArray(approval?.tags) ? approval.tags : []),
    [approval],
  );

  const associatedDeviceMap = useMemo(() => {
    const map = new Map();
    (associatedDevices ?? []).forEach((device) => {
      const id = device?.id ?? device?.deviceId;
      if (!id) {
        return;
      }
      map.set(String(id).trim(), device);
    });
    return map;
  }, [associatedDevices]);

  const deviceRows = useMemo(() => {
    const rows = [];
    if (deviceItems.length > 0) {
      deviceItems.forEach((item, index) => {
        const rawId = item?.deviceId ?? approvalDeviceIds[index];
        const id = rawId != null ? String(rawId).trim() : "";
        const fallback = id ? associatedDeviceMap.get(id) : null;
        rows.push({
          key: id || `item-${index}`,
          deviceId: id || null,
          categoryName: item?.categoryName ?? fallback?.categoryName ?? fallback?.category ?? null,
          purpose: item?.purpose ?? fallback?.purpose ?? null,
          status: item?.status ?? fallback?.status ?? null,
          requestedProjectName: item?.requestedProjectName ?? approval?.tmpProjectName ?? null,
          requestedProjectCode: item?.requestedProjectCode ?? approval?.tmpProjectCode ?? null,
          requestedDepartmentName: item?.requestedDepartmentName ?? approval?.tmpDepartmentName ?? "경영지원부",
          requestedRealUser: item?.requestedRealUser ?? approval?.realUser ?? null,
          currentProjectName: item?.currentProjectName ?? fallback?.projectName ?? null,
          currentProjectCode: item?.currentProjectCode ?? fallback?.projectCode ?? null,
          currentDepartmentName: item?.currentDepartmentName ?? fallback?.manageDepName ?? null,
          currentRealUser: item?.currentRealUser ?? fallback?.realUser ?? null,
          categoryFallback: fallback?.categoryName ?? fallback?.category ?? null,
        });
      });
    } else {
      approvalDeviceIds.forEach((rawId) => {
        const id = rawId != null ? String(rawId).trim() : "";
        if (!id) {
          return;
        }
        const fallback = associatedDeviceMap.get(id);
        rows.push({
          key: id,
          deviceId: id,
          categoryName: fallback?.categoryName ?? fallback?.category ?? null,
          purpose: fallback?.purpose ?? null,
          status: fallback?.status ?? null,
          requestedProjectName: approval?.tmpProjectName ?? null,
          requestedProjectCode: approval?.tmpProjectCode ?? null,
          requestedDepartmentName: approval?.tmpDepartmentName ?? "경영지원부",
          requestedRealUser: approval?.realUser ?? null,
          currentProjectName: fallback?.projectName ?? null,
          currentProjectCode: fallback?.projectCode ?? null,
          currentDepartmentName: fallback?.manageDepName ?? null,
          currentRealUser: fallback?.realUser ?? null,
        });
      });
    }
    return rows;
  }, [approval, approvalDeviceIds, associatedDeviceMap, deviceItems]);

  const deviceRowMap = useMemo(() => {
    const map = new Map();
    deviceRows.forEach((row) => {
      const id = row?.deviceId ?? row?.key;
      if (!id) {
        return;
      }
      map.set(String(id), row);
    });
    return map;
  }, [deviceRows]);

  const visibleOverrideIds = useMemo(() => {
    const ordered = [];
    const seen = new Set();
    approvalDeviceIds.forEach((rawId) => {
      const id = rawId != null ? String(rawId).trim() : "";
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      ordered.push(id);
    });
    Object.keys(deviceOverrides ?? {}).forEach((rawId) => {
      const id = rawId != null ? String(rawId).trim() : "";
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      ordered.push(id);
    });
    return ordered;
  }, [approvalDeviceIds, deviceOverrides]);

  const returnStatusOptions = useMemo(() => {
    const seen = new Set(DEFAULT_RETURN_STATUS_OPTIONS);
    visibleOverrideIds.forEach((id) => {
      const status = deviceOverrides[id]?.status;
      const normalized = typeof status === "string" ? status.trim() : "";
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
      }
    });
    return Array.from(seen);
  }, [deviceOverrides, visibleOverrideIds]);

  const approverPending = useMemo(() => {
    const list = Array.isArray(approval?.approvers) ? approval.approvers : [];
    return list.filter((approver) => !approver?.isApproved && !approver?.isRejected);
  }, [approval]);

  const nextPending = approverPending.length > 0 ? approverPending[0] : null;

  const stageLabel = useMemo(
    () => computeStageLabel(approval?.approvalInfo, approval?.approvers ?? []),
    [approval],
  );

  const statusClass = useMemo(
    () => getStatusClass(approval?.approvalInfo ?? approval?.approvalStatus ?? ""),
    [approval],
  );

  const urgency = useMemo(
    () => computeUrgency(approval?.deadline, approval?.approvalInfo),
    [approval],
  );

  const isTerminalStatus = useMemo(() => {
    const status = approval?.approvalStatus;
    if (!status || typeof status !== "string") {
      return false;
    }
    const normalized = status.trim().toUpperCase();
    return normalized === "APPROVED" || normalized === "REJECTED" || normalized === "CANCELLED";
  }, [approval]);

  const matchApprover = useCallback(
    (approver) => {
      if (!approver) {
        return false;
      }
      const normalizedName = normalizedUsername?.toLowerCase();
      const normalizedId = currentUserExternalId?.toLowerCase();
      const approverName = approver.username ? approver.username.trim().toLowerCase() : "";
      const approverId = approver.userUuid ? String(approver.userUuid).toLowerCase() : "";
      return (normalizedName && normalizedName === approverName)
        || (normalizedId && normalizedId === approverId);
    },
    [currentUserExternalId, normalizedUsername],
  );

  const isCurrentUserApprover = useMemo(() => {
    const list = Array.isArray(approval?.approvers) ? approval.approvers : [];
    if (list.length === 0) {
      return false;
    }
    return list.some((approver) => matchApprover(approver));
  }, [approval, matchApprover]);

  const isCurrentUserPendingApprover = useMemo(
    () => (nextPending ? matchApprover(nextPending) : false),
    [matchApprover, nextPending],
  );

  const canApprove = isCurrentUserPendingApprover && !isTerminalStatus;
  const canReject = canApprove;

  useEffect(() => {
    const baseOptions = isReturnRequest
      ? mergeTagOptions(DEFAULT_RETURN_TAG_SUGGESTIONS, initialTags)
      : initialTags;
    setSelectedTags(initialTags);
    setTagOptions((prev) => mergeTagOptions(prev, baseOptions));
    setTagInput("");
  }, [initialTags, isReturnRequest]);

  const loadDetail = useCallback(async () => {
    if (!approvalId) {
      setApproval(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await fetchApprovalDetail(Number(approvalId));
      setApproval(detail);
    } catch (err) {
      console.error(err);
      setError("결재 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [approvalId]);

  const loadComments = useCallback(async () => {
    if (!approvalId) {
      setComments([]);
      return;
    }
    try {
      const data = await fetchApprovalComments(Number(approvalId));
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, [approvalId]);

  useEffect(() => {
    loadDetail();
    loadComments();
  }, [loadComments, loadDetail]);

  useEffect(() => {
    let cancelled = false;
    const loadMetadata = async () => {
      setIsMetadataLoading(true);
      setMetadataError(null);
      try {
        const [deptData, projectData] = await Promise.all([fetchDepartments(), fetchProjects()]);
        if (cancelled) {
          return;
        }
        setDepartments(Array.isArray(deptData) ? deptData : []);
        setProjects(Array.isArray(projectData) ? projectData : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setMetadataError("참조 정보를 불러오지 못했습니다.");
          setDepartments([]);
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setIsMetadataLoading(false);
        }
      }
    };

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReturnRequest) {
      setIsTagLoading(false);
      setTagFetchError(null);
      return undefined;
    }

    let cancelled = false;
    const loadAvailableTags = async () => {
      setIsTagLoading(true);
      setTagFetchError(null);
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

    loadAvailableTags();
    return () => {
      cancelled = true;
    };
  }, [isReturnRequest]);

  const canEditApplication = useMemo(() => {
    if (!approval || isTerminalStatus) {
      return false;
    }
    const applicant = approval.userName ? approval.userName.trim().toLowerCase() : "";
    const current = normalizedUsername ? normalizedUsername.toLowerCase() : "";
    if (applicant && current) {
      return applicant === current;
    }
    return !!normalizedUsername;
  }, [approval, isTerminalStatus, normalizedUsername]);

  const canModifyComment = useCallback(
    (comment) => {
      if (!comment) {
        return false;
      }
      const author = comment.username ? comment.username.trim().toLowerCase() : "";
      const current = normalizedUsername ? normalizedUsername.toLowerCase() : "";
      return author && current && author === current;
    },
    [normalizedUsername],
  );

    useEffect(() => {
      let cancelled = false;
      const ids = approvalDeviceIds;
      if (!ids || ids.length === 0) {
        setAssociatedDevices([]);
        setAssociatedDevicesError(null);
        setIsAssociatedDevicesLoading(false);
        return () => {
          cancelled = true;
        };
      }

      const loadAssociatedDevices = async () => {
        setIsAssociatedDevicesLoading(true);
        setAssociatedDevicesError(null);
        try {
          const results = await Promise.allSettled(
            ids.map((deviceId) => fetchDeviceDetail(deviceId)),
          );
          if (cancelled) {
            return;
          }
          const nextDevices = [];
          const failures = [];
          results.forEach((result, index) => {
            const targetId = ids[index];
            if (result.status === "fulfilled" && result.value) {
              const detail = result.value;
              nextDevices.push({
                ...detail,
                id: detail?.id ?? targetId,
              });
            } else {
              failures.push(targetId);
            }
          });
          setAssociatedDevices(nextDevices);
          if (failures.length > 0) {
            setAssociatedDevicesError(`일부 장비 정보를 불러오지 못했습니다: ${failures.join(", ")}`);
          } else {
            setAssociatedDevicesError(null);
          }
        } catch (err) {
          console.error(err);
          if (!cancelled) {
            setAssociatedDevices([]);
            setAssociatedDevicesError("선택된 장비 정보를 불러오는 중 문제가 발생했습니다.");
          }
        } finally {
          if (!cancelled) {
            setIsAssociatedDevicesLoading(false);
          }
        }
      };

      loadAssociatedDevices();

      return () => {
        cancelled = true;
      };
    }, [approvalDeviceIds]);

    const buildInitialOverrides = useCallback(() => {
      if (!approval) {
        return {};
      }

      const nextOverrides = {};
      const defaultMode = (approval?.realUserMode ?? "auto").toLowerCase() === "manual" ? "manual" : "auto";

      if (deviceItems.length > 0) {
        deviceItems.forEach((item, index) => {
          const rawId = item?.deviceId ?? approvalDeviceIds[index];
          if (!rawId) {
            return;
          }
          const id = String(rawId);
          const fallback = associatedDeviceMap.get(id) || {};
          const row = deviceRowMap.get(id) || {};
          const initialStatus = (item?.status ?? row?.status ?? fallback.status ?? "").trim();
          const initialTags = dedupeTagNames(
            Array.isArray(fallback?.tags) ? fallback.tags : [],
          );
          const mode = (item?.requestedRealUserMode ?? defaultMode).toLowerCase() === "manual" ? "manual" : "auto";
          nextOverrides[id] = {
            deviceId: id,
            projectName:
              item?.requestedProjectName
              ?? approval?.tmpProjectName
              ?? fallback.projectName
              ?? "",
            projectCode:
              item?.requestedProjectCode
              ?? approval?.tmpProjectCode
              ?? fallback.projectCode
              ?? "",
            departmentName:
              item?.requestedDepartmentName
              ?? approval?.tmpDepartmentName
              ?? fallback.manageDepName
              ?? "",
            departmentCode:
              item?.requestedDepartmentCode
              ?? approval?.tmpDepartmentCode
              ?? fallback.manageDepCode
              ?? "",
            realUserMode: mode,
            realUser: mode === "manual"
              ? item?.requestedRealUser ?? fallback.realUser ?? ""
              : "",
            status: initialStatus,
            tags: initialTags,
            tagInput: "",
          };
        });
      } else {
        approvalDeviceIds.forEach((rawId) => {
          if (!rawId) {
            return;
          }
          const id = String(rawId);
          const fallback = associatedDeviceMap.get(id) || {};
          const row = deviceRowMap.get(id) || {};
          const initialStatus = (row?.status ?? fallback.status ?? "").trim();
          const initialTags = dedupeTagNames(
            Array.isArray(fallback?.tags) ? fallback.tags : [],
          );
          const mode = defaultMode;
          nextOverrides[id] = {
            deviceId: id,
            projectName: approval?.tmpProjectName ?? fallback.projectName ?? "",
            projectCode: approval?.tmpProjectCode ?? fallback.projectCode ?? "",
            departmentName: approval?.tmpDepartmentName ?? fallback.manageDepName ?? "경영지원부",
            departmentCode: approval?.tmpDepartmentCode ?? fallback.manageDepCode ?? "",
            realUserMode: mode,
            realUser: mode === "manual"
              ? approval?.realUser ?? fallback.realUser ?? ""
              : "",
            status: initialStatus,
            tags: initialTags,
            tagInput: "",
          };
        });
      }

      return nextOverrides;
    }, [approval, approvalDeviceIds, associatedDeviceMap, deviceItems, deviceRowMap]);

    useEffect(() => {
      if (!approval) {
        setDeviceOverrides({});
        return;
      }
      const initialOverrides = buildInitialOverrides();
      setDeviceOverrides(initialOverrides);
      const seededTags = dedupeTagNames(
        Object.values(initialOverrides || {}).flatMap((entry) => (Array.isArray(entry?.tags) ? entry.tags : [])),
      );
      if (seededTags.length > 0) {
        setTagOptions((prev) => mergeTagOptions(prev, seededTags));
      }
    }, [approval, buildInitialOverrides]);
  const buildEditFormFromApproval = useCallback(() => {
    if (!approval) {
      return null;
    }
    const initialDeadline = extractDateString(approval.deadline) || todayDateString();

    return {
      reason: approval.reason ?? "",
      usageStartDate: extractDateString(approval.usageStartDate),
      usageEndDate: extractDateString(approval.usageEndDate),
      deadlineDate: initialDeadline,
    };
  }, [approval]);

  useEffect(() => {
    const initialForm = buildEditFormFromApproval();
    if (!initialForm) {
      setEditForm(null);
      setIsEditing(false);
      return;
    }
    setEditForm(initialForm);
    setEditError(null);
    setIsEditing(false);
  }, [buildEditFormFromApproval]);

  const refreshData = useCallback(async () => {
    await loadDetail();
    await loadComments();
  }, [loadDetail, loadComments]);

  const handleEditFieldChange = (field) => (event) => {
    const value = event.target.value;
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleUsagePeriodEdit = (start, end) => {
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        usageStartDate: start,
        usageEndDate: end,
      };
    });
  };

  const handleDeadlineChange = (value) => {
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        deadlineDate: value ?? "",
      };
    });
  };

  const handleStartEdit = () => {
    if (!canEditApplication) {
      return;
    }
    const current = buildEditFormFromApproval();
    setEditForm(current);
    setEditError(null);
    setIsEditing(true);
  setSelectedTags(initialTags);
  setTagInput("");
  setDeviceOverrides(buildInitialOverrides());
  };

  const handleCancelEdit = () => {
    setEditForm(buildEditFormFromApproval());
    setEditError(null);
    setIsEditing(false);
  setSelectedTags(initialTags);
  setTagInput("");
  setDeviceOverrides(buildInitialOverrides());
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

  const updateDeviceOverride = (deviceId, patch) => {
    if (!deviceId) {
      return;
    }
  setDeviceOverrides((prev) => {
      const key = String(deviceId);
      const current = prev[key] ?? { deviceId: key };
      const next = {
        ...prev,
        [key]: {
          ...current,
          ...patch,
          deviceId: key,
        },
      };
      const entry = next[key];
      if (entry.realUserMode && entry.realUserMode !== "manual") {
        entry.realUserMode = "auto";
        entry.realUser = "";
      }
      if (entry.realUserMode === "manual" && typeof entry.realUser !== "string") {
        entry.realUser = "";
      }
      return next;
    });
  };

  const handleReturnDeviceStatusChange = (deviceId, value) => {
    if (!deviceId) {
      return;
    }
    const normalized = typeof value === "string" ? value.trim() : "";
  setDeviceOverrides((prev) => {
      const key = String(deviceId);
      const current = prev[key] ?? { deviceId: key };
      if (current.status === normalized) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...current,
          deviceId: key,
          status: normalized,
        },
      };
    });
  };

  const handleReturnDeviceTagInputChange = (deviceId, value) => {
    if (!deviceId) {
      return;
    }
    setDeviceOverrides((prev) => {
      const key = String(deviceId);
      const current = prev[key] ?? { deviceId: key, tags: [], tagInput: "" };
      if (current.tagInput === value) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...current,
          deviceId: key,
          tags: Array.isArray(current.tags) ? current.tags : [],
          tagInput: value,
        },
      };
    });
  };

  const handleReturnDeviceTagSubmit = (deviceId) => {
    if (!deviceId) {
      return;
    }
    let normalizedValue = null;
    setDeviceOverrides((prev) => {
      const key = String(deviceId);
      const current = prev[key] ?? { deviceId: key, tags: [], tagInput: "" };
      const currentTags = Array.isArray(current.tags) ? current.tags : [];
      const inputValue = typeof current.tagInput === "string" ? current.tagInput : "";
      normalizedValue = normalizeTagName(inputValue);
      if (!normalizedValue) {
        if (!inputValue) {
          return prev;
        }
        return {
          ...prev,
          [key]: {
            ...current,
            deviceId: key,
            tags: currentTags,
            tagInput: "",
          },
        };
      }
      const already = hasTag(currentTags, normalizedValue);
      const nextTags = already ? currentTags : dedupeTagNames([...currentTags, normalizedValue]);
      return {
        ...prev,
        [key]: {
          ...current,
          deviceId: key,
          tags: nextTags,
          tagInput: "",
        },
      };
    });
    if (normalizedValue) {
      setTagOptions((prev) => mergeTagOptions(prev, [normalizedValue]));
    }
  };

  const handleReturnDeviceTagInputKeyDown = (deviceId) => (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleReturnDeviceTagSubmit(deviceId);
    }
  };

  const toggleReturnDeviceTagSelection = (deviceId, tag) => {
    if (!deviceId) {
      return;
    }
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setDeviceOverrides((prev) => {
      const key = String(deviceId);
      const current = prev[key] ?? { deviceId: key, tags: [], tagInput: "" };
      const currentTags = Array.isArray(current.tags) ? current.tags : [];
      const selected = hasTag(currentTags, normalized);
      const nextTags = selected
        ? removeTag(currentTags, normalized)
        : dedupeTagNames([...currentTags, normalized]);
      return {
        ...prev,
        [key]: {
          ...current,
          deviceId: key,
          tags: nextTags,
        },
      };
    });
    setTagOptions((prev) => mergeTagOptions(prev, [normalized]));
  };

  const removeReturnDeviceTag = (deviceId, tag) => {
    if (!deviceId) {
      return;
    }
    const normalized = normalizeTagName(tag);
    if (!normalized) {
      return;
    }
    setDeviceOverrides((prev) => {
      const key = String(deviceId);
      const current = prev[key];
      if (!current) {
        return prev;
      }
      const currentTags = Array.isArray(current.tags) ? current.tags : [];
      if (!hasTag(currentTags, normalized)) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...current,
          deviceId: key,
          tags: removeTag(currentTags, normalized),
        },
      };
    });
  };

  const applyOverrideToAll = (deviceId) => {
    if (isReturnRequest) {
      return;
    }
    if (!deviceId) {
      return;
    }
    setDeviceOverrides((prev) => {
      const source = prev[String(deviceId)];
      if (!source) {
        return prev;
      }
      const sanitizedMode = source.realUserMode === "manual" ? "manual" : "auto";
      const sanitizedRealUser = sanitizedMode === "manual" ? source.realUser ?? "" : "";
      const next = { ...prev };
      visibleOverrideIds.forEach((id) => {
        const current = next[id] ?? { deviceId: id };
        next[id] = {
          ...current,
          deviceId: id,
          projectName: source.projectName ?? "",
          projectCode: source.projectCode ?? "",
          departmentName: source.departmentName ?? "경영지원부",
          departmentCode: source.departmentCode ?? "",
          realUserMode: sanitizedMode,
          realUser: sanitizedRealUser,
        };
      });
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!approval || !editForm) {
      return;
    }
    if (!defaultUsername) {
      alert("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    const trimmedReason = (editForm.reason ?? "").trim();
    if (!trimmedReason) {
      alert("신청 사유를 입력해 주세요.");
      return;
    }
    const applicantAutoRealUser = normalizedUsername || "";

    const start = editForm.usageStartDate ?? "";
    const end = editForm.usageEndDate ?? "";
    if ((start && !end) || (!start && end)) {
      alert("사용 기간은 시작일과 종료일을 모두 선택해 주세요.");
      return;
    }
    if (start && end && start > end) {
      alert("사용 종료일은 시작일 이후여야 합니다.");
      return;
    }

    if (!editForm.deadlineDate) {
      alert("신청 마감일을 선택해 주세요.");
      return;
    }

    if (visibleOverrideIds.length === 0) {
      alert("연결된 장비 정보가 없습니다.");
      return;
    }

    const seenDeviceIds = new Set();
    let overridesPayload = [];

    if (isReturnRequest) {
      const missingStatusIds = [];
      overridesPayload = [];
      visibleOverrideIds.forEach((rawId) => {
        const id = rawId != null ? String(rawId) : "";
        if (!id || seenDeviceIds.has(id)) {
          return;
        }
        seenDeviceIds.add(id);
        const override = deviceOverrides[id] ?? { deviceId: id };
        const statusValue = typeof override.status === "string" ? override.status.trim() : "";
        const deviceTags = Array.isArray(override.tags) ? dedupeTagNames(override.tags) : [];
        overridesPayload.push({
          deviceId: id,
          status: statusValue || null,
          tags: deviceTags,
        });
        if (!statusValue) {
          missingStatusIds.push(id);
        }
      });
      if (missingStatusIds.length > 0) {
        alert(`장비 상태를 선택해 주세요: ${missingStatusIds.join(", ")}`);
        return;
      }
    } else {
      const collected = [];
      visibleOverrideIds.forEach((rawId) => {
        const id = rawId != null ? String(rawId) : "";
        if (!id || seenDeviceIds.has(id)) {
          return;
        }
        seenDeviceIds.add(id);
        const override = deviceOverrides[id] ?? { deviceId: id };
        const modeKey = (override.realUserMode ?? "auto").toLowerCase() === "manual" ? "manual" : "auto";
        const manualRealUser = modeKey === "manual" ? (override.realUser ?? "").trim() : "";
        const resolvedRealUser = modeKey === "manual"
          ? manualRealUser || null
          : (applicantAutoRealUser || null);
        collected.push({
          deviceId: id,
          projectName: (override.projectName ?? "").trim() || null,
          projectCode: (override.projectCode ?? "").trim() || null,
          departmentName: (override.departmentName ?? "경영지원부").trim() || null,
          realUserMode: modeKey,
          realUser: resolvedRealUser,
        });
      });
      overridesPayload = collected;
    }

    if (overridesPayload.length === 0) {
      alert("조정할 장비 정보를 찾지 못했습니다.");
      return;
    }

    const payload = {
      username: defaultUsername,
      reason: trimmedReason,
      devices: overridesPayload,
      deadline: editForm.deadlineDate ? `${editForm.deadlineDate}T00:00:00` : null,
      usageStartDate: start ? `${start}T00:00:00` : null,
      usageEndDate: end ? `${end}T00:00:00` : null,
    };

    if (isReturnRequest) {
      const aggregatedTags = dedupeTagNames(overridesPayload.flatMap((item) => item.tags ?? []));
      const primaryStatus = (overridesPayload[0]?.status ?? "").trim();
      payload.tags = aggregatedTags;
      payload.status = primaryStatus || null;
      payload.deviceStatus = primaryStatus || null;
      payload.realUser = null;
      payload.realUserMode = "auto";
      payload.departmentName = null;
      payload.projectName = null;
      payload.projectCode = null;
    } else {
      const primaryOverride = overridesPayload[0] ?? {};
      payload.departmentName = primaryOverride.departmentName ?? "경영지원부";
      payload.projectName = primaryOverride.projectName ?? null;
      payload.projectCode = primaryOverride.projectCode ?? null;
    }

    setEditError(null);
    setIsSavingEdit(true);
    try {
      await updateApprovalApplication(Number(approvalId), payload);
    alert("신청 정보가 수정되었습니다.");
    setIsEditing(false);
      await refreshData();
    } catch (err) {
      console.error(err);
      setEditError("신청 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleApprove = async () => {
    if (isActionProcessing) {
      return;
    }
    if (isTerminalStatus) {
      alert("이미 완료되거나 취소된 결재입니다.");
      return;
    }
    if (!isCurrentUserApprover) {
      alert("결재 권한이 없습니다.");
      return;
    }
    if (!actionUsername) {
      alert("승인자를 입력해주세요.");
      return;
    }
    if (!canApprove) {
      alert("이미 승인을 완료한 단계입니다.");
      return;
    }
    setIsActionProcessing(true);
    try {
      await approveApproval(Number(approvalId), {
        approverUsername: actionUsername,
        comment: actionComment,
      });
      alert("승인되었습니다.");
      await refreshData();
    } catch (err) {
      console.error(err);
      alert("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isActionProcessing) {
      return;
    }
    if (isTerminalStatus) {
      alert("이미 완료되거나 취소된 결재입니다.");
      return;
    }
    if (!isCurrentUserApprover) {
      alert("결재 권한이 없습니다.");
      return;
    }
    if (!actionUsername) {
      alert("승인자를 입력해주세요.");
      return;
    }
    if (!canReject) {
      alert("현재 단계에서는 반려할 수 없습니다.");
      return;
    }
    setIsActionProcessing(true);
    try {
      await rejectApproval(Number(approvalId), {
        approverUsername: actionUsername,
        comment: actionComment,
      });
      alert("반려 처리되었습니다.");
      await refreshData();
    } catch (err) {
      console.error(err);
      alert("반려 처리 중 오류가 발생했습니다.");
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleAddComment = async () => {
    const author = (normalizedUsername ?? "").trim();
    if (!author) {
      alert("로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }
    if (!commentText.trim()) {
      alert("댓글 내용을 입력해주세요.");
      return;
    }
    setIsActionProcessing(true);
    try {
      await addApprovalComment(Number(approvalId), {
        username: author,
        content: commentText,
      });
      // keep commentText cleared; author is from logged-in user
      setCommentText("");
      await loadComments();
    } catch (err) {
      console.error(err);
      alert("댓글 등록 중 오류가 발생했습니다.");
    } finally {
      setIsActionProcessing(false);
    }
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id ?? null);
    setEditingCommentText(comment.content ?? "");
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleUpdateComment = async () => {
    if (!editingCommentId) {
      return;
    }
    if (!normalizedUsername) {
      alert("댓글 수정 권한을 확인할 수 없습니다.");
      return;
    }
    if (!editingCommentText.trim()) {
      alert("댓글 내용을 입력해주세요.");
      return;
    }
    setIsActionProcessing(true);
    try {
      await updateApprovalComment(Number(approvalId), editingCommentId, {
        username: normalizedUsername,
        content: editingCommentText,
      });
      cancelEditComment();
      await loadComments();
    } catch (err) {
      console.error(err);
      alert("댓글 수정 중 오류가 발생했습니다.");
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId) {
      return;
    }
    if (!normalizedUsername) {
      alert("댓글 삭제 권한을 확인할 수 없습니다.");
      return;
    }
    const confirmed = window.confirm("댓글을 삭제하시겠습니까?");
    if (!confirmed) {
      return;
    }
    setIsActionProcessing(true);
    try {
      await deleteApprovalComment(Number(approvalId), commentId, normalizedUsername);
      if (editingCommentId === commentId) {
        cancelEditComment();
      }
      await loadComments();
    } catch (err) {
      console.error(err);
      alert("댓글 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsActionProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <p>불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="card">
        <p>결재 정보를 찾을 수 없습니다.</p>
        <button type="button" onClick={() => navigate(-1)}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>결재 상세</h2>
          <p className="muted">결재 ID {approval.approvalId} · {statusLabel(approval.approvalInfo)}</p>
          <div className="taglist-wrap">
            <span className={`status-chip ${statusClass}`}>{statusLabel(approval.approvalInfo)}</span>
            {stageLabel && <span className="tag tag-outline">{stageLabel}</span>}
            {urgency.urgent && urgency.label && <span className="tag tag-danger">{urgency.label}</span>}
            {approval.type && <span className="tag tag-outline">{approval.type}</span>}
          </div>
        </div>
        <div className="card-actions">
          {canEditApplication && !isEditing && (
            <button type="button" className="primary" onClick={handleStartEdit}>
              신청 내용 수정
            </button>
          )}
          {canEditApplication && isEditing && (
            <button type="button" className="outline" onClick={handleCancelEdit}>
              수정 취소
            </button>
          )}
          <button type="button" className="outline" onClick={() => navigate(-1)}>
            목록으로 돌아가기
          </button>
        </div>
      </div>

      <section className="detail-grid detail-grid--approval">
        <div className="detail-section detail-section--applicant">
          <h3>신청 정보</h3>
          {isEditing && editForm ? (
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
              {isMetadataLoading && <p className="muted">참조 정보를 불러오는 중입니다...</p>}
              {metadataError && <p className="error">{metadataError}</p>}
              {editError && <p className="error">{editError}</p>}
              <div className="form-section-grid applicant-grid applicant-grid--detail">
                <label className="stretch applicant-grid__reason">
                  신청 사유
                  <textarea
                    style={{ width: "96%" }}
                    rows={4}
                    value={editForm.reason}
                    onChange={handleEditFieldChange("reason")}
                    placeholder="신청 사유를 입력해 주세요."
                  />
                </label>
                {!isReturnRequest && !isDisposalRequest && (
                  <div className="applicant-field applicant-field--range">
                    <RangeDateInput
                      startDate={editForm.usageStartDate}
                      endDate={editForm.usageEndDate}
                      onChange={handleUsagePeriodEdit}
                    />
                  </div>
                )}
                <div className="applicant-field applicant-field--deadline">
                  <DeadlineDateField
                    value={editForm.deadlineDate}
                    onChange={handleDeadlineChange}
                  />
                </div>
              </div>

              {approval?.type === "반납" && !isReturnEditing && (
                <div className="tag-edit-wrapper">
                  <div className="tag-edit-header">
                    <span className="tag-edit-title">태그</span>
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
              )}

              <div className="form-actions form-actions--tight">
                <button type="button" className="primary" onClick={handleSaveEdit} disabled={isSavingEdit}>
                  {isSavingEdit ? "저장 중..." : "저장"}
                </button>
                <button type="button" className="outline" onClick={handleCancelEdit} disabled={isSavingEdit}>
                  취소
                </button>
              </div>
            </LocalizationProvider>
          ) : (
            <dl>
              <div>
                <dt>신청자</dt>
                <dd>{approval.userName ?? "-"}</dd>
              </div>
              <div>
                <dt>다음 결재자</dt>
                <dd>{nextPending?.username ?? "-"}</dd>
              </div>
              <div>
                <dt>신청 유형</dt>
                <dd>{approval.type ?? "-"}</dd>
              </div>
              <div>
                <dt>신청일</dt>
                <dd>{formatDateTime(approval.createdDate)}</dd>
              </div>
              {!isReturnRequest && !isDisposalRequest && (
                <>
                  <div>
                    <dt>사용 시작일</dt>
                    <dd>{formatDateOnly(approval.usageStartDate)}</dd>
                  </div>
                  <div>
                    <dt>사용 종료일</dt>
                    <dd>{formatDateOnly(approval.usageEndDate)}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>신청 마감일</dt>
                <dd>{formatDateOnly(approval.deadline)}</dd>
              </div>
              <div>
                <dt>사유</dt>
                <dd>
                  <pre className="detail-reason">
                    {approval.reason ?? "-"}
                  </pre>
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="detail-section detail-section--devices">
          <h3>장비 정보</h3>
          
          {isEditing && editForm && !isDisposalRequest && (
            <>
             <p className="muted">
              {isReturnEditing
                ? "반납 신청 장비마다 반납 상태와 태그를 조정할 수 있습니다."
                : "각 장비마다 프로젝트, 관리부서, 실제 사용자 정보를 개별로 조정할 수 있습니다."}
            </p>
            <div className="table-wrapper table-wrapper--device-overrides">
              <div className="table-wrapper__scroll">
                <table className={`device-overrides-table ${isReturnEditing ? 'return-editing' : ''}`}>
                  <thead>
                    <tr>
                      <th>관리번호</th>
                      {isReturnEditing ? (
                        <>
                          <th>반납 상태</th>
                          <th>장비 태그</th>
                          <th>현재 정보</th>
                        </>
                      ) : (
                        <>
                          <th>요청 프로젝트</th>
                          <th>요청 부서</th>
                          <th>실제 사용자</th>
                          <th>현재 정보</th>
                          <th>작업</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOverrideIds.length === 0 ? (
                      <tr>
                        <td colSpan={isReturnEditing ? 4 : 6} className="muted">
                          조정할 장비 정보가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      visibleOverrideIds.map((id, index) => {
                        const key = String(id);
                        const override = deviceOverrides[key] ?? { deviceId: key };
                        const row = deviceRowMap.get(key) || deviceRows[index] || {};
                        if (isReturnEditing) {
                          const statusValue = typeof override.status === "string" ? override.status.trim() : "";
                          const deviceTags = Array.isArray(override.tags) ? override.tags : [];
                          const tagInputValue = typeof override.tagInput === "string" ? override.tagInput : "";
                          const currentStatus = row.status ?? row.currentStatus ?? "-";

                          return (
                            <tr key={key}>
                              <td>
                                <div className="device-overrides-meta">
                                  <strong>{row.deviceId || key}</strong>
                                  {row.categoryName && row.categoryName !== "-" && (
                                    <span>{row.categoryName}</span>
                                  )}
                                  {currentStatus && currentStatus !== "-" && (
                                    <span className="muted">현재 상태: {currentStatus}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <select
                                  value={statusValue}
                                  onChange={(event) => handleReturnDeviceStatusChange(key, event.target.value)}
                                >
                                  {returnStatusOptions.map((option) => (
                                    <option key={`${key}-status-${option}`} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <div className="device-return-tags">
                                  <div className="tag-input-row">
                                    <input
                                      type="text"
                                      value={tagInputValue}
                                      onChange={(event) => handleReturnDeviceTagInputChange(key, event.target.value)}
                                      onKeyDown={handleReturnDeviceTagInputKeyDown(key)}
                                      placeholder="태그 입력 후 Enter 또는 추가 버튼"
                                    />
                                    <button
                                      type="button"
                                      className="outline tag-add-button"
                                      onClick={() => handleReturnDeviceTagSubmit(key)}
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
                                          <div key={`${key}-selected-${tagKey(normalizedTag)}`} className="tag-chip selected">
                                            <span className="tag-label">{normalizedTag}</span>
                                            <button
                                              type="button"
                                              className="remove-btn"
                                              onClick={(ev) => {
                                                ev.stopPropagation();
                                                removeReturnDeviceTag(key, normalizedTag);
                                              }}
                                              aria-label={`태그 ${normalizedTag} 제거`}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  {tagOptions.length > 0 && (
                                    <div className="tag-options" style={{ marginTop: "4px" }}>
                                      {tagOptions.map((option) => {
                                        const normalizedOption = normalizeTagName(option);
                                        if (!normalizedOption) {
                                          return null;
                                        }
                                        const selected = hasTag(deviceTags, normalizedOption);
                                        return (
                                          <div
                                            key={`${key}-option-${tagKey(normalizedOption)}`}
                                            className={`tag-chip${selected ? " selected" : ""}`}
                                            onClick={() => toggleReturnDeviceTagSelection(key, normalizedOption)}
                                            role="button"
                                            tabIndex={0}
                                            aria-pressed={selected}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                toggleReturnDeviceTagSelection(key, normalizedOption);
                                              }
                                            }}
                                          >
                                            <span className="tag-label">{normalizedOption}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="device-overrides-current">
                                  <div>
                                    <span className="device-overrides-current-label">프로젝트</span>
                                    <span className="device-overrides-current-value">{row.currentProjectName ?? "-"}</span>
                                  </div>
                                  <div>
                                    <span className="device-overrides-current-label">부서</span>
                                    <span className="device-overrides-current-value">{row.currentDepartmentName ?? "-"}</span>
                                  </div>
                                  <div>
                                    <span className="device-overrides-current-label">실제 사용자</span>
                                    <span className="device-overrides-current-value">{row.currentRealUser ?? "-"}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const mode = (override.realUserMode ?? "auto").toLowerCase() === "manual" ? "manual" : "auto";
                        const manualDisabled = mode !== "manual";

                        const fallbackRequestedProject = row.requestedProjectName && row.requestedProjectName !== "-"
                          ? row.requestedProjectName
                          : "";
                        const fallbackRequestedProjectCode = row.requestedProjectCode && row.requestedProjectCode !== "-"
                          ? row.requestedProjectCode
                          : "";
                        const fallbackCurrentProject = row.currentProjectName && row.currentProjectName !== "-"
                          ? row.currentProjectName
                          : "";
                        const fallbackCurrentProjectCode = row.currentProjectCode && row.currentProjectCode !== "-"
                          ? row.currentProjectCode
                          : "";
                        const resolvedProjectName = (override.projectName ?? fallbackRequestedProject ?? fallbackCurrentProject ?? "").trim();
                        const resolvedProjectCode = (override.projectCode ?? fallbackRequestedProjectCode ?? fallbackCurrentProjectCode ?? "").trim();
                        const selectedProject = resolvedProjectName || resolvedProjectCode
                          ? { name: resolvedProjectName, code: resolvedProjectCode }
                          : null;
                        const displayProject = resolvedProjectName || resolvedProjectCode
                          ? [resolvedProjectName || resolvedProjectCode, resolvedProjectName && resolvedProjectCode ? `(${resolvedProjectCode})` : ""].filter(Boolean).join(" ")
                          : fallbackRequestedProject || fallbackCurrentProject || "-";

                        const fallbackRequestedDepartment = row.requestedDepartmentName && row.requestedDepartmentName !== "-"
                          ? row.requestedDepartmentName
                          : "";
                        const fallbackCurrentDepartment = row.currentDepartmentName && row.currentDepartmentName !== "-"
                          ? row.currentDepartmentName
                          : "";
                        const selectedDepartmentName = (override.departmentName ?? fallbackRequestedDepartment ?? "").trim();
                        const displayDepartment = selectedDepartmentName || fallbackCurrentDepartment || "-";

                        const fallbackRequestedUser = normalizeName(
                          row.requestedRealUser && row.requestedRealUser !== "-"
                            ? row.requestedRealUser
                            : "",
                        );
                        const fallbackCurrentUser = normalizeName(
                          row.currentRealUser && row.currentRealUser !== "-"
                            ? row.currentRealUser
                            : "",
                        );
                        const applicantName = normalizeName(approval?.userName ?? defaultUsername ?? "");
                        const autoRealUserDisplay = isEditing
                          ? applicantName
                          : (fallbackRequestedUser || fallbackCurrentUser);
                        const manualRealUser = normalizeName(override.realUser ?? "");
                        const resolvedInputRealUser = mode === "manual"
                          ? manualRealUser || ""
                          : autoRealUserDisplay || "";
                        const displayRealUser = mode === "manual"
                          ? manualRealUser || "-"
                          : autoRealUserDisplay || "-";
                        

                        return (
                          <tr key={key}>
                            <td>
                              <div className="device-overrides-meta">
                                <strong>{row.deviceId || key}</strong>
                                {row.categoryName && row.categoryName !== "-" && (
                                  <span>{row.categoryName}</span>
                                )}
                                {row.status && row.status !== "-" && (
                                  <span className="muted">{row.status}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="device-overrides-project">
                                <ProjectCombobox
                                  projects={projects}
                                  selectedProject={selectedProject}
                                  onSelect={(project) => {
                                    updateDeviceOverride(key, {
                                      projectName: project?.name ?? "",
                                      projectCode: project?.code ?? "",
                                    });
                                  }}
                                  disabled={projects.length === 0}
                                  panelClassName="combobox-panel--stretch"
                                  searchInputClassName="combobox-search--full"
                                  listClassName="combobox-options combobox-options--scroll"
                                />
                              </div>
                            </td>
                            <td>
                              <select
                                value={selectedDepartmentName}
                                onChange={(event) => {
                                  const nextName = event.target.value;
                                  const matched = departments.find((department) => department.name === nextName || department.code === nextName);
                                  updateDeviceOverride(key, {
                                    departmentName: nextName,
                                    departmentCode: matched?.code ?? "",
                                  });
                                }}
                              >
                                {departments.map((department) => (
                                  <option key={department.id ?? department.code ?? department.name} value={department.name}>
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
                                    updateDeviceOverride(key, {
                                      realUserMode: nextMode,
                                      realUser: nextMode === "manual"
                                        ? manualRealUser || ""
                                        : isEditing ? applicantName : "",
                                    });
                                  }}
                                >
                                  <option value="auto">자동</option>
                                  <option value="manual">직접 입력</option>
                                </select>
                                <input
                                  type="text"
                                  value={resolvedInputRealUser}
                                  onChange={(event) => updateDeviceOverride(key, { realUser: event.target.value })}
                                  placeholder={mode === "manual" ? "실제 사용자 이름" : "자동 지정"}
                                  disabled={manualDisabled}
                                />
                              </div>
                            </td>
                            <td>
                              <div className="device-overrides-current">
                                <div>
                                  <span className="device-overrides-current-label">프로젝트</span>
                                  <span className="device-overrides-current-value">{displayProject}</span>
                                </div>
                                <div>
                                  <span className="device-overrides-current-label">부서</span>
                                  <span className="device-overrides-current-value">{displayDepartment}</span>
                                </div>
                                <div>
                                  <span className="device-overrides-current-label">실제 사용자</span>
                                  <span className="device-overrides-current-value">{displayRealUser}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="device-overrides-actions">
                                <button
                                  type="button"
                                  className="outline small-button"
                                  onClick={() => applyOverrideToAll(key)}
                                >
                                  전체 적용
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
          {!(isEditing && isReturnRequest) && (
            <>
              {isAssociatedDevicesLoading && <p className="muted">선택된 장비 정보를 불러오는 중입니다...</p>}
              {associatedDevicesError && <p className="error">{associatedDevicesError}</p>}
              {deviceRows.length > 0 ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>관리번호</th>
                        <th>품목</th>
                        <th>용도</th>
                        <th>상태</th>
                        <th>요청 정보</th>
                        <th>현재 정보</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceRows.map((row) => {
                        const key = row.deviceId ?? row.key;
                        const overrideEntry = key != null ? deviceOverrides[String(key)] : null;
                        const deviceTags = dedupeTagNames(
                          Array.isArray(overrideEntry?.tags) ? overrideEntry.tags : [],
                        );
                        const shouldUseDefaultRequestInfo = isReturnRequest || isDisposalRequest;
                        const requestedProjectDisplay = shouldUseDefaultRequestInfo
                          ? DEFAULT_METADATA_PROJECT
                          : row.requestedProjectName ?? "-";
                        const requestedDepartmentDisplay = shouldUseDefaultRequestInfo
                          ? DEFAULT_METADATA_DEPARTMENT
                          : row.requestedDepartmentName ?? "-";
                        const requestedRealUserDisplay = shouldUseDefaultRequestInfo
                          ? DEFAULT_METADATA_REAL_USER
                          : row.requestedRealUser ?? "-";
                        return (
                          <tr key={key}>
                            <td>{row.deviceId ?? "-"}</td>
                            <td>{row.categoryName ?? "-"}</td>
                            <td>{row.purpose ?? "-"}</td>
                            <td>{row.status ?? "-"}</td>
                            <td>
                              <div className="device-overrides-current">
                                <span>프로젝트: {requestedProjectDisplay}</span>
                                <span>관리부서: {requestedDepartmentDisplay}</span>
                                <span>실사용자: {requestedRealUserDisplay}</span>
                                {isReturnRequest && (
                                  <div className="device-tag-view">
                                    <span>태그:</span>
                                    {deviceTags.length > 0 ? (
                                      <div className="tag-view-list">
                                        {deviceTags.map((tag) => (
                                          <span key={`${key}-tag-${tagKey(tag)}`} className="tag-pill">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="device-overrides-current">
                                <span>프로젝트: {row.currentProjectName ?? "-"}</span>
                                <span>관리부서: {row.currentDepartmentName ?? "-"}</span>
                                <span>실사용자: {row.currentRealUser ?? "-"}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : approvalDeviceIds.length > 0 ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>관리번호</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalDeviceIds.map((deviceId) => (
                        <tr key={deviceId}>
                          <td>{deviceId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">연결된 장비 정보가 없습니다.</p>
              )}
            </>
          )}
        </div>

        <div className="detail-section detail-section--flow">
          <h3>승인 흐름</h3>
          <ul className="approver-steps">
            {(approval.approvers ?? []).map((approver) => {
              const statusClass = approver.isRejected
                ? "status-rejected"
                : approver.isApproved
                  ? "status-approved"
                  : "status-pending";
              const statusLabel = approver.isRejected
                ? "반려"
                : approver.isApproved
                  ? "승인"
                  : "대기";
              return (
                <li key={`${approver.step}-${approver.username}`} className="approver-item">
                  <div className="approver-header">
                    <span className="badge">{approver.step}차</span>
                    <span className="approver-name">{approver.username ?? "-"}</span>
                  </div>
                  <span className={`status-pill ${statusClass}`}>
                    {statusLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {isCurrentUserApprover && (
        <section className="detail-section action-box">
          <h3>승인/반려 처리</h3>
          {urgency.urgent && urgency.label && (
            <p className="muted muted--spaced">
              ⚠️ {urgency.label} - 빠른 처리가 필요합니다.
            </p>
          )}
          <div className="form-grid">
            <div className="detail-inline">
              <strong className="detail-inline__label">처리자</strong>
              <span className="muted">{actionUsername || "-"}</span>
            </div>
            <label className="full-width">
              의견
              <textarea
                rows={3}
                value={actionComment}
                onChange={(event) => setActionComment(event.target.value)}
                placeholder="승인 또는 반려 시 남길 메모"
              />
            </label>
          </div>
          <div className="group-buttons">
            <button
              type="button"
              className="primary"
              onClick={handleApprove}
              disabled={!canApprove || isActionProcessing}
            >
              {isActionProcessing ? (
                <>
                  <Spinner size={14} /> 처리중...
                </>
              ) : (
                "승인"
              )}
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleReject}
              disabled={!canReject || isActionProcessing}
            >
              {isActionProcessing ? (
                <>
                  <Spinner size={14} /> 처리중...
                </>
              ) : (
                "반려"
              )}
            </button>
          </div>
          {!canApprove && !canReject && approverPending.length > 0 && (
            <p className="muted">* 현재 로그인된 사용자는 현재 단계의 승인자로 등록되어 있지 않습니다.</p>
          )}
        </section>
      )}

      <section className="detail-section">
        <h3>댓글</h3>
        <div className="comment-form">
          <div className="form-grid">
            <div className="detail-inline">
              <strong className="detail-inline__label">작성자</strong>
              <span className="muted">{normalizedUsername || "로그인 필요"}</span>
            </div>
            <label className="full-width">
              내용
              <textarea
                rows={3}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder={normalizedUsername ? "결재 관련 내용을 자유롭게 기록하세요." : "로그인 후 댓글 작성 가능"}
                disabled={!normalizedUsername}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary" onClick={handleAddComment} disabled={!normalizedUsername || isActionProcessing}>
              {isActionProcessing ? <><Spinner size={12} /> 처리중...</> : "댓글 등록"}
            </button>
          </div>
        </div>

        <div className="comment-list">
          {comments.length === 0 && <p className="muted">등록된 댓글이 없습니다.</p>}
          {comments.map((comment) => {
            const editable = canModifyComment(comment);
            const isEditing = editingCommentId === comment.id;
            const authorLabel = comment.username || comment.authorName || "-";
            return (
              <div key={comment.id} className="comment-item">
                <div className="comment-meta">
                  <strong>{authorLabel}</strong>
                  <span>{formatDateTime(comment.createdDate)}</span>
                  {comment.modifiedDate && (
                    <span className="muted small">수정됨 {formatDateTime(comment.modifiedDate)}</span>
                  )}
                </div>
                {isEditing ? (
                  <div className="comment-edit-form">
                    <textarea
                      rows={3}
                      value={editingCommentText}
                      onChange={(event) => setEditingCommentText(event.target.value)}
                    />
                    <div className="comment-actions">
                      <button type="button" className="primary" onClick={handleUpdateComment} disabled={isActionProcessing}>
                        {isActionProcessing ? <><Spinner size={12} /> 처리중...</> : "저장"}
                      </button>
                      <button type="button" className="outline" onClick={cancelEditComment} disabled={isActionProcessing}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{comment.content}</p>
                )}
                {editable && !isEditing && (
                  <div className="comment-actions">
                    <button type="button" className="outline" onClick={() => startEditComment(comment)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={isActionProcessing}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
