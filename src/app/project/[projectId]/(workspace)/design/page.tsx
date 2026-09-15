"use client";

import { useParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { useProjectStore } from "@/lib/store/project-store";

export default function UiDesignPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const design = active?.artifacts.uiDesign ?? null;

  if (!design) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">UI Design</h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="uiDesign" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Product
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">UI Design</h1>
          {design.overview && (
            <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
              {design.overview}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="primary">{design.screens.length} layar</Badge>
            <Badge tone="neutral">{design.components.length} komponen</Badge>
            <Badge tone="neutral">{design.colorTokens.length} color token</Badge>
            {design.themeMode && <Badge tone="outline">{design.themeMode}</Badge>}
          </div>
        </header>

        {design.styleDirection && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Arah visual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[13px] leading-relaxed text-foreground-soft">
                {design.styleDirection}
              </p>
              {design.creativeConcept && (
                <p className="text-[13px] leading-relaxed text-foreground-soft">
                  <span className="font-medium text-foreground">Konsep: </span>
                  {design.creativeConcept}
                </p>
              )}
              {design.creativeRationale && (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {design.creativeRationale}
                </p>
              )}
              {design.principles.length > 0 && (
                <ul className="space-y-1.5">
                  {design.principles.map((principle) => (
                    <li
                      key={principle}
                      className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                      {principle}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {design.signatureMoments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Signature moments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {design.signatureMoments.map((moment) => (
                <div key={moment.name} className="rounded-card border border-border px-4 py-3">
                  <p className="text-[13px] font-medium text-foreground">{moment.name}</p>
                  {moment.description && (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {moment.description}
                    </p>
                  )}
                  {moment.screenIds.length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {moment.screenIds.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {design.approvedDependencies.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Approved UI dependencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {design.approvedDependencies.map((dependency) => (
                <div
                  key={dependency.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface-muted px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{dependency.name}</p>
                    {dependency.purpose && (
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        {dependency.purpose}
                      </p>
                    )}
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={dependency.source === "user-selected" ? "primary" : "outline"}>
                      {dependency.source === "user-selected" ? "User Selected" : "Recommended"}
                    </Badge>
                    {dependency.platforms.map((platform) => (
                      <Badge key={platform} tone="neutral">
                        {platform}
                      </Badge>
                    ))}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {design.platformProfiles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Platform profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {design.platformProfiles.map((profile) => (
                <div key={profile.platform} className="rounded-card border border-border px-4 py-3">
                  <p className="text-[13px] font-medium text-foreground">{profile.platform}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {profile.navigation}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {profile.units} · {profile.safeAreas} · {profile.resizing}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Input: {profile.inputModes.join(", ")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {design.colorTokens.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Color tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {design.colorTokens.map((token) => (
                  <li
                    key={token.name}
                    className="flex items-start gap-3 rounded-card border border-border bg-surface-muted px-3 py-2"
                  >
                    <span
                      className="mt-0.5 size-5 shrink-0 rounded-sm border border-border-strong"
                      style={{ backgroundColor: token.value }}
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] text-foreground">
                        {token.name}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {token.value}
                      </span>
                      {token.usage && (
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                          {token.usage}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {design.typographyScale.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Size</TableHeaderCell>
                    <TableHeaderCell>Weight</TableHeaderCell>
                    <TableHeaderCell>Line height</TableHeaderCell>
                    <TableHeaderCell>Usage</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {design.typographyScale.map((token) => (
                    <TableRow key={token.role}>
                      <TableCell className="text-foreground">{token.role}</TableCell>
                      <TableCell className="font-mono text-[12px]">{token.size}</TableCell>
                      <TableCell className="font-mono text-[12px]">{token.weight}</TableCell>
                      <TableCell className="font-mono text-[12px]">{token.lineHeight}</TableCell>
                      <TableCell className="text-muted-foreground">{token.usage || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { title: "Spacing", tokens: design.spacingScale },
            { title: "Radius", tokens: design.radiusTokens },
            { title: "Shadow", tokens: design.shadowTokens },
          ]
            .filter((group) => group.tokens.length > 0)
            .map((group) => (
              <Card key={group.title}>
                <CardHeader className="pb-3">
                  <CardTitle>{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.tokens.map((token) => (
                    <div key={token.name} className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[12px] text-foreground">{token.name}</span>
                      <span className="font-mono text-[12px] text-muted-foreground">
                        {token.value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>

        {(design.layout.shell ||
          design.layout.navigation ||
          design.layout.grid ||
          design.layout.breakpoints.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Layout system</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {design.layout.shell && (
                <p className="text-[13px] leading-relaxed text-foreground-soft">
                  <span className="font-medium text-foreground">Shell: </span>
                  {design.layout.shell}
                </p>
              )}
              {design.layout.navigation && (
                <p className="text-[13px] leading-relaxed text-foreground-soft">
                  <span className="font-medium text-foreground">Navigation: </span>
                  {design.layout.navigation}
                </p>
              )}
              {design.layout.grid && (
                <p className="text-[13px] leading-relaxed text-foreground-soft">
                  <span className="font-medium text-foreground">Grid: </span>
                  {design.layout.grid}
                </p>
              )}
              {design.layout.breakpoints.length > 0 && (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Breakpoint</TableHeaderCell>
                      <TableHeaderCell>Width</TableHeaderCell>
                      <TableHeaderCell>Behaviour</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {design.layout.breakpoints.map((breakpoint) => (
                      <TableRow key={breakpoint.name}>
                        <TableCell className="text-foreground">{breakpoint.name}</TableCell>
                        <TableCell className="font-mono text-[12px]">{breakpoint.width}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {breakpoint.behavior || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {design.components.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Component inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {design.components.map((component) => (
                <div
                  key={component.name}
                  className="rounded-card border border-border bg-surface-muted px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground">{component.name}</p>
                    {component.variants.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {component.variants.map((variant) => (
                          <span
                            key={variant}
                            className="rounded-pill border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {variant}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {component.purpose && (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {component.purpose}
                    </p>
                  )}
                  {component.states.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground-soft">States: </span>
                      {component.states.join(", ")}
                    </p>
                  )}
                  {component.rules.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {component.rules.map((rule) => (
                        <li key={rule} className="text-[12px] leading-relaxed text-muted-foreground">
                          · {rule}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {design.screens.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Screens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {design.screens.map((screen) => (
                <div key={screen.id} className="rounded-card border border-border px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-semibold tracking-tight text-foreground">
                        {screen.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {screen.featureId || "shared screen"}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      {screen.states.map((state) => (
                        <Badge key={state} tone="outline">
                          {state}
                        </Badge>
                      ))}
                    </span>
                  </div>

                  {screen.purpose && (
                    <p className="mt-2 text-[13px] leading-relaxed text-foreground-soft">
                      {screen.purpose}
                    </p>
                  )}

                  {screen.layout.length > 0 && (
                    <ol className="mt-3 space-y-1.5">
                      {screen.layout.map((region, index) => (
                        <li
                          key={`${region}-${index}`}
                          className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground"
                        >
                          <span className="font-mono text-faint-foreground">{index + 1}.</span>
                          {region}
                        </li>
                      ))}
                    </ol>
                  )}

                  {screen.components.length > 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground-soft">Components: </span>
                      {screen.components.join(", ")}
                    </p>
                  )}

                  {screen.responsive.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {screen.responsive.map((item) => (
                        <li key={item} className="text-[12px] leading-relaxed text-muted-foreground">
                          Responsive: {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {screen.sampleContent.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {screen.sampleContent.map((item) => (
                        <li
                          key={item}
                          className="rounded-control bg-surface-muted px-2.5 py-1.5 text-[12px] leading-relaxed text-muted-foreground"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { title: "Interaction", rules: design.interactionRules },
            { title: "Accessibility", rules: design.accessibilityRules },
            { title: "Content", rules: design.contentRules },
            { title: "Anti-patterns", rules: design.antiPatterns },
            { title: "Visual QA", rules: design.visualQaRules },
          ]
            .filter((group) => group.rules.length > 0)
            .map((group) => (
              <Card key={group.title}>
                <CardHeader className="pb-3">
                  <CardTitle>{group.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {group.rules.map((rule) => (
                      <li key={rule} className="text-[12px] leading-relaxed text-muted-foreground">
                        · {rule}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel
          artifact="uiDesign"
          extra={
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Layar</span>
                <span className="text-foreground-soft">{design.screens.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Komponen</span>
                <span className="text-foreground-soft">{design.components.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Token</span>
                <span className="text-foreground-soft">
                  {design.colorTokens.length +
                    design.typographyScale.length +
                    design.spacingScale.length +
                    design.radiusTokens.length +
                    design.shadowTokens.length}
                </span>
              </div>
            </>
          }
        />
        <Alert tone="info">
          File ini di-export sebagai <code className="font-mono text-[12px]">docs/ui-design.md</code>{" "}
          dan dirujuk oleh setiap task frontend serta AGENTS.md.
        </Alert>
      </aside>
    </div>
  );
}
