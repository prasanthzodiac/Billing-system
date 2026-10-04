import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velmayil Ventures Billing",
  description: "Velmayil Ventures billing, inventory, and receivables workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
