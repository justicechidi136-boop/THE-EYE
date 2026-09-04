"use client";

import { useState } from "react";
import type { BroadcastDetailView } from "../../lib/types/admin-views";
import type { AdminEvidenceItem } from "../../lib/admin-media";
import { formatBroadcastDate } from "../../lib/broadcast-detail-presentation";
import { ConsoleEmptyState } from "../console";
import { StatusBadge } from "../ui";
import { BroadcastDetailMap } from "./broadcast-detail-map";
import { BroadcastEvidenceGallery } from "./broadcast-evidence-gallery";

type Sighting = NonNullable<BroadcastDetailView["sightings"]>[number];

function galleryItems(items: Sighting["attachments"]): AdminEvidenceItem[] {
  return items.map((item) => ({
    id: item.id,
    type: item.mediaType === "image" ? "Image" : item.mediaType === "video" ? "Video" : item.mediaType === "audio" ? "Audio" : "Media",
    label: item.label,
    contentType: item.contentType,
    url: item.url,
  }));
}

function distanceKilometres(fromLat: number | null, fromLng: number | null, sighting: Sighting) {
  if (fromLat == null || fromLng == null || sighting.latitude == null || sighting.longitude == null) return null;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(sighting.latitude - fromLat);
  const longitudeDelta = toRadians(sighting.longitude - fromLng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(sighting.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function reviewTone(status: Sighting["reviewStatus"]): "success" | "danger" | "warning" | "neutral" {
  if (status === "Verified") return "success";
  if (status === "Dismissed") return "danger";
  if (status === "Unverified") return "neutral";
  return "warning";
}

function SightingDialog({ broadcastId, sighting, distance, onClose }: {
  broadcastId: string;
  sighting: Sighting;
  distance: number | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sighting-dialog-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase text-eye">Sighting review</p><h2 id="sighting-dialog-title" className="mt-1 text-xl font-semibold text-ink">Sighting details</h2></div>
          <button type="button" onClick={onClose} aria-label="Close sighting details" className="grid h-9 w-9 place-items-center rounded-md border border-line text-xl text-ink hover:border-eye">×</button>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Reported by", sighting.reporter],
            ["Review status", sighting.reviewStatus],
            ["Sighting occurred", formatBroadcastDate(sighting.observedAt)],
            ["Reported", formatBroadcastDate(sighting.reportedAt)],
          ].map(([label, value]) => <div key={label} className="border-l-2 border-eye bg-surfaceMuted px-3 py-2"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words font-semibold text-ink">{value}</dd></div>)}
        </dl>
        <div className="mt-3 border-l-2 border-eye bg-surfaceMuted px-3 py-2 text-sm"><p className="text-xs text-muted">Location</p><p className="mt-1 break-words font-semibold text-ink">{sighting.approximateArea ?? "Location not provided"}{distance == null ? "" : ` · ~${distance.toFixed(1)} km from last-known location`}</p></div>
        <p className="mt-4 whitespace-pre-wrap break-words rounded-md border border-line bg-surfaceMuted p-4 text-sm leading-6 text-ink">{sighting.description}</p>
        {sighting.reviewNote ? <p className="mt-3 text-sm text-muted"><strong className="text-ink">Review note:</strong> {sighting.reviewNote}</p> : null}
        <div className="mt-5"><BroadcastEvidenceGallery broadcastId={broadcastId} title="Sighting evidence — separate from the original broadcast evidence" items={galleryItems(sighting.attachments)} /></div>
      </section>
    </div>
  );
}

export function BroadcastSightingsSection({ broadcast }: { broadcast: BroadcastDetailView }) {
  const [selected, setSelected] = useState<Sighting | null>(null);
  if (broadcast.type !== "MissingPerson" && broadcast.type !== "StolenVehicle") return null;
  const sightings = broadcast.sightings ?? [];
  const markers = sightings.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({
    id: item.id,
    latitude: item.latitude!,
    longitude: item.longitude!,
    label: item.approximateArea ?? "Reported sighting",
  }));
  return <>
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">{broadcast.type === "StolenVehicle" ? "Vehicle sightings" : "Sightings"}</h2><p className="mt-1 text-sm text-muted">Reports are reviewed independently from the original broadcast evidence.</p></div><StatusBadge tone={sightings.length ? "info" : "neutral"}>{sightings.length} reported</StatusBadge></div>
      {markers.length ? <div className="mt-4"><BroadcastDetailMap title="Sighting locations" description="Last-known location and reported sightings" latitude={broadcast.targetLatitude} longitude={broadcast.targetLongitude} location={broadcast.location} radiusMeters={broadcast.targetRadiusMeters} markers={markers} showOpenLocation={false} embedded /></div> : null}
      {!sightings.length ? <div className="mt-4"><ConsoleEmptyState title="No sightings yet" detail="New authorized sightings will appear here." /></div> : <div className="mt-4 grid gap-3">{sightings.map((sighting, index) => {
        const distance = distanceKilometres(broadcast.targetLatitude, broadcast.targetLongitude, sighting);
        return <article id={`sighting-${sighting.id}`} key={sighting.id} className="border-l-2 border-eye bg-surfaceMuted p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-ink">Sighting #{index + 1}</p><p className="mt-1 text-xs text-muted">Reported {formatBroadcastDate(sighting.reportedAt)} · Occurred {formatBroadcastDate(sighting.observedAt)}</p></div><StatusBadge tone={reviewTone(sighting.reviewStatus)}>{sighting.reviewStatus}</StatusBadge></div>
          <p className="mt-2 break-words text-xs text-muted">{sighting.approximateArea ?? "Location not provided"}{distance == null ? "" : ` · ~${distance.toFixed(1)} km from last-known location`}</p>
          <p className="mt-3 line-clamp-3 break-words text-sm text-ink">“{sighting.description}”</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>{sighting.attachmentsCount ? `${sighting.attachmentsCount} media attachment${sighting.attachmentsCount === 1 ? "" : "s"}` : "No media attached"}</span><button type="button" onClick={() => setSelected(sighting)} className="rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:opacity-90">Review sighting</button></div>
        </article>;
      })}</div>}
    </section>
    {selected ? <SightingDialog broadcastId={broadcast.id} sighting={selected} distance={distanceKilometres(broadcast.targetLatitude, broadcast.targetLongitude, selected)} onClose={() => setSelected(null)} /> : null}
  </>;
}
