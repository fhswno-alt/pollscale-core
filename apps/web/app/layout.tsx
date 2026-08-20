import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";

import { Nav } from "@/components/Nav";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: {
    default: "Pollscale",
    template: "%s · Pollscale",
  },
  description: "One poll at a time. Vote or skip, see the split, next.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <div className="shell">
          <header className="top">
            <Link href="/" className="brand">
              <span className="bars" aria-hidden />
              Pollscale
            </Link>
            <Nav />
          </header>
          {children}
          <footer>
            <p>
              Questions: <a href="mailto:support@pollscale.com">support@pollscale.com</a>
              {" · "}
              <a href="mailto:legal@pollscale.com">legal@pollscale.com</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
