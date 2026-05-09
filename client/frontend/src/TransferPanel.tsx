import { type TransferJob, ClearDoneTransfers } from "./wails";
import { formatFileSize } from "./filePanelHelpers";

interface Props {
  jobs: TransferJob[];
}

function StatusBadge({ status }: { status: TransferJob["status"] }) {
  const labels: Record<TransferJob["status"], string> = {
    queued: "Queued",
    running: "Running",
    done: "Done",
    failed: "Failed",
  };
  return (
    <span className={`transfer-panel__badge transfer-panel__badge--${status}`}>
      {labels[status]}
    </span>
  );
}

export default function TransferPanel({ jobs }: Props) {
  const hasDone = jobs.some((j) => j.status === "done" || j.status === "failed");

  return (
    <div className="transfer-panel">
      <div className="transfer-panel__header">
        <span className="transfer-panel__title">Transfers</span>
        {hasDone && (
          <button
            type="button"
            className="transfer-panel__clear-btn"
            onClick={() => ClearDoneTransfers()}
          >
            Clear done
          </button>
        )}
      </div>
      {jobs.length === 0 ? (
        <div className="transfer-panel__empty">No transfers</div>
      ) : (
        <ul className="transfer-panel__list">
          {jobs.map((job) => {
            const pct = job.total > 0
              ? Math.min(100, (job.copied / job.total) * 100)
              : (job.status === "done" ? 100 : 0);
            const label = job.kind === "copy" ? "Copy" : job.kind === "move" ? "Move" : "Zip";
            return (
              <li key={job.id} className="transfer-panel__job">
                <div className="transfer-panel__job-header">
                  <span className="transfer-panel__job-kind">{label}</span>
                  <span className="transfer-panel__job-name" title={job.source}>{job.name}</span>
                  <StatusBadge status={job.status} />
                </div>
                <div className="transfer-panel__job-meta">
                  <span className="transfer-panel__job-size">
                    {job.total > 0
                      ? `${formatFileSize(job.copied)} / ${formatFileSize(job.total)}`
                      : formatFileSize(job.copied)}
                  </span>
                  <span className="transfer-panel__job-dest" title={job.dest}>{job.dest}</span>
                </div>
                <div className="transfer-panel__track">
                  <div
                    className="transfer-panel__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
