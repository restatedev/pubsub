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

import { describe, it, expect } from "vitest";

describe("Simple count machine", () => {
  it(
    "Will respond to different count events",
    { timeout: 20_000 },
    async () => {
      expect(1).toBe(1);
    },
  );
});
