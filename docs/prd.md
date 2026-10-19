# Product Requirements Document (PRD)

## Personal Messenger

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Draft — initial development |
| **Product type** | Self-hosted, real-time messaging web app |
| **Platform** | Web |
| **Initial users** | The developer who owns the app, and friends or portfolio visitors who want to contact them |

---

## 1. Product Overview

Personal Messenger is a web-based instant messaging app that its owner builds and runs on their own server.

Users sign in with their Google account, find other users, and exchange messages in real time through a simple web interface.

The project has two main goals:

1. **Personal utility:** give the owner their own channel for sending and receiving messages, instead of relying on a third-party messaging platform as the main interface.
2. **Engineering portfolio:** demonstrate skills in building a Go backend, APIs, authentication, a database, real-time communication, and deploying and running an app on a self-managed server.

The project is built in stages. Voice calls, video calls, and AI agent integrations are possible future additions, not MVP requirements.

## 2. Problem Statement

The owner of a developer portfolio wants visitors to be able to contact them through an app they built themselves.

General-purpose messaging apps already exist, but none of them is a communication platform designed and run entirely by the project owner.

On the engineering side, the project is a way to learn and apply real-time communication using Go and modern web technology.

**Initial hypothesis:** visitors will try the app if starting a conversation is easy and the experience is good.

This hypothesis is not yet proven and must be tested with real usage.

## 3. Product Goals

### Primary goals

- Let visitors contact the app owner from the portfolio site.
- Provide sign-in with Google OAuth.
- Support user search and one-to-one conversations.
- Send and receive messages in real time.
- Store message history permanently.
- Run the app on a VPS using Docker.
- Show a backend and infrastructure implementation that can be explained in technical detail.

### Secondary goals

- Support a small group of early users.
- Provide a foundation that can grow into a more complete communication platform.
- Leave room to experiment with voice calls, video calls, and AI agents.

### Non-goals

The MVP does **not** aim to:

- Replace Telegram, WhatsApp, or other major messaging platforms.
- Provide group chats or public channels.
- Support end-to-end encryption.
- Act as an AI gateway or agent orchestration platform.
- Provide voice or video calls.
- Provide native Android or iOS apps.
- Implement a complex push notification system.

## 4. Target Users

### Primary user — Portfolio visitor

Someone visiting the portfolio website who wants to contact the owner directly.

Needs:

- Start a conversation easily.
- Avoid creating a new password.
- See which account they are signed in with.
- Send a message without having to learn how the app works.

### Secondary user — Registered user

A signed-in user who wants to find and contact other users.

Needs:

- Search for users by username.
- Start a one-to-one conversation.
- Read past messages.
- Receive new messages in real time.

### Owner / administrator

The person who runs the app and receives messages from visitors.

Needs:

- Have an account that others can find through a profile link or username.
- See incoming conversations.
- Manage deployment and app configuration.
- Monitor service health and fix outages.

## 5. User Flows

### Flow A — Contacting the owner from the portfolio

1. The visitor opens the portfolio website.
2. The visitor clicks **Chat with me**.
3. The visitor is taken to the owner's profile or chat page in Personal Messenger.
4. If not signed in, the app asks the visitor to continue with Google.
5. The backend verifies the sign-in and creates an internal account if the user is new.
6. The user is taken to the conversation with the owner.
7. The user sends a message.
8. If the owner is online, they receive the message in real time.
9. If the owner is offline, the message is saved and they can read it when they come back.

### Flow B — Starting a conversation with another user

1. The user signs in with Google.
2. The user opens search.
3. The user searches by username.
4. The user selects the matching profile.
5. The user clicks **Message**.
6. The app opens the existing conversation, or creates a new one.
7. Both users can exchange messages.

### Flow C — Returning to a conversation

1. The user opens the app while their session is still valid.
2. The app loads the conversation list.
3. The user selects a conversation.
4. The app loads message history page by page.
5. New messages arrive through the real-time connection.

## 6. Functional Requirements

Priority levels: **P0** = required for the MVP.

### 6.1 Authentication — P0

- Sign in with Google OAuth 2.0 / OpenID Connect.
- An internal account is created automatically on a user's first sign-in.
- The Google `sub` (subject) claim is used as the stable external identifier.
- Every user has an internal user ID.
- The backend provides an endpoint that returns the currently signed-in user.
- Users can sign out.
- Sessions use cookies with appropriate security settings.
- Private endpoints reject requests without a valid session.
- Changing the email on the same Google account must not create a duplicate account.

### 6.2 User Profile — P0

User data includes:

- Internal user ID
- Google subject identifier
- Email
- Display name
- Avatar URL
- Unique username
- Account creation and last update timestamps

Rules:

- Usernames are unique and searchable.
- Users can view other users' public profiles.
- Email is hidden from other users by default.
- The username is the identity used for search and profile links.
- Users cannot directly change their internal user ID or OAuth identity.

### 6.3 User Search — P0

- Users can search for other users by username.
- Search results never include private email addresses.
- Users can open a profile from the search results.
- Users can start a one-to-one conversation from a profile.
- Search input is validated and the number of results is limited.
- Each user appears at most once in the results.
- Users are never offered the option to start a conversation with themselves.

### 6.4 Direct Messaging — P0

- Conversations are between two users.
- Users can send text messages.
- Messages are stored in PostgreSQL.
- Each message has a unique ID, a sender, a conversation, a body, and a timestamp.
- Messages have a consistent order.
- Message history is loaded with pagination.
- If two users already have a conversation, it is reused instead of creating a new one.
- Messages are not lost when the recipient is offline.
- Users can only read conversations they are a member of.
- Users cannot send messages to conversations they do not have access to.

### 6.5 Real-time Communication — P0

- New messages are delivered over a WebSocket connection.
- Users receive new messages without reloading the page.
- The backend authenticates WebSocket connections.
- Users only receive events for conversations they have access to.
- The backend handles dropped connections.
- The frontend shows the connection status.
- The frontend reconnects after a dropped connection, waiting a little longer after each failed attempt (exponential backoff).
- A message sent over a dropped connection is not shown as sent until the server confirms it.
- After reconnecting, the app fetches any messages it missed.
- Retrying a send must never show the same message twice.

**Implementation note:** WebSocket is only the real-time transport; PostgreSQL remains the source of truth. A message must be validated and saved before the server confirms that it was sent.

### 6.6 Conversation List — P0

- Show the user's conversations.
- Show who the other person is in each conversation.
- Show a preview of the last message.
- Show the time of the last message.
- Sort conversations by most recent activity.
- Show an unread message indicator (an MVP polish item).

### 6.7 User Interface — P0

Minimum pages:

1. Landing / sign-in page
2. Sign in with Google
3. Conversation list
4. User search
5. User profile
6. Conversation page
7. Loading, empty, error, and disconnected states

Design principles:

- Minimal and focused on conversations.
- Responsive on desktop and mobile browsers.
- Fast to load.
- No excessive animation.
- Basic keyboard navigation and sufficient text contrast.

### 6.8 Portfolio Integration — P0 (required for the first public release)

- The portfolio site has a **Chat with me** link.
- The link points to the owner's profile or the relevant conversation.
- The link can be opened directly in a browser.
- Visitors who are not signed in are taken through sign-in first.
- After signing in, the user returns to where they were going.
- Links and redirects only accept allowed destinations, to prevent open redirects.

## 7. Technical Requirements

### Frontend

- React
- Vite
- TypeScript
- REST API for authentication, profiles, search, the conversation list, and message history
- WebSocket for real-time messages
- Responsive layout

### Backend

- Go
- Gin for HTTP routing and middleware
- `pgx` for PostgreSQL access
- REST API with JSON
- WebSocket for real-time communication
- Clear separation of configuration, routing, middleware, business logic, and data access
- Consistent input validation and error handling

### Database

- PostgreSQL
- Database migrations tracked in version control
- An internal primary key for every entity
- Foreign keys and unique constraints to protect data integrity
- Indexes for user search, the conversation list, and message retrieval

Main entities:

- `users`
- `conversations`
- `conversation_members`
- `messages`
- `sessions` (if sessions are stored in the database)

The final schema is decided when the database design and migrations are prepared.

### Infrastructure

- Docker for deployment
- Docker Compose for development and the initial deployment
- A reverse proxy with HTTPS in production
- Configuration through environment variables
- No secrets stored in the repository
- A persistent volume for PostgreSQL
- Database backups and a documented restore procedure
- Logs for requests, errors, and relevant operational events

## 8. Security and Privacy

Minimum security requirements:

- Validate the OAuth callback and its `state` parameter.
- Validate OpenID Connect according to the sign-in flow used.
- Session cookies use `HttpOnly`, `Secure` in production, and an appropriate `SameSite` setting.
- Protect relevant flows against CSRF.
- Check the `Origin` of WebSocket connections.
- Check permissions on the server for every access to a conversation or message.
- Rate-limit sign-in, search, and message sending.
- Limit message payload size.
- Validate and normalize all input.
- Manage secrets through environment variables or a secret manager.
- Never write emails, tokens, session IDs, or credentials to logs.
- Signing out invalidates the session on the server.
- Protect database backups and restrict who can access them.

Signing in with Google only proves the user controls a Google account; it does not verify their real name.

The MVP does not offer end-to-end encryption. Messages are stored in the database and must be protected through access control, server security, and sound operational practices.

## 9. Non-Functional Requirements

### Reliability

- Messages confirmed as saved must still be available after the app restarts.
- A connection problem must never cause the UI to show a message as sent without server confirmation.
- The app can recover the WebSocket connection after it drops.
- An error in one request must not crash the server.

### Performance

Initial targets, measured in a defined deployment and test environment:

- The health check endpoint responds in under 200 ms under normal conditions.
- Simple read endpoints aim for a p95 latency under 300 ms at the defined test load.
- A successfully processed message aims to reach the recipient in under 500 ms on a normal connection and server.

These are starting targets, not universal guarantees. Results must be measured with a documented test load and environment.

### Maintainability

- The code structure is easy to understand and extend.
- Business logic does not depend directly on HTTP handlers.
- Development and production configuration are kept separate.
- Database schema changes use migrations.
- The API is documented.
- Core features have automated tests.

### Compatibility

- Supports modern browsers.
- The layout works on desktop and mobile.
- Public deployments use HTTPS.

## 10. MVP Acceptance Criteria

The MVP is complete when all of the following are true:

- [ ] Users can sign in with Google.
- [ ] New users get an internal account automatically.
- [ ] Sign-in sessions stay valid according to the session policy.
- [ ] Users can sign out.
- [ ] Users can find other users by username.
- [ ] Users can start a one-to-one conversation.
- [ ] Users can send and receive messages in real time.
- [ ] Messages are stored in PostgreSQL.
- [ ] Conversation history is still available after the app restarts.
- [ ] Users can load older messages with pagination.
- [ ] Users who are not members of a conversation cannot read it or send messages to it.
- [ ] The WebSocket connection recovers after it drops.
- [ ] Retrying a send does not create duplicate messages.
- [ ] The app can be deployed with Docker over HTTPS.
- [ ] The portfolio site has a link to start a chat with the owner.
- [ ] The README covers setup, configuration, architecture, and deployment.
- [ ] Core tests and basic security checks have been done.

## 11. Development Milestones

### Milestone 1 — Foundation

- Set up the repository and backend structure.
- Set up React, Vite, TypeScript, and Gin.
- Set up PostgreSQL with Docker Compose.
- Configure environment variables.
- Add a health check.
- Connect to the database and add the first migration.

**Done when:** the frontend, backend, and database all run locally.

### Milestone 2 — Authentication and Profiles

- Integrate Google OAuth.
- Create internal accounts.
- Manage sessions.
- Add authentication middleware.
- Add user profile endpoints.
- Add unique usernames and user search.

**Done when:** users can sign in and find other users.

### Milestone 3 — Messaging API

- Add the conversations and messages tables.
- Create one-to-one conversations.
- Send messages through the API.
- Load message history with pagination.
- Check conversation membership.

**Done when:** sending and reading messages works and is persisted, even though it is not real-time yet.

### Milestone 4 — Real-time Messaging

- Authenticate WebSocket connections.
- Add a connection manager.
- Route events by user and conversation.
- Save messages before confirming them.
- Reconnect and sync missed messages.
- Prevent duplicates on retry.

**Done when:** two users can chat in real time, and the connection recovers after it drops.

### Milestone 5 — Production Readiness

- Polish the UI.
- Add rate limiting and logging.
- Add automated tests.
- Deploy with Docker.
- Set up HTTPS and a domain.
- Set up database backups.
- Write documentation and integrate with the portfolio.

**Done when:** the app is publicly available and visitors can use it.

## 12. Future Roadmap

These features may be considered once the MVP is stable:

**Phase 2 — Messaging improvements**

- Read receipts
- Typing indicators
- Online status and last seen
- Message notifications
- Profile management and blocking users

**Phase 3 — Voice and video**

- WebRTC for audio and video
- Signaling over WebSocket
- STUN/TURN servers for connectivity
- Evaluate an SFU (Selective Forwarding Unit) if group calls are needed

**Phase 4 — Experimental integrations**

- AI agent integration
- Agent status and event notifications
- Self-hosted integration experiments

Each phase needs its own review of requirements and running costs before it starts. No roadmap feature is required to complete the MVP.

## 13. Success Metrics

Success is not measured by user count alone.

### Product metrics

- Number of users who complete sign-in
- Number of users who start a conversation
- Number of conversations with real activity
- Message delivery success rate
- How often the owner and early users come back

### Engineering metrics

- Percentage of messages successfully saved and delivered
- API and message delivery latency
- Reconnect success rate
- Number of server and WebSocket errors
- Backup and restore success
- Ability to redeploy without losing persistent data

### Portfolio outcomes

- The app is available on a public domain.
- The architecture and deployment documentation is easy to read.
- The source code shows a clear separation of responsibilities.
- Technical decisions and trade-offs can be explained.
- The project is a concrete example of backend and infrastructure skills.

## 14. Key Risks

| Risk | Mitigation |
|---|---|
| No active users | Keep using the app personally and treat it as an engineering project |
| Spam or abuse | Google sign-in, rate limiting, blocking, and basic moderation |
| Messages lost during reconnect | Database persistence, acknowledgments, and re-syncing |
| Real-time complexity grows | Start with direct messages and a single backend instance |
| Infrastructure costs grow | Start with a VPS and the minimum set of services |
| OAuth fails after deployment | Keep local and production configuration separate and test callback URLs |
| Feature scope grows too large | Hold the MVP boundary and evaluate the roadmap against real needs |

## 15. Final Scope Decision

The first version of Personal Messenger focuses on:

**Google OAuth + user search + direct messaging + PostgreSQL persistence + WebSocket + self-hosted deployment.**

Group chats, voice and video calls, AI agents, and mobile apps are outside the MVP scope.

The top priority is one communication flow that works correctly, is secure, is maintainable, and can be used by both the owner and portfolio visitors.

The MVP does not need large user growth to succeed. The project succeeds if it meets the initial communication needs and serves as an engineering demonstration that runs and can be explained in technical detail.
