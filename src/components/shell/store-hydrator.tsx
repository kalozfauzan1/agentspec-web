"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { useSettingsStore } from "@/lib/store/settings-store";

/**
 * Loads local settings and the local project index once per session.
 * When nothing has been configured in the browser yet, the server-side
 * provider configuration becomes the default so the app works out of the box.
 */
export function StoreHydrator() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      useSettingsStore.getState().hydrate();
      const store = useSettingsStore.getState();

      try {
        const response = await fetch("/api/ai/status");
        if (response.ok) {
          const status = (await response.json()) as {
            configured: boolean;
            baseUrl: string;
            model: string;
            mode: "live" | "demo";
          };
          store.adoptServerDefaults({
            baseUrl: status.baseUrl,
            model: status.model,
            mode: status.configured ? "live" : "demo",
          });
        }
      } catch {
        // Offline or SSR: keep whatever is already configured.
      }

      await useProjectStore.getState().hydrate();
      if (!cancelled) setReady(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  void ready;
  return null;
}
