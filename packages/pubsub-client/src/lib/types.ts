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
import type { Duration } from "@restatedev/restate-sdk-clients";

/**
 * Types for creating a pubsub client.
 * These types define the options required to create a pubsub client
 * and the options for pulling messages from a pubsub topic.
 */
export type CreatePubsubClientOptionsV1 = {
  /**
   * The name of the pubsub virtual object.
   */
  name: string;
  /**
   *  Restate ingress URL for the pubsub service.
   */
  ingressUrl: string;
  /**
   * Optional headers to include in requests.
   */
  headers?: Record<string, string>;
  /**
   * Optional interval for pulling messages.
   * Defaults to 1 second if not provided.
   */
  pullInterval?: Duration;
};

/**
 * Options for pulling messages from a pubsub topic.
 */
export type PullOptions = {
  /**
   * The topic to pull messages from.
   */
  topic: string;

  /**
   * Optional offset to start pulling messages from.
   * If not provided, messages will be pulled from the latest offset.
   */
  offset?: number;
  /**
   * Optional signal to abort the pull operation.
   */
  signal?: AbortSignal;
};
