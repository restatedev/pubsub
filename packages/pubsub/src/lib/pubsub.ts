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
  type PubSubState,
  type Notification,
  type Subscription,
  PullRequest,
  PullResponse,
  type PubsubObjectOptions,
} from "./types.js";

const handler = restate.handlers.object;

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
    const messages = (await ctx.get("messages")) ?? [];
    if (offset < messages.length) {
      return {
        messages: messages.slice(offset),
        nextOffset: messages.length,
      };
    }
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
    const messages = (await ctx.get("messages")) ?? [];
    messages.push(message);
    ctx.set("messages", messages);

    const subscriptions = (await ctx.get("subscription")) ?? [];
    for (const { id, offset } of subscriptions) {
      const notification = {
        newOffset: messages.length,
        newMessages: messages.slice(offset),
      };
      ctx.resolveAwakeable(id, notification);
    }
    ctx.clear("subscription");
  };

  const subscribe = async (
    ctx: restate.ObjectContext<PubSubState>,
    subscription: Subscription,
  ) => {
    const messages = (await ctx.get("messages")) ?? [];
    if (subscription.offset < messages.length) {
      const notification = {
        newOffset: messages.length,
        newMessages: messages.slice(subscription.offset),
      };
      ctx.resolveAwakeable(subscription.id, notification);
      return;
    }
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
