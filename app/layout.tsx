import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Penjadwalan Kuliah Otomatis",
  description: "Penjadwalan kuliah mingguan otomatis dengan solver heuristik",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
