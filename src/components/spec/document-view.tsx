import { InlineText } from "./inline-text";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { DocBlock, SpecDocument } from "@/lib/schemas";

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="text-[14px] leading-[1.75] text-foreground-soft">
          <InlineText text={block.text} />
        </p>
      );
    case "bullets":
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-[14px] leading-[1.7] text-foreground-soft">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary-border" />
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2">
          {block.items.map((item, index) => (
            <li key={item} className="flex gap-3 text-[14px] leading-[1.7] text-foreground-soft">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-[11px] font-medium text-muted-foreground">
                {index + 1}
              </span>
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-hidden rounded-card border border-border">
          <Table>
            <TableHead>
              <TableRow>
                {block.columns.map((column) => (
                  <TableHeaderCell key={column}>{column}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <InlineText text={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case "callout":
      return (
        <div
          className={
            block.tone === "warning"
              ? "rounded-card border border-warning-border bg-warning-soft px-4 py-3 text-[13px] leading-relaxed text-foreground-soft"
              : "rounded-card border border-primary-border bg-primary-soft px-4 py-3 text-[13px] leading-relaxed text-foreground-soft"
          }
        >
          <InlineText text={block.text} />
        </div>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-card border border-border bg-surface-muted p-4 font-mono text-[12px] leading-relaxed text-foreground-soft">
          {block.code}
        </pre>
      );
  }
}

export function DocumentView({ document, withIds = true }: { document: SpecDocument; withIds?: boolean }) {
  return (
    <article className="space-y-9">
      {document.summary && (
        <p className="text-[14px] leading-[1.75] text-muted-foreground">
          <InlineText text={document.summary} />
        </p>
      )}
      {document.sections.map((section) => (
        <section key={section.id} id={withIds ? section.id : undefined} className="scroll-mt-24">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            {section.title}
          </h2>
          <div className="mt-3 space-y-3.5">
            {section.blocks.map((block, index) => (
              <Block key={`${section.id}-${index}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

export function DocumentOutline({ document }: { document: SpecDocument }) {
  return (
    <ol className="space-y-1.5">
      {document.sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="block truncate text-[13px] text-muted-foreground transition-colors hover:text-primary"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}
