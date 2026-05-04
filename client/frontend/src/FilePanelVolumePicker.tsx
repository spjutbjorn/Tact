import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type VolumeInfo } from "./wails";
import { currentVolume } from "./filePanelHelpers";

function DiskSelector({
  path,
  volumes,
  onNavigate,
  onOpen,
}: {
  path: string;
  volumes: VolumeInfo[];
  onNavigate: (p: string) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const active = currentVolume(path, volumes);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown) return;
    dropdown.style.setProperty("--dropdown-top", `${dropdownPos.top}px`);
    dropdown.style.setProperty("--dropdown-left", `${dropdownPos.left}px`);
  }, [dropdownPos]);

  function toggle() {
    if (!open) {
      onOpen();
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setDropdownPos({ top: r.bottom + 4, left: r.left });
      }
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        className={`breadcrumb__link disk-selector__trigger${open ? " breadcrumb__link--open" : ""}`}
        onClick={toggle}
      >
        {active.name}
        <svg className="disk-selector__caret" viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div ref={dropdownRef} className="disk-selector__dropdown">
            {volumes.map((v) => (
              <button
                key={v.path}
                className={`disk-selector__option${v.path === active.path ? " disk-selector__option--active" : ""}`}
                onClick={() => {
                  onNavigate(v.path);
                  setOpen(false);
                }}
              >
                {v.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function FilePanelVolumePicker({
  path,
  volumes,
  onNavigate,
  onOpen,
}: {
  path: string;
  volumes: VolumeInfo[];
  onNavigate: (p: string) => void;
  onOpen: () => void;
}) {
  return (
    <>
      <DiskSelector path={path} volumes={volumes} onNavigate={onNavigate} onOpen={onOpen} />
    </>
  );
}
