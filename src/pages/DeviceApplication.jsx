import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, isValid, parse } from "date-fns";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Box from "@mui/material/Box";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import {
  fetchDepartments,
  fetchDeviceDetail,
  fetchProjects,
  submitDeviceApplication,
} from "@/api/devices";
import { useUser } from "@/context/UserProvider";
import { PickersDay } from '@mui/x-date-pickers/PickersDay';

const toDateString = (value) => (value && isValid(value) ? format(value, "yyyy-MM-dd") : "");

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : null;
  }
  return null;
};

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

const toDayjs = (value) => {
  const parsed = parseDate(value);
  return parsed ? dayjs(parsed) : null;
};

const toDateStringFromDayjs = (value) =>
  value && typeof value.isValid === "function" && value.isValid()
    ? value.format("YYYY-MM-DD")
    : "";

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
  deadlineDate: "",
  description: "",
  categoryName: "",
});

export default function DeviceApplication() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const defaultUserName = useMemo(() => {
    if (!user) return "";
    return (
      user?.profile?.preferred_username ||
      user?.profile?.email ||
      user?.profile?.name ||
      ""
    );
  }, [user]);

  const [device, setDevice] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(() => initialPayload(deviceId, defaultUserName));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const projectComboRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!projectComboRef.current) return;
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

  useEffect(() => {
    setForm(initialPayload(deviceId, defaultUserName));
  }, [deviceId, defaultUserName]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceData, departmentData, projectData] = await Promise.all([
          fetchDeviceDetail(deviceId),
          fetchDepartments(),
          fetchProjects(),
        ]);

        setDevice(deviceData);
        setDepartments(departmentData);
        setProjects(projectData);
        setForm((prev) => ({
          ...prev,
          description: deviceData?.description ?? "",
          categoryName: deviceData?.categoryName ?? "",
          departmentName: deviceData?.manageDepName ?? "",
          projectName: deviceData?.projectName ?? "",
          projectCode: deviceData?.projectCode ?? "",
          usageStartDate: extractDateString(deviceData?.usageStartDate) || prev.usageStartDate,
          usageEndDate: extractDateString(deviceData?.usageEndDate) || prev.usageEndDate,
          deadlineDate: extractDateString(deviceData?.deadline) || prev.deadlineDate,
        }));
      } catch (err) {
        console.error(err);
        setError("신청서를 불러오는 중 문제가 발생했습니다.");
      }
    };

    if (deviceId) {
      loadData();
    }
  }, [deviceId]);

  const filteredProjects = useMemo(() => {
    const term = projectSearchTerm.trim().toLowerCase();
    if (!term) {
      return projects;
    }
    return projects.filter((project) => {
      const name = project.name?.toLowerCase() ?? "";
      const code = project.code?.toLowerCase() ?? "";
      return name.includes(term) || code.includes(term);
    });
  }, [projects, projectSearchTerm]);

  const selectedProjectLabel = useMemo(() => {
    if (!form.projectName && !form.projectCode) {
      return "";
    }
    if (!form.projectCode) {
      return form.projectName;
    }
    return `${form.projectName} (${form.projectCode})`;
  }, [form.projectCode, form.projectName]);

  const toggleProjectDropdown = () => {
    setIsProjectDropdownOpen((prev) => !prev);
    setProjectSearchTerm("");
  };

  const handleProjectSelect = (project) => {
    setForm((prev) => ({
      ...prev,
      projectName: project.name,
      projectCode: project.code,
    }));
    setProjectSearchTerm("");
    setIsProjectDropdownOpen(false);
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

  const toggleRealUserMode = (mode) => {
    if (mode === "auto") {
      setForm((prev) => ({ ...prev, realUser: prev.userName, realUserMode: mode }));
    } else {
      setForm((prev) => ({ ...prev, realUserMode: mode }));
    }
  };

  const handleUsagePeriodChange = (start, end) => {
    setForm((prev) => ({ ...prev, usageStartDate: start, usageEndDate: end }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!form.reason.trim()) {
      setError("신청 사유를 입력해 주세요.");
      return;
    }

    if (!form.usageStartDate) {
      setError("사용 시작일을 선택해 주세요.");
      return;
    }

    if (!form.usageEndDate) {
      setError("사용 종료일을 선택해 주세요.");
      return;
    }

    if (form.usageStartDate > form.usageEndDate) {
      setError("사용 종료일은 시작일 이후여야 합니다.");
      return;
    }

    if (!form.deadlineDate) {
      setError("신청 마감일을 선택해 주세요.");
      return;
    }

    const payload = {
      ...form,
      deadline: `${form.deadlineDate}T00:00:00`,
      usageStartDate: `${form.usageStartDate}T00:00:00`,
      usageEndDate: `${form.usageEndDate}T00:00:00`,
      description: device?.description ?? "",
      status: device?.status ?? "정상",
      deviceStatus: device?.status ?? "정상",
      devicePurpose: device?.purpose ?? "",
      categoryName: form.categoryName ?? device?.categoryName ?? "",
    };

    try {
      setIsSaving(true);
      await submitDeviceApplication(payload);
      alert("신청이 완료되었습니다.");
      navigate("/device/list");
    } catch (err) {
      console.error(err);
      setError("신청 처리 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

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
              <h3>신청자 정보</h3>
            </div>
            <div className="form-section-grid applicant-grid">
              <div className="applicant-column">
                <label>
                  사용자
                  <input type="text" value={form.userName} readOnly />
                </label>
                <label className="real-user-field">
                  실제 사용자
                  <div className="input-group real-user-group">
                    <input
                      type="text"
                      value={form.realUser ?? ""}
                      onChange={handleChange("realUser")}
                      placeholder="실제 사용자 이름"
                      disabled={form.realUserMode !== "manual"}
                    />
                    <div className="group-buttons real-user-buttons">
                      <button
                        type="button"
                        className={form.realUserMode !== "manual" ? "primary" : "outline"}
                        onClick={() => toggleRealUserMode("auto")}
                      >
                        자동
                      </button>
                      <button
                        type="button"
                        className={form.realUserMode === "manual" ? "primary" : "outline"}
                        onClick={() => toggleRealUserMode("manual")}
                      >
                        직접 입력
                      </button>
                    </div>
                  </div>
                </label>
              </div>
              <div className="applicant-column">
                <RangeDateInput
                  startDate={form.usageStartDate}
                  endDate={form.usageEndDate}
                  onChange={handleUsagePeriodChange}
                />
                <DeadlineDateField
                  value={form.deadlineDate}
                  min={form.usageStartDate}
                  onChange={(date) =>
                    setForm((prev) => ({ ...prev, deadlineDate: date ?? "" }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h3>장비 정보</h3>
            </div>
            <div className="device-info-grid">
              <label className="device-info-label">
                관리번호
                <input type="text" value={form.deviceId} readOnly />
              </label>
              <label className="device-info-label">
                품목
                <input type="text" value={form.categoryName ?? ""} readOnly />
              </label>
              <label className="device-info-label">
                관리부서
                <select value={form.departmentName ?? ""} onChange={handleChange("departmentName")}> 
                  <option value="">선택하세요</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
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
                          style={{width: '100%'}}
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
            </div>
            <style jsx>{`
              .device-info-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 24px 32px;
                margin-bottom: 8px;
                align-items: flex-end;
              }
              .device-info-label {
                display: flex;
                flex-direction: column;
                min-width: 180px;
                margin-bottom: 0;
                margin-right: 0;
                gap: 6px;
                flex: 1 1 220px;
                max-width: 260px;
              }
              .device-info-label input,
              .device-info-label select,
              .device-info-label .combobox-wrapper {
                width: 100%;
                box-sizing: border-box;
              }
              .device-info-label input,
              .device-info-label select {
                margin-top: 4px;
                padding: 8px 10px;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                font-size: 15px;
                background: #f9fafb;
                min-width: 0;
                transition: border-color 0.2s;
              }
              /* Combobox(프로젝트 선택)도 동일한 radius 적용 */
              .combobox-trigger {
                border-radius: 8px !important;
                border: 1px solid #d1d5db;
                background: #f9fafb;
                padding: 8px 10px;
                font-size: 15px;
                width: 100%;
                text-align: left;
                transition: border-color 0.2s;
              }
              .combobox.open .combobox-trigger {
                border-bottom-left-radius: 0 !important;
                border-bottom-right-radius: 0 !important;
              }
              .combobox-panel {
                width: 100% !important;
                min-width: 0 !important;
                box-sizing: border-box;
                border-radius: 0 0 8px 8px !important;
                border: 1px solid #d1d5db;
                border-top: none;
                background: #fff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                overflow: hidden;
              }
              .combobox-search {
                width: 100% !important;
                box-sizing: border-box;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                margin-bottom: 6px;
                padding: 8px 10px;
                font-size: 15px;
                background: #f9fafb;
              }
              /* combobox-option도 radius 살짝 */
              .combobox-option {
                border-radius: 6px;
                transition: background 0.15s;
              }
              .combobox-option:focus,
              .combobox-option:hover {
                background: #f1f5f9;
              }
              @media (max-width: 900px) {
                .device-info-grid {
                  flex-direction: column;
                  gap: 16px 0;
                }
                .device-info-label {
                  max-width: 100%;
                }
              }
              @media (max-width: 900px) {
                .device-info-grid {
                  flex-direction: column;
                  gap: 16px 0;
                }
                .device-info-label {
                  max-width: 100%;
                }
              }
            `}</style>
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
            <button type="submit" className="primary" disabled={isSaving}>
              {isSaving ? "신청 중..." : "신청하기"}
            </button>
          </div>
        </form>
      </div>
    </LocalizationProvider>
  );
}

function RangeDateInput({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const start = useMemo(() => toDayjs(startDate), [startDate]);
  const end = useMemo(() => toDayjs(endDate), [endDate]);
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);

  // 패널 열릴 때 현재 값으로 draft 동기화
  useEffect(() => {
    if (open) {
      setDraftStart(start);
      setDraftEnd(end);
    }
  }, [open, start, end]);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const displayValue = useMemo(() => {
    if (!startDate && !endDate) return "";
    if (startDate && endDate) return `${startDate} ~ ${endDate}`;
    return startDate || endDate || "";
  }, [startDate, endDate]);

  const apply = () => {
    const s = toDateStringFromDayjs(draftStart);
    const e = toDateStringFromDayjs(draftEnd);
    if (s && e && draftStart && draftEnd && draftEnd.isBefore(draftStart)) {
      onChange(e, s);
    } else {
      onChange(s, e);
    }
    setOpen(false);
  };

  const clear = () => {
    setDraftStart(null);
    setDraftEnd(null);
    onChange("", "");
    setOpen(false);
  };

  // 날짜 범위 마킹을 위한 커스텀 Day
  function RangeDay(props) {
    const { day, outsideCurrentMonth, ...other } = props;
    const isStart = !!draftStart && day.isSame(draftStart, 'day');
    const isEnd = !!draftEnd && day.isSame(draftEnd, 'day');
    const inRange =
      !!draftStart &&
      !!draftEnd &&
      (day.isAfter(draftStart, 'day') && day.isBefore(draftEnd, 'day'));

    return (
      <PickersDay
        {...other}
        day={day}
        outsideCurrentMonth={outsideCurrentMonth}
        sx={{
          ...(inRange && {
            bgcolor: 'rgba(37,99,235,0.18) !important',
            color: '#2563eb',
            borderRadius: 0,
          }),
          ...(isStart && {
            bgcolor: '#2563eb !important',
            color: '#fff !important',
            borderTopLeftRadius: '50%',
            borderBottomLeftRadius: '50%',
          }),
          ...(isEnd && {
            bgcolor: '#2563eb !important',
            color: '#fff !important',
            borderTopRightRadius: '50%',
            borderBottomRightRadius: '50%',
          }),
          '&:hover': {
            bgcolor: inRange ? 'rgba(37,99,235,0.28) !important' : undefined,
          },
        }}
      />
    );
  }

  return (
    <div className="range-field">
      <label className="field-label" htmlFor="usage-range-trigger">사용 기간</label>
      <div className="combobox-wrapper">
        <div className={`combobox${open ? " open" : ""}`}>
          <button
            id="usage-range-trigger"
            type="button"
            className="combobox-trigger"
            onClick={() => setOpen(v => !v)}
          >
            <span>{displayValue || "YYYY-MM-DD ~ YYYY-MM-DD"}</span>
            <span className="combobox-caret" aria-hidden>▾</span>
          </button>
          {open && (
            <div
              className="range-overlay"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className="range-dialog"
                onMouseDown={e => e.stopPropagation()}
              >
                <div className="range-grid">
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>시작일</div>
                    <DateCalendar
                      value={draftStart}
                      onChange={value => {
                        setDraftStart(value);
                        if (draftEnd && value && draftEnd.isBefore(value)) {
                          setDraftEnd(null);
                        }
                      }}
                      maxDate={draftEnd ?? undefined}
                      slots={{ day: RangeDay }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>종료일</div>
                    <DateCalendar
                      value={draftEnd}
                      onChange={value => setDraftEnd(value)}
                      minDate={draftStart ?? undefined}
                      slots={{ day: RangeDay }}
                    />
                  </div>
                </div>
                <div className="range-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="btn-small" onClick={clear}>지우기</button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn-small" onClick={() => setOpen(false)}>
                      닫기
                    </button>
                    <button
                      type="button"
                      className="btn-small btn-primary"
                      onClick={apply}
                      disabled={!draftStart || !draftEnd}
                    >
                      확인
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeadlineDateField({ value, min, onChange }) {
  const selected = value ? toDayjs(value) : null;
  const minDate = min ? toDayjs(min) : null;

  const handleChange = (newValue) => {
    onChange(toDateStringFromDayjs(newValue));
  };

  return (
    <label className="range-field mui single deadline-field stacked">
      신청 마감일
      <Box sx={{ mt: 1 }}>
        <DatePicker
          value={selected}
          onChange={handleChange}
          format="YYYY-MM-DD"
          minDate={minDate ?? undefined}
          slotProps={{
            textField: {
              fullWidth: true,
              size: "small",
              variant: "outlined",
              placeholder: "신청 마감일",
              InputLabelProps: { shrink: false },
              sx: {
                "& .MuiInputBase-input": { cursor: "pointer" },
              },
              onClick: (e) => {
                // 항상 input에 포커스를 줘서 캘린더가 뜨게 함
                e.currentTarget.querySelector('input')?.focus();
              },
            },
            // field: { readOnly: true }, // 이 라인 주석처리 또는 제거
          }}
        />
      </Box>
    </label>
  );
}
