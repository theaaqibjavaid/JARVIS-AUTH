"use client";

import { AuthProvider } from "./context/AuthContext";
import { CanvasBackground } from "./components/CanvasBackground";
import { AuthPortal } from "./components/AuthPortal";
import type { AuthAdapterName } from "./lib/auth-adapter";

function resolveAdapter(): AuthAdapterName {
  if (typeof process === "undefined") return "mock";
  const raw = process.env.NEXT_PUBLIC_AUTH_ADAPTER as string | undefined;
  if (raw === "backend" || raw === "firebase" || raw === "mock") return raw;
  return "mock";
}

export default function JarvisAuthPage() {
  const adapter = resolveAdapter();
  const baseUrl =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_AUTH_API_URL
      : undefined;

  return (
    <AuthProvider
      adapter={adapter}
      adapterOptions={baseUrl ? { baseUrl } : undefined}
    >
      <CanvasBackground />
      <AuthPortal />
    </AuthProvider>
  );
}
