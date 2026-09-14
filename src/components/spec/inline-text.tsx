import * as React from "react";

/**
 * Renders the light inline markup that AI-generated specification text uses:
 * `**bold**` and `` `code` ``. Everything else is rendered as plain text so
 * unknown syntax never breaks the document view.
 */
export function InlineText({ text }: { text: string }) {
  const parts = React.useMemo(() => splitInline(text), [text]);
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "bold") {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {part.value}
            </strong>
          );
        }
        if (part.type === "code") {
          return (
            <code
              key={index}
              className="rounded-[6px] border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground-soft"
            >
              {part.value}
            </code>
          );
        }
        return <React.Fragment key={index}>{part.value}</React.Fragment>;
      })}
    </>
  );
}

type Part = { type: "text" | "bold" | "code"; value: string };

function splitInline(text: string): Part[] {
  const parts: Part[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push({ type: "bold", value: token.slice(2, -2) });
    } else {
      parts.push({ type: "code", value: token.slice(1, -1) });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}
