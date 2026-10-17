import type { Metadata } from "next";
import "../src/index.css";

export const metadata: Metadata = {
  title: {
    default: "ROYAL EQUINE | Luxury Equestrian Atelier in Kuwait",
    template: "%s | ROYAL EQUINE",
  },
  description:
    "Discover premium horse equipment, rider apparel, horse care, veterinary first-aid supplies, and equine supplements from ROYAL EQUINE Kuwait.",
  openGraph: {
    title: "ROYAL EQUINE | Luxury Equestrian Atelier in Kuwait",
    description:
      "A curated collection for horses and riders, with complimentary VIP delivery across Kuwait.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
