import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchDepartments, fetchProjects } from "@/api/devices";
import { fetchTags } from "@/api/tags";
import { RangeDateInput, DeadlineDateField } from "@/components/form/DateInputs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/ko";
import Spinner from "@/components/Spinner";

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
  if (typeof status === "string" && status.trim().endsWith("승인완료")) {
    return "status-progress";
  }
  return statusClassMap[status] ?? "status-unknown";
};

const computeStageLabel = (approvalInfo, approvers = []) => {
  if (!Array.isArray(approvers) || approvers.length === 0) return null;
  if (approvalInfo !== "승인대기" && !(typeof approvalInfo === "string" && approvalInfo.includes("승인완료"))) {
    return null;
  }
  const approved = approvers.filter((item) => item?.isApproved);
  if (approved.length === 0) return null;
  const minStep = Math.min(...approved.map((item) => Number(item.step) || 0).filter((step) => step > 0));
  if (!Number.isFinite(minStep) || minStep <= 0) return null;
  return `${minStep}차승인완료`;
};

const computeUrgency = (deadline, approvalInfo) => {
  if (!deadline) return { urgent: false, label: null };
  const active = approvalInfo === "승인대기"
    || (typeof approvalInfo === "string" && approvalInfo.trim().endsWith("승인완료"));
  if (!active) return { urgent: false, label: null };
  const now = new Date();
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return { urgent: false, label: null };
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 5) return { urgent: false, label: null };
  if (diffDays > 0) return { urgent: true, label: `긴급 D-${diffDays}` };
  if (diffDays === 0) return { urgent: true, label: "긴급 오늘 마감" };
  return { urgent: true, label: `긴급 ${Math.abs(diffDays)}일 지연` };
};

const statusLabel = (status) => {
  if (!status) return "-";
  if (status === "승인완료") {
    return "승인완료";
  }
  if (status === "승인대기") {
    return "승인 대기";
  }
  if (typeof status === "string" && status.trim().endsWith("승인완료")) {
    return status.trim();
  }
  return status;
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

const mergeTagOptions = (base = [], additions = []) => dedupeTagNames([...(base ?? []), ...(additions ?? [])]);

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

  const [actionUsername, setActionUsername] = useState(defaultUsername);
  const [actionComment, setActionComment] = useState("");
  // note: comment author is derived from the logged-in user (normalizedUsername)
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
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const projectComboRef = useRef(null);
  const [tagOptions, setTagOptions] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [tagFetchError, setTagFetchError] = useState(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);

  const normalizedUsername = useMemo(() => (defaultUsername ?? "").trim(), [defaultUsername]);
  const normalizedDisplayName = useMemo(() => (user?.profile?.name ?? "").trim(), [user]);
  const currentUserExternalId = useMemo(() => {
    const candidate = user?.profile?.sub || user?.profile?.id;
    return typeof candidate === "string" ? candidate.trim() : "";
  }, [user]);

  // comment author is not an editable field anymore; we use `normalizedUsername`

  const isCurrentUserApprover = useMemo(() => {
    if (!normalizedUsername) {
      return false;
    }
    const approvers = approval?.approvers;
    if (!Array.isArray(approvers) || approvers.length === 0) {
      return false;
    }
    return approvers.some((item) => {
      const candidate = (item?.username ?? "").trim();
      const step = Number(item?.step ?? 0);
      return candidate === normalizedUsername && (step === 1 || step === 2);
    });
  }, [approval, normalizedUsername]);

  useEffect(() => {
    if (isCurrentUserApprover) {
      setActionUsername(normalizedUsername);
    } else {
      setActionUsername("");
    }
  }, [isCurrentUserApprover, normalizedUsername]);

  const approverPending = useMemo(() => {
    if (!approval?.approvers) {
      return [];
    }
    return approval.approvers.filter((item) => !item.isApproved);
  }, [approval]);

  const isRequester = useMemo(() => {
    if (!approval) {
      return false;
    }
    const requesterId = typeof approval.userUuid === "string" ? approval.userUuid.trim() : "";
    if (requesterId && currentUserExternalId && requesterId === currentUserExternalId) {
      return true;
    }
    const requesterName = typeof approval.userName === "string" ? approval.userName.trim().toLowerCase() : "";
    if (!requesterName) {
      return false;
    }
    if (normalizedDisplayName && requesterName === normalizedDisplayName.toLowerCase()) {
      return true;
    }
    if (normalizedUsername && requesterName === normalizedUsername.toLowerCase()) {
      return true;
    }
    return false;
  }, [approval, currentUserExternalId, normalizedDisplayName, normalizedUsername]);

  const canEditApplication = useMemo(() => {
    if (!approval || !isRequester) {
      return false;
    }
    const status = approval.approvalStatus ?? "";
    return status === "PENDING" || status === "IN_PROGRESS";
  }, [approval, isRequester]);

  const statusClass = useMemo(() => getStatusClass(approval?.approvalInfo), [approval]);
  const stageLabel = useMemo(
    () => (approval ? computeStageLabel(approval.approvalInfo, approval.approvers) : null),
    [approval],
  );
  const urgency = useMemo(
    () => (approval ? computeUrgency(approval.deadline, approval.approvalInfo) : { urgent: false }),
    [approval],
  );
  const nextPending = useMemo(
    () => (approval?.approvers || []).find((item) => !item.isApproved && !item.isRejected),
    [approval],
  );
  const isTerminalStatus = useMemo(
    () => ["승인완료", "반려", "취소"].includes(approval?.approvalInfo ?? ""),
    [approval],
  );

  const canRollbackApproval = useMemo(() => {
    if (!approval || !actionUsername || isTerminalStatus) {
      return false;
    }
    const approvers = Array.isArray(approval.approvers) ? approval.approvers : [];
    const currentStep = approvers.find((item) => item?.username === actionUsername);
    if (!currentStep || !currentStep.isApproved) {
      return false;
    }
    const myStepNumber = Number(currentStep.step) || 0;
    const laterApproved = approvers.some((item) => {
      if (!item) {
        return false;
      }
      const stepNumber = Number(item.step) || 0;
      if (stepNumber <= myStepNumber) {
        return false;
      }
      return Boolean(item.isApproved);
    });
    return !laterApproved;
  }, [approval, actionUsername, isTerminalStatus]);

  const canApprove = useMemo(() => {
    if (isTerminalStatus || !isCurrentUserApprover) {
      return false;
    }
    return approverPending.some((item) => item.username === actionUsername);
  }, [approverPending, actionUsername, isCurrentUserApprover, isTerminalStatus]);

  const canReject = useMemo(() => {
    if (isTerminalStatus || !isCurrentUserApprover) {
      return false;
    }
    if (approverPending.some((item) => item.username === actionUsername)) {
      return true;
    }
    return canRollbackApproval;
  }, [approverPending, actionUsername, canRollbackApproval, isCurrentUserApprover, isTerminalStatus]);

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchApprovalDetail(approvalId);
      setApproval(data);
    } catch (err) {
      console.error(err);
      setError("결재 상세를 불러오는 중 문제가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [approvalId]);

  const loadComments = useCallback(async () => {
    try {
      const data = await fetchApprovalComments(approvalId);
      const list = Array.isArray(data) ? data : [];
      const normalizedList = list.map((item) => ({
        ...item,
        username: (item?.username ?? "").trim(),
        authorName: (item?.authorName ?? "").trim(),
      }));
      setComments(normalizedList);
    } catch (err) {
      console.error(err);
    }
  }, [approvalId]);

  const canModifyComment = useCallback(
    (comment) => {
      if (!comment) return false;
      if (!normalizedUsername) return false;
      const commentUsers = [comment.username, comment.authorName]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim().toLowerCase());
      return commentUsers.includes(normalizedUsername.toLowerCase());
    },
    [normalizedUsername],
  );

  useEffect(() => {
    if (!approvalId) return;
    loadDetail();
    loadComments();
  }, [approvalId, loadDetail, loadComments]);

  useEffect(() => {
    let cancelled = false;
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
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadMetadata = async () => {
      setIsMetadataLoading(true);
      setMetadataError(null);
      try {
        const [departmentData, projectData] = await Promise.all([
          fetchDepartments(),
          fetchProjects(),
        ]);
        if (cancelled) {
          return;
        }
        setDepartments(Array.isArray(departmentData) ? departmentData : []);
        setProjects(Array.isArray(projectData) ? projectData : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setMetadataError("결재 수정에 필요한 참조 데이터를 불러오지 못했습니다.");
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

    const initialTags = useMemo(() => dedupeTagNames(approval?.tags ?? []), [approval]);

    useEffect(() => {
      setSelectedTags(initialTags);
      setTagOptions((prev) => mergeTagOptions(prev, initialTags));
      setTagInput("");
    }, [initialTags]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!projectComboRef.current) {
        return;
      }
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

  const buildEditFormFromApproval = useCallback(() => {
    if (!approval) {
      return null;
    }
    const initialDeadline = extractDateString(approval.deadline) || todayDateString();
    let initialRealUser = approval.realUser ?? approval.userName ?? "";
    let realUserMode = "auto";
    if (approval.userName && initialRealUser && approval.userName !== initialRealUser) {
      realUserMode = "manual";
    } else if (!initialRealUser && approval.userName) {
      initialRealUser = approval.userName;
    }

    return {
      reason: approval.reason ?? "",
      usageStartDate: extractDateString(approval.usageStartDate),
      usageEndDate: extractDateString(approval.usageEndDate),
      deadlineDate: initialDeadline,
      departmentName: approval.tmpDepartmentName ?? "",
      projectName: approval.tmpProjectName ?? approval.projectName ?? "",
      projectCode: approval.tmpProjectCode ?? approval.projectCode ?? "",
      realUser: initialRealUser,
      realUserMode,
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

  const filteredProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const keyword = projectSearchTerm.trim().toLowerCase();
    if (!keyword) {
      return list;
    }
    return list.filter((project) => {
      const name = project?.name?.toLowerCase() ?? "";
      const code = project?.code?.toLowerCase() ?? "";
      return name.includes(keyword) || code.includes(keyword);
    });
  }, [projects, projectSearchTerm]);

  const selectedProjectLabel = useMemo(() => {
    if (!editForm) {
      return "";
    }
    if (editForm.projectName && editForm.projectCode) {
      return `${editForm.projectName} (${editForm.projectCode})`;
    }
    return editForm.projectName ?? "";
  }, [editForm]);

  const refreshData = useCallback(async () => {
    await loadDetail();
    await loadComments();
  }, [loadDetail, loadComments]);

  const toggleEditRealUserMode = (mode) => {
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }
      if (mode === "auto") {
        const fallback = approval?.userName ?? prev.realUser ?? "";
        return {
          ...prev,
          realUserMode: "auto",
          realUser: fallback,
        };
      }
      return {
        ...prev,
        realUserMode: "manual",
      };
    });
  };

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

  const handleProjectSelect = (project) => {
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        projectName: project?.name ?? "",
        projectCode: project?.code ?? "",
      };
    });
    setProjectSearchTerm("");
    setIsProjectDropdownOpen(false);
  };

  const handleStartEdit = () => {
    if (!canEditApplication) {
      return;
    }
    const current = buildEditFormFromApproval();
    setEditForm(current);
    setEditError(null);
    setIsEditing(true);
    setIsProjectDropdownOpen(false);
    setSelectedTags(initialTags);
    setTagInput("");
  };

  const handleCancelEdit = () => {
    setEditForm(buildEditFormFromApproval());
    setEditError(null);
    setIsEditing(false);
    setIsProjectDropdownOpen(false);
    setSelectedTags(initialTags);
    setTagInput("");
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

    const resolvedRealUser = (editForm.realUserMode === "manual"
      ? (editForm.realUser ?? "").trim()
      : (approval.userName ?? editForm.realUser ?? "").trim()) || null;

    const payload = {
      username: defaultUsername,
      reason: trimmedReason,
      realUser: resolvedRealUser,
      departmentName: (editForm.departmentName ?? "").trim() || null,
      projectName: (editForm.projectName ?? "").trim() || null,
      projectCode: (editForm.projectCode ?? "").trim() || null,
      deadline: editForm.deadlineDate ? `${editForm.deadlineDate}T00:00:00` : null,
      usageStartDate: start ? `${start}T00:00:00` : null,
      usageEndDate: end ? `${end}T00:00:00` : null,
    };

    if (approval?.type === "반납") {
      payload.tags = dedupeTagNames(selectedTags);
    }

    setEditError(null);
    setIsSavingEdit(true);
    try {
      await updateApprovalApplication(Number(approvalId), payload);
      alert("신청 정보가 수정되었습니다.");
      setIsEditing(false);
      setIsProjectDropdownOpen(false);
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
          <div className="taglist-wrap" style={{ marginTop: 8 }}>
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

      <section className="detail-grid">
        <div className="detail-section">
          <h3>신청 정보</h3>
          {isEditing && editForm ? (
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
              {isMetadataLoading && <p className="muted">참조 정보를 불러오는 중입니다...</p>}
              {metadataError && <p className="error">{metadataError}</p>}
              {editError && <p className="error">{editError}</p>}
              <div className="form-section-grid applicant-grid">
                <label className="stretch">
                  신청 사유
                  <textarea
                    rows={4}
                    value={editForm.reason}
                    onChange={handleEditFieldChange("reason")}
                    placeholder="신청 사유를 입력해 주세요."
                  />
                </label>
                <div className="applicant-column" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <RangeDateInput
                    startDate={editForm.usageStartDate}
                    endDate={editForm.usageEndDate}
                    onChange={handleUsagePeriodEdit}
                  />
                  <DeadlineDateField
                    value={editForm.deadlineDate}
                    onChange={handleDeadlineChange}
                  />
                </div>
                <label className="real-user-field">
                  실제 사용자
                  <div className="input-group real-user-group">
                    <input
                      type="text"
                      value={editForm.realUser ?? ""}
                      onChange={handleEditFieldChange("realUser")}
                      placeholder="실제 사용자 이름"
                      disabled={editForm.realUserMode !== "manual"}
                    />
                    <div className="group-buttons real-user-buttons">
                      <button
                        type="button"
                        className={editForm.realUserMode !== "manual" ? "primary" : "outline"}
                        onClick={() => toggleEditRealUserMode("auto")}
                      >
                        자동
                      </button>
                      <button
                        type="button"
                        className={editForm.realUserMode === "manual" ? "primary" : "outline"}
                        onClick={() => toggleEditRealUserMode("manual")}
                      >
                        직접 입력
                      </button>
                    </div>
                  </div>
                </label>
                <label className="device-info-label">
                  관리부서
                  <select
                    value={editForm.departmentName ?? ""}
                    onChange={handleEditFieldChange("departmentName")}
                  >
                    <option value="">선택하세요</option>
                    {(departments ?? []).map((department, index) => (
                      <option
                        key={department?.id ?? department?.name ?? `department-${index}`}
                        value={department?.name ?? ""}
                      >
                        {department?.name ?? ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="device-info-label">
                  프로젝트
                  <div className="combobox-wrapper" ref={projectComboRef}>
                    <div className={`combobox${isProjectDropdownOpen ? " open" : ""}`}>
                      <button
                        type="button"
                        className="combobox-trigger"
                        onClick={() => setIsProjectDropdownOpen((prev) => !prev)}
                      >
                        <span>{selectedProjectLabel || "프로젝트를 선택하세요"}</span>
                        <span className="combobox-caret" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {isProjectDropdownOpen && (
                        <div className="combobox-panel">
                          <input
                            type="text"
                            className="combobox-search"
                            placeholder="프로젝트 이름 또는 코드를 검색하세요"
                            value={projectSearchTerm}
                            onChange={(event) => setProjectSearchTerm(event.target.value)}
                            autoFocus
                          />
                          <div className="combobox-list">
                            {filteredProjects.length === 0 && (
                              <p className="combobox-empty">검색 결과가 없습니다.</p>
                            )}
                            {filteredProjects.map((project, index) => (
                              <button
                                type="button"
                                key={project?.id ?? `${project?.name ?? "project"}-${project?.code ?? index}`}
                                className="combobox-option"
                                onClick={() => handleProjectSelect(project)}
                              >
                                <span className="combobox-option-name">{project?.name ?? ""}</span>
                                {project?.code && (
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
                {approval?.type === "반납" && (
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
              </div>
              <div className="form-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
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
                <dt>실제 사용자</dt>
                <dd>{approval.realUser ?? "-"}</dd>
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
              <div>
                <dt>사용 시작일</dt>
                <dd>{formatDateOnly(approval.usageStartDate)}</dd>
              </div>
              <div>
                <dt>사용 종료일</dt>
                <dd>{formatDateOnly(approval.usageEndDate)}</dd>
              </div>
              <div>
                <dt>신청 마감일</dt>
                <dd>{formatDateOnly(approval.deadline)}</dd>
              </div>
              <div>
                <dt>사유</dt>
                <dd>
                  <pre
                    style={{
                      overflowY: "auto",
                      maxHeight: '220px',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                    }}
                  >
                    {approval.reason ?? "-"}
                  </pre>
                </dd>
              </div>
              {approval.type === "반납" && (
                <div>
                  <dt>태그</dt>
                  <dd>
                    {initialTags.length > 0 ? (
                      <div className="tag-view-list">
                        {initialTags.map((tag) => (
                          <span key={tagKey(tag)} className="tag-pill">{tag}</span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="detail-section">
          <h3>장비 정보</h3>
          <dl>
            <div>
              <dt>장비 ID</dt>
              <dd>{approval.deviceId ?? "-"}</dd>
            </div>
            <div>
              <dt>품목</dt>
              <dd>{approval.categoryName ?? "-"}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{approval.deviceStatus ?? "-"}</dd>
            </div>
            <div>
              <dt>프로젝트</dt>
              <dd>{approval.tmpProjectName ?? approval.projectName ?? "-"}</dd>
            </div>
            <div>
              <dt>부서</dt>
              <dd>{approval.tmpDepartmentName ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-section">
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
            <p className="muted" style={{ marginBottom: 8 }}>
              ⚠️ {urgency.label} - 빠른 처리가 필요합니다.
            </p>
          )}
          <div className="form-grid">
            <div style={{ display: "flex", alignItems: "center" }}>
              <strong style={{ marginRight: 8 }}>처리자</strong>
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
            <div style={{ display: "flex", alignItems: "center" }}>
              <strong style={{ marginRight: 8 }}>작성자</strong>
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
      <style jsx>{`
        .card-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .combobox-wrapper {
          width: 100%;
          box-sizing: border-box;
        }
        .combobox {
          width: 100%;
        }
        .combobox-trigger {
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          padding: 8px 10px;
          font-size: 15px;
          width: 100%;
          text-align: left;
          transition: border-color 0.2s;
        }
        .combobox.open .combobox-trigger {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        .combobox-panel {
          width: 100%;
          box-sizing: border-box;
          border-radius: 0 0 8px 8px;
          border: 1px solid #d1d5db;
          border-top: none;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          z-index: 10;
        }
        .combobox-search {
          width: 100%;
          box-sizing: border-box;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          margin-bottom: 6px;
          padding: 8px 10px;
          font-size: 15px;
          background: #f9fafb;
        }
        .combobox-option {
          width: 100%;
          text-align: left;
          border-radius: 6px;
          transition: background 0.15s;
          padding: 8px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .combobox-option:focus,
        .combobox-option:hover {
          background: #f1f5f9;
        }
        .combobox-option-code {
          color: #6b7280;
          font-size: 12px;
        }
        .real-user-group {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .real-user-group input {
          flex: 1;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
        }
        .real-user-buttons {
          display: flex;
          gap: 6px;
        }
        .real-user-buttons button {
          min-width: 80px;
        }
        .device-info-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 180px;
          flex: 1 1 220px;
          max-width: 260px;
        }
        .device-info-label select {
          margin-top: 4px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
        }
        .form-section-grid textarea,
        .form-section-grid select,
        .form-section-grid input[type="text"] {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          width: 100%;
          box-sizing: border-box;
        }
        .form-section-grid textarea {
          resize: vertical;
          min-height: 120px;
        }
        .tag-edit-wrapper {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
        }
        .tag-edit-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .tag-edit-title {
          font-weight: 600;
          font-size: 15px;
        }
        .tag-input-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .tag-input-row input {
          flex: 1 1 240px;
          min-width: 200px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          font-size: 14px;
          background: #fff;
        }
        .tag-add-button {
          padding: 9px 16px;
        }
        .tag-hint {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }
        .tag-options {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 9999px;
          border: 1px solid transparent;
          background: #e5e7eb;
          color: #111827;
          padding: 6px 10px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tag-chip:hover {
          transform: translateY(-1px);
        }
        .tag-chip.selected {
          background: #6b7280;
          border-color: #4b5563;
          color: #fff;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
        }
        .tag-chip .remove-btn {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 12px;
          line-height: 1;
          padding: 0 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tag-chip .remove-btn:hover,
        .tag-chip .remove-btn:focus {
          color: #facc15;
        }
        .tag-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }
        .tag-status {
          font-size: 13px;
          color: #4b5563;
        }
        .tag-status.muted {
          color: #94a3b8;
        }
        .tag-status.loading {
          color: #2563eb;
        }
        .tag-status.error {
          color: #dc2626;
        }
        .tag-label {
          pointer-events: none;
        }
        .tag-view-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tag-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 9999px;
          background: #e5e7eb;
          font-size: 12px;
          color: #111827;
        }
        @media (max-width: 900px) {
          .tag-input-row {
            flex-direction: column;
            align-items: stretch;
          }
          .tag-add-button {
            width: 100%;
          }
        }
        /* spinner animation moved to shared component (SVG animateTransform) */
      `}</style>
    </div>
  );
}
