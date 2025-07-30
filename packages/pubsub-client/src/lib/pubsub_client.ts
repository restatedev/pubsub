import * as clients from "@restatedev/restate-sdk-clients";
import type { PubsubApiV1 } from "@restatedev/pubsub";
import type { CreatePubsubClientOptionsV1, PullOptions } from "./types.js";

export function createPubsubClient(pubsubOptions: CreatePubsubClientOptionsV1) {
  return {
    pull: (opts: PullOptions) => pullMessages(pubsubOptions, opts),
    sse: (opts: PullOptions) => sse(pubsubOptions, opts),
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
  let offset = opts.offset ?? 0;
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
