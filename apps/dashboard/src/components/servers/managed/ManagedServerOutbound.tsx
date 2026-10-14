"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Value } from "@sinclair/typebox/value";
import { ServerResourceSchemas, type ServerOperations } from "@repo/contracts";
import { useI18n } from "@/components/i18n-provider";
import { useCloudResourceKey } from "@/context/CloudResourceContext";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/Switch";
import { systemApi } from "@/lib/api/system";
import { ManagedControlPanel } from "./ManagedControlPanel";
import { useManagedServerResource, useManagedServerSecret } from "./useManagedServerResource";

type OutboundInput = Parameters<ServerOperations["setManagedOutbound"]>[1];

export function ManagedServerOutbound({ serverId }: { serverId: string }) {
  const account = useCloudResourceKey();
  return <OutboundEditor key={`${account}:${serverId}`} serverId={serverId} />;
}

function OutboundEditor({ serverId }: { serverId: string }) {
  const { t, locale } = useI18n();
  const common = t.servers.managedControls;
  const copy = common.outbound;
  const countries = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const resource = useManagedServerResource(serverId, systemApi.managedOutbound);
  const options = useManagedServerResource(serverId, systemApi.managedOutboundOptions);
  const credentials = useManagedServerSecret<{ username: string; password: string }>(serverId);
  const current = resource.data;
  const [mode, setMode] = useState<"managed" | "custom">("managed");
  const [ip, setIp] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8080");
  const [protocol, setProtocol] = useState<"http" | "https">("http");
  const [authenticated, setAuthenticated] = useState(false);
  const [edited, setEdited] = useState(false);
  const [notice, setNotice] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!current) return;
    setMode(current.mode ?? "managed");
    setIp(current.mode === "managed" ? (current.ip ?? "") : "");
    setHost(current.proxy?.host ?? "");
    setPort(String(current.proxy?.port ?? 8080));
    setProtocol(current.proxy?.protocol ?? "http");
    setAuthenticated(current.proxy?.hasCredentials ?? false);
    credentials.clear();
    setEdited(false);
  }, [current, credentials.clear]);
  const edit = () => {
    setEdited(true);
    setNotice(false);
  };
  const disabled = resource.busy || !current?.revision;
  const input: OutboundInput =
    mode === "managed"
      ? { mode, ...(ip ? { ip } : {}), expectedRevision: current?.revision ?? "", confirm: true }
      : {
          mode,
          proxy: {
            host: host.trim(),
            port: Number(port),
            protocol,
            ...(authenticated
              ? {
                  username: credentials.value?.username ?? "",
                  password: credentials.value?.password ?? "",
                }
              : {}),
          },
          expectedRevision: current?.revision ?? "",
          confirm: true,
        };
  const valid = Value.Check(ServerResourceSchemas.setManagedOutbound.input, input);
  const ips = options.data?.ips ?? [];
  const choices = [
    { value: "", label: copy.automatic },
    ...ips.map((item) => ({
      value: item.ip,
      label: item.countryCode ? `${item.ip} · ${item.countryCode}` : item.ip,
      description: item.countryCode ? countries.of(item.countryCode) : undefined,
    })),
  ];
  if (current?.mode === "managed" && current.ip && !ips.some((item) => item.ip === current.ip))
    choices.push({ value: current.ip, label: `${current.ip} · ${copy.current}` });

  async function save() {
    if (!valid || disabled || !edited) return;
    setNotice(false);
    credentials.clear();
    await resource.run(
      () => systemApi.setManagedOutbound(serverId, input),
      (result) => {
        resource.replace(result);
        setNotice(true);
      },
    );
  }
  return (
    <ManagedControlPanel
      title={copy.title}
      description={copy.description}
      icon="network"
      {...resource}
      refresh={() => {
        resource.refresh();
        options.refresh();
      }}
    >
      {!current && resource.busy && <div className="h-48 animate-pulse rounded-xl bg-muted/40" />}
      {current && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 p-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{copy.currentIp}</p>
              <p dir="ltr" className="font-mono text-sm">
                {current.ip ?? common.unavailable}
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {current.mode === "custom"
                ? copy.custom
                : current.mode === "managed"
                  ? copy.managed
                  : common.unavailable}
            </span>
          </div>
          {!current.revision && <p className="text-sm text-muted-foreground">{copy.unavailable}</p>}
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid min-w-0 grid-cols-1 gap-4 @min-[32rem]/server-detail:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor={`${id}-mode`} className="text-sm font-medium">
                  {copy.connection}
                </label>
                <CustomSelect
                  id={`${id}-mode`}
                  value={mode}
                  onChange={(value) => {
                    setMode(value);
                    credentials.clear();
                    edit();
                  }}
                  options={[
                    { value: "managed", label: copy.managed },
                    { value: "custom", label: copy.custom },
                  ]}
                  variant="filled"
                  triggerClassName="bg-muted/60 hover:bg-muted"
                  disabled={disabled}
                />
              </div>
              {mode === "managed" && (
                <div className="space-y-2">
                  <label htmlFor={`${id}-ip`} className="text-sm font-medium">
                    {copy.address}
                  </label>
                  <CustomSelect
                    id={`${id}-ip`}
                    value={ip}
                    onChange={(value) => {
                      setIp(value);
                      edit();
                    }}
                    options={choices}
                    variant="filled"
                    triggerClassName="bg-muted/60 hover:bg-muted"
                    disabled={disabled || options.busy || !!options.error}
                    searchable
                    searchPlaceholder={copy.search}
                  />
                  {options.error && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-2 text-xs text-danger"
                    >
                      <span>
                        {options.errorCode === "CLOUD_SERVER_CONTROL_UNAVAILABLE"
                          ? common.controlUnavailable.description
                          : copy.optionsFailed}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={options.refresh}
                        disabled={options.busy}
                      >
                        {common.retry}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {mode === "managed" ? (
              <p className="text-xs text-muted-foreground">{copy.managedHint}</p>
            ) : (
              <>
                <div className="grid min-w-0 grid-cols-1 gap-4 @min-[32rem]/server-detail:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor={`${id}-host`} className="text-sm font-medium">
                      {copy.host}
                    </label>
                    <Input
                      id={`${id}-host`}
                      variant="filled"
                      dir="ltr"
                      value={host}
                      onChange={(event) => {
                        setHost(event.target.value);
                        edit();
                      }}
                      maxLength={15}
                      placeholder="123.45.67.89"
                      disabled={disabled}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label htmlFor={`${id}-port`} className="text-sm font-medium">
                        {copy.port}
                      </label>
                      <Input
                        id={`${id}-port`}
                        variant="filled"
                        type="number"
                        min={1}
                        max={65535}
                        value={port}
                        onChange={(event) => {
                          setPort(event.target.value);
                          edit();
                        }}
                        disabled={disabled}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`${id}-protocol`} className="text-sm font-medium">
                        {copy.protocol}
                      </label>
                      <CustomSelect
                        id={`${id}-protocol`}
                        value={protocol}
                        onChange={(value) => {
                          setProtocol(value);
                          edit();
                        }}
                        options={[
                          { value: "http", label: "HTTP" },
                          { value: "https", label: "HTTPS" },
                        ]}
                        variant="filled"
                        triggerClassName="bg-muted/60 hover:bg-muted"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{copy.proxyHint}</p>
                <div className="space-y-3 rounded-xl bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{copy.authentication}</span>
                    <Switch
                      checked={authenticated}
                      onChange={(value) => {
                        setAuthenticated(value);
                        credentials.clear();
                        edit();
                      }}
                      ariaLabel={copy.authentication}
                      disabled={disabled}
                    />
                  </div>
                  {authenticated && (
                    <>
                      <div className="grid min-w-0 grid-cols-1 gap-3 @min-[32rem]/server-detail:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor={`${id}-username`} className="text-sm">
                            {copy.username}
                          </label>
                          <Input
                            id={`${id}-username`}
                            variant="filled"
                            dir="ltr"
                            value={credentials.value?.username ?? ""}
                            maxLength={256}
                            autoComplete="off"
                            disabled={disabled}
                            required
                            onChange={(event) => {
                              credentials.reveal({
                                username: event.target.value,
                                password: credentials.value?.password ?? "",
                              });
                              edit();
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor={`${id}-password`} className="text-sm">
                            {copy.password}
                          </label>
                          <Input
                            id={`${id}-password`}
                            variant="filled"
                            type="password"
                            value={credentials.value?.password ?? ""}
                            maxLength={256}
                            autoComplete="new-password"
                            disabled={disabled}
                            required
                            onChange={(event) => {
                              credentials.reveal({
                                username: credentials.value?.username ?? "",
                                password: event.target.value,
                              });
                              edit();
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {current.proxy?.hasCredentials
                          ? copy.savedCredentials
                          : copy.credentialsHint}
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
            {edited && !valid && (
              <p role="alert" className="text-xs text-danger">
                {copy.invalid}
              </p>
            )}
            {edited && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">{copy.impact}</p>
                <Button type="submit" disabled={disabled || !valid}>
                  {resource.busy ? copy.applying : copy.apply}
                </Button>
              </div>
            )}
            {notice && (
              <p role="status" className="text-sm text-success">
                {common.saved}
              </p>
            )}
          </form>
        </>
      )}
    </ManagedControlPanel>
  );
}
