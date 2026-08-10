"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type PairingQrCodeProps = {
  value: string;
  size?: number;
};

/**
 * Renders a QR code entirely client-side (no network calls) so the one-time pairing token
 * embedded in `value` is never sent to a third-party QR image service.
 */
export function PairingQrCode({ value, size = 220 }: PairingQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);
    if (!value) return;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((qrError: unknown) => {
        if (!cancelled) setError(qrError instanceof Error ? qrError.message : "Failed to render QR code");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value) return null;

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-danger/30 bg-danger/10 p-3 text-center text-xs text-danger"
        style={{ width: size, height: size }}
      >
        {error}
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-line bg-surfaceMuted"
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-muted">Generating QR…</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data: URL is not supported by next/image
    <img
      src={dataUrl}
      alt="Field device pairing QR code"
      width={size}
      height={size}
      className="rounded-md border border-line bg-white p-2"
    />
  );
}
