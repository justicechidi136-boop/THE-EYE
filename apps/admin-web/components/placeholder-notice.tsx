type PlaceholderNoticeProps = {
  title: string;
  endpoint: string;
  note: string;
};

export function PlaceholderNotice({ title, endpoint, note }: PlaceholderNoticeProps) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-surfaceMuted px-4 py-3 text-sm text-muted">
      <span className="font-semibold text-ink">{title}</span> — waiting on <code className="text-xs">{endpoint}</code>. {note}
    </p>
  );
}
