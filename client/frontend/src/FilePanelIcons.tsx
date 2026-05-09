export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      width="12"
      height="12"
      className={expanded ? "file-panel__chevron file-panel__chevron--expanded" : "file-panel__chevron"}
    >
      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

export function NewFileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.5a.5.5 0 0 1 .5.5v3h3.5a.5.5 0 0 1 0 1H8.5v3.5a.5.5 0 0 1-1 0V8.5h-3.5a.5.5 0 0 1 0-1h3.5v-3.5A.5.5 0 0 1 8 4z" />
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm7 1.5v2a.5.5 0 0 0 .5.5h2L11 1.5z" />
    </svg>
  );
}

export function RenameIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
    </svg>
  );
}

export function NewFolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.086a1.5 1.5 0 0 1 1.06.44l.914.914A1.5 1.5 0 0 0 9.06 4.3l.44-.44A1.5 1.5 0 0 1 10.56 3.5H13A1.5 1.5 0 0 1 14.5 5v6A1.5 1.5 0 0 1 13 12.5H3A1.5 1.5 0 0 1 1.5 11V4zm7 3.5a.5.5 0 0 0-1 0V9H6a.5.5 0 0 0 0 1h1.5v1.5a.5.5 0 0 0 1 0V10H10a.5.5 0 0 0 0-1H8.5V7.5z" />
    </svg>
  );
}

export function AddToMediaIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.086a1.5 1.5 0 0 1 1.06.44l.915.914A1.5 1.5 0 0 0 8.62 3.8l.44-.44A1.5 1.5 0 0 1 10.12 3H13.5A1.5 1.5 0 0 1 15 4.5V6a.5.5 0 0 1-1 0V4.5a.5.5 0 0 0-.5-.5h-3.38a.5.5 0 0 0-.354.146l-.44.44A2.5 2.5 0 0 1 7.56 5.3L6.646 4.386A.5.5 0 0 0 6.293 4H2.5a.5.5 0 0 0-.5.5V12a.5.5 0 0 0 .5.5H6a.5.5 0 0 1 0 1H2.5A1.5 1.5 0 0 1 1 12V3.5z"/>
      <path d="M11.5 8a.5.5 0 0 1 .5.5v2h2a.5.5 0 0 1 0 1h-2v2a.5.5 0 0 1-1 0v-2H9a.5.5 0 0 1 0-1h2v-2a.5.5 0 0 1 .5-.5z"/>
    </svg>
  );
}

export function CompareIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M5.5 3a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V7.707L3.854 8.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .354-.146ZM10.5 13a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 1 0v4.293l1.146-1.147a.5.5 0 1 1 .708.708l-2 2a.5.5 0 0 1-.354.146Z"/>
    </svg>
  );
}

export function ZipIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M6.5 7.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v.938l.4 1.599a1 1 0 0 1-.416 1.074l-.93.62a1 1 0 0 1-1.108 0l-.93-.62a1 1 0 0 1-.416-1.074L6.5 8.438V7.5z"/>
      <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm5.5 2a.5.5 0 0 1 0 1H7v1h.5a.5.5 0 0 1 0 1H7v1h.5a.5.5 0 0 1 0 1H7v1h.5a1.5 1.5 0 0 1 1.5 1.5v.938l.4 1.599A2 2 0 0 1 8.567 14H7.433a2 2 0 0 1-1.832-2.963l.4-1.599V8.5A1.5 1.5 0 0 1 7.5 7H8V6h-.5a.5.5 0 0 1 0-1H8V4h-.5a.5.5 0 0 1 0-1H8V2H7.5z"/>
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M6 1.5A1.5 1.5 0 0 0 4.5 3V3.5H1.75a.75.75 0 0 0 0 1.5h.55l.82 8.2A2 2 0 0 0 5.11 15h5.78a2 2 0 0 0 1.99-1.8l.82-8.2h.55a.75.75 0 0 0 0-1.5H11.5V3A1.5 1.5 0 0 0 10 1.5H6Zm4 2V3.5H6V3a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 10 3.5ZM5.32 6.24a.75.75 0 0 1 .84.66l.4 4.5a.75.75 0 0 1-1.5.14l-.4-4.5a.75.75 0 0 1 .66-.8Zm5.02.66a.75.75 0 0 1 1.5.14l-.4 4.5a.75.75 0 0 1-1.5-.14l.4-4.5ZM8 6.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 6.5Z" />
    </svg>
  );
}
