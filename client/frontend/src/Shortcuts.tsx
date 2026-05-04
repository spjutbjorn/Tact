const isMac = navigator.platform.toUpperCase().includes("MAC");
const Cmd = isMac ? "⌘" : "Ctrl";

interface ShortcutRow {
  keys: string[];
  label: string;
  note?: string;
}

interface Group {
  title: string;
  rows: ShortcutRow[];
}

const GROUPS: Group[] = [
  {
    title: "Folder panel — left",
    rows: [
      { keys: ["W"], label: "Move cursor up" },
      { keys: ["S"], label: "Move cursor down" },
      { keys: ["E"], label: "Go up one folder" },
      { keys: ["Enter", "Q"], label: "Open file or folder" },
      { keys: [Cmd, "S"], label: "Save current file" },
      { keys: ["D"], label: "Copy to other panel", note: "Split view" },
      { keys: ["A"], label: "Move to other panel", note: "Split view" },
    ],
  },
  {
    title: "Folder panel — right",
    rows: [
      { keys: ["↑"], label: "Move cursor up" },
      { keys: ["↓"], label: "Move cursor down" },
      { keys: ["Enter", "Q"], label: "Open file or folder" },
      { keys: [Cmd, "S"], label: "Save current file" },
      { keys: ["←"], label: "Copy to other panel", note: "Split view" },
      { keys: ["→"], label: "Move to other panel", note: "Split view" },
    ],
  },
  {
    title: "Text editor",
    rows: [
      { keys: [Cmd, "S"], label: "Save" },
      { keys: ["Alt", "↑"], label: "Move line up" },
      { keys: ["Alt", "↓"], label: "Move line down" },
      { keys: ["Esc"], label: "Return to folder view" },
    ],
  },
  {
    title: "Image & video viewer",
    rows: [
      { keys: ["↑", "↓"], label: "Navigate between files" },
      { keys: ["←", "→"], label: "Navigate between images" },
      { keys: ["Esc"], label: "Exit fullscreen" },
    ],
  },
  {
    title: "Gemma",
    rows: [
      { keys: ["Enter"], label: "Send message" },
      { keys: ["Shift", "Enter"], label: "New line" },
    ],
  },
];

function Key({ label }: { label: string }) {
  return <kbd className="shortcuts__key">{label}</kbd>;
}

function ShortcutRow({ keys, label, note }: ShortcutRow) {
  return (
    <div className="shortcuts__row">
      <span className="shortcuts__keys">
        {keys.map((k, i) => (
          <span key={i} className="shortcuts__key-combo">
            {i > 0 && <span className="shortcuts__key-sep">+</span>}
            <Key label={k} />
          </span>
        ))}
      </span>
      <span className="shortcuts__label">{label}</span>
      {note && <span className="shortcuts__note">{note}</span>}
    </div>
  );
}

export default function Shortcuts() {
  return (
    <div className="shortcuts">
      <div className="shortcuts__header">Keyboard shortcuts</div>
      <div className="shortcuts__body">
        {GROUPS.map((group) => (
          <section key={group.title} className="shortcuts__group">
            <h2 className="shortcuts__group-title">{group.title}</h2>
            {group.rows.map((row, i) => (
              <ShortcutRow key={i} {...row} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
