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

export function createPubsubObject<P extends string>(
  name: P,
  options?: PubsubObjectOptions,
): restate.VirtualObjectDefinition<P, PubsubApiV1> {
  const pullTimeout = options?.pullTimeout ?? { seconds: 30 };

  return restate.object({
    name,
    handlers: {
      pull: handler.shared(
        {
          input: serde.zod(PullRequest),
          output: serde.zod(PullResponse),
        },
        async (ctx: restate.ObjectSharedContext<PubSubState>, { offset }) => {
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
          const { newMessages, newOffset } =
            await promise.orTimeout(pullTimeout);
          return {
            messages: newMessages,
            nextOffset: newOffset,
          };
        },
      ),

      publish: async (
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
      },

      subscribe: async (
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
      },
    } satisfies PubsubApiV1,
  });
}

export function createPubsubPublisher(name: string) {
  return (ctx: restate.Context, topic: string, message: unknown) => {
    ctx.objectSendClient<PubsubApiV1>({ name }, topic).publish(message);
  };
}
