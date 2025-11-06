const statusClassMap = {
  "승인대기": "status-progress",
  "진행중": "status-progress",
  "1차승인완료": "status-progress",
  "승인완료": "status-complete",
  "반려": "status-reject",
  "반납": "status-return",
  "취소": "status-unknown",
};

export const formatDate = (value, withTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options = withTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "2-digit", day: "2-digit" };
  return date.toLocaleString("ko-KR", options);
};

export const getStatusClass = (status) => {
  if (!status) return "status-unknown";
  if (typeof status === "string") {
    const trimmed = status.trim();
    if (trimmed === "승인완료") {
      return "status-complete";
    }
    if (/^\d+차승인완료$/.test(trimmed)) {
      return "status-progress";
    }
  }
  return statusClassMap[status] ?? "status-unknown";
};

export const computeStageLabel = (approvalInfo, approvers = []) => {
  if (!Array.isArray(approvers) || approvers.length === 0) return null;
  if (approvalInfo !== "승인대기" && !(typeof approvalInfo === "string" && approvalInfo.includes("승인완료"))) {
    return null;
  }

  const pendingExists = approvers.some((item) => !item?.isApproved);
  if (!pendingExists) {
    return null;
  }

  const approvedSteps = approvers
    .filter((item) => item?.isApproved)
    .map((item) => Number(item.step) || 0)
    .filter((step) => step > 0);

  if (approvedSteps.length === 0) {
    return null;
  }

  const highestStep = Math.max(...approvedSteps);
  if (!Number.isFinite(highestStep) || highestStep <= 0) {
    return null;
  }

  return `${highestStep}차승인완료`;
};

export const computeUrgency = (deadline, approvalInfo) => {
  if (!deadline) return { urgent: false, label: null, days: null };
  // only consider active when explicitly pending or when it's a numbered
  // approval-completed state like "1차승인완료". Do NOT treat plain
  // "승인완료" as active for urgency.
  const active = approvalInfo === "승인대기"
    || (typeof approvalInfo === "string" && /^\d+차승인완료$/.test(approvalInfo.trim()));
  if (!active) return { urgent: false, label: null, days: null };
  const now = new Date();
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return { urgent: false, label: null, days: null };

  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 5) {
    return { urgent: false, label: null, days: diffDays };
  }

  if (diffDays > 0) {
    return { urgent: true, label: `긴급 D-${diffDays}`, days: diffDays };
  }
  if (diffDays === 0) {
    return { urgent: true, label: "긴급 오늘 마감", days: diffDays };
  }
  return { urgent: true, label: `긴급 ${Math.abs(diffDays)}일 지연`, days: diffDays };
};

export const extractUsername = (profile) =>
  profile?.preferred_username || profile?.name || profile?.email || "";

export const isCurrentApprover = (approvers = [], username = "") => {
  if (!username) return false;
  const normalized = username.trim().toLowerCase();
  return approvers.some(
    (approver) =>
      !approver?.isApproved && approver?.username?.trim().toLowerCase() === normalized,
  );
};

export const APPROVAL_STATUS_PRIORITY = {
  PENDING: 0,
  IN_PROGRESS: 1,
  APPROVED: 2,
  REJECTED: 3,
  CANCELLED: 4,
};
