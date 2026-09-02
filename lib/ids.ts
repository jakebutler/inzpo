import { monotonicFactory } from "ulid";

const monotonicUlid = monotonicFactory();

export function newId(): string {
  return monotonicUlid();
}
