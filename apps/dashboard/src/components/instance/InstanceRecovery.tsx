"use client";

import { reportCaughtError as observeCaughtError } from "@repo/core/diagnostics";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InstanceLocation } from "./InstanceLocation";
import { instanceApi, type InstanceStatus } from "@/lib/api/instance";

/** Reachable even while ordinary auth/data APIs are fenced. It never offers a
 * local fallback when the live remote controller is unreachable. */
export function InstanceRecovery({ initial }: { initial: InstanceStatus }) {
  useEffect(() => {
    if (
      !initial.connection ||
      (initial.handoff && !["complete", "aborted"].includes(initial.handoff.status))
    )
      return;
    let stopped = false;
    const timer = setInterval(() => {
      void instanceApi
        .connectedSession()
        .then((session) => {
          if (!stopped && session?.user) window.location.reload();
        })
        .catch((diagnosticFailure) => {
          observeCaughtError(diagnosticFailure, "dashboard/components/instance/InstanceRecovery");
        });
    }, 3_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [initial]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-5 px-5 py-10">
      <div>
        <h1 className="text-xl font-semibold">Your Openship instance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Finish the move or reconnect to continue managing your projects.
        </p>
      </div>
      <InstanceLocation initial={initial} recovering />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Check connection
        </Button>
        {initial.connection && (
          <Button asChild>
            <Link href="/login">Sign in to remote instance</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
