import type { Duration } from "@restatedev/restate-sdk-clients";

export type CreatePubsubClientOptionsV1 = {
  name: string;
  ingressUrl: string;
  headers?: Record<string, string>;
  pullInterval?: Duration;
};

export type PullOptions = {
  topic: string;
  signal?: AbortSignal;
  offset?: number;
};
