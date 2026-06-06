import { ReactNode } from "react";
import { Construction } from "lucide-react";

export function StubPage({ title, blurb, children }: { title: string; blurb: string; children?: ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="aw-panel max-w-md rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur p-6 text-center">
        <Construction className="mx-auto h-7 w-7 text-primary mb-3" />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>
        {children}
      </div>
    </div>
  );
}
