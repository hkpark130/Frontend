import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PLACEHOLDER = "프로젝트를 선택하세요";
const DEFAULT_EMPTY_TEXT = "검색 결과가 없습니다.";

const createKey = (name = "", code = "") => {
  const normalizedName = typeof name === "string" ? name.trim().toLowerCase() : "";
  const normalizedCode = typeof code === "string" ? code.trim().toLowerCase() : "";
  return `${normalizedName}:::${normalizedCode}`;
};

const normalizeProject = (project, index) => {
  if (project == null) {
    return null;
  }
  if (typeof project === "string") {
    const trimmed = project.trim();
    if (!trimmed) {
      return null;
    }
    const key = createKey(trimmed, "");
    return {
      id: key || `__idx_${index}`,
      name: trimmed,
      code: "",
      key,
      raw: { name: trimmed, code: "" },
    };
  }
  if (typeof project === "object") {
    const name = typeof project.name === "string" ? project.name.trim() : "";
    const code = typeof project.code === "string" ? project.code.trim() : "";
    if (!name && !code) {
      return null;
    }
    const key = createKey(name, code);
    const id = project.id ?? project.code ?? project.name ?? `__idx_${index}`;
    return {
      id,
      name,
      code,
      key,
      raw: project,
    };
  }
  return null;
};

const parseSelectedProject = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return { id: null, name: trimmed, code: "" };
  }
  if (typeof value === "object") {
    const name = typeof value.name === "string" ? value.name : "";
    const code = typeof value.code === "string" ? value.code : "";
    if (!name.trim() && !code.trim()) {
      return null;
    }
    return {
      id: value.id ?? null,
      name,
      code,
    };
  }
  return null;
};

const formatLabel = (project, placeholder) => {
  if (!project) {
    return placeholder;
  }
  const name = typeof project.name === "string" ? project.name.trim() : "";
  const code = typeof project.code === "string" ? project.code.trim() : "";
  if (name && code) {
    return `${name} (${code})`;
  }
  if (name) {
    return name;
  }
  if (code) {
    return code;
  }
  return placeholder;
};

const buildSelection = (project) => {
  if (!project) {
    return null;
  }
  const base = {
    id: project.raw?.id ?? project.id ?? null,
    name: project.name ?? "",
    code: project.code ?? "",
  };
  if (project.raw && typeof project.raw === "object") {
    return { ...project.raw, ...base };
  }
  return base;
};

export default function ProjectCombobox({
  projects = [],
  selectedProject,
  onSelect,
  
  autoSelectFirst = true,
  disabled = false,
  placeholder = DEFAULT_PLACEHOLDER,
  searchPlaceholder = "프로젝트 이름 또는 코드를 검색하세요",
  wrapperClassName = "",
  triggerClassName = "",
  panelClassName = "",
  searchInputClassName = "",
  listClassName = "",
  emptyText = DEFAULT_EMPTY_TEXT,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, width: 0 });

  const normalizedProjects = useMemo(
    () => (projects ?? []).map(normalizeProject).filter(Boolean),
    [projects],
  );

  const parsedSelected = useMemo(
    () => parseSelectedProject(selectedProject),
    [selectedProject],
  );

  const selectedKey = useMemo(
    () => (parsedSelected ? createKey(parsedSelected.name, parsedSelected.code) : ""),
    [parsedSelected],
  );

  const hasSelection = !!parsedSelected;

  const filteredProjects = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return normalizedProjects;
    }
    return normalizedProjects.filter((project) => {
      const name = project.name?.toLowerCase() ?? "";
      const code = project.code?.toLowerCase() ?? "";
      return name.includes(keyword) || code.includes(keyword);
    });
  }, [normalizedProjects, searchTerm]);

  useEffect(() => {
    if (!autoSelectFirst) {
      return;
    }
    if (disabled) {
      return;
    }
    if (hasSelection) {
      return;
    }
    if (!normalizedProjects.length) {
      return;
    }
    if (typeof onSelect !== "function") {
      return;
    }
    onSelect(buildSelection(normalizedProjects[0]));
  }, [autoSelectFirst, disabled, hasSelection, normalizedProjects, onSelect]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      return undefined;
    }
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isStretchPanel = useMemo(
    () => typeof panelClassName === "string" && panelClassName.includes("combobox-panel--stretch"),
    [panelClassName],
  );

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const horizontalPadding = 16;
    const verticalGap = 8;

    const desiredWidth = isStretchPanel
      ? rect.width
      : Math.max(rect.width, 240);
    const maximumWidth = isStretchPanel
      ? Math.max(280, viewportWidth - horizontalPadding * 2)
      : Math.min(420, viewportWidth - horizontalPadding * 2);

    const width = Math.min(Math.max(desiredWidth, 200), maximumWidth);
    let left = rect.left;
    if (left + width + horizontalPadding > viewportWidth) {
      left = Math.max(horizontalPadding, viewportWidth - width - horizontalPadding);
    }
    let top = rect.bottom + verticalGap;
    if (top > viewportHeight - horizontalPadding) {
      top = viewportHeight - horizontalPadding;
    }
    setPanelPosition({ top, left, width });
  }, [isStretchPanel]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    updatePanelPosition();
    const handleReposition = () => {
      updatePanelPosition();
    };
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updatePanelPosition]);

  const toggleOpen = () => {
    if (disabled || !normalizedProjects.length) {
      return;
    }
    if (!isOpen) {
      updatePanelPosition();
    }
    const next = !isOpen;
    setIsOpen(next);
    if (!isOpen && next) {
      requestAnimationFrame(() => {
        updatePanelPosition();
      });
    }
  };

  const handleOptionSelect = (project) => {
    if (disabled || typeof onSelect !== "function") {
      setIsOpen(false);
      return;
    }
    const payload = buildSelection(project);
    const nextKey = createKey(payload?.name, payload?.code);
    if (nextKey === selectedKey) {
      setIsOpen(false);
      return;
    }
    onSelect(payload);
    setIsOpen(false);
  };

  // clear functionality removed; keep function placeholder removed to avoid unused lint warnings

  const displayProject = parsedSelected
    ?? (autoSelectFirst && normalizedProjects.length ? normalizedProjects[0] : null);

  const displayLabel = formatLabel(displayProject, placeholder);

  const wrapperClasses = ["combobox-wrapper", wrapperClassName].filter(Boolean).join(" ");
  const triggerClasses = ["combobox-trigger", triggerClassName].filter(Boolean).join(" ");
  const panelClasses = ["combobox-panel", panelClassName].filter(Boolean).join(" ");
  const searchClasses = ["combobox-search", searchInputClassName].filter(Boolean).join(" ");
  const listClasses = [
    listClassName || "combobox-options combobox-options--scroll",
  ].filter(Boolean).join(" ");

  const panelInlineStyle = {
    top: panelPosition.top,
    left: panelPosition.left,
    minWidth: panelPosition.width || undefined,
    width: isStretchPanel ? panelPosition.width || undefined : undefined,
  };

  return (
    <div className={wrapperClasses} ref={wrapperRef}>
      <div className={`combobox${isOpen ? " open" : ""}`}>
        <button
          type="button"
          className={triggerClasses}
          onClick={toggleOpen}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          ref={triggerRef}
        >
          <span>{displayLabel}</span>
          <span className="combobox-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {isOpen && (
          <div className={panelClasses} style={panelInlineStyle}>
            <input
              type="text"
              className={searchClasses}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              autoFocus
            />
            <div className={listClasses} role="listbox">
              {/* clear button removed by request */}
              {filteredProjects.length === 0 ? (
                <div className="combobox-option" aria-disabled>
                  {emptyText}
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const optionKey = project.id ?? project.key;
                  const optionSelected = project.key === selectedKey;
                  const optionClasses = optionSelected
                    ? "combobox-option combobox-option--selected"
                    : "combobox-option";
                  return (
                    <button
                      type="button"
                      key={optionKey}
                      className={optionClasses}
                      onClick={() => handleOptionSelect(project)}
                      role="option"
                      aria-selected={optionSelected}
                    >
                      <span className="combobox-option-name">{project.name}</span>
                      <span className="combobox-option-code">{project.code || "프로젝트 코드 없음"}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
