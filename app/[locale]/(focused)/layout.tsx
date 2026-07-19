import type { ReactNode } from "react";

export default function FocusedLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-background">{children}</div>;
}
