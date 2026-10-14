/** Shared classification without loading credentials, storage or configuration. */
export function isGitHubCredentialRejected(
  status: number,
  headers: Headers,
  message?: unknown,
): boolean {
  return (
    status === 401 ||
    (status === 403 &&
      headers.get("x-ratelimit-remaining") !== "0" &&
      !headers.has("retry-after") &&
      !(typeof message === "string" && /rate limit|abuse detection/i.test(message)))
  );
}

/** Machine-readable failure details; never retry a mutation after an auth error. */
export class GitHubApiError extends Error {
  readonly credentialRejected: boolean;

  constructor(
    readonly status: number,
    message: string,
    headers: Headers,
  ) {
    super(`GitHub API error (${status}): ${message}`);
    this.name = "GitHubApiError";
    this.credentialRejected = isGitHubCredentialRejected(status, headers, message);
  }
}
