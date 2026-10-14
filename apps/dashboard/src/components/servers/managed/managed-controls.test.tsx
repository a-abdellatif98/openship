// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n-provider";
import { baseDictionary } from "@/i18n";
import { CloudResourceContext } from "@/context/CloudResourceContext";
import { ApiError } from "@/lib/api/client";
import { ManagedServerSsh } from "./ManagedServerSsh";
import { ManagedServerRuntime } from "./ManagedServerRuntime";
import { ManagedServerWorkloads } from "./ManagedServerWorkloads";
import { ManagedServerNetwork } from "./ManagedServerNetwork";
import { ManagedServerOutbound } from "./ManagedServerOutbound";
import { ManagedServerSettings } from "./ManagedServerSettings";
import { ManagedServerConnectionNotice } from "./ManagedServerConnectionNotice";
import { ManagedServerActionFeedback } from "./ManagedServerActionFeedback";
import type { CloudWorkspaceSummary } from "@repo/contracts";
import type { ManagedServerActions } from "./useManagedServerActions";

const cloud = vi.hoisted(() => ({ connecting: false, loading: false, startConnect: vi.fn() }));
vi.mock("@/context/CloudContext", () => ({ useCloud: () => cloud }));

const api = vi.hoisted(() => ({
  managedSshStatus: vi.fn(),
  setManagedSsh: vi.fn(),
  setManagedSshKey: vi.fn(),
  setManagedSshPassword: vi.fn(),
  managedSshConnection: vi.fn(),
  managedRuntimeStatus: vi.fn(),
  enableManagedRuntime: vi.fn(),
  managedRuntimeCredential: vi.fn(),
  rotateManagedRuntimeCredential: vi.fn(),
  managedWorkloads: vi.fn(),
  managedWorkloadLogs: vi.fn(),
  createManagedWorkload: vi.fn(),
  controlManagedWorkload: vi.fn(),
  managedInfo: vi.fn(),
  managedBootLogs: vi.fn(),
  getServerNetworkSettings: vi.fn(),
  updateServerNetworkSettings: vi.fn(),
  managedOutbound: vi.fn(),
  managedOutboundOptions: vi.fn(),
  setManagedOutbound: vi.fn(),
}));
vi.mock("@/lib/api/system", () => ({ systemApi: api }));
const copy = baseDictionary.servers.managedControls;
const sshStatus = {
  enabled: false,
  keyConfigured: false,
  passwordConfigured: true,
  requiresIdentityAccess: false,
  connection: null,
};
const credential = {
  endpoint: "https://runtime.example.test",
  token: "super-private-runtime-token",
  revision: "a".repeat(64),
  expiresAt: "2030-10-10T00:00:00Z",
};
const network = {
  internetAccess: true,
  ingressPorts: [80, 9990],
  ingressAll: false,
  egress: ["*"],
  privateIp: "10.0.0.5",
  outboundIp: "192.0.2.2",
  outboundMode: "managed",
  revision: "a".repeat(64),
};
const manual = {
  id: "openship-manual-test",
  name: "Worker",
  state: "stopped",
  restartPolicy: "never",
  source: "manual",
  projectId: null,
  manageable: true,
};
const outbound = {
  mode: "managed",
  ip: "1.1.1.1",
  countryCode: "AU",
  proxy: null,
  revision: "c".repeat(64),
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let root: Root, host: HTMLDivElement;
const render = (node: ReactNode, scope = "account-a") =>
  act(async () =>
    root.render(
      <I18nProvider>
        <CloudResourceContext.Provider value={scope}>{node}</CloudResourceContext.Provider>
      </I18nProvider>,
    ),
  );
const buttons = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].filter(
    (node) => node.textContent?.trim() === label || node.getAttribute("aria-label") === label,
  );
const button = (label: string) => {
  const found = buttons(label);
  expect(found.length, label).toBeGreaterThan(0);
  return found[0]!;
};
async function fill(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const submit = async (form: HTMLFormElement) =>
  act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
it("offers the selected server's subscription management before deletion", async () => {
  const server: CloudWorkspaceSummary = {
    id: "cws-production",
    serverId: "server-production",
    name: "Production",
    planTierId: "hobby",
    subscriptionStatus: "active",
    projectCount: 0,
    state: "running",
    resources: null,
    operation: null,
    createdAt: "2026-10-01T00:00:00Z",
  };
  const remove = vi.fn();
  const actions = {
    busy: false,
    error: null,
    preview: null,
    remove,
  } as unknown as ManagedServerActions;
  await render(
    <ManagedServerActionFeedback
      server={server}
      actions={actions}
      deleting
      onCancelDelete={vi.fn()}
    />,
  );
  const link = host.querySelector<HTMLAnchorElement>(
    'a[href="/billing/overview?workspaceId=cws-production"]',
  );
  expect(link?.textContent).toBe(baseDictionary.billing.subscription.manage);
  expect(host.textContent).toContain(
    baseDictionary.billing.workspaces.deleteHint,
  );
  expect(remove).not.toHaveBeenCalled();
  await render(
    <ManagedServerActionFeedback
      server={{ ...server, id: "cws-staging", projectCount: 1 }}
      actions={actions}
      deleting
      onCancelDelete={vi.fn()}
    />,
  );
  expect(
    host.querySelector(
      'a[href="/billing/overview?workspaceId=cws-production"]',
    ),
  ).toBeNull();
  expect(
    host.querySelector('a[href="/billing/overview?workspaceId=cws-staging"]'),
  ).not.toBeNull();
  expect(button(baseDictionary.billing.workspaces.confirmDelete).disabled).toBe(
    true,
  );
});

it("starts the existing Cloud sign-in flow and labels an account mismatch separately", async () => {
  const refresh = vi.fn();
  await render(<ManagedServerConnectionNotice issue="not_connected" refresh={refresh} />);
  expect(host.textContent).toContain(copy.cloudConnection.titles.not_connected);
  await act(async () => button(copy.cloudConnection.signIn).click());
  expect(cloud.startConnect).toHaveBeenCalledOnce();
  await render(<ManagedServerConnectionNotice issue="account_mismatch" refresh={refresh} />);
  expect(host.textContent).toContain(copy.cloudConnection.titles.account_mismatch);
  await act(async () => button(copy.retry).click());
  expect(refresh).toHaveBeenCalledOnce();
  expect(api.setManagedOutbound).not.toHaveBeenCalled();
});

it.each([null, "404 Not Found", "<html>404 Not Found</html>"])("explains a missing Cloud control route (%s) and retries it without replaying a mutation", async body => {
  api.managedOutbound.mockRejectedValueOnce(new ApiError(404, "Not Found", body));
  await render(<ManagedServerOutbound serverId="server-a" />);
  expect(host.textContent).toContain(copy.controlUnavailable.title);
  expect(host.textContent).toContain(copy.controlUnavailable.description);
  expect(host.textContent).not.toContain("API 404");
  expect(api.setManagedOutbound).not.toHaveBeenCalled();
  await act(async () => button(copy.retry).click());
  expect(host.textContent).not.toContain(copy.controlUnavailable.title);
  expect(api.managedOutbound).toHaveBeenCalledTimes(2);
  expect(api.setManagedOutbound).not.toHaveBeenCalled();
});
it("preserves a structured server-not-found response", async () => {
  api.managedOutbound.mockRejectedValueOnce(new ApiError(404, "Not Found", { error: "Server not found", code: "SERVER_NOT_FOUND" }));
  await render(<ManagedServerOutbound serverId="server-a" />);
  expect(host.textContent).toContain("Server not found");
  expect(host.textContent).not.toContain(copy.controlUnavailable.title);
});
it("explains unavailable outbound choices without showing a raw route 404", async () => {
  api.managedOutboundOptions.mockRejectedValueOnce(new ApiError(404, "Not Found", null));
  await render(<ManagedServerOutbound serverId="server-a" />);
  expect(host.textContent).toContain(copy.controlUnavailable.description);
  expect(host.textContent).not.toContain("API 404");
  expect(api.setManagedOutbound).not.toHaveBeenCalled();
});
it("removes the edit form when the Cloud write route is unavailable and never replays it on refresh", async () => {
  api.setManagedOutbound.mockRejectedValueOnce(new ApiError(404, "Not Found", null));
  await render(<ManagedServerOutbound serverId="server-a" />);
  await select(copy.outbound.address, "8.8.4.4 · US");
  await act(async () => button(copy.outbound.apply).click());
  expect(host.textContent).toContain(copy.controlUnavailable.description);
  expect(host.querySelector("form")).toBeNull();
  await act(async () => button(copy.retry).click());
  expect(api.setManagedOutbound).toHaveBeenCalledOnce();
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.managedSshStatus.mockResolvedValue(sshStatus);
  api.managedRuntimeStatus.mockResolvedValue({ enabled: true, running: true });
  api.managedRuntimeCredential.mockResolvedValue(credential);
  api.managedWorkloads.mockResolvedValue({ workloads: [], truncated: false });
  api.getServerNetworkSettings.mockResolvedValue(network);
  api.managedOutbound.mockResolvedValue(outbound);
  api.managedOutboundOptions.mockResolvedValue({
    ips: [
      { ip: "1.1.1.1", countryCode: "AU" },
      { ip: "8.8.4.4", countryCode: "US" },
    ],
  });
  api.managedInfo.mockResolvedValue({
    workspaceId: "vm-a",
    image: "oblien/docker:29",
    state: "running",
    mode: "permanent",
    operatingSystem: "Alpine 3.22",
    restartPolicy: null,
    resources: { cpuCores: 2, memoryMb: 8192, diskMb: 32768 },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("reads runtime status without automatically enabling it or exposing a token", async () => {
  await render(<ManagedServerRuntime serverId="server-a" />);
  expect(api.managedRuntimeStatus).toHaveBeenCalledExactlyOnceWith("server-a");
  expect(api.managedRuntimeCredential).not.toHaveBeenCalled();
  expect(api.enableManagedRuntime).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain(credential.token);
  expect(host.textContent).toContain(copy.runtime.requiredHint);
});
it("reveals a credential only on request and clears it after a minute", async () => {
  await render(<ManagedServerRuntime serverId="server-a" />);
  vi.useFakeTimers();
  await act(async () => button(copy.runtime.reveal).click());
  expect(api.managedRuntimeCredential).toHaveBeenCalledExactlyOnceWith("server-a", {
    confirm: true,
  });
  expect(host.textContent).toContain(credential.token);
  expect(localStorage.getItem("oblien-runtime-token")).toBeNull();
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(host.textContent).not.toContain(credential.token);
});
it("ignores a credential response arriving after an account or server switch", async () => {
  const pending = deferred<typeof credential>();
  api.managedRuntimeCredential.mockReturnValueOnce(pending.promise);
  await render(<ManagedServerRuntime serverId="server-a" />);
  await act(async () => button(copy.runtime.reveal).click());
  await render(<ManagedServerRuntime serverId="server-b" />, "account-b");
  await act(async () => pending.resolve(credential));
  expect(host.textContent).not.toContain(credential.token);
  expect(api.managedRuntimeStatus).toHaveBeenLastCalledWith("server-b");
});
it("does not restore a revealed credential after switching accounts and back", async () => {
  await render(<ManagedServerRuntime serverId="server-a" />);
  await act(async () => button(copy.runtime.reveal).click());
  expect(host.textContent).toContain(credential.token);
  await render(<ManagedServerRuntime serverId="server-a" />, "account-b");
  await render(<ManagedServerRuntime serverId="server-a" />, "account-a");
  expect(host.textContent).not.toContain(credential.token);
});
it("clears credentials in a hidden tab and discards replies while it is hidden", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  try {
    await render(<ManagedServerRuntime serverId="server-a" />);
    await act(async () => button(copy.runtime.reveal).click());
    expect(host.textContent).toContain(credential.token);
    hidden.mockReturnValue(true);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(host.textContent).not.toContain(credential.token);
    hidden.mockReturnValue(false);
    const pending = deferred<typeof credential>();
    api.managedRuntimeCredential.mockReturnValueOnce(pending.promise);
    await act(async () => button(copy.runtime.reveal).click());
    hidden.mockReturnValue(true);
    await act(async () => pending.resolve(credential));
    hidden.mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(host.textContent).not.toContain(credential.token);
  } finally {
    hidden.mockRestore();
  }
});
it("clears a revealed credential when navigating to another tab", async () => {
  await render(<ManagedServerRuntime serverId="server-a" />);
  await act(async () => button(copy.runtime.reveal).click());
  expect(host.textContent).toContain(credential.token);
  await render(<ManagedServerSsh serverId="server-a" />);
  await render(<ManagedServerRuntime serverId="server-a" />);
  expect(host.textContent).not.toContain(credential.token);
});
it("requires a separate confirmation for rotation and sends its revision", async () => {
  api.rotateManagedRuntimeCredential.mockResolvedValue({
    ...credential,
    token: "new-token",
    revision: "b".repeat(64),
  });
  await render(<ManagedServerRuntime serverId="server-a" />);
  await act(async () => button(copy.runtime.reveal).click());
  await act(async () => button(copy.runtime.rotate).click());
  expect(api.rotateManagedRuntimeCredential).not.toHaveBeenCalled();
  await act(async () => button(copy.runtime.confirmRotate).click());
  expect(api.rotateManagedRuntimeCredential).toHaveBeenCalledExactlyOnceWith("server-a", {
    expectedRevision: credential.revision,
    confirm: true,
  });
  expect(host.textContent).toContain("new-token");
  expect(host.textContent).not.toContain(credential.token);
});
it("does not label an unavailable runtime as disabled or offer to turn it on", async () => {
  api.managedRuntimeStatus.mockRejectedValueOnce(new Error("Provider status unavailable"));
  await render(<ManagedServerRuntime serverId="server-a" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Provider status unavailable",
  );
  expect(buttons(copy.runtime.enable)).toHaveLength(0);
  await act(async () => button(copy.retry).click());
  expect(buttons(copy.runtime.reveal)).toHaveLength(1);
});
it("shows safe stopped-server advice and disables token reveal", async () => {
  api.managedRuntimeStatus.mockResolvedValue({ enabled: true, running: false });
  await render(<ManagedServerRuntime serverId="server-a" />);
  expect(button(copy.runtime.reveal).disabled).toBe(true);
  expect(host.textContent).toContain(copy.runtime.stoppedHint);
});
it("enables SSH once and shows the one-time password without repeating the request", async () => {
  const pending = deferred<unknown>();
  api.setManagedSsh.mockReturnValueOnce(pending.promise);
  await render(<ManagedServerSsh serverId="server-a" />);
  const enable = button(copy.ssh.enable);
  await act(async () => {
    enable.click();
    enable.click();
  });
  expect(api.setManagedSsh).toHaveBeenCalledExactlyOnceWith("server-a", {
    enabled: true,
    expectedEnabled: false,
    confirm: true,
  });
  await act(async () =>
    pending.resolve({ status: { ...sshStatus, enabled: true }, initialPassword: "initial-secret" }),
  );
  expect(host.textContent).toContain("initial-secret");
  await act(async () => button(copy.hideSecrets).click());
  expect(host.textContent).not.toContain("initial-secret");
});
it("asks for SSH disable confirmation and keeps errors visible", async () => {
  api.managedSshStatus.mockResolvedValue({ ...sshStatus, enabled: true });
  api.setManagedSsh.mockRejectedValue(new Error("Server is busy"));
  await render(<ManagedServerSsh serverId="server-a" />);
  await act(async () => button(copy.ssh.disable).click());
  expect(api.setManagedSsh).not.toHaveBeenCalled();
  expect(host.textContent).toContain(copy.ssh.disableHint);
  await act(async () => button(copy.ssh.confirmDisable).click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Server is busy");
  expect(buttons(copy.ssh.disable)).toHaveLength(1);
});
it("submits only the public key and clears a password immediately after submission", async () => {
  api.managedSshStatus.mockResolvedValue({ ...sshStatus, enabled: true });
  api.setManagedSshKey.mockResolvedValue({ ...sshStatus, enabled: true, keyConfigured: true });
  api.setManagedSshPassword.mockRejectedValue(new Error("Try again"));
  await render(<ManagedServerSsh serverId="server-a" />);
  const key = "ssh-ed25519 AAAApublic-key-fixture";
  await fill(host.querySelector("textarea")!, key);
  await submit(host.querySelector("form")!);
  expect(api.setManagedSshKey).toHaveBeenCalledExactlyOnceWith("server-a", {
    publicKey: key,
    confirm: true,
  });
  const password = host.querySelector<HTMLInputElement>('input[type="password"]')!;
  await fill(password, "do-not-retain-this");
  await submit(password.closest("form")!);
  expect(api.setManagedSshPassword).toHaveBeenCalledExactlyOnceWith("server-a", {
    password: "do-not-retain-this",
    confirm: true,
  });
  expect(password.value).toBe("");
  expect(host.textContent).not.toContain("do-not-retain-this");
});
it("edits outbound destinations with their revision and never sends ingress/proxy fields", async () => {
  api.updateServerNetworkSettings.mockResolvedValue({
    ...network,
    egress: ["api.example.test"],
    revision: "b".repeat(64),
  });
  await render(<ManagedServerNetwork serverId="server-a" />);
  await fill(host.querySelector("textarea")!, "API.example.test\napi.example.test");
  await act(async () => button(copy.save).click());
  expect(api.updateServerNetworkSettings).toHaveBeenCalledExactlyOnceWith("server-a", {
    internetAccess: true,
    expectedInternetAccess: true,
    egress: ["api.example.test"],
    expectedRevision: network.revision,
    confirm: true,
  });
  expect(host.textContent).toContain(copy.saved);
});
it("blocks malformed outbound lists and preserves the draft on conflict", async () => {
  await render(<ManagedServerNetwork serverId="server-a" />);
  await fill(host.querySelector("textarea")!, "*\ngithub.com");
  expect(button(copy.save).disabled).toBe(true);
  await fill(host.querySelector("textarea")!, "github.com");
  api.updateServerNetworkSettings.mockRejectedValue(new Error("Network settings changed"));
  await act(async () => button(copy.save).click());
  expect(host.querySelector("textarea")!.value).toBe("github.com");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Network settings changed");
});
it("shows wildcard ingress accurately and keeps unavailable rules read-only", async () => {
  api.getServerNetworkSettings.mockResolvedValue({ ...network, ingressAll: true, egress: null });
  await render(<ManagedServerNetwork serverId="server-a" />);
  expect(host.textContent).toContain(copy.network.allPorts);
  expect(host.querySelector("textarea")!.disabled).toBe(true);
  expect(host.textContent).toContain(copy.network.rulesUnavailable);
});
async function select(label: string, option: string) {
  const node = [...host.querySelectorAll("label")].find((node) => node.textContent === label)!;
  await act(async () => document.getElementById(node.htmlFor)!.click());
  const choice = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((node) =>
    node.textContent?.trim().startsWith(option),
  )!;
  expect(choice, option).toBeDefined();
  await act(async () => choice.click());
}
const field = (label: string) => {
  const node = [...host.querySelectorAll("label")].find((node) => node.textContent === label)!;
  return document.getElementById(node.htmlFor) as HTMLInputElement;
};
it("applies a selected outbound IP once and keeps the current IP until provider confirmation", async () => {
  const pending = deferred<typeof outbound>();
  api.setManagedOutbound.mockReturnValue(pending.promise);
  await render(<ManagedServerOutbound serverId="server-a" />);
  expect(api.setManagedOutbound).not.toHaveBeenCalled();
  await select(copy.outbound.address, "8.8.4.4 · US");
  await act(async () => button(copy.outbound.apply).click());
  await submit(host.querySelector("form")!);
  expect(api.setManagedOutbound).toHaveBeenCalledExactlyOnceWith("server-a", {
    mode: "managed",
    ip: "8.8.4.4",
    expectedRevision: outbound.revision,
    confirm: true,
  });
  expect(host.textContent).toContain("1.1.1.1");
  expect(button(copy.outbound.applying).disabled).toBe(true);
  await act(async () => pending.resolve({ ...outbound, ip: "8.8.4.4", revision: "d".repeat(64) }));
  expect(host.textContent).toContain(copy.saved);
});
it("requires both proxy credentials, clears them after a failure, and retains the non-secret draft", async () => {
  api.setManagedOutbound.mockRejectedValue(new Error("Proxy preflight failed"));
  await render(<ManagedServerOutbound serverId="server-a" />);
  await select(copy.outbound.connection, copy.outbound.custom);
  await fill(field(copy.outbound.host), "8.8.8.8");
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  await fill(field(copy.outbound.username), "proxy-user");
  expect(button(copy.outbound.apply).disabled).toBe(true);
  await fill(field(copy.outbound.password), "private-proxy-password");
  await submit(host.querySelector("form")!);
  expect(api.setManagedOutbound).toHaveBeenCalledExactlyOnceWith("server-a", {
    mode: "custom",
    proxy: {
      host: "8.8.8.8",
      port: 8080,
      protocol: "http",
      username: "proxy-user",
      password: "private-proxy-password",
    },
    expectedRevision: outbound.revision,
    confirm: true,
  });
  expect(field(copy.outbound.password).value).toBe("");
  expect(field(copy.outbound.host).value).toBe("8.8.8.8");
  expect(host.textContent).toContain("Proxy preflight failed");
  expect(host.textContent).not.toContain(copy.saved);
  expect(api.updateServerNetworkSettings).not.toHaveBeenCalled();
});
it("clears the outbound draft on an account switch and ignores the previous request", async () => {
  const pending = deferred<typeof outbound>();
  api.setManagedOutbound.mockReturnValue(pending.promise);
  await render(<ManagedServerOutbound serverId="server-a" />);
  await select(copy.outbound.address, "8.8.4.4 · US");
  await submit(host.querySelector("form")!);
  await render(<ManagedServerOutbound serverId="server-b" />, "account-b");
  await act(async () => pending.resolve({ ...outbound, ip: "8.8.4.4" }));
  expect(host.textContent).not.toContain(copy.saved);
  expect(api.managedOutbound).toHaveBeenLastCalledWith("server-b");
});
it("offers a read-only retry after a failed pool read without hiding custom proxy controls", async () => {
  api.managedOutboundOptions.mockRejectedValueOnce(new Error("Connection lost"));
  await render(<ManagedServerOutbound serverId="server-a" />);
  expect(host.textContent).toContain(copy.outbound.optionsFailed);
  await act(async () => button(copy.retry).click());
  expect(host.textContent).not.toContain(copy.outbound.optionsFailed);
  expect(api.managedOutboundOptions).toHaveBeenCalledTimes(2);
  expect(api.setManagedOutbound).not.toHaveBeenCalled();
  await select(copy.outbound.connection, copy.outbound.custom);
  expect(field(copy.outbound.host)).toBeDefined();
});
it("lists native workloads without offering direct controls for managed application/system processes", async () => {
  api.managedWorkloads.mockResolvedValue({
    workloads: [
      manual,
      {
        ...manual,
        id: "openship-app",
        name: "API app",
        source: "project",
        projectId: "project-a",
        manageable: false,
      },
      {
        ...manual,
        id: "openship-docker-api-v1",
        name: "Docker bridge",
        source: "system",
        manageable: false,
      },
    ],
    truncated: false,
  });
  await render(<ManagedServerWorkloads serverId="server-a" />);
  const articles = host.querySelectorAll("article");
  expect(articles).toHaveLength(3);
  expect(articles[0]!.textContent).toContain(copy.workloads.start);
  expect(articles[1]!.querySelector("a")?.getAttribute("href")).toBe("/projects/project-a");
  for (const article of [articles[1]!, articles[2]!]) {
    expect(
      [...article.querySelectorAll("button")].some(
        (node) => node.textContent === copy.workloads.delete,
      ),
    ).toBe(false);
    expect(article.textContent).toContain(copy.workloads.protected);
  }
});
it("retries a lost workload create response with the same immutable payload", async () => {
  api.createManagedWorkload
    .mockRejectedValueOnce(new Error("Lost response"))
    .mockResolvedValueOnce(manual);
  await render(<ManagedServerWorkloads serverId="server-a" />);
  await act(async () => button(copy.workloads.create).click());
  await fill(host.querySelector<HTMLInputElement>('input[id$="-name"]')!, "Worker");
  await fill(
    host.querySelector<HTMLTextAreaElement>('textarea[id$="-command"]')!,
    "node worker.js",
  );
  await fill(host.querySelector<HTMLTextAreaElement>('textarea[id$="-env"]')!, "TOKEN=private");
  await submit(host.querySelector("form")!);
  expect(host.querySelector<HTMLInputElement>('input[id$="-name"]')!.disabled).toBe(true);
  const first = api.createManagedWorkload.mock.calls[0]!;
  await submit(host.querySelector("form")!);
  expect(api.createManagedWorkload.mock.calls[1]).toEqual(first);
  expect(first[1]).toMatchObject({
    name: "Worker",
    command: "node worker.js",
    environment: ["TOKEN=private"],
    confirm: true,
  });
  expect(first[1].idempotencyKey.length).toBeGreaterThanOrEqual(16);
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).not.toContain("TOKEN=private");
});
it("confirms workload actions and reads only the selected process logs", async () => {
  api.managedWorkloads.mockResolvedValue({ workloads: [manual], truncated: false });
  api.controlManagedWorkload.mockResolvedValue({
    ok: true,
    workload: { ...manual, state: "running" },
  });
  api.managedWorkloadLogs.mockResolvedValue({ logs: "worker ready", truncated: false });
  await render(<ManagedServerWorkloads serverId="server-a" />);
  await act(async () => button(copy.workloads.start).click());
  expect(api.controlManagedWorkload).not.toHaveBeenCalled();
  await act(async () => button(copy.workloads.start).click());
  expect(api.controlManagedWorkload).toHaveBeenCalledExactlyOnceWith("server-a", {
    workloadId: manual.id,
    action: "start",
    confirm: true,
  });
  await act(async () => button(copy.workloads.logs).click());
  expect(api.managedWorkloadLogs).toHaveBeenCalledExactlyOnceWith("server-a", {
    workloadId: manual.id,
    tail: 200,
  });
  expect(host.textContent).toContain("worker ready");
});
it("shows managed image details and delegates capacity changes to the existing resize flow", async () => {
  const resize = vi.fn();
  const actions = { busy: false, previewResize: resize } as any;
  api.managedBootLogs.mockResolvedValue({ logs: "boot complete", truncated: false });
  await render(<ManagedServerSettings serverId="server-a" actions={actions} />);
  expect(host.textContent).toContain("oblien/docker:29");
  expect(host.textContent).toContain(copy.settings.imageHint);
  await act(async () => button(baseDictionary.billing.workspaces.resize).click());
  expect(resize).toHaveBeenCalledOnce();
  expect(api.managedBootLogs).not.toHaveBeenCalled();
  await act(async () => button(copy.settings.bootLogs).click());
  expect(host.textContent).toContain("boot complete");
  expect(host.querySelector('a[href="/servers/server-a?tab=terminal"]')).not.toBeNull();
});
it("does not keep a previous server's read after a target change", async () => {
  const pending = deferred<typeof network>();
  api.getServerNetworkSettings
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ ...network, privateIp: "10.0.0.8" });
  await render(<ManagedServerNetwork serverId="server-a" />);
  await render(<ManagedServerNetwork serverId="server-b" />);
  await act(async () => pending.resolve(network));
  expect(host.textContent).toContain("10.0.0.8");
  expect(host.textContent).not.toContain("10.0.0.5");
});
