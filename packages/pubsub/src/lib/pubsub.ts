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
import * as restate from "@restatedev/restate-sdk";
import { serde } from "@restatedev/restate-sdk-zod";
import {
  type PubsubApiV1,
  type Notification,
  type Subscription,
  PullRequest,
  PullResponse,
  type PubsubObjectOptions,
} from "@restatedev/pubsub-types";
import { RestatePromise, TerminalError } from "@restatedev/restate-sdk";

type Metadata = {
  head: number;
  /// Excluded
  tail: number;
};

export interface PubSubState {
  messagesMetadata: Metadata;
  subscription: Subscription[];
  [key: Exclude<string, "messagesMetadata" | "subscription">]: unknown;
}

const handler = restate.handlers.object;

function defaultMetadata(): Metadata {
  return { head: 0, tail: 0 };
}

async function loadMessagesInRange(
  ctx: restate.ObjectSharedContext<PubSubState>,
  fromIncluded: number,
  toExcluded: number,
): Promise<unknown[]> {
  if (fromIncluded == toExcluded) {
    return [];
  }

  const promises = [];
  for (let i = fromIncluded; i < toExcluded; i++) {
    promises.push(
      (ctx.get(`m_${i.toString()}`) as RestatePromise<unknown>).map(
        (value, failure) => {
          if (failure) {
            throw failure;
          }
          if (value === undefined) {
            throw new TerminalError("Value is unexpected to be undefined");
          }
          return value;
        },
      ),
    );
  }

  return RestatePromise.all(promises);
}

/**
 * Create a pubsub object.
 * @param name The name of the pubsub object to create.
 * @param options The options for the pubsub object.
 * @returns The created pubsub object.
 */
export function createPubsubObject<P extends string>(
  name: P,
  options?: PubsubObjectOptions,
): restate.VirtualObjectDefinition<P, PubsubApiV1> {
  const pullTimeout = options?.pullTimeout ?? { seconds: 30 };

  const pull = async (
    ctx: restate.ObjectSharedContext<PubSubState>,
    { offset }: PullRequest,
  ) => {
    const metadata = (await ctx.get("messagesMetadata")) ?? defaultMetadata();

    if (offset < metadata.head) {
      // Offset before the head
      throw new TerminalError(
        `Offset ${offset.toString()} is lower than the head ${metadata.head.toString()}`,
      );
    }

    if (offset < metadata.tail) {
      // Load between offset and tail
      const messages = await loadMessagesInRange(ctx, offset, metadata.tail);
      return {
        messages,
        nextOffset: metadata.tail,
      };
    }

    // Offset after the tail, need to wait for this one
    const { id, promise } = ctx.awakeable<Notification>();
    ctx
      .objectSendClient<PubsubApiV1>({ name }, ctx.key)
      .subscribe({ offset, id });
    const { newMessages, newOffset } = await promise.orTimeout(pullTimeout);
    return {
      messages: newMessages,
      nextOffset: newOffset,
    };
  };

  const publish = async (
    ctx: restate.ObjectContext<PubSubState>,
    message: unknown,
  ) => {
    // Write the new message
    const metadata = (await ctx.get("messagesMetadata")) ?? defaultMetadata();
    ctx.set(`m_${metadata.tail.toString()}`, message);
    metadata.tail += 1;
    ctx.set("messagesMetadata", metadata);

    // Awake awaiting subscriptions
    const subscriptions = (await ctx.get("subscription")) ?? [];
    for (const { id, offset } of subscriptions) {
      const notification = {
        newOffset: metadata.tail,
        // Lil' implementation note here: if the get value is already loaded,
        // this won't write a new message to the journal for the same get!
        newMessages: await loadMessagesInRange(ctx, offset, metadata.tail),
      };
      ctx.resolveAwakeable(id, notification);
    }
    ctx.clear("subscription");
  };

  const subscribe = async (
    ctx: restate.ObjectContext<PubSubState>,
    subscription: Subscription,
  ) => {
    const metadata = (await ctx.get("messagesMetadata")) ?? defaultMetadata();

    if (subscription.offset < metadata.head) {
      // Offset before the head
      ctx.rejectAwakeable(
        subscription.id,
        `Offset ${subscription.offset.toString()} is lower than the head ${metadata.head.toString()}`,
      );
      return;
    }

    if (subscription.offset < metadata.tail) {
      // Subscription offset before the tail, let's return messages back
      const notification = {
        newOffset: metadata.tail,
        newMessages: await loadMessagesInRange(
          ctx,
          subscription.offset,
          metadata.tail,
        ),
      };
      ctx.resolveAwakeable(subscription.id, notification);
      return;
    }

    // Subscription offset after the tail, time to remember this awakeable.
    const sub = (await ctx.get("subscription")) ?? [];
    sub.push(subscription);
    ctx.set("subscription", sub);
  };

  return restate.object({
    name,
    handlers: {
      pull: handler.shared(
        {
          input: serde.zod(PullRequest),
          output: serde.zod(PullResponse),
        },
        pull,
      ),

      publish,
      subscribe,
    } satisfies PubsubApiV1,
    options: {
      enableLazyState: true,
    },
  });
}

/**
 * Create a publisher for a specific pubsub object.
 *
 * @param name The name of the pubsub object to create a publisher for.
 * @returns A function that publishes messages to the specified pubsub object.
 */
export function createPubsubPublisher(name: string) {
  return (ctx: restate.Context, topic: string, message: unknown) => {
    ctx.objectSendClient<PubsubApiV1>({ name }, topic).publish(message);
  };
}
