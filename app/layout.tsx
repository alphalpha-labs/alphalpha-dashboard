import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alphalpha Command Center",
  description: "Chief-of-staff dashboard for open loops, projects, investing signals, and syntheses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
