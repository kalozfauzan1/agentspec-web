"use client";

import { create } from "zustand";
import { appSettingsSchema, type AppSettings, type ProviderSettings } from "@/lib/schemas";

const STORAGE_KEY = "agentspec.settings.v1";

function readSettings(): { settings: AppSettings; stored: boolean } {
  const fallback = { settings: appSettingsSchema.parse({}), stored: false };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { settings: appSettingsSchema.parse(JSON.parse(raw)), stored: true };
  } catch {
    return fallback;
  }
}

function writeSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  hasStoredSettings: boolean;
  hydrate: () => void;
  adoptServerDefaults: (patch: Partial<ProviderSettings>) => void;
  updateProvider: (patch: Partial<ProviderSettings>) => void;
  resetProvider: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: appSettingsSchema.parse({}),
  hydrated: false,
  hasStoredSettings: false,

  hydrate: () => {
    const { settings, stored } = readSettings();
    set({ settings, hydrated: true, hasStoredSettings: stored });
  },

  /**
   * Server configuration is only a default: it is never written to localStorage,
   * so adding credentials to the environment later takes effect on the next load
   * instead of being masked by an earlier implicit default.
   */
  adoptServerDefaults: (patch) => {
    if (get().hasStoredSettings) return;
    set({ settings: { ...get().settings, provider: { ...get().settings.provider, ...patch } } });
  },

  updateProvider: (patch) => {
    const next: AppSettings = {
      ...get().settings,
      provider: { ...get().settings.provider, ...patch },
    };
    writeSettings(next);
    set({ settings: next, hasStoredSettings: true });
  },

  resetProvider: () => {
    const next: AppSettings = {
      ...get().settings,
      provider: appSettingsSchema.parse({}).provider,
    };
    writeSettings(next);
    set({ settings: next, hasStoredSettings: true });
  },
}));

/** Provider overrides sent to the server on each AI request when configured in the UI. */
export function providerOverrideHeaders(provider: ProviderSettings): Record<string, string> {
  if (provider.mode !== "live") return {};
  return {
    "x-agentspec-base-url": provider.baseUrl.trim(),
    "x-agentspec-api-key": provider.apiKey.trim(),
    "x-agentspec-model": provider.model.trim(),
  };
}
