"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, PlugZap, RotateCcw } from "lucide-react";
import { AppHeader } from "@/components/shell/app-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useSettingsStore } from "@/lib/store/settings-store";

interface ServerStatus {
  configured: boolean;
  baseUrl: string;
  model: string;
  mode: "live" | "demo";
}

export default function SettingsPage() {
  const { settings, updateProvider, resetProvider } = useSettingsStore();
  const provider = settings.provider;

  const [server, setServer] = useState<ServerStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((response) => response.json())
      .then((data: ServerStatus) => setServer(data))
      .catch(() => setServer(null));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      // Only override the server configuration when the user filled it in here;
      // otherwise the credentials from the environment are used.
      if (provider.apiKey.trim()) {
        headers["x-agentspec-base-url"] = provider.baseUrl;
        headers["x-agentspec-api-key"] = provider.apiKey;
        headers["x-agentspec-model"] = provider.model;
      }

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "live",
          idea: "Aplikasi sederhana untuk mencatat daftar belanja harian keluarga.",
        }),
      });
      const payload = (await response.json()) as { error?: string; analysis?: unknown };
      if (!response.ok) {
        setTestResult({ ok: false, message: payload.error ?? `Provider menolak (${response.status}).` });
      } else if (!payload.analysis) {
        setTestResult({ ok: false, message: "Provider menjawab, tetapi hasilnya tidak sesuai skema." });
      } else {
        setTestResult({ ok: true, message: "Koneksi berhasil. Model merespons sesuai skema." });
      }
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : "Tes koneksi gagal.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader
        right={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft />
              Kembali
            </Link>
          </Button>
        }
        subtitle="Pengaturan AI provider"
      />

      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Pengaturan disimpan di browser ini saja. API key tidak pernah ditulis ke project dan tidak
          ikut ter-export.
        </p>

        <Card className="mt-7">
          <CardHeader>
            <CardTitle>Mode generation</CardTitle>
            <CardDescription>
              Mode Demo memakai generator bawaan tanpa memanggil AI, berguna untuk mencoba alur dan
              export. Mode Live memanggil provider OpenAI-compatible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updateProvider({ mode: "demo" })}
                className={`rounded-card border px-4 py-3 text-left transition-colors ${
                  provider.mode === "demo"
                    ? "border-primary-border bg-primary-soft"
                    : "border-border bg-surface hover:bg-surface-muted"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  Mode Demo
                  {provider.mode === "demo" && <Badge tone="primary">aktif</Badge>}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                  Hasil diturunkan dari idemu secara deterministik. Tanpa biaya, tanpa API key.
                </span>
              </button>

              <button
                type="button"
                onClick={() => updateProvider({ mode: "live" })}
                className={`rounded-card border px-4 py-3 text-left transition-colors ${
                  provider.mode === "live"
                    ? "border-primary-border bg-primary-soft"
                    : "border-border bg-surface hover:bg-surface-muted"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  Mode Live
                  {provider.mode === "live" && <Badge tone="success">aktif</Badge>}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                  Memanggil provider AI untuk analisis, klarifikasi, dan seluruh dokumen.
                </span>
              </button>
            </div>

            {server && (
              <Alert tone={server.configured ? "success" : "info"} title="Konfigurasi server">
                {server.configured ? (
                  <>
                    Server sudah punya kredensial dari environment. Model default{" "}
                    <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                      {server.model}
                    </code>{" "}
                    pada <span className="break-all">{server.baseUrl}</span>. Isi kolom di bawah hanya
                    bila ingin menimpa dari browser.
                  </>
                ) : (
                  <>
                    Belum ada kredensial di server. Isi kolom di bawah, atau set{" "}
                    <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                      AI_API_KEY
                    </code>{" "}
                    di <code className="font-mono text-[12px]">.env.local</code>.
                  </>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Provider</CardTitle>
            <CardDescription>
              Endpoint harus kompatibel dengan OpenAI <code className="font-mono">/chat/completions</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                value={provider.baseUrl}
                onChange={(event) => updateProvider({ baseUrl: event.target.value })}
                placeholder="https://9router.nalarlabs.tech/v1"
                disabled={provider.mode === "demo"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={provider.apiKey}
                onChange={(event) => updateProvider({ apiKey: event.target.value })}
                placeholder="sk-…"
                disabled={provider.mode === "demo"}
              />
              <FieldHint>
                Dikirim hanya ke route server milik aplikasi ini, lalu diteruskan ke provider.
              </FieldHint>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={provider.model}
                onChange={(event) => updateProvider({ model: event.target.value })}
                placeholder="first"
                disabled={provider.mode === "demo"}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                onClick={handleTest}
                disabled={testing || !provider.baseUrl || (!provider.apiKey && !server?.configured)}
              >
                {testing ? <Spinner /> : <PlugZap />}
                Tes koneksi
              </Button>
              <Button variant="outline" onClick={resetProvider}>
                <RotateCcw />
                Reset
              </Button>
            </div>

            {testResult && (
              <Alert tone={testResult.ok ? "success" : "danger"}>
                <span className="flex items-center gap-2">
                  {testResult.ok && <CheckCircle2 className="size-4 text-success" />}
                  {testResult.message}
                </span>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Bahasa</CardTitle>
            <CardDescription>
              Cara AgentSpec berkomunikasi denganmu berbeda dari bahasa dokumen hasil generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] leading-relaxed text-foreground-soft">
            <p>
              <span className="font-medium text-foreground">Pertanyaan &amp; ringkasan perubahan:</span>{" "}
              Bahasa Indonesia, supaya enak dibaca.
            </p>
            <p>
              <span className="font-medium text-foreground">Dokumen hasil generate:</span> selalu English
              (PRD, feature spec, architecture, data model, API, task, AGENTS.md) supaya coding agent
              menerima istilah yang konsisten.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
