# 0005. Run a single backend instance for the MVP

- Status: Accepted
- Date: 2026-10-19

## Context

Real-time messaging needs to know which WebSocket connections belong to which users. With several backend instances, a message received by one instance must reach users connected to another, which requires a shared pub/sub layer (for example Redis or PostgreSQL `LISTEN/NOTIFY`).

The PRD lists growing real-time complexity and infrastructure cost as key risks (§14) and targets a small number of early users.

## Decision

Run exactly one Go server instance for the MVP. It keeps an in-memory map of users to their open WebSocket connections and delivers events directly.

## Consequences

- No message broker, and simpler code and operations.
- Database migrations can safely run at server startup.
- A restart briefly disconnects everyone. Clients reconnect and re-sync from the database (ADR 0003), so no messages are lost.
- No horizontal scaling or zero-downtime deploys. To scale out later:
  - add a pub/sub layer behind the connection manager;
  - move migrations to a separate step;
  - record the change in a new ADR that supersedes this one.
