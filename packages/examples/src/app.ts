/*
 * Copyright (c) 2023 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate Examples for the Node.js/TypeScript SDK,
 * which is released under the MIT license.
 *
 * You can find a copy of the license in the file LICENSE
 * in the root directory of this repository or package or at
 * https://github.com/restatedev/examples/blob/main/LICENSE
 */

import { createPubsubObject } from "@restatedev/pubsub";
import { serve } from "@restatedev/restate-sdk";

const pubsub = createPubsubObject("sessions", {});

void serve({
  services: [pubsub],
});
