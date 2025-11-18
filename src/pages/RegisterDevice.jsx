import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProjects } from "@/api/projects";
import { fetchCategories } from "@/api/categories";
import { fetchDepartments } from "@/api/departments";
import ProjectCombobox from "@/components/form/ProjectCombobox";
import "./RegisterDevice.css";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

export default function RegisterDevice() {
  const [form, setForm] = useState({
    category: '',
    assetCode: '',
    assetCodeChecked: false,
    project: '',
    projectCode: '',
    manageDept: '',
    purpose: '',
    status: '정상',
    spec: '',
    price: '',
    vatIncluded: true,
    model: '',
    manufacturer: '',
    serial: '',
    mac: '',
    note: '',
    adminNote: '',
    purchaseDate: '',
  });
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);

  // 관리번호 중복체크 (실제 API 연동 필요)
  const checkAssetCode = () => {
    if (!form.assetCode) return alert('관리번호를 입력하세요.');
    // TODO: 실제 중복체크 API 연동
    setForm((prev) => ({ ...prev, assetCodeChecked: true }));
    alert('사용 가능한 관리번호입니다.');
  };

  // 프로젝트 필터링
  // 프로젝트 리스트 불러오기
  useEffect(() => {
    fetchProjects().then((data) => {
      setProjects(Array.isArray(data) ? data : []);
    });
  }, []);

  // 카테고리/부서 목록 불러오기
  useEffect(() => {
    let ignore = false;

    const loadMeta = async () => {
      try {
        const [categoryData, departmentData] = await Promise.all([
          fetchCategories(),
          fetchDepartments(),
        ]);

        if (ignore) {
          return;
        }

        const categoryNames = Array.isArray(categoryData)
          ? categoryData
              .map((item) => {
                if (typeof item === 'string') {
                  return item;
                }
                if (item && typeof item === 'object') {
                  return item.name || '';
                }
                return '';
              })
              .filter((name) => !!name)
          : [];

        const departmentNames = Array.isArray(departmentData)
          ? departmentData
              .map((item) => {
                if (typeof item === 'string') {
                  return item;
                }
                if (item && typeof item === 'object') {
                  return item.name || '';
                }
                return '';
              })
              .filter((name) => !!name)
          : [];

        setCategories(categoryNames);
        setDepartments(departmentNames);
      } catch (error) {
        console.error('Failed to load categories or departments', error);
        if (!ignore) {
          setCategories([]);
          setDepartments([]);
        }
      }
    };

    loadMeta();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedProject = useMemo(() => {
    const name = typeof form.project === "string" ? form.project.trim() : "";
    const code = typeof form.projectCode === "string" ? form.projectCode.trim() : "";
    if (!name && !code) {
      return null;
    }
    const match = projects.find((project) => {
      const projectName = project?.name?.trim() ?? "";
      const projectCode = project?.code?.trim() ?? "";
      if (name && code) {
        return projectName === name && projectCode === code;
      }
      if (name) {
        return projectName === name;
      }
      return projectCode === code;
    });
    if (match) {
      return {
        id: match.id ?? null,
        name: match.name ?? "",
        code: match.code ?? "",
      };
    }
    return {
      id: null,
      name,
      code,
    };
  }, [form.project, form.projectCode, projects]);

  const handleProjectSelect = useCallback((project) => {
    setForm((prev) => ({
      ...prev,
      project: project?.name ?? '',
      projectCode: project?.code ?? '',
    }));
  }, []);
  const handlePriceChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setForm((prev) => ({ ...prev, price: value }));
  };

  // 기타 입력 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: API 연동
    alert('장비가 등록되었습니다.');
    setForm({
      category: '',
      assetCode: '',
      assetCodeChecked: false,
      project: '',
      projectCode: '',
      manageDept: '',
      purpose: '',
      status: '정상',
      spec: '',
      price: '',
      vatIncluded: true,
      model: '',
      manufacturer: '',
      serial: '',
      mac: '',
      note: '',
      adminNote: '',
      purchaseDate: '',
    });
  };

    return (
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
        <div className="card register-device-card">
          <h2>장비 등록</h2>
          <form onSubmit={handleSubmit} className="register-device-form">
            {/* 한 줄씩 세로 배치 */}
            <label>
              품목
              <select name="category" value={form.category} onChange={handleChange} required>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label style={{ alignItems: 'flex-start' }}>
              <span style={{ display: 'block' }}>관리번호</span>
              <div style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'baseline' }}>
                <input name="assetCode" value={form.assetCode} onChange={handleChange} required style={{ flex: 1 }} />
                <button type="button" onClick={checkAssetCode} style={{ minWidth: 90 }}>중복체크</button>
              </div>
            </label>
            {/* 프로젝트 (커스텀 콤보박스) */}
            <label className="device-info-label">
              프로젝트
              <ProjectCombobox
                projects={projects}
                selectedProject={selectedProject}
                onSelect={handleProjectSelect}
                disabled={projects.length === 0}
                searchPlaceholder="프로젝트 이름 또는 코드를 검색하세요"
                listClassName="combobox-list"
              />
            </label>
            <label>
              관리부서
              <select name="manageDept" value={form.manageDept} onChange={handleChange}>

                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </label>
            <label>
              용도
              <select name="purpose" value={form.purpose} onChange={handleChange}>

                <option value="개발">개발</option>
                <option value="사무">사무</option>
              </select>
            </label>
            <label>
              <span style={{ display: 'block' }}>장비상태</span>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                        <input type="radio" name="status" value="정상" checked={form.status === '정상'} onChange={handleRadioChange}
                            style={{ width: '20px', height: '20px' }}
                        />
                        정상
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                        <input type="radio" name="status" value="노후" checked={form.status === '노후'} onChange={handleRadioChange}
                            style={{ width: '20px', height: '20px' }}
                        />
                        노후
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                        <input type="radio" name="status" value="폐기" checked={form.status === '폐기'} onChange={handleRadioChange}
                            style={{ width: '20px', height: '20px' }}
                        />
                        폐기
                    </label>
                </div>
            </label>
            <label style={{ alignItems: 'flex-start' }}>
              <span style={{ display: 'block' }}>사양</span>
              <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                <textarea name="spec" value={form.spec} onChange={handleChange} rows={2} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
            <label>
              금액
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>₩</span>
                <input name="price" type="text" inputMode="numeric" value={form.price} onChange={handlePriceChange} style={{ flex: 1, minWidth: 0 }} />
                <span style={{ minWidth: 90, textAlign: 'right' }}>{formattedPrice}</span>
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
            <label>
              모델명
              <div style={{ display: 'flex', width: '100%' }}>
                <input name="model" value={form.model} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
            <label>
              제조사
              <div style={{ display: 'flex', width: '100%' }}>
                <input name="manufacturer" value={form.manufacturer} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
            <label>
              S/N
              <div style={{ display: 'flex', width: '100%' }}>
                <input name="serial" value={form.serial} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
            <label>
              MAC 주소
              <div style={{ display: 'flex', width: '100%' }}>
                <input name="mac" value={form.mac} onChange={handleChange} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
            <label>
              비고
              <div style={{ display: 'flex', width: '100%' }}>
                <textarea name="note" value={form.note} onChange={handleChange} rows={2} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
            <label>
              관리자용 비고
              <div style={{ display: 'flex', width: '100%' }}>
                <textarea name="adminNote" value={form.adminNote} onChange={handleChange} rows={2} style={{ flex: 1, minWidth: 0 }} />
              </div>
            </label>
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
                        // 항상 input에 포커스를 줘서 캘린더가 뜨게 함
                        e.currentTarget.querySelector('input')?.focus();
                    },
                  },
                }}
              />
            </label>
            <button type="submit">등록</button>
          </form>
        </div>
      </LocalizationProvider>
    );
}
