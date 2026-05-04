import { useState } from "react";
import { type FileHandlerSettings } from "./fileHandlers";
import { type TerminalProfile } from "./wails";
import { addExtension, filterExtensions, getExtensionClass, removeExtension, resetHiddenNames, resetTextExtensions } from "./settingsHelpers";

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

  const filtered = filterExtensions(exts, filter);

  function handleRemove(ext: string) {
    onFileHandlerSettingsChange({ ...fileHandlerSettings, textExtensions: removeExtension(exts, ext) });
  }

  function handleAdd() {
    const next = addExtension(exts, newExt);
    if (next === exts) {
      setNewExt("");
      return;
    }
    onFileHandlerSettingsChange({ ...fileHandlerSettings, textExtensions: next });
    setNewExt("");
  }

  function handleReset() {
    onFileHandlerSettingsChange({ 
      ...fileHandlerSettings, 
      textExtensions: resetTextExtensions() 
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
      hiddenNames: resetHiddenNames() 
    });
  }

  return (
    <div className="settings">
      <div className="settings__header">Settings</div>
      <div className="settings__body">

        <div className="settings__group">
          <h2 className="settings__group-title">Interface</h2>
          <section className="settings__section">
            <h3 className="settings__section-title">Panel width</h3>
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
        </div>

        <div className="settings__group">
          <h2 className="settings__group-title">Terminal</h2>

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
                        <div className="settings__profile-info">
                          <span className="settings__profile-name">{profile.name}</span>
                          <span className="settings__profile-model">{profile.model}</span>
                        </div>
                        <div className="settings__spacer" />
                        <div className="settings__toggle">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => onToggleProfileDisabled(profile.id)}
                            className="settings__checkbox"
                          />
                          <span className="settings__toggle-track" aria-hidden="true">
                            <span className="settings__toggle-thumb" />
                          </span>
                        </div>
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className="settings__group">
          <h2 className="settings__group-title">Files</h2>
          
          <section className="settings__section">
            <h3 className="settings__section-title">Hidden folders & files</h3>
            <p className="settings__description">
              Folders and files with these names are hidden from the file panel. Folders starting with "." are always hidden.
            </p>
            <div className="settings__ext-toolbar">
              <div className="settings__spacer" />
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
              Files with these extensions open in the text editor.
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
                  <span key={ext} className={getExtensionClass(ext)}>
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

          <section className="settings__section">
            <h3 className="settings__section-title">Integration</h3>
            <div className="settings__row settings__row--toggle">
              <span className="settings__label">Highlight shared files</span>
              <label className="settings__toggle">
                <input
                  type="checkbox"
                  checked={fileHandlerSettings.highlightSharedFiles}
                  onChange={(e) =>
                    onFileHandlerSettingsChange({
                      ...fileHandlerSettings,
                      highlightSharedFiles: e.target.checked,
                    })
                  }
                  className="settings__checkbox"
                />
                <span className="settings__toggle-track" aria-hidden="true">
                  <span className="settings__toggle-thumb" />
                </span>
              </label>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
