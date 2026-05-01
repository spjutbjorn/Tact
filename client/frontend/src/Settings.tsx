const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

interface Props {
  panelWidth: number;
  onPanelWidthChange: (w: number) => void;
}

export default function Settings({ panelWidth, onPanelWidthChange }: Props) {
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
      </div>
    </div>
  );
}
