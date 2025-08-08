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
import * as clients from "@restatedev/restate-sdk-clients";
import type { PubsubApiV1 } from "@restatedev/pubsub-types";
import type { CreatePubsubClientOptionsV1, PullOptions } from "./types.js";

/**
 * Creates a pubsub client for interacting with a pubsub service.
 *
 * @param pubsubOptions The options for creating the pubsub client.
 * @param pubsubOptions.name The name of the pubsub client.
 * @param pubsubOptions.ingressUrl The URL for the pubsub ingress.
 * @param pubsubOptions.headers Optional headers to include in requests.
 * @param pubsubOptions.pullInterval Optional interval for pulling messages.
 *                                  Defaults to 1 second if not provided.
 * @returns A pubsub client instance.
 */
export function createPubsubClient(pubsubOptions: CreatePubsubClientOptionsV1) {
  return {
    /**
     * Pull messages from the pubsub topic.
     * @param opts The options for pulling messages.
     * @returns A stream of messages.
     */
    pull: (opts: PullOptions) => pullMessages(pubsubOptions, opts),

    /**
     * Create a Server-Sent Events (SSE) stream for the pubsub topic.
     * @param opts The options for the SSE stream.
     * @returns A ReadableStream that emits messages as SSE events.
     */
    sse: (opts: PullOptions) => sse(pubsubOptions, opts),

    /**
     * Publish a message to the pubsub topic.
     * @param topic The topic to publish to.
     * @param message The message to publish.
     * @param idempotencyKey An optional idempotency key for the message.
     * @returns A promise that resolves when the message is published.
     */
    publish: (topic: string, message: unknown, idempotencyKey?: string) => {
      const ingress = clients.connect({
        url: pubsubOptions.ingressUrl,
        headers: pubsubOptions.headers,
      });
      return ingress
        .objectSendClient<PubsubApiV1>({ name: pubsubOptions.name }, topic)
        .publish(message, clients.rpc.sendOpts({ idempotencyKey }));
    },

    /**
     * Truncate messages from the head of the pubsub topic.
     * @param topic The topic to truncate messages from.
     * @param count The number of messages to remove from the head.
     * @returns A promise that resolves when the truncation is complete.
     */
    truncate: (topic: string, count: number) => {
      const ingress = clients.connect({
        url: pubsubOptions.ingressUrl,
        headers: pubsubOptions.headers,
      });
      return ingress
        .objectClient<PubsubApiV1>({ name: pubsubOptions.name }, topic)
        .truncate(count);
    },
  };
}

export function sse(
  pubsubOpts: CreatePubsubClientOptionsV1,
  opts: PullOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`event: ping\n`));
        const content = pullMessages(pubsubOpts, opts);
        for await (const message of content) {
          const chunk = `data: ${JSON.stringify(message)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
        throw error;
      }
    },
  });
}

export async function* pullMessages(
  pubsubOptions: CreatePubsubClientOptionsV1,
  opts: PullOptions,
) {
  const ingress = clients.connect({
    url: pubsubOptions.ingressUrl,
    headers: pubsubOptions.headers,
  });
  const signal = opts.signal;
  const delay = durationToMs(pubsubOptions.pullInterval ?? { seconds: 1 });
  let offset = opts.offset;
  while (!(signal?.aborted ?? false)) {
    try {
      const { messages, nextOffset } = await ingress
        .objectClient<PubsubApiV1>({ name: pubsubOptions.name }, opts.topic)
        .pull({ offset }, clients.rpc.opts({ signal }));
      for (const message of messages) {
        yield message;
      }
      offset = nextOffset;
    } catch (error) {
      if (!(error instanceof clients.HttpCallError) || error.status !== 408) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function durationToMs(duration: clients.Duration): number {
  if (duration.milliseconds !== undefined) {
    return duration.milliseconds;
  }
  if (duration.seconds !== undefined) {
    return duration.seconds * 1000;
  }
  if (duration.minutes !== undefined) {
    return duration.minutes * 60 * 1000;
  }
  if (duration.hours !== undefined) {
    return duration.hours * 60 * 60 * 1000;
  }
  if (duration.days !== undefined) {
    return duration.days * 24 * 60 * 60 * 1000;
  }
  throw new Error(`Unsupported duration unit: ${JSON.stringify(duration)}`);
}
