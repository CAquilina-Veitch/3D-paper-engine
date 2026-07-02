import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: { name: "model", root: "packages/model" },
  },
  {
    test: { name: "engine", root: "packages/engine" },
  },
]);
