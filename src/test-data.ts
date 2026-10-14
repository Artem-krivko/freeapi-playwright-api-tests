import { randomUUID } from 'node:crypto';

// Built-in UUIDs give every run unique data without another dependency.
export function newUser(role?: 'ADMIN' | 'USER') {
  const username = `qa${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  return {
    username,
    email: `${username}@example.com`,
    password: `Qa${randomUUID()}!`,
    ...(role ? { role } : {}),
  };
}

export function uniqueName(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
