# 0004. Use `fetch` with TanStack Query instead of Axios

- Status: Accepted
- Date: 2026-10-19

## Context

The frontend needs an HTTP client for the REST API and a way to manage server data: caching, loading and error states, cancellation, retries, and pagination for message history. The PRD asks for a lightweight frontend (§6.7).

Axios offers interceptors, automatic errors on non-2xx responses, and convenient JSON handling, at a cost of roughly 13 kB gzipped. It does not provide caching or help with WebSocket.

## Decision

- Use the built-in `fetch` through one small wrapper, `web/src/lib/api.ts`. It adds the `/api/v1` prefix and credentials, sends JSON bodies, and throws an `ApiError` with the HTTP status on non-2xx responses.
- Use **TanStack Query** for all server data. Each feature exposes hooks from its own `api.ts` (for example `useMe`, `useUserSearch`).

## Consequences

- No extra HTTP dependency. The wrapper covers what Axios would have provided.
- Caching, request cancellation (`signal`), retries (network and 5xx only), and infinite pagination come from TanStack Query.
- Global behaviour such as "on 401, go to sign-in" lives in query hooks and route guards, not in HTTP interceptors.
- Real-time messages from the WebSocket client will be written into the same query cache, so REST and WebSocket data share one store.
