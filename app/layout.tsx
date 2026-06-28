import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "European Physician Workforce Crisis Monitor",
  description:
    "Interactive European health workforce intelligence platform built using Eurostat indicators.",
  openGraph: {
    title: "European Physician Workforce Crisis Monitor",
    description:
      "Evidence-driven dashboards for physician workforce monitoring across Europe.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Professional dashboard typography */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>

      <body>{children}</body>
    </html>
  );
}
