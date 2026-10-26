/** Keep in sync with inactiveGuestAge in server/cmd/api/main.go (ADR 0008). */
export const GUEST_RETENTION_DAYS = 90

export const GUEST_RETENTION_NOTE = `Guest chats are deleted after ${GUEST_RETENTION_DAYS} days without new messages.`
