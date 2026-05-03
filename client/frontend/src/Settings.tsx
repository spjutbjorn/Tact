import { useState } from "react";
import { type FileHandlerSettings, DEFAULT_TEXT_EXTENSIONS, DEFAULT_HIDDEN_NAMES } from "./fileHandlers";
import { type TerminalProfile } from "./wails";

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

interface Props {
  panelWidth: number;
  onPanelWidthChange: (w: number) => void;
  fileHandlerSettings: FileHandlerSettings;
  onFileHandlerSettingsChange: (s: FileHandlerSettings) => void;
  terminalProfiles: TerminalProfile[];
  disabledProfileIds: string[];
  onToggleProfileDisabled: (id: string) => void;
}

export default function Settings({ 
  panelWidth, 
  onPanelWidthChange, 
  fileHandlerSettings, 
  onFileHandlerSettingsChange,
  terminalProfiles,
  disabledProfileIds,
  onToggleProfileDisabled
}: Props) {
  const [filter, setFilter] = useState("");
  const [newExt, setNewExt] = useState("");
  const [newHiddenName, setNewHiddenName] = useState("");

  const exts = fileHandlerSettings.textExtensions;
  const hiddenNames = fileHandlerSettings.hiddenNames;

  const filtered = filter.trim()
    ? exts.filter((e) => e.includes(filter.trim().toLowerCase().replace(/^\./, "")))
    : exts;

  function handleRemove(ext: string) {
    onFileHandlerSettingsChange({ ...fileHandlerSettings, textExtensions: exts.filter((e) => e !== ext) });
  }

  function handleAdd() {
    const clean = newExt.trim().toLowerCase().replace(/^\./, "");
    if (!clean || exts.includes(clean)) {
      setNewExt("");
      return;
    }
    onFileHandlerSettingsChange({ ...fileHandlerSettings, textExtensions: [...exts, clean].sort() });
    setNewExt("");
  }

  function handleReset() {
    onFileHandlerSettingsChange({ 
      ...fileHandlerSettings, 
      textExtensions: [...DEFAULT_TEXT_EXTENSIONS] 
    });
  }

  function handleAddHidden() {
    const clean = newHiddenName.trim();
    if (!clean || hiddenNames.includes(clean)) {
      setNewHiddenName("");
      return;
    }
    onFileHandlerSettingsChange({ 
      ...fileHandlerSettings, 
      hiddenNames: [...hiddenNames, clean].sort() 
    });
    setNewHiddenName("");
  }

  function handleRemoveHidden(name: string) {
    onFileHandlerSettingsChange({ 
      ...fileHandlerSettings, 
      hiddenNames: hiddenNames.filter((n) => n !== name) 
    });
  }

  function handleResetHidden() {
    onFileHandlerSettingsChange({ 
      ...fileHandlerSettings, 
      hiddenNames: [...DEFAULT_HIDDEN_NAMES] 
    });
  }

  function getExtClass(ext: string): string {
    const isDefault = DEFAULT_TEXT_EXTENSIONS.includes(ext);
    let cls = "settings__ext-tag";
    if (isDefault) cls += " settings__ext-tag--default";
    
    const data = ["json", "yaml", "yml", "toml", "xml", "csv", "sql", "proto", "graphql", "gql", "env", "conf", "ini"];
    const code = ["js", "ts", "tsx", "jsx", "py", "go", "rs", "cpp", "c", "h", "java", "cs", "rb", "php", "pl", "swift", "kt", "scala", "dart", "lua", "clj", "erl", "ex", "sh", "bash"];
    const web = ["html", "css", "scss", "sass", "less", "styl", "xhtml", "vue", "svelte"];
    const doc = ["md", "txt", "log", "rst", "adoc", "org", "tex", "rmd", "qmd", "mdx", "mdc"];
    
    if (data.includes(ext)) cls += " settings__ext-tag--data";
    else if (code.includes(ext)) cls += " settings__ext-tag--code";
    else if (web.includes(ext)) cls += " settings__ext-tag--web";
    else if (doc.includes(ext)) cls += " settings__ext-tag--doc";
    
    return cls;
  }

  return (
    <div className="settings">
      <div className="settings__header">Settings</div>
      <div className="settings__body">

        <section className="settings__section">
          <h3 className="settings__section-title">File panel</h3>
          <div className="settings__row">
            <span className="settings__label">Width</span>
            <input
              type="range"
              min={MIN_WIDTH}
              max={MAX_WIDTH}
              value={panelWidth}
              onChange={(e) => onPanelWidthChange(parseInt(e.target.value))}
              className="settings__slider"
            />
            <span className="settings__value">{panelWidth}px</span>
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">Terminal clients</h3>
          <p className="settings__description">
            Choose which terminal clients to show in the sidebar.
          </p>
          <div className="settings__profiles">
            {terminalProfiles.length === 0 ? (
              <div className="settings__profiles-empty">No terminal clients found</div>
            ) : (
              terminalProfiles.map((profile) => {
                const isEnabled = !disabledProfileIds.includes(profile.id);
                return (
                  <div key={profile.id} className="settings__profile-row">
                    <label className="settings__profile-label">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => onToggleProfileDisabled(profile.id)}
                        className="settings__checkbox"
                      />
                      <div className="settings__profile-info">
                        <span className="settings__profile-name">{profile.name}</span>
                        <span className="settings__profile-model">{profile.model}</span>
                      </div>
                    </label>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">Hidden folders & files</h3>
          <p className="settings__description">
            Folders and files with these names are hidden from the file panel. Folders starting with "." are always hidden.
          </p>

          <div className="settings__ext-toolbar">
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="settings__ext-reset"
              onClick={handleResetHidden}
              title="Reset to defaults"
            >
              Reset
            </button>
          </div>

          <div className="settings__ext-list">
            {hiddenNames.length === 0 ? (
              <span className="settings__ext-empty">No hidden names configured</span>
            ) : (
              hiddenNames.map((name) => (
                <span key={name} className="settings__ext-tag settings__ext-tag--data">
                  {name}
                  <button
                    type="button"
                    className="settings__ext-remove"
                    onClick={() => handleRemoveHidden(name)}
                    title={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="settings__ext-add">
            <input
              className="settings__ext-input"
              type="text"
              placeholder="Add name (e.g. node_modules)…"
              value={newHiddenName}
              onChange={(e) => setNewHiddenName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddHidden();
                }
              }}
            />
            <button
              type="button"
              className="settings__ext-add-btn"
              onClick={handleAddHidden}
              disabled={!newHiddenName.trim()}
            >
              Add
            </button>
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">Text editor file types</h3>
          <p className="settings__description">
            Files with these extensions open in the text editor. {exts.length} formats configured.
          </p>

          <div className="settings__ext-toolbar">
            <input
              className="settings__ext-filter"
              type="text"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button
              type="button"
              className="settings__ext-reset"
              onClick={handleReset}
              title="Reset to defaults"
            >
              Reset
            </button>
          </div>

          <div className="settings__ext-list">
            {filtered.length === 0 ? (
              <span className="settings__ext-empty">No matches</span>
            ) : (
              filtered.map((ext) => (
                <span key={ext} className={getExtClass(ext)}>
                  .{ext}
                  <button
                    type="button"
                    className="settings__ext-remove"
                    onClick={() => handleRemove(ext)}
                    title={`Remove .${ext}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="settings__ext-add">
            <input
              className="settings__ext-input"
              type="text"
              placeholder="Add extension…"
              value={newExt}
              onChange={(e) => setNewExt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <button
              type="button"
              className="settings__ext-add-btn"
              onClick={handleAdd}
              disabled={!newExt.trim()}
            >
              Add
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
