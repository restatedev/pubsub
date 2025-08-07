import type { Duration } from "@restatedev/restate-sdk";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Subscription {
  offset: number;
  id: string;
}

export interface Notification {
  newOffset: number;
  newMessages: any[];
}

export const PullRequest = z.object({
  offset: z.number(),
});

export type PullRequest = z.infer<typeof PullRequest>;

export const PullResponse = z.object({
  messages: z.any({}).array(),
  nextOffset: z.number(),
});

export type PullResponse = z.infer<typeof PullResponse>;

export interface PubsubApiV1 {
  pull: (ctx: any, req: PullRequest) => Promise<PullResponse>;
  publish: (ctx: any, message: unknown) => Promise<void>;
  subscribe: (ctx: any, subscription: Subscription) => Promise<void>;
}

export type PubsubObjectOptions = {
  pullTimeout?: Duration;
};
