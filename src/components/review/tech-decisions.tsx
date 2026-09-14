"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import {
  DECISION_SOURCE_LABEL,
  type DecisionSource,
  type TechDecision,
} from "@/lib/schemas";

const SOURCE_TONES: Record<DecisionSource, "success" | "primary" | "neutral"> = {
  "user-selected": "success",
  recommended: "primary",
  undecided: "neutral",
};

export function DecisionSourceBadge({ source }: { source: DecisionSource }) {
  return <Badge tone={SOURCE_TONES[source]}>{DECISION_SOURCE_LABEL[source]}</Badge>;
}

export function TechDecisionsEditor({
  decisions,
  onChange,
}: {
  decisions: TechDecision[];
  onChange: (decisions: TechDecision[]) => void;
}) {
  const update = (index: number, patch: Partial<TechDecision>) => {
    const next = decisions.map((decision, position) => {
      if (position !== index) return decision;
      const merged = { ...decision, ...patch };
      // An undecided component must never carry a technology (PRD §17).
      if (merged.source === "undecided") merged.technology = null;
      return merged;
    });
    onChange(next);
  };

  const add = () =>
    onChange([
      ...decisions,
      {
        component: "Komponen baru",
        technology: null,
        source: "undecided",
        rationale: "",
        alternatives: [],
      },
    ]);

  return (
    <div className="space-y-3">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-[26%]">Component</TableHeaderCell>
            <TableHeaderCell className="w-[34%]">Technology</TableHeaderCell>
            <TableHeaderCell className="w-[28%]">Source</TableHeaderCell>
            <TableHeaderCell className="w-[12%]" />
          </TableRow>
        </TableHead>
        <TableBody>
          {decisions.map((decision, index) => (
            <TableRow key={`${decision.component}-${index}`}>
              <TableCell>
                <Input
                  value={decision.component}
                  onChange={(event) => update(index, { component: event.target.value })}
                  className="h-9"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={decision.technology ?? ""}
                  onChange={(event) => update(index, { technology: event.target.value })}
                  placeholder={decision.source === "undecided" ? "Belum diputuskan" : "Nama teknologi"}
                  disabled={decision.source === "undecided"}
                  className="h-9"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={decision.source}
                  onChange={(event) =>
                    update(index, { source: event.target.value as DecisionSource })
                  }
                  className="h-9"
                >
                  <option value="user-selected">User Selected</option>
                  <option value="recommended">Recommended</option>
                  <option value="undecided">Undecided</option>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus komponen"
                  onClick={() => onChange(decisions.filter((_, position) => position !== index))}
                >
                  <Trash2 className="text-danger" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button variant="outline" size="sm" onClick={add}>
        <Plus />
        Tambah komponen
      </Button>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">User Selected</strong> berarti kamu yang memilih.{" "}
        <strong className="font-medium text-foreground">Recommended</strong> berarti usulan AgentSpec.{" "}
        <strong className="font-medium text-foreground">Undecided</strong> berarti belum diputuskan dan
        tidak akan diisi teknologi apa pun.
      </p>
    </div>
  );
}
