import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NodeFleet - Device Fleet Management",
  description: "Enterprise-grade fleet management for ESP32 IoT devices with real-time monitoring, GPS tracking, and remote command execution.",
  keywords: ["IoT", "device management", "ESP32", "GPS tracking", "fleet management"],
  authors: [{ name: "NodeFleet Team" }],
  openGraph: {
    title: "NodeFleet - Device Fleet Management",
    description: "Manage your IoT device fleet with real-time monitoring and control.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#030712" />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-slate-950 text-slate-100">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
