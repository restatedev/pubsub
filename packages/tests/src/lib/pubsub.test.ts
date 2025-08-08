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
import * as clients from "@restatedev/restate-sdk-clients";
import { RestateTestEnvironment } from "@restatedev/restate-sdk-testcontainers";
import { createPubsubObject } from "@restatedev/pubsub";
import { randomUUID } from "node:crypto";
import { createPubsubClient } from "@restatedev/pubsub-client";

const PUBSUB_OBJECT_NAME = "pubsub";

describe("Pubsub", () => {
  let restateTestEnvironment: RestateTestEnvironment;
  let rs: clients.Ingress;

  // Deploy Restate and the Service endpoint once for all the tests in this suite
  beforeAll(async () => {
    restateTestEnvironment = await RestateTestEnvironment.start({
      services: [createPubsubObject(PUBSUB_OBJECT_NAME)],
    });
    rs = clients.connect({ url: restateTestEnvironment.baseUrl() });
  }, 20_000);

  // Stop Restate and the Service endpoint
  afterAll(async () => {
    await restateTestEnvironment.stop();
  });

  it.concurrent("Push events and subscribe from 0", { timeout: 20_000 }, async () => {
    const topic = randomUUID();

    const client = createPubsubClient({
      ingressUrl: restateTestEnvironment.baseUrl(),
      name: PUBSUB_OBJECT_NAME,
    });

    await client.publish(topic, "123", "123");

    expect((await client.pull({ topic, offset: 0 }).next()).value).toBe("123");
  });

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
});
