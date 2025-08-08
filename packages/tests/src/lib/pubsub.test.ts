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
import { randomUUID } from "node:crypto";
import { createPubsubClient } from "@restatedev/pubsub-client";

const PUBSUB_OBJECT_NAME = "pubsub";

describe("Pubsub", () => {
  let restateTestEnvironment: RestateTestEnvironment;

  // Deploy Restate and the Service endpoint once for all the tests in this suite
  beforeAll(async () => {
    restateTestEnvironment = await RestateTestEnvironment.start({
      services: [createPubsubObject(PUBSUB_OBJECT_NAME)],
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

      const client = createPubsubClient({
        ingressUrl: restateTestEnvironment.baseUrl(),
        name: PUBSUB_OBJECT_NAME,
      });

      await client.publish(topic, "123", "123");

      expect((await client.pull({ topic, offset: 0 }).next()).value).toBe(
        "123",
      );
    },
  );

  it.concurrent("Subscribe then push event", { timeout: 20_000 }, async () => {
    const topic = randomUUID();

    const client = createPubsubClient({
      ingressUrl: restateTestEnvironment.baseUrl(),
      name: PUBSUB_OBJECT_NAME,
    });

    const awaitNext = client.pull({ topic, offset: 0 }).next();

    await client.publish(topic, "123", "123");

    expect((await awaitNext).value).toBe("123");
  });

  it.concurrent(
    "Publish 100 events and read them concurrently with random delays",
    { timeout: 60_000 },
    async () => {
      const topic = randomUUID();

      const client = createPubsubClient({
        ingressUrl: restateTestEnvironment.baseUrl(),
        name: PUBSUB_OBJECT_NAME,
      });

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
});
