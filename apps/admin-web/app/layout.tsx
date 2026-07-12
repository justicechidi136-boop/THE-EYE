import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";
import { BRAND_ASSETS } from "../lib/brand";
import "./styles.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THE EYE Admin",
  description: "Public safety command dashboard",
  icons: {
    icon: [
      { url: BRAND_ASSETS.appIconDarkGreen, type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: BRAND_ASSETS.appIconWhite,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={montserrat.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
