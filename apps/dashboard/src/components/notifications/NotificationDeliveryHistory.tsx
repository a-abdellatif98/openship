"use client";

import { reportCaughtError as observeCaughtError } from "@repo/core/diagnostics";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useCloudResourceKey } from "@/context/CloudResourceContext";
import { getApiBaseUrl } from "@/lib/api/client";
import {
  notificationsApi,
  type ChannelKind,
  type NotificationCategory,
  type NotificationDelivery,
} from "@/lib/api/notifications";
import { useI18n, interpolate } from "@/components/i18n-provider";
import { ChannelLogo, CHANNEL_LABELS } from "@/components/ui/ChannelLogo";
import { Button } from "@/components/ui/button";

/** Remount before rendering another account's private delivery history. */
export function NotificationDeliveryHistory() {
  const { data: session } = useSession();
  const cloud = useCloudResourceKey();
  const scope = JSON.stringify([
    getApiBaseUrl(),
    session?.user?.id,
    session?.session?.activeOrganizationId,
    cloud,
  ]);
  if (!session?.user) return null;
  return <ScopedDeliveryHistory key={scope} />;
}

function ScopedDeliveryHistory() {
  const { t, locale } = useI18n();
  const copy = t.settings.notifications.deliveryHistory;
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<{
    deliveries: NotificationDelivery[];
    categories: NotificationCategory[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void Promise.all([
      notificationsApi.listDeliveries({ limit: 50 }),
      notificationsApi.listCategories(),
    ])
      .then(([history, registry]) => {
        if (active) setData({ deliveries: history.deliveries, categories: registry.categories });
      })
      .catch((error) => {
        observeCaughtError(error, "dashboard/components/notifications/NotificationDeliveryHistory");
        // A read failure is not an empty history. Do not expose arbitrary server error bodies.
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const labels = new Map(data?.categories.map((category) => [category.id, category.label]));
  return (
    <section aria-label={copy.title} className="rounded-2xl bg-card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-foreground">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {copy.refresh}
        </Button>
      </div>
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {copy.loading}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {copy.error}
        </p>
      )}
      {!loading && !error && data?.deliveries.length === 0 && (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      )}
      {!!data?.deliveries.length && (
        <ul className="divide-y divide-border/30">
          {data.deliveries.map((delivery) => {
            const kind = Object.hasOwn(CHANNEL_LABELS, delivery.channelKind)
              ? (delivery.channelKind as ChannelKind)
              : null;
            const date = new Date(delivery.createdAt);
            return (
              <li key={delivery.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground break-words">
                      {((t.settings.notifications as any)?.categories?.[delivery.category]?.label) ?? (labels.get(delivery.category) ?? copy.unknownCategory)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {kind && <ChannelLogo kind={kind} className="size-4 shrink-0" />}
                      <span>
                        {kind ? t.settings.notifications.kinds[kind] : copy.unknownChannel}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${delivery.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}
                  >
                    {copy.status[delivery.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {Number.isFinite(date.getTime()) && (
                    <time dateTime={delivery.createdAt}>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(date)}
                    </time>
                  )}
                  {delivery.attempts > 0 && (
                    <span>{interpolate(copy.attempts, { count: String(delivery.attempts) })}</span>
                  )}
                </div>
                {delivery.lastError && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {copy.errorDetails}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap break-words">{delivery.lastError}</p>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
