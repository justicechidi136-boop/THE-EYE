"use client";

import type { AdminEvidenceItem } from "../../lib/admin-media";
import { EvidenceGallery } from "../admin-media";

export function BroadcastEvidenceGallery({ broadcastId, title, items }: {
  broadcastId: string;
  title: string;
  items: AdminEvidenceItem[];
}) {
  return (
    <EvidenceGallery
      title={title}
      mediaAccessPath={(mediaId) => `/api/admin/broadcasts/${broadcastId}/media/${mediaId}/view`}
      items={items}
    />
  );
}
