import type { ReactNode } from "react";
import { PlaceholderNotice } from "../placeholder-notice";

type ApiNotice = {
  title: string;
  endpoint: string;
  note: string;
};

export function CsocApiNotice({ notice }: { notice: ApiNotice }) {
  return <PlaceholderNotice title={notice.title} endpoint={notice.endpoint} note={notice.note} />;
}

export function CsocDataTable({
  columns,
  rows,
  emptyMessage = "No records found.",
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-surfaceMuted text-xs uppercase text-muted">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
