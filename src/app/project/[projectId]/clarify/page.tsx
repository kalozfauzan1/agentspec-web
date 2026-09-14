"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, RefreshCw, SkipForward } from "lucide-react";
import { FlowHeader } from "@/components/flow/flow-shell";
import { DetectedContext } from "@/components/flow/detected-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { OptionCard } from "@/components/ui/option-card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useProjectStore } from "@/lib/store/project-store";
import type { ClarificationAnswer } from "@/lib/schemas";

export default function ClarificationPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;

  const { active, answerQuestion, buildDefinition, generateQuestions, busy, error } =
    useProjectStore();
  const [index, setIndex] = useState(0);
  const [generating, setGenerating] = useState(false);

  const questions = active?.questions ?? [];
  const analysis = active?.analysis ?? null;
  const answers = active?.answers ?? [];
  const question = questions[index];

  const currentAnswer = useMemo<ClarificationAnswer>(() => {
    if (!question) return { questionId: "", values: [], custom: "" };
    return (
      answers.find((answer) => answer.questionId === question.id) ?? {
        questionId: question.id,
        values: [],
        custom: "",
      }
    );
  }, [answers, question]);

  const answeredCount = questions.filter((entry) => {
    const answer = answers.find((candidate) => candidate.questionId === entry.id);
    return Boolean(answer && (answer.values.length > 0 || answer.custom.trim()));
  }).length;

  const progressValue = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const canContinue =
    !question || currentAnswer.values.length > 0 || currentAnswer.custom.trim().length > 0;

  const persist = async (next: ClarificationAnswer) => {
    if (!question) return;
    await answerQuestion(projectId, question.id, next);
  };

  const handleSelect = (value: string) => {
    if (!question) return;
    if (question.type === "checkbox") {
      const values = currentAnswer.values.includes(value)
        ? currentAnswer.values.filter((entry) => entry !== value)
        : [...currentAnswer.values, value];
      void persist({ ...currentAnswer, values });
    } else {
      void persist({ ...currentAnswer, values: [value] });
    }
  };

  const handleCustom = (value: string) => {
    void persist({ ...currentAnswer, custom: value });
  };

  const goNext = () => {
    if (index < questions.length - 1) setIndex(index + 1);
    else void finish();
  };

  const finish = async () => {
    setGenerating(true);
    try {
      await buildDefinition(projectId);
      router.push(`/project/${projectId}/review`);
    } catch {
      setGenerating(false);
    }
  };

  const regenerateQuestions = async () => {
    await generateQuestions(projectId);
    setIndex(0);
  };

  if (!active) return null;

  return (
    <>
      <FlowHeader
        projectName={active.definition?.name ?? active.analysis?.suggestedName ?? "Project baru"}
        idea={active.idea}
        current="clarify"
      />

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {questions.length === 0 ? (
            <Card>
              <CardContent className="space-y-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum ada pertanyaan klarifikasi untuk project ini.
                </p>
                <Button onClick={regenerateQuestions} disabled={busy}>
                  {busy ? <Spinner /> : <RefreshCw />}
                  Buat pertanyaan klarifikasi
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-primary">
                    Pertanyaan {index + 1} dari {questions.length}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {answeredCount} sudah dijawab. Boleh dilewati — AgentSpec akan memakai rekomendasi
                    untuk yang kosong.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={regenerateQuestions}
                  disabled={busy}
                  title="Buat ulang pertanyaan"
                >
                  <RefreshCw />
                  Buat ulang
                </Button>
              </div>

              <Progress value={progressValue} />

              <Card key={question.id} className="animate-enter">
                <CardHeader className="pb-3">
                  <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-foreground">
                    {question.question}
                  </h2>
                  {question.description && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {question.description}
                    </p>
                  )}
                  {question.why && (
                    <p className="mt-2 rounded-control bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                      Kenapa penting: {question.why}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {question.type === "text" ? (
                    <textarea
                      value={currentAnswer.custom}
                      onChange={(event) => handleCustom(event.target.value)}
                      rows={3}
                      className="w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                      placeholder="Tulis jawabanmu…"
                    />
                  ) : (
                    <>
                      {question.options.map((option) => (
                        <OptionCard
                          key={option.label}
                          name={question.id}
                          value={option.label}
                          label={option.label}
                          description={option.description}
                          type={question.type === "checkbox" ? "checkbox" : "radio"}
                          checked={currentAnswer.values.includes(option.label)}
                          onSelect={handleSelect}
                        />
                      ))}
                      <div className="pt-1">
                        <Input
                          value={currentAnswer.custom}
                          onChange={(event) => handleCustom(event.target.value)}
                          placeholder="Atau tulis jawaban lain…"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {error && <Alert tone="danger">{error.message}</Alert>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => (index === 0 ? router.push("/") : setIndex(index - 1))}
                  disabled={generating}
                >
                  <ArrowLeft />
                  {index === 0 ? "Kembali ke ide" : "Sebelumnya"}
                </Button>

                <div className="flex items-center gap-2">
                  {question.type !== "text" && (
                    <Button
                      variant="ghost"
                      onClick={() => (index < questions.length - 1 ? setIndex(index + 1) : void finish())}
                      disabled={generating}
                    >
                      <SkipForward />
                      Lewati
                    </Button>
                  )}
                  <Button onClick={goNext} disabled={generating || !canContinue}>
                    {generating ? <Spinner /> : null}
                    {index === questions.length - 1 ? "Lanjut ke Review" : "Berikutnya"}
                    {!generating && <ArrowRight />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <DetectedContext analysis={analysis} />
        </aside>
      </div>
    </>
  );
}
