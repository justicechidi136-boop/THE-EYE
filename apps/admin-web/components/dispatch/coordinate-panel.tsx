type CoordinateRow = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  stale?: boolean;
  navigationUrl: string;
};

export function CoordinatePanel({ rows, title }: { rows: CoordinateRow[]; title: string }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No live coordinates available.</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border p-3 text-sm">
            <div className="font-medium">{row.label}</div>
            <div>
              {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
              {row.stale ? " · stale" : ""}
            </div>
            <a className="text-primary underline" href={row.navigationUrl} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Embedded map visualization is BLOCKED until an approved map provider is configured. Coordinates are live API data.
      </p>
    </div>
  );
}

export function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
