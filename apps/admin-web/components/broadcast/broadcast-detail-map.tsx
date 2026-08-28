"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const mapHeight = 360;
const tileSize = 256;

function worldPoint(latitude: number, longitude: number, zoom: number) {
  const worldSize = tileSize * 2 ** zoom;
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const latitudeRadians = (boundedLatitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians))) / (4 * Math.PI)) * worldSize,
  };
}

export function BroadcastDetailMap({ latitude, longitude, location, radiusMeters }: {
  latitude: number | null;
  longitude: number | null;
  location: string;
  radiusMeters: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(280, Math.round(element.getBoundingClientRect().width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const map = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    const zoom = radiusMeters && radiusMeters > 10000 ? 11 : radiusMeters && radiusMeters > 3000 ? 13 : 15;
    const point = worldPoint(latitude, longitude, zoom);
    const originX = point.x - width / 2;
    const originY = point.y - mapHeight / 2;
    const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
    const tileCount = 2 ** zoom;
    for (let tileY = Math.floor(originY / tileSize); tileY <= Math.floor((originY + mapHeight) / tileSize); tileY += 1) {
      if (tileY < 0 || tileY >= tileCount) continue;
      for (let tileX = Math.floor(originX / tileSize); tileX <= Math.floor((originX + width) / tileSize); tileX += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push({ key: `${zoom}-${tileX}-${tileY}`, url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`, left: tileX * tileSize - originX, top: tileY * tileSize - originY });
      }
    }
    return { tiles };
  }, [latitude, longitude, radiusMeters, width]);

  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="font-semibold text-ink">Target location</h2>
        <p className="mt-1 break-words text-sm text-muted">{location}</p>
      </div>
      <div ref={mapRef} className="relative min-h-[360px] overflow-hidden rounded-lg border border-line bg-surfaceMuted" aria-label="Broadcast target map">
        {map ? (
          <>
            {map.tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" aria-hidden="true" className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} />)}
            <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-danger/25 shadow-soft" aria-hidden="true" />
            <div className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-danger text-xs font-bold text-white shadow-soft" aria-label="Broadcast target marker">!</div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">A geographic target was not captured for this broadcast.</div>
        )}
        <div className="absolute bottom-1 left-1 rounded bg-surface/95 px-2 py-1 text-xs text-ink shadow-sm">
          {radiusMeters ? `Delivery radius: ${(radiusMeters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : "Geographic scope follows the saved target"}
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-1 right-1 bg-surface/95 px-1.5 py-0.5 text-[10px] text-ink hover:underline">© OpenStreetMap contributors</a>
      </div>
    </section>
  );
}
