import React, { useState, useRef, useEffect } from 'react';
import { fetchProjects, fetchDeviceDetail, updateDevice } from '@/api/devices';
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
    vatIncluded: '포함',
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProjectDropdownOpen]);

  const toggleProjectDropdown = () => {
    setIsProjectDropdownOpen((open) => !open);
    setProjectSearchTerm('');
  };

  const handleProjectSelect = (project) => {
    setForm((prev) => ({ ...prev, project: project.name }));
    setSelectedProjectLabel(project.name + (project.code ? ` (${project.code})` : ''));
    setIsProjectDropdownOpen(false);
  };
  const handlePriceChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setForm((prev) => ({ ...prev, price: value }));
  };

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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 금액 표시용
  const formattedPrice = form.price ? Number(form.price).toLocaleString() + ' 원' : '0 원';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.assetCode) return;
    setIsSaving(true);
    try {
      const payload = {
        id: form.assetCode,
        categoryName: form.category || null,
        manageDepName: form.manageDept || null,
        projectName: form.project || null,
        username: form.username || null,
        realUser: form.realUser || null,
        status: form.status || null,
        purpose: form.purpose || null,
        spec: form.spec || null,
        price: form.price ? Number(form.price) : null,
        model: form.model || null,
        company: form.manufacturer || null,
        sn: form.serial || null,
        description: form.note || null,
        adminDescription: form.adminNote || null,
        purchaseDate: form.purchaseDate || null,
      };
      await updateDevice(form.assetCode, payload);
      alert('장비 정보가 수정되었습니다.');
    } catch (e2) {
      console.error(e2);
      alert('수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // DeviceDto -> form 매핑
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
    vatIncluded: '포함',
    model: dto.model || '',
    manufacturer: dto.company || '',
    serial: dto.sn || '',
    mac: '',
    note: dto.description || '',
    adminNote: dto.adminDescription || '',
    purchaseDate: dto.purchaseDate ? dayjs(dto.purchaseDate).format('YYYY-MM-DD') : '',
  });

  // 장비 조회 실행
  const handleSearch = async (rawId) => {
    const id = (rawId ?? searchId).trim();
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const dto = await fetchDeviceDetail(id);
      setForm(mapDeviceToForm(dto));
      // 프로젝트 라벨 표시
      setSelectedProjectLabel(
        (dto.projectName || '') + (dto.projectCode ? ` (${dto.projectCode})` : '')
      );
      setIsLoaded(true);
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
              <input name="username" value={form.username} onChange={handleChange} placeholder="값 변경시 신청정보까지 변경됨" style={{ width: '90%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>사용자</label>
              <input name="realUser" value={form.realUser} onChange={handleChange} placeholder="빈 값일시 자동으로 신청자가 입력됨" style={{ width: '90%' }} />
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
              <label><input type="radio" name="vatIncluded" value="포함" checked={form.vatIncluded === '포함'} onChange={handleRadioChange} /> 부가세 포함</label>
              <label><input type="radio" name="vatIncluded" value="별도" checked={form.vatIncluded === '별도'} onChange={handleRadioChange} /> 부가세 별도</label>
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
          <button type="submit" disabled={isSaving}>{isSaving ? '저장중…' : '수정'}</button>
        </form>
        )}
      </div>
    </LocalizationProvider>
  );
}
