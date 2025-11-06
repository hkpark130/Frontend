import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import Box from "@mui/material/Box";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { format, isValid, parse } from "date-fns";

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

export function RangeDateInput({
  startDate,
  endDate,
  onChange,
  label = "사용 기간",
  startPlaceholder = "YYYY-MM-DD",
  endPlaceholder = "YYYY-MM-DD",
}) {
  const [open, setOpen] = useState(false);
  const start = useMemo(() => toDayjs(startDate), [startDate]);
  const end = useMemo(() => toDayjs(endDate), [endDate]);
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);

  useEffect(() => {
    if (open) {
      setDraftStart(start);
      setDraftEnd(end);
    }
  }, [open, start, end]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const displayValue = useMemo(() => {
    const startValue = extractDateString(startDate);
    const endValue = extractDateString(endDate);
    if (!startValue && !endValue) return "";
    if (startValue && endValue) return `${startValue} ~ ${endValue}`;
    return startValue || endValue || "";
  }, [startDate, endDate]);

  const apply = () => {
    const startValue = toDateStringFromDayjs(draftStart);
    const endValue = toDateStringFromDayjs(draftEnd);
    if (startValue && endValue && draftStart && draftEnd && draftEnd.isBefore(draftStart)) {
      onChange(endValue, startValue);
    } else {
      onChange(startValue, endValue);
    }
    setOpen(false);
  };

  const clear = () => {
    setDraftStart(null);
    setDraftEnd(null);
    onChange("", "");
    setOpen(false);
  };

  function RangeDay(props) {
    const { day, outsideCurrentMonth, ...other } = props;
    const isStart = !!draftStart && day.isSame(draftStart, "day");
    const isEnd = !!draftEnd && day.isSame(draftEnd, "day");
    const inRange =
      !!draftStart &&
      !!draftEnd &&
      (day.isAfter(draftStart, "day") && day.isBefore(draftEnd, "day"));

    return (
      <PickersDay
        {...other}
        day={day}
        outsideCurrentMonth={outsideCurrentMonth}
        sx={{
          ...(inRange && {
            bgcolor: "rgba(37,99,235,0.18) !important",
            color: "#2563eb",
            borderRadius: 0,
          }),
          ...(isStart && {
            bgcolor: "#2563eb !important",
            color: "#fff !important",
            borderTopLeftRadius: "50%",
            borderBottomLeftRadius: "50%",
          }),
          ...(isEnd && {
            bgcolor: "#2563eb !important",
            color: "#fff !important",
            borderTopRightRadius: "50%",
            borderBottomRightRadius: "50%",
          }),
          "&:hover": {
            bgcolor: inRange ? "rgba(37,99,235,0.28) !important" : undefined,
          },
        }}
      />
    );
  }

  return (
    <>
      <div className="range-field">
      <label className="field-label" htmlFor="usage-range-trigger">{label}</label>
      <div className="combobox-wrapper">
        <div className={`combobox${open ? " open" : ""}`}>
          <button
            id="usage-range-trigger"
            type="button"
            className="combobox-trigger"
            onClick={() => setOpen((prev) => !prev)}
          >
            <span>{displayValue || `${startPlaceholder} ~ ${endPlaceholder}`}</span>
            <span className="combobox-caret" aria-hidden>▾</span>
          </button>
          {open && (
            <div
              className="range-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <div
                className="range-dialog"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="range-grid">
                  <div>
                    <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 2, fontWeight: 800 }}>시작일</div>
                    <DateCalendar
                      value={draftStart}
                      onChange={(value) => {
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
                    <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 2, fontWeight: 800 }}>종료일</div>
                    <DateCalendar
                      value={draftEnd}
                      onChange={(value) => setDraftEnd(value)}
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
      <style jsx>{`
      :global(.range-field) {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      :global(.field-label) {
        font-weight: 600;
        font-size: 14px;
        color: #111827;
      }
      :global(.range-overlay) {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.28);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }
      :global(.range-dialog) {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
        padding: 24px;
        width: min(640px, 90vw);
        max-width: 720px;
      }
      :global(.range-grid) {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 24px;
      }
      :global(.range-actions) {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      :global(.btn-small) {
        border-radius: 8px;
        border: 1px solid #d1d5db;
        padding: 6px 14px;
        font-size: 14px;
        background: #fff;
        cursor: pointer;
      }
      :global(.btn-small:hover) {
        border-color: #2563eb;
      }
      :global(.btn-primary) {
        background: #2563eb;
        color: #fff;
        border-color: #1d4ed8;
      }
      :global(.btn-primary:hover) {
        background: #1d4ed8;
      }
      @media (max-width: 640px) {
        :global(.range-dialog) {
          padding: 20px 16px;
        }
        :global(.range-grid) {
          gap: 16px;
        }
      }
    `}</style>
    </>
  );
}

export function DeadlineDateField({
  value,
  onChange,
  label = "신청 마감일",
  minDate,
}) {
  const selected = value ? toDayjs(value) : null;
  const min = minDate ? toDayjs(minDate) : null;

  const handleChange = (newValue) => {
    const formatted = toDateStringFromDayjs(newValue);
    onChange(formatted);
  };

  return (
    <label className="range-field mui single deadline-field stacked">
      {label}
      <Box sx={{ mt: 1 }}>
        <DatePicker
          value={selected}
          onChange={handleChange}
          format="YYYY-MM-DD"
          minDate={min ?? undefined}
          slotProps={{
            textField: {
              fullWidth: true,
              size: "small",
              variant: "outlined",
              placeholder: label,
              InputLabelProps: { shrink: false },
              sx: {
                "& .MuiInputBase-input": { cursor: "pointer" },
              },
              onClick: (event) => {
                event.currentTarget.querySelector("input")?.focus();
              },
            },
          }}
        />
      </Box>
    </label>
  );
}

