import React, { useState, useRef, useEffect } from 'react';
import { fetchProjects, fetchDeviceDetail, updateDevice } from '@/api/devices';
import { lookupKeycloakUser } from '@/api/users';
import './RegisterDevice.css';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';

const categories = ['노트북', '데스크탑', '서버', '모니터', '태블릿', '기타'];
// 프로젝트 리스트는 fetchProjects로 동적 로드
const departments = ['경영지원부', '개발부', '영업부'];

export default function EditDevice() {
  const navigate = useNavigate();
  const { deviceId } = useParams();

  const [form, setForm] = useState({
    category: '',
    assetCode: '',
    project: '',
    manageDept: '',
    username: '',
    realUser: '',
    status: '정상',
    purpose: '',
    spec: '',
    price: '',
    vatIncluded: true,
    isUsable: true,
    model: '',
    manufacturer: '',
    serial: '',
    mac: '',
    note: '',
    adminNote: '',
    purchaseDate: '',
  });
  const [projects, setProjects] = useState([]);
  const [searchId, setSearchId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialAssignment, setInitialAssignment] = useState({
    username: '',
    realUser: '',
    isUsable: true,
  });
  const [approvalSnapshot, setApprovalSnapshot] = useState({
    type: '',
    info: '',
    deadline: null,
  });
  const [applicantLookup, setApplicantLookup] = useState({
    status: 'idle',
    message: '',
    info: null,
    username: '',
    lookupAvailable: true,
  });
  const applicantDebounceRef = useRef(null);
  const applicantRequestSeqRef = useRef(0);

  // 프로젝트 콤보박스 관련 상태
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [selectedProjectLabel, setSelectedProjectLabel] = useState('');
  const projectComboRef = useRef(null);

  // 프로젝트 필터링
  const filteredProjects = projects.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())) ||
      (p.code && p.code.toLowerCase().includes(projectSearchTerm.toLowerCase()))
  );

  // 프로젝트 리스트 불러오기
  useEffect(() => {
    fetchProjects().then((data) => {
      setProjects(Array.isArray(data) ? data : []);
    });
  }, []);

  // 디바이스 상세 불러오기 (초기: URL 파라미터에 deviceId가 있으면 자동 조회)
  useEffect(() => {
    if (deviceId) {
      setSearchId(deviceId);
      handleSearch(deviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // 콤보박스 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (projectComboRef.current && !projectComboRef.current.contains(event.target)) {
        setIsProjectDropdownOpen(false);
      }
    }
    if (isProjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProjectDropdownOpen]);

  // 기타 입력 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'project') {
      setSelectedProjectLabel(value);
    }
  };

  // 라디오 버튼 핸들러
  const handleRadioChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'vatIncluded' ? value === 'true' : value,
    }));
  };

  // 금액 표시용
  const formattedPrice = form.price ? Number(form.price).toLocaleString() + ' 원' : '0 원';

  const normalizeComparable = (value) => {
    if (value == null) {
      return '';
    }
    return String(value).trim().toLowerCase();
  };

  const equalsIgnoreCase = (left, right) => normalizeComparable(left) === normalizeComparable(right);

  const formatProjectLabel = (name, code) => {
    const label = `${name || ''}${code ? ` (${code})` : ''}`;
    return label.trim();
  };

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
  const trimmed = form.username ? form.username.trim() : '';
  const baseline = initialAssignment.username ? initialAssignment.username.trim() : '';
  const changed = (trimmed || '').toLowerCase() !== (baseline || '').toLowerCase();

    if (applicantDebounceRef.current) {
      clearTimeout(applicantDebounceRef.current);
      applicantDebounceRef.current = null;
    }

    if (!trimmed) {
      const nextStatus = changed ? 'empty' : 'unchanged';
      const nextMessage = changed
        ? '신청자를 비워두면 장비가 반납 상태로 저장됩니다.'
        : '현재 신청자가 없습니다.';
      setApplicantLookup((prev) => {
        if (prev.status === nextStatus && prev.username === '' && prev.message === nextMessage) {
          return prev;
        }
        return {
          status: nextStatus,
          message: nextMessage,
          info: null,
          username: '',
          lookupAvailable: prev.lookupAvailable ?? true,
        };
      });
      return;
    }

    if (!changed) {
      const nextMessage = `현재 신청자가 '${trimmed}'으로 유지됩니다.`;
      setApplicantLookup((prev) => {
        if (prev.status === 'unchanged' && prev.username === trimmed && prev.message === nextMessage) {
          return prev;
        }
        return {
          status: 'unchanged',
          message: nextMessage,
          info: prev.info && prev.username === trimmed ? prev.info : null,
          username: trimmed,
          lookupAvailable: prev.lookupAvailable ?? true,
        };
      });
      return;
    }

    const requestId = applicantRequestSeqRef.current + 1;
    applicantRequestSeqRef.current = requestId;

    setApplicantLookup((prev) => ({
      status: 'loading',
      message: 'Keycloak에서 신청자를 확인 중…',
      info: null,
      username: trimmed,
      lookupAvailable: prev.lookupAvailable ?? true,
    }));

    applicantDebounceRef.current = setTimeout(async () => {
      try {
        const result = await lookupKeycloakUser(trimmed);
        if (applicantRequestSeqRef.current !== requestId) {
          return;
        }
        if (!result.lookupAvailable) {
          setApplicantLookup((prev) => {
            if (prev.status === 'error' && prev.username === trimmed && prev.lookupAvailable === false) {
              return prev;
            }
            return {
              status: 'error',
              message: 'Keycloak 조회 설정이 비활성화되어 신청자를 확인할 수 없습니다.',
              info: null,
              username: trimmed,
              lookupAvailable: false,
            };
          });
          return;
        }
        if (result.exists) {
          const message = result.displayName
            ? `${result.displayName} (${result.username || trimmed}) 계정을 확인했습니다.`
            : `${result.username || trimmed} 계정을 확인했습니다.`;
          setApplicantLookup((prev) => {
            if (prev.status === 'valid' && prev.username === (result.username || trimmed) && prev.message === message) {
              return prev;
            }
            return {
              status: 'valid',
              message,
              info: result,
              username: result.username || trimmed,
              lookupAvailable: true,
            };
          });
        } else {
          const message = `Keycloak에서 '${trimmed}' 계정을 찾을 수 없습니다.`;
          setApplicantLookup((prev) => {
            if (prev.status === 'invalid' && prev.username === trimmed && prev.message === message) {
              return prev;
            }
            return {
              status: 'invalid',
              message,
              info: result,
              username: trimmed,
              lookupAvailable: true,
            };
          });
        }
      } catch (error) {
        if (applicantRequestSeqRef.current !== requestId) {
          return;
        }
        let message = '신청자 조회 중 오류가 발생했습니다.';
        if (error?.response?.status === 401) {
          message = '세션이 만료되었거나 권한이 없습니다. 다시 로그인해주세요.';
        }
        const normalizedMessage = message;
        setApplicantLookup((prev) => {
          if (prev.status === 'error' && prev.username === trimmed && prev.message === normalizedMessage) {
            return prev;
          }
          return {
            status: 'error',
            message: normalizedMessage,
            info: null,
            username: trimmed,
            lookupAvailable: true,
          };
        });
      }
    }, 400);

    return () => {
      if (applicantDebounceRef.current) {
        clearTimeout(applicantDebounceRef.current);
        applicantDebounceRef.current = null;
      }
    };
  }, [form.username, initialAssignment.username, isLoaded]);

  const isPendingStage = (stage) => {
    if (!stage) {
      return false;
    }
    const normalized = stage.trim();
    return normalized === '승인대기' || normalized === '1차승인완료';
  };

  const buildStatusText = (isUsable, username, realUser, approval) => {
    const type = approval?.type ? approval.type.trim() : '';
    const stage = approval?.info ? approval.info.trim() : '';

    if (type === '대여' && isPendingStage(stage)) {
      return '대여 승인대기';
    }

    if (type === '반납' && isPendingStage(stage)) {
      return '반납 승인대기';
    }

    if (isUsable === false) {
      const holder = realUser || username || '정보 없음';
      return `대여 중 (사용자: ${holder})`;
    }

    return '반납 완료';
  };

  const resolveStatusColor = (isUsable, approval) => {
    const type = approval?.type ? approval.type.trim() : '';
    const stage = approval?.info ? approval.info.trim() : '';

    if (type === '대여' && isPendingStage(stage)) {
      return '#d97706';
    }
    if (type === '반납' && isPendingStage(stage)) {
      return '#0ea5e9';
    }
    return isUsable === false ? '#dc2626' : '#2563eb';
  };

  const mapDeviceToForm = (dto) => ({
    category: dto.categoryName || '',
    assetCode: dto.id || '',
    project: dto.projectName || '',
    manageDept: dto.manageDepName || '',
    username: dto.username || '',
    realUser: dto.realUser || '',
    status: dto.status || '정상',
    purpose: dto.purpose || '',
    spec: dto.spec || '',
    price: dto.price != null ? String(dto.price) : '',
    vatIncluded: dto.vatIncluded ?? true,
    isUsable: dto.isUsable != null ? dto.isUsable : true,
    model: dto.model || '',
    manufacturer: dto.company || '',
    serial: dto.sn || '',
    mac: dto.macAddress || '',
    note: dto.description || '',
    adminNote: dto.adminDescription || '',
    purchaseDate: dto.purchaseDate ? dayjs(dto.purchaseDate).format('YYYY-MM-DD') : '',
  });

  const applyDeviceDto = (dto) => {
    if (!dto) {
      return;
    }
    const mapped = mapDeviceToForm(dto);
    setForm(mapped);
    setInitialAssignment({
      username: mapped.username ? mapped.username.trim() : '',
      realUser: mapped.realUser ? mapped.realUser.trim() : '',
      isUsable: mapped.isUsable,
    });
    const baselineApplicant = mapped.username ? mapped.username.trim() : '';
    setApplicantLookup((prev) => {
      if (!baselineApplicant) {
        const fallbackAvailable = prev.lookupAvailable ?? true;
        return {
          status: 'empty',
          message: '현재 신청자가 없습니다.',
          info: null,
          username: '',
          lookupAvailable: fallbackAvailable,
        };
      }
      const fallbackAvailable = prev.lookupAvailable ?? true;
      return {
        status: 'unchanged',
        message: `현재 신청자가 '${baselineApplicant}'으로 설정되어 있습니다.`,
        info: null,
        username: baselineApplicant,
        lookupAvailable: fallbackAvailable,
      };
    });
    setApprovalSnapshot({
      type: dto.approvalType || '',
      info: dto.approvalInfo || '',
      deadline: dto.deadline || null,
    });
    setSelectedProjectLabel(formatProjectLabel(dto.projectName, dto.projectCode));
    setSearchId(dto.id || mapped.assetCode || '');
    setIsLoaded(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.assetCode) return;
    const trimmedApplicantName = form.username ? form.username.trim() : '';
    const baselineApplicantName = initialAssignment.username ? initialAssignment.username.trim() : '';
    const applicantChangedNow = (trimmedApplicantName || '').toLowerCase() !== (baselineApplicantName || '').toLowerCase();
    if (applicantChangedNow && trimmedApplicantName) {
      if (applicantLookup.status === 'loading') {
        alert('신청자 검증이 완료될 때까지 기다려주세요.');
        return;
      }
      if (applicantLookup.status !== 'valid') {
        const warning = (() => {
          if (applicantLookup.status === 'invalid') {
            return `Keycloak에서 '${trimmedApplicantName}' 계정을 찾을 수 없습니다.`;
          }
          if (applicantLookup.status === 'error') {
            return applicantLookup.message || '신청자 검증 중 오류가 발생했습니다.';
          }
          return '신청자 검증이 완료된 뒤 다시 시도해주세요.';
        })();
        alert(warning);
        return;
      }
    }
    setIsSaving(true);
    try {
      const payload = {
        id: form.assetCode,
        categoryName: form.category || null,
        manageDepName: form.manageDept || null,
  projectName: form.project ? form.project.trim() : null,
  username: form.username ? form.username.trim() : null,
  realUser: form.realUser ? form.realUser.trim() : null,
        status: form.status || null,
        purpose: form.purpose || null,
        spec: form.spec || null,
        price: form.price ? Number(form.price) : null,
        vatIncluded: form.vatIncluded,
        model: form.model || null,
        company: form.manufacturer || null,
        sn: form.serial || null,
  macAddress: form.mac ? form.mac.trim() : null,
        description: form.note || null,
        adminDescription: form.adminNote || null,
        purchaseDate: form.purchaseDate || null,
      };
      const updated = await updateDevice(form.assetCode, payload);
      applyDeviceDto(updated);
      alert('장비 정보가 수정되었습니다.');
      navigate('/');
    } catch (e2) {
      console.error(e2);
      alert('수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };
  // 장비 조회 실행
  const handleSearch = async (rawId) => {
    const id = (rawId ?? searchId).trim();
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const dto = await fetchDeviceDetail(id);
      applyDeviceDto(dto);
      // URL에 id가 없고 사용자가 검색으로 들어왔다면 라우팅 정리 (/admin/edit/:id)
      if (!deviceId) {
        navigate(`/admin/edit/${id}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      setLoadError('장비를 찾을 수 없습니다. 관리번호를 확인해주세요.');
      setIsLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProjectDropdown = () => {
    setIsProjectDropdownOpen((prev) => !prev);
    if (!isProjectDropdownOpen) {
      setProjectSearchTerm('');
    }
  };
  const handleProjectSelect = (project) => {
    setForm((prev) => ({
      ...prev,
      project: project?.name || '',
    }));
    setSelectedProjectLabel(formatProjectLabel(project?.name, project?.code));
    setIsProjectDropdownOpen(false);
    setProjectSearchTerm('');
  };

  const handlePriceChange = (event) => {
    const numeric = event.target.value.replace(/[^0-9]/g, '');
    setForm((prev) => ({ ...prev, price: numeric }));
  };

  const initialStatusText = buildStatusText(
    initialAssignment.isUsable,
    initialAssignment.username,
    initialAssignment.realUser,
    approvalSnapshot
  );
  const initialStatusColor = resolveStatusColor(initialAssignment.isUsable, approvalSnapshot);

  const trimmedApplicant = form.username ? form.username.trim() : '';
  const trimmedRealUser = form.realUser ? form.realUser.trim() : '';
  const applicantChanged = !equalsIgnoreCase(trimmedApplicant, initialAssignment.username);
  const realUserChanged = !equalsIgnoreCase(trimmedRealUser, initialAssignment.realUser);
  const pendingRental = approvalSnapshot.type && approvalSnapshot.type.trim() === '대여'
    && isPendingStage(approvalSnapshot.info);
  const safeDisplay = (value, fallback = '없음') => {
    if (!value) {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  };

  const toNullable = (value) => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const firstNonEmpty = (...values) => {
    for (const value of values) {
      if (!value) {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return '';
  };

  const initialApplicantDisplay = safeDisplay(firstNonEmpty(initialAssignment.username));
  const initialRealUserDisplay = safeDisplay(firstNonEmpty(initialAssignment.realUser, initialAssignment.username));

  const previewActive = applicantChanged || pendingRental;
  const previewApplicantRaw = previewActive
    ? (applicantChanged ? trimmedApplicant : initialAssignment.username)
    : '';
  const previewRealUserRaw = previewActive
    ? (applicantChanged
        ? (trimmedRealUser || trimmedApplicant || '')
        : (realUserChanged ? (trimmedRealUser || trimmedApplicant || initialAssignment.realUser) : initialAssignment.realUser))
    : '';
  const previewIsUsable = previewActive
    ? (trimmedApplicant ? false : true)
    : initialAssignment.isUsable;
  const previewApplicantNormalized = previewActive ? toNullable(previewApplicantRaw) : null;
  const previewRealUserNormalized = previewActive ? toNullable(previewRealUserRaw) : null;
  const previewStatusText = previewActive
    ? buildStatusText(previewIsUsable, previewApplicantNormalized, previewRealUserNormalized, null)
    : null;
  const previewStatusColor = resolveStatusColor(previewIsUsable, null);
  const previewApplicantDisplay = previewActive ? safeDisplay(previewApplicantNormalized) : null;
  const previewRealUserDisplay = previewActive ? safeDisplay(previewRealUserNormalized) : null;
  const applicantHelperText = applicantLookup.message || '';
  const applicantHelperColor = (() => {
    switch (applicantLookup.status) {
      case 'valid':
        return '#047857';
      case 'invalid':
      case 'error':
        return '#dc2626';
      case 'loading':
        return '#0369a1';
      default:
        return '#64748b';
    }
  })();
  const applicantValidationBlocked = (() => {
    if (!trimmedApplicant) {
      return false;
    }
    if (!applicantChanged) {
      return false;
    }
    if (applicantLookup.status === 'valid') {
      return false;
    }
    return true;
  })();
  const realUserDisabled = trimmedApplicant === '';

  useEffect(() => {
    if (realUserDisabled && form.realUser) {
      setForm((prev) => {
        if (!prev.realUser) {
          return prev;
        }
        return { ...prev, realUser: '' };
      });
    }
  }, [realUserDisabled, form.realUser]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
      <div className="card register-device-card">
        <h2>장비 편집</h2>

        {/* 검색 바: 편집할 장비의 관리번호(ID) 입력 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="편집할 장비의 ‘관리번호’ 를 입력해주세요."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem', minHeight: 20 }}
          />
          <button type="button" onClick={() => handleSearch()} disabled={isLoading}>
            {isLoading ? '조회중...' : '검색'}
          </button>
        </div>
        {loadError && (
          <div style={{ color: '#d00', marginBottom: 16 }}>{loadError}</div>
        )}

        {/* 장비 로딩 전에는 폼을 감춤 */}
        {!isLoaded ? null : (
        <form onSubmit={handleSubmit} className="register-device-form">
          {/* 품목 */}
          <label>
            품목
            <select name="category" value={form.category} onChange={handleChange} required>
              <option value="">선택</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>
          {/* 관리번호 */}
          <label style={{ alignItems: 'flex-start' }}>
            <span style={{ display: 'block' }}>관리번호</span>
            <div style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'baseline' }}>
              <input name="assetCode" value={form.assetCode} onChange={handleChange} required style={{ flex: 1 }} disabled />
            </div>
          </label>
          {/* 프로젝트 (커스텀 콤보박스) */}
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
                      style={{width: '94%'}}
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
          {/* 관리부서 */}
          <label>
            관리부서
            <select name="manageDept" value={form.manageDept} onChange={handleChange}>
              <option value="">선택</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          {/* 신청자/사용자 */}
          <div style={{ display: 'flex', width: '100%' }}>
            <div style={{ flex: 1 }}>
              <label>신청자</label>
              <input name="username" value={form.username} onChange={handleChange} placeholder="값 변경시 신청정보까지 변경됨" style={{ width: '92%' }} />
              {applicantHelperText ? (
                <div style={{ fontSize: '0.85rem', marginTop: 4, color: applicantHelperColor }}>
                  {applicantHelperText}
                </div>
              ) : null}
            </div>
            <div style={{ flex: 1 }}>
              <label>사용자</label>
              <input
                name="realUser"
                value={form.realUser}
                onChange={handleChange}
                placeholder="빈 값일시 자동으로 신청자와 동일하게 설정"
                style={{ width: '92%' }}
                disabled={realUserDisabled}
              />
            </div>
          </div>
          <div
            style={{
              width: '100%',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>현재 신청 상태</div>
            <div style={{ color: initialStatusColor, marginBottom: 6 }}>상태: {initialStatusText}</div>
            <div style={{ fontSize: '0.95rem', color: '#475569' }}>신청자: {initialApplicantDisplay}</div>
            <div style={{ fontSize: '0.95rem', color: '#475569', marginBottom: previewActive ? 8 : 0 }}>
              사용자: {initialRealUserDisplay}
            </div>
            {approvalSnapshot.info && (
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  marginBottom: previewActive ? 8 : 0,
                }}
              >
                최근 결재 단계: {approvalSnapshot.type ? `${approvalSnapshot.type} / ` : ''}{approvalSnapshot.info}
              </div>
            )}
            {previewActive && (
              <div
                style={{
                  backgroundColor: '#e0f2fe',
                  border: '1px dashed #38bdf8',
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>저장 시 변경 미리보기</div>
                <div style={{ color: previewStatusColor, marginBottom: 6 }}>상태: {previewStatusText}</div>
                <div style={{ fontSize: '0.95rem', color: '#0f172a' }}>신청자: {previewApplicantDisplay}</div>
                <div style={{ fontSize: '0.95rem', color: '#0f172a' }}>사용자: {previewRealUserDisplay}</div>
              </div>
            )}
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: previewActive ? 0 : 8 }}>
              신청자를 저장하면 진행 중이던 대여 신청은 자동으로 반려되고, 새 대여 상태가 즉시 반영됩니다.
            </div>
          </div>
          {/* 용도 */}
          <label>
            용도
            <select name="purpose" value={form.purpose} onChange={handleChange}>
              <option value="">선택</option>
              <option value="개발">개발</option>
              <option value="사무">사무</option>
            </select>
          </label>
          {/* 장비상태 */}
          <label>
            <span style={{ display: 'block' }}>장비상태</span>
            <div style={{ display: 'flex', gap: '24px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                <input type="radio" name="status" value="정상" checked={form.status === '정상'} onChange={handleRadioChange} style={{ width: '20px', height: '20px' }} />
                정상
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                <input type="radio" name="status" value="노후" checked={form.status === '노후'} onChange={handleRadioChange} style={{ width: '20px', height: '20px' }} />
                노후
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                <input type="radio" name="status" value="폐기" checked={form.status === '폐기'} onChange={handleRadioChange} style={{ width: '20px', height: '20px' }} />
                폐기
              </label>
            </div>
          </label>
          {/* 사양 */}
          <label style={{ alignItems: 'flex-start' }}>
            <span style={{ display: 'block' }}>사양</span>
            <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
              <textarea name="spec" value={form.spec} onChange={handleChange} rows={2} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* 금액 */}
          <label>
            금액
            <div style={{ display: 'flex', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>₩</span>
                <input name="price" type="text" inputMode="numeric" value={form.price} onChange={handlePriceChange} style={{ flex: 1, minWidth: 0 }} />
                <span style={{ minWidth: 90, textAlign: 'right' }}>{formattedPrice}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label>
                <input
                  type="radio"
                  name="vatIncluded"
                  value="true"
                  checked={form.vatIncluded === true}
                  onChange={handleRadioChange}
                />{' '}
                부가세 포함
              </label>
              <label>
                <input
                  type="radio"
                  name="vatIncluded"
                  value="false"
                  checked={form.vatIncluded === false}
                  onChange={handleRadioChange}
                />{' '}
                부가세 별도
              </label>
            </div>
          </label>
          {/* 모델명 */}
          <label>
            모델명
            <div style={{ display: 'flex', width: '100%' }}>
              <input name="model" value={form.model} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* 제조사 */}
          <label>
            제조사
            <div style={{ display: 'flex', width: '100%' }}>
              <input name="manufacturer" value={form.manufacturer} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* S/N */}
          <label>
            S/N
            <div style={{ display: 'flex', width: '100%' }}>
              <input name="serial" value={form.serial} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* MAC 주소 */}
          <label>
            MAC 주소
            <div style={{ display: 'flex', width: '100%' }}>
              <input name="mac" value={form.mac} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* 비고 */}
          <label>
            비고
            <div style={{ display: 'flex', width: '100%' }}>
              <textarea name="note" value={form.note} onChange={handleChange} rows={2} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* 관리자용 비고 */}
          <label>
            관리자용 비고
            <div style={{ display: 'flex', width: '100%' }}>
              <textarea name="adminNote" value={form.adminNote} onChange={handleChange} rows={2} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </label>
          {/* 구입일자 */}
          <label>
            구입일자
            <DatePicker
              value={form.purchaseDate ? dayjs(form.purchaseDate) : null}
              onChange={(date) => setForm((prev) => ({ ...prev, purchaseDate: date ? date.format('YYYY-MM-DD') : '' }))}
              format="YYYY-MM-DD"
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  variant: 'outlined',
                  placeholder: '구입일자',
                  InputLabelProps: { shrink: false },
                  sx: {
                    "& .MuiInputBase-input": { cursor: "pointer" },
                  },
                  onClick: (e) => {
                    e.currentTarget.querySelector('input')?.focus();
                  },
                },
              }}
            />
          </label>
          <button type="submit" disabled={isSaving || applicantValidationBlocked}>{isSaving ? '저장중…' : '수정'}</button>
        </form>
        )}
      </div>
    </LocalizationProvider>
  );
}
