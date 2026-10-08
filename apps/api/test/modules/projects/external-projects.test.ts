import { beforeEach, describe, expect, it, vi } from "vitest";
import { repos } from "@repo/db";
import type { ExecutionContext } from "@repo/platform";
import { seedOrg } from "../../helpers/seed";

const h = vi.hoisted(() => ({
  containers: [] as Array<{
    id: string;
    names: string[];
    image: string;
    state: string;
    status: string;
    labels: Record<string, string>;
  }>,
  runtimeServers: [] as Array<string | undefined>,
  logTargets: [] as string[],
  disposed: 0,
}));

vi.mock("@repo/platform/engine/lib/deployment-runtime", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createServerDockerRuntime: async (serverId: string | undefined) => {
    h.runtimeServers.push(serverId);
    return {
      listAllContainers: async () => h.containers,
      getRuntimeLogs: async (id: string) => {
        h.logTargets.push(id);
        return [{ timestamp: "t", message: `from ${id}`, level: "info" }];
      },
      streamRuntimeLogs: async (id: string) => {
        h.logTargets.push(id);
        return () => {};
      },
    };
  },
  disposeRuntime: () => {
    h.disposed += 1;
  },
}));

const { createExternalProject, listExternalContainers } =
  await import("@repo/platform/engine/modules/projects/external-project.service");
const { getRuntimeLogs, streamRuntimeLogs } =
  await import("@repo/platform/engine/modules/projects/project-runtime.service");
const { createQueuedDeployment } =
  await import("@repo/platform/engine/modules/deployments/build.service");
const { createService } = await import("@repo/platform/engine/modules/services/service.service");

const container = (id: string, name: string, state: string, labels: Record<string, string>) => ({
  id,
  names: [name],
  image: "registry/app:1",
  state,
  status: state,
  labels,
});
const kamal = { service: "shop", role: "web" };

let ctx: ExecutionContext;
let serverId: string;

beforeEach(async () => {
  h.containers = [];
  h.runtimeServers = [];
  h.logTargets = [];
  h.disposed = 0;
  ctx = (await seedOrg()) as ExecutionContext;
  serverId = (
    await repos.server.create({ organizationId: ctx.organizationId, sshHost: "192.0.2.30" })
  ).id;
}, 30_000);

const createShop = () =>
  createExternalProject(
    {
      name: `shop-${Math.random().toString(36).slice(2, 8)}`,
      serverId,
      matchers: [{ labels: kamal }],
    },
    ctx.organizationId,
  );

describe("creating an external project", () => {
  it("stores the server and matchers on an observe-only project row", async () => {
    const project = await createShop();
    const row = await repos.project.findById(project.id);

    expect(row).toMatchObject({
      gitProvider: "external",
      serverId,
      autoDeploy: false,
      runtimeMode: "docker",
    });
    expect(row?.externalConfig).toEqual({ serverId, matchers: [{ labels: kamal }] });
  });

  it("rejects a server from another organization", async () => {
    const other = await seedOrg();
    const foreign = await repos.server.create({
      organizationId: other.organizationId,
      sshHost: "192.0.2.31",
    });

    await expect(
      createExternalProject(
        { name: "x", serverId: foreign.id, matchers: [{ name: "web" }] },
        ctx.organizationId,
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects matchers that pin neither a name nor a label", async () => {
    await expect(
      createExternalProject(
        { name: "x", serverId, matchers: [{ labels: {} }] },
        ctx.organizationId,
      ),
    ).rejects.toThrow(/container name or at least one label/);
  });
});

describe("reading an external project", () => {
  it("lists only the matched containers on the configured server", async () => {
    const project = await createShop();
    h.containers = [
      container("c-web", "shop-web-1", "running", kamal),
      container("c-other", "blog-web-1", "running", { service: "blog", role: "web" }),
    ];

    const listed = await listExternalContainers(project.id, ctx.organizationId);

    expect(listed.map((c) => c.id)).toEqual(["c-web"]);
    expect(h.runtimeServers).toEqual([serverId]);
    expect(h.disposed).toBe(1);
  });

  it("reads logs from the running matched container, preferring it over a stopped one", async () => {
    const project = await createShop();
    h.containers = [
      container("c-old", "shop-web-0", "exited", kamal),
      container("c-live", "shop-web-1", "running", kamal),
      container("c-other", "blog-web-1", "running", { service: "blog" }),
    ];

    const logs = await getRuntimeLogs(project.id, ctx.organizationId);
    const stream = await streamRuntimeLogs(project.id, ctx.organizationId, () => {});
    stream.cleanup();

    expect(logs[0]?.message).toBe("from c-live");
    expect(h.logTargets).toEqual(["c-live", "c-live"]);
    expect(h.disposed).toBe(2);
  });
});

describe("external projects refuse every mutation", () => {
  it("refuses a queued deployment and a new service", async () => {
    const project = await createShop();

    await expect(
      createQueuedDeployment({
        projectId: project.id,
        organizationId: ctx.organizationId,
        branch: "main",
        environment: "production",
        framework: "unknown",
        meta: {} as never,
        envVars: {},
      }),
    ).rejects.toThrow(/deployed by another tool/);
    await expect(
      createService(ctx, project.id, { name: "db", image: "postgres:16" } as never),
    ).rejects.toThrow(/deployed by another tool/);
    expect(await repos.deployment.listInFlightByProject(project.id)).toEqual([]);
  });
});
