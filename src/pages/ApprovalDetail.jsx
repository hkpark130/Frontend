import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addApprovalComment,
  approveApproval,
  fetchApprovalComments,
  fetchApprovalDetail,
  rejectApproval,
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
  const [commentAuthor, setCommentAuthor] = useState(defaultUsername);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    setActionUsername(defaultUsername);
    setCommentAuthor(defaultUsername);
  }, [defaultUsername]);

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
      setComments(data ?? []);
    } catch (err) {
      console.error(err);
    }
  }, [approvalId]);

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
    if (!commentAuthor) {
      alert("작성자를 입력해주세요.");
      return;
    }
    if (!commentText.trim()) {
      alert("댓글 내용을 입력해주세요.");
      return;
    }
    try {
      await addApprovalComment(Number(approvalId), {
        username: commentAuthor,
        content: commentText,
      });
      setCommentText("");
      await loadComments();
    } catch (err) {
      console.error(err);
      alert("댓글 등록 중 오류가 발생했습니다.");
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

      <section className="detail-section action-box">
        <h3>승인/반려 처리</h3>
        <div className="form-grid">
          <label>
            처리자
            <input
              type="text"
              value={actionUsername}
              onChange={(event) => setActionUsername(event.target.value)}
              placeholder="결재 담당자 사용자명"
            />
          </label>
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
          <p className="muted">* 입력한 처리자는 현재 단계의 승인자로 등록되어 있지 않습니다.</p>
        )}
      </section>

      <section className="detail-section">
        <h3>댓글</h3>
        <div className="comment-form">
          <div className="form-grid">
            <label>
              작성자
              <input
                type="text"
                value={commentAuthor}
                onChange={(event) => setCommentAuthor(event.target.value)}
                placeholder="작성자 이름"
              />
            </label>
            <label className="full-width">
              내용
              <textarea
                rows={3}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="결재 관련 내용을 자유롭게 기록하세요."
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary" onClick={handleAddComment}>
              댓글 등록
            </button>
          </div>
        </div>

        <div className="comment-list">
          {comments.length === 0 && <p className="muted">등록된 댓글이 없습니다.</p>}
          {comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <div className="comment-meta">
                <strong>{comment.username ?? "-"}</strong>
                <span>{formatDateTime(comment.createdDate)}</span>
              </div>
              <p>{comment.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
