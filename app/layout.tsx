import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "J.A.R.V.I.S. Cyber Security Portal",
  description: "Futuristic Biometric & Passkey Authentication Suite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#030a16] text-[#00f3ff] antialiased selection:bg-[#00f3ff] selection:text-[#030a16]">
        {children}
      </body>
    </html>
  );
}