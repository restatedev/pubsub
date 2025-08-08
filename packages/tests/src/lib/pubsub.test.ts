/*
 * Copyright (c) 2023-2024 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate SDK for Node.js/TypeScript,
 * which is released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RestateTestEnvironment } from "@restatedev/restate-sdk-testcontainers";
import { createPubsubObject } from "@restatedev/pubsub";
import { connect, type Ingress } from "@restatedev/restate-sdk-clients";
import { randomUUID } from "node:crypto";
import {
  createPubsubClient,
  type PubsubClientV1,
} from "@restatedev/pubsub-client";

const PUBSUB_OBJECT_NAME = "pubsub";

describe("Pubsub", () => {
  let restateTestEnvironment: RestateTestEnvironment;
  let ingressClient: Ingress;
  let client: PubsubClientV1;

  // Deploy Restate and the Service endpoint once for all the tests in this suite
  beforeAll(async () => {
    restateTestEnvironment = await RestateTestEnvironment.start({
      services: [createPubsubObject(PUBSUB_OBJECT_NAME)],
    });
    ingressClient = connect({ url: restateTestEnvironment.baseUrl() });
    client = createPubsubClient(ingressClient, {
      name: PUBSUB_OBJECT_NAME,
    });
  }, 20_000);

  // Stop Restate and the Service endpoint
  afterAll(async () => {
    await restateTestEnvironment.stop();
  });

  it.concurrent(
    "Push events and subscribe from 0",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      await client.publish(topic, "123", "123");

      expect((await client.pull({ topic, offset: 0 }).next()).value).toBe(
        "123",
      );
    },
  );

  it.concurrent("Subscribe then push event", { timeout: 20_000 }, async () => {
    const topic = randomUUID();

    const awaitNext = client.pull({ topic, offset: 0 }).next();

    await client.publish(topic, "123", "123");

    expect((await awaitNext).value).toBe("123");
  });

  it.concurrent(
    "Publish 100 events and read them concurrently with random delays",
    { timeout: 60_000 },
    async () => {
      const topic = randomUUID();

      const eventCount = 100;
      const publishedMessages = new Set<string>();
      const receivedMessages = new Set<string>();

      // Start the reader first
      const readerPromise = (async () => {
        const pullIterator = client.pull({ topic, offset: 0 });
        let messagesReceived = 0;

        for await (const message of pullIterator) {
          receivedMessages.add(message as string);
          messagesReceived++;

          // Add random delay between reads (0-50ms)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 50),
          );

          if (messagesReceived >= eventCount) {
            break;
          }
        }
      })();

      // Start publishing events concurrently
      const publishPromises = [];
      for (let i = 0; i < eventCount; i++) {
        const message = `message-${i.toString()}`;
        publishedMessages.add(message);

        const publishPromise = (async () => {
          // Add random delay before publishing (0-100ms)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 100),
          );
          await client.publish(topic, message, `key-${i.toString()}`);
        })();

        publishPromises.push(publishPromise);
      }

      // Wait for all publishing to complete and all messages to be received
      await Promise.all([Promise.all(publishPromises), readerPromise]);

      // Verify all published messages were received
      expect(receivedMessages.size).toBe(eventCount);
      expect(receivedMessages).toEqual(publishedMessages);
    },
  );

  it.concurrent(
    "Basic truncate functionality",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      // Publish 5 messages
      await client.publish(topic, "message-0", "key-0");
      await client.publish(topic, "message-1", "key-1");
      await client.publish(topic, "message-2", "key-2");
      await client.publish(topic, "message-3", "key-3");
      await client.publish(topic, "message-4", "key-4");

      // Truncate first 2 messages
      await client.truncate(topic, 2);

      // Pull from offset 2 (new head) should work
      const messages = [];
      const pullIterator = client.pull({ topic, offset: 2 });
      let messageCount = 0;
      for await (const message of pullIterator) {
        messages.push(message);
        messageCount++;
        if (messageCount >= 3) break; // Get remaining 3 messages
      }

      expect(messages).toEqual(["message-2", "message-3", "message-4"]);
    },
  );

  it.concurrent(
    "Subscribing from a truncated index should fail",
    { timeout: 120_000 },
    async () => {
      const topic = randomUUID();

      // Publish 3 messages
      await client.publish(topic, "message-0", "key-0");
      await client.publish(topic, "message-1", "key-1");
      await client.publish(topic, "message-2", "key-2");

      // Truncate first 2 messages
      await client.truncate(topic, 2);

      // Try to pull from offset 0 (below new head) should fail
      const pullIterator = client.pull({ topic, offset: 0 });
      await expect(pullIterator.next()).rejects.toThrow(
        "Offset 0 is lower than the head 2",
      );
    },
  );

  it.concurrent(
    "Subscribing after truncation should work normally",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      // Publish 3 messages
      await client.publish(topic, "message-0", "key-0");
      await client.publish(topic, "message-1", "key-1");
      await client.publish(topic, "message-2", "key-2");

      // Truncate first message
      await client.truncate(topic, 1);

      // Subscribe from new head should work
      const messages = [];
      const pullIterator = client.pull({ topic, offset: 1 });
      let messageCount = 0;
      for await (const message of pullIterator) {
        messages.push(message);
        messageCount++;
        if (messageCount >= 2) break; // Get remaining 2 messages
      }

      expect(messages).toEqual(["message-1", "message-2"]);
    },
  );

  it.concurrent(
    "Subscribe then truncate should reject pending subscriptions below the range",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      // Publish 2 messages
      await client.publish(topic, "message-0", "key-0");
      await client.publish(topic, "message-1", "key-1");

      // Start a subscription that will wait (offset beyond tail)
      const pullPromise = client.pull({ topic, offset: 3 }).next();

      // Give some time for the subscription to be registered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Truncate all messages (this should reject the pending subscription)
      await client.truncate(topic, 5);

      // Now publish more messages
      await client.publish(topic, "message-2", "key-2");
      await client.publish(topic, "message-3", "key-3");

      // The pull should be rejected
      expect((await pullPromise).value).toBe("message-3");
    },
  );

  it.concurrent(
    "Truncate more messages than available should truncate all",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      // Publish 3 messages
      await client.publish(topic, "message-0", "key-0");
      await client.publish(topic, "message-1", "key-1");
      await client.publish(topic, "message-2", "key-2");

      // Truncate more messages than available
      await client.truncate(topic, 10);

      // Try to pull from the tail (offset 3) should wait for new messages
      const pullIterator = client.pull({ topic, offset: 3 });
      const pullPromise = pullIterator.next();

      // Publish a new message
      await client.publish(topic, "new-message", "new-key");

      // Should receive the new message
      const result = await pullPromise;
      expect(result.value).toBe("new-message");
    },
  );

  it.concurrent(
    "Pull without offset should start from tail (latest offset)",
    { timeout: 10_000 },
    async () => {
      const topic = randomUUID();

      // Publish some messages first
      await client.publish(topic, "old-message-1", "key-1");
      await client.publish(topic, "old-message-2", "key-2");

      // Start pulling without offset - should wait for new messages
      const pullIterator = client.pull({ topic });
      let pullPromise = pullIterator.next();

      // Publish a new message after starting the pull
      await client.publish(topic, "new-message", "key-3");

      // Now pull until new message is found
      while ((await pullPromise).value !== "new-message") {
        pullPromise = pullIterator.next();
      }
    },
  );

  it.concurrent(
    "Pull without offset on empty topic should wait for first message",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      // Start pulling without offset on empty topic
      const pullIterator = client.pull({ topic });
      const pullPromise = pullIterator.next();

      // Publish the first message
      await client.publish(topic, "first-message", "key-1");

      // Should receive the first message
      const result = await pullPromise;
      expect(result.value).toBe("first-message");
    },
  );

  it.concurrent(
    "Pull without offset should continue receiving new messages",
    { timeout: 20_000 },
    async () => {
      const topic = randomUUID();

      // Publish some existing messages
      await client.publish(topic, "existing-1", "key-1");
      await client.publish(topic, "existing-2", "key-2");

      // Start pulling without offset
      const pullIterator = client.pull({ topic });

      // Publish new messages
      await client.publish(topic, "new-1", "key-3");
      await client.publish(topic, "new-2", "key-4");

      while ((await pullIterator.next()).value !== "new-1") {
        // Loop until new-1 is there
      }

      const result2 = await pullIterator.next();
      expect(result2.value).toBe("new-2");
    },
  );
});
