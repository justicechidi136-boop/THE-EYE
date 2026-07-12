import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND_ASSETS } from "../lib/brand";

export function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-field px-4 py-10">
      <div className="w-full max-w-[454px] rounded-lg border border-line bg-surface px-6 py-8 shadow-soft">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src={BRAND_ASSETS.lockupDarkBg}
            alt="THE EYE"
            width={320}
            height={96}
            priority
            className="h-20 w-auto max-w-full object-contain"
          />
          {children}
        </div>
      </div>
    </div>
  );
}
