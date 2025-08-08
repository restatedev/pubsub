import { defineConfig } from "vitest/config";
import path from "path";

const isWatch =
  (process.argv.includes("--watch") || process.argv.includes("watch")) &&
  !process.argv.includes("run");

export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node",
    projects: ["packages/*"],
    watch: isWatch,
    passWithNoTests: true,
  },
  ...(isWatch && {
    resolve: {
      alias: {
        "@restatedev/pubsub-types": path.resolve(
          __dirname,
          "./packages/types/src/index.ts",
        ),
        "@restatedev/pubsub": path.resolve(
          __dirname,
          "./packages/pubsub/src/index.ts",
        ),
        "@restatedev/pubsub-client": path.resolve(
          __dirname,
          "./packages/pubsub-client/src/index.ts",
        ),
      },
      preserveSymlinks: true,
    },
    optimizeDeps: {
      exclude: [
        "@restatedev/pubsub-types",
        "@restatedev/pubsub",
        "@restatedev/pubsub-client",
        "@restatedev/test",
      ],
    },
  }),
});
