import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CameraMap = lazy(() =>
  import("@/components/CameraMap").then((m) => ({ default: m.CameraMap })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ALERTWest — Wildfire Camera Network" },
      {
        name: "description",
        content:
          "Live map of ALERTWest's wildfire detection cameras across the western US. Powered by the public ALERTWest API.",
      },
      { property: "og:title", content: "ALERTWest — Wildfire Camera Network" },
      {
        property: "og:description",
        content:
          "Live map of ALERTWest's wildfire detection cameras across the western US.",
      },
    ],
  }),
  component: Index,
  ssr: false,
});

function Index() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Loading map…
        </div>
      }
    >
      <CameraMap />
    </Suspense>
  );
}
