import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skillcase Lead Intelligence",
  description: "Turns messy B2C nurse leads into a clean, prioritized sales list."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Outfit:wght@360;420;530;650&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
