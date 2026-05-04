import { useEffect, useState } from "react";
import { MemoryUsage } from "./wails";

export default function MemoryBar() {
  const [mem, setMem] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    async function load() {
      const data = await MemoryUsage();
      setMem({ used: data.used ?? 0, total: data.total ?? 0 });
    }
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, []);

  if (!mem || !mem.total) return null;

  const pct = Math.min(100, (mem.used / mem.total) * 100);
  const usedGB = (mem.used / 1e9).toFixed(1);
  const totalGB = Math.round(mem.total / 1e9);
  const color = pct > 85 ? "var(--color-error)" : pct > 65 ? "var(--color-warning)" : "var(--color-info)";

  return (
    <div className="memory-bar">
      <div className="memory-bar__track">
        <div className="memory-bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="memory-bar__label">
        <span>RAM</span>
        <span>{usedGB} / {totalGB} GB</span>
      </div>
    </div>
  );
}
