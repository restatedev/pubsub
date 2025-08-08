/**
 *   MIT License
 *
 *   Copyright (c) 2023-2025 - Restate Software, Inc., Restate GmbH
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE
 */
import type {
  Duration,
  ConnectionOpts,
  Send,
} from "@restatedev/restate-sdk-clients";

/**
 * Types for creating a pubsub client.
 * These types define the options required to create a pubsub client
 * and the options for pulling messages from a pubsub topic.
 */
export type CreatePubsubClientOptionsV1 = ConnectionOpts &
  PubsubClientOptionsV1;

export type PubsubClientOptionsV1 = {
  /**
   * The name of the pubsub virtual object.
   */
  name: string;
  /**
   * Optional interval for pulling messages.
   * Defaults to 1 second if not provided.
   */
  pullInterval?: Duration;
};

export type PubsubClientV1 = {
  /**
   * Pull messages from the pubsub topic.
   * @param pullOpts The options for pulling messages.
   * @returns A stream of messages.
   */
  pull: (pullOpts: PullOptions) => AsyncGenerator;
  /**
   * Create a Server-Sent Events (SSE) stream for the pubsub topic.
   * @param pullOpts The options for the SSE stream.
   * @returns A ReadableStream that emits messages as SSE events.
   */
  sse: (pullOpts: PullOptions) => ReadableStream<Uint8Array>;
  /**
   * Publish a message to the pubsub topic.
   * @param topic The topic to publish to.
   * @param message The message to publish.
   * @param idempotencyKey An optional idempotency key for the publish operation.
   * @returns A promise that resolves when the message is published.
   */
  publish: (
    topic: string,
    message: unknown,
    idempotencyKey?: string,
  ) => PromiseLike<Send>;
  /**
   * Truncate messages from the head of the pubsub topic.
   * @param topic The topic to truncate messages from.
   * @param count The number of messages to remove from the head.
   * @param idempotencyKey An optional idempotency key for the truncation operation.
   * @returns A promise that resolves when the truncation is complete.
   */
  truncate: (
    topic: string,
    count: number,
    idempotencyKey?: string,
  ) => PromiseLike<void>;
};

/**
 * Options for pulling messages from a pubsub topic.
 */
export type PullOptions = {
  /**
   * The topic to pull messages from.
   */
  topic: string;

  /**
   * Optional offset to start pulling messages from.
   * If not provided, messages will be pulled from the latest offset.
   */
  offset?: number;
  /**
   * Optional signal to abort the pull operation.
   */
  signal?: AbortSignal;
};
