"use client";

import { useState, type ReactNode } from "react";
import type { ActionRunnerView } from "@repo/contracts";
import { Icon } from "@repo/ui/icons";
import { useI18n } from "@/components/i18n-provider";
import { usePlatform } from "@/context/PlatformContext";
import { useAddServerModal } from "@/components/servers/add-server-modal";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/shared/OptionCard";
import { actionsApi } from "@/lib/api/actions";
import { useActionResource } from "./useActions";
import { ActionError } from "./ActionStatus";
import { RunnerCapabilities, RunnerIdentity } from "./RunnerPresentation";
import { ActionBudgetDialog } from "./ActionBudget";

type SelectedServer = { id: string; name: string };
export function RunnerDestination({
  onSaved,
  onCancel,
  renderForm,
}: {
  onSaved: (runner: ActionRunnerView) => void;
  onCancel: () => void;
  renderForm: (server: SelectedServer | undefined, onBack: () => void) => ReactNode;
}) {
  const { t } = useI18n();
  const c = t.actions.runnerSetup.destinations;
  const { selfHosted, cloudAuthUrl } = usePlatform();
  const [mode, setMode] = useState<"existing" | "temporary" | null>(null);
  const [server, setServer] = useState<SelectedServer>();
  const addServer = useAddServerModal({ initialMode: "managed" });
  if (mode === "existing")
    return renderForm(server, () => {
      setServer(undefined);
      setMode(null);
    });
  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          {mode && (
            <Button variant="ghost" size="sm" className="mb-2 -ms-3" onClick={() => setMode(null)}>
              <Icon name="arrow-left" className="rtl:rotate-180" />
              {c.back}
            </Button>
          )}
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            {mode === "temporary" ? c.temporary : t.actions.newRunner}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "temporary" ? c.temporaryHint : c.subtitle}
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          {t.actions.cancel}
        </Button>
      </header>
      {mode === "temporary" ? (
        <TemporaryRunners onSaved={onSaved} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <OptionCard
            value="existing"
            selected={false}
            onSelect={() => setMode("existing")}
            icon={<Icon name="server" className="size-5" />}
            label={c.existing}
            description={c.existingHint}
          />
          <OptionCard
            value="dedicated"
            selected={false}
            onSelect={() =>
              addServer((created) => {
                setServer({ id: created.id, name: created.name || created.sshHost || c.dedicated });
                setMode("existing");
              })
            }
            icon={<Icon name="plus" className="size-5" />}
            label={c.dedicated}
            description={c.dedicatedHint}
          />
          <OptionCard
            value="temporary"
            selected={false}
            disabled={selfHosted}
            onSelect={() => setMode("temporary")}
            icon={<Icon name="cloud" className="size-5" />}
            label={c.temporary}
            description={selfHosted ? c.cloudOnly : c.temporaryHint}
          />
        </div>
      )}
      {!mode && selfHosted && (
        <Button asChild variant="ghost" size="sm">
          <a
            href={`${cloudAuthUrl.replace(/\/$/, "")}/actions`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.openCloud}
            <Icon name="arrow-right" className="size-4 rtl:rotate-180" />
          </a>
        </Button>
      )}
    </div>
  );
}

function TemporaryRunners({ onSaved }: { onSaved: (runner: ActionRunnerView) => void }) {
  const { t } = useI18n();
  const a = t.actions;
  const c = a.runnerSetup.destinations;
  const resource = useActionResource(actionsApi.runners, 5000);
  const [budget, setBudget] = useState(false);
  const runners =
    resource.data?.filter((runner) => runner.kind === "cloud" && runner.enabled) ?? [];
  return (
    <div className="space-y-4">
      <ActionError message={resource.error} onRetry={resource.refresh} />
      {resource.loading && !resource.data ? (
        <div className="h-32 animate-pulse rounded-xl bg-card" aria-busy="true" />
      ) : runners.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {runners.map((runner) => (
            <button
              key={runner.id}
              type="button"
              disabled={!!runner.error}
              onClick={() => onSaved(runner)}
              className="space-y-3 rounded-xl border border-border/50 bg-card p-4 text-start hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <span className="flex items-center gap-3">
                <RunnerIdentity runner={runner} />
                <span className="text-sm font-medium">{runner.name}</span>
              </span>
              <RunnerCapabilities runner={runner} />
              {runner.error && <span className="block text-xs text-warning">{runner.error}</span>}
            </button>
          ))}
        </div>
      ) : (
        !resource.error && (
          <p className="rounded-xl bg-card p-5 text-sm text-muted-foreground">{c.fundHint}</p>
        )
      )}
      <Button variant="secondary" onClick={() => setBudget(true)}>
        <Icon name="wallet" />
        {a.budget.title}
      </Button>
      {budget && (
        <ActionBudgetDialog
          onClose={() => {
            setBudget(false);
            resource.refresh();
          }}
        />
      )}
    </div>
  );
}
