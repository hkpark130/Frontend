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
} from "@/api/approvals";
import { useUser } from "@/context/UserProvider";

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
  "1차승인완료": "status-progress",
  승인완료: "status-complete",
  반려: "status-reject",
  반납: "status-return",
};

const getStatusClass = (status) => statusClassMap[status] ?? "status-unknown";

const computeStageLabel = (approvalInfo, approvers = []) => {
  if (!Array.isArray(approvers) || approvers.length === 0) return null;
  if (approvalInfo !== "승인대기" && approvalInfo !== "1차승인완료") return null;
  const approved = approvers.filter((item) => item?.isApproved);
  if (approved.length === 0) return null;
  const minStep = Math.min(...approved.map((item) => Number(item.step) || 0).filter((step) => step > 0));
  if (!Number.isFinite(minStep) || minStep <= 0) return null;
  return `${minStep}차 승인 완료`;
};

const computeUrgency = (deadline, approvalInfo) => {
  if (!deadline) return { urgent: false, label: null };
  const active = approvalInfo === "승인대기" || approvalInfo === "1차승인완료";
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
  switch (status) {
    case "승인완료":
      return "승인 완료";
    case "승인대기":
      return "승인 대기";
    case "반려":
      return "반려";
    case "1차승인완료":
      return "1차 승인 완료";
    default:
      return status ?? "-";
  }
};

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

  const normalizedUsername = useMemo(() => (defaultUsername ?? "").trim(), [defaultUsername]);

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

  const canProcess = useMemo(
    () => approverPending.some((item) => item.username === actionUsername),
    [approverPending, actionUsername],
  );

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
    () => (approval?.approvers || []).find((item) => !item.isApproved),
    [approval],
  );

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

  const refreshData = useCallback(async () => {
    await loadDetail();
    await loadComments();
  }, [loadDetail, loadComments]);

  const handleApprove = async () => {
    if (!isCurrentUserApprover) {
      alert("결재 권한이 없습니다.");
      return;
    }
    if (!actionUsername) {
      alert("승인자를 입력해주세요.");
      return;
    }
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
    }
  };

  const handleReject = async () => {
    if (!isCurrentUserApprover) {
      alert("결재 권한이 없습니다.");
      return;
    }
    if (!actionUsername) {
      alert("승인자를 입력해주세요.");
      return;
    }
    if (!actionComment) {
      const confirmed = window.confirm("사유 없이 반려하시겠습니까?");
      if (!confirmed) {
        return;
      }
    }
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
    try {
      await deleteApprovalComment(Number(approvalId), commentId, normalizedUsername);
      if (editingCommentId === commentId) {
        cancelEditComment();
      }
      await loadComments();
    } catch (err) {
      console.error(err);
      alert("댓글 삭제 중 오류가 발생했습니다.");
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
          <button type="button" className="outline" onClick={() => navigate(-1)}>
            목록으로 돌아가기
          </button>
        </div>
      </div>

      <section className="detail-grid">
        <div className="detail-section">
          <h3>신청 정보</h3>
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
            <div>
              <dt>사용 예정일</dt>
              <dd>{formatDateTime(approval.deadline)}</dd>
            </div>
            <div>
              <dt>사유</dt>
              <dd>{approval.reason ?? "-"}</dd>
            </div>
          </dl>
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
            {(approval.approvers ?? []).map((approver) => (
              <li key={`${approver.step}-${approver.username}`} className="approver-item">
                <div className="approver-header">
                  <span className="badge">{approver.step}차</span>
                  <span className="approver-name">{approver.username ?? "-"}</span>
                </div>
                <span
                  className={`status-pill ${approver.isApproved ? "status-approved" : "status-pending"}`}
                >
                  {approver.isApproved ? "승인" : "대기"}
                </span>
              </li>
            ))}
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
              disabled={["승인완료", "반려"].includes(approval.approvalInfo)}
            >
              승인
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleReject}
              disabled={approval.approvalInfo === "승인완료"}
            >
              반려
            </button>
          </div>
          {!canProcess && approverPending.length > 0 && (
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
            <button type="button" className="primary" onClick={handleAddComment} disabled={!normalizedUsername}>
              댓글 등록
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
                      <button type="button" className="primary" onClick={handleUpdateComment}>
                        저장
                      </button>
                      <button type="button" className="outline" onClick={cancelEditComment}>
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
