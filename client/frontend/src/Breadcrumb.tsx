import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListVolumes, VolumeInfo } from "./wails";
import { joinPath } from "./path";

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

interface Segment {
  label: string;
  path: string;
}

function parseSegments(fullPath: string, volumePath: string): Segment[] {
  const relative = fullPath.slice(volumePath === "/" ? 0 : volumePath.length);
  const parts = relative.split("/").filter(Boolean);
  const segments: Segment[] = [];

  parts.reduce((acc, part) => {
    const current = joinPath(acc || volumePath, part);
    segments.push({ label: part, path: current });
    return current;
  }, volumePath === "/" ? "" : volumePath);

  return segments;
}

function currentVolume(path: string, volumes: VolumeInfo[]): VolumeInfo {
  const match = volumes
    .filter((v) => v.path !== "/")
    .sort((a, b) => b.path.length - a.path.length)
    .find((v) => path === v.path || path.startsWith(v.path + "/"));
  return match ?? volumes.find((v) => v.path === "/") ?? { path: "/", name: "local" };
}

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
      if (
        !btnRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

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
          <div
            ref={dropdownRef}
            className="disk-selector__dropdown"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
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
          document.body
        )}
    </>
  );
}

export default function Breadcrumb({ path, onNavigate }: Props) {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);

  useEffect(() => {
    ListVolumes().then(setVolumes);
  }, []);

  const vol = volumes.length ? currentVolume(path, volumes) : null;
  const segments = vol ? parseSegments(path, vol.path) : [];

  return (
    <nav className="breadcrumb" aria-label="Current location">
      {vol && (
        <>
          <DiskSelector
            path={path}
            volumes={volumes}
            onNavigate={onNavigate}
            onOpen={() => ListVolumes().then(setVolumes)}
          />
          {segments.length > 0 && <span className="breadcrumb__sep">/</span>}
        </>
      )}

      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={seg.path} className="breadcrumb__item">
            {i > 0 && <span className="breadcrumb__sep">/</span>}
            {isLast ? (
              <span className="breadcrumb__current">{seg.label}</span>
            ) : (
              <button
                className="breadcrumb__link"
                onClick={() => onNavigate(seg.path)}
              >
                {seg.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
