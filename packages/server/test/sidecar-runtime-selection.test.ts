import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPreferredRuntimeVariants,
  isVariantCompatibleWithPreference,
  type RuntimeCapabilities,
} from "../src/services/sidecar/sidecar-runtime-selection.js";

function capabilities(overrides: Partial<RuntimeCapabilities>): RuntimeCapabilities {
  return {
    platform: "linux",
    arch: "x64",
    gpuVendors: [],
    preferCuda: false,
    preferHip: false,
    preferRocm: false,
    preferSycl: false,
    preferVulkan: false,
    systemLlamaPath: null,
    ...overrides,
  };
}

test("Linux NVIDIA preference falls back to Vulkan and CPU when CUDA assets are unavailable", () => {
  assert.deepEqual(
    buildPreferredRuntimeVariants(
      capabilities({ gpuVendors: ["nvidia"], preferCuda: true, preferVulkan: true }),
      "nvidia",
    ),
    ["linux-x64-cuda", "linux-x64-vulkan", "linux-x64-cpu"],
  );
});

test("Linux NVIDIA preference still has a CPU escape hatch without Vulkan", () => {
  assert.deepEqual(
    buildPreferredRuntimeVariants(
      capabilities({ gpuVendors: ["nvidia"], preferCuda: true, preferVulkan: false }),
      "nvidia",
    ),
    ["linux-x64-cuda", "linux-x64-cpu"],
  );
});

test("Linux NVIDIA fallback variants satisfy the stored runtime preference", () => {
  assert.equal(isVariantCompatibleWithPreference("linux-x64-cuda", "nvidia"), true);
  assert.equal(isVariantCompatibleWithPreference("linux-x64-vulkan", "nvidia"), true);
  assert.equal(isVariantCompatibleWithPreference("linux-x64-cpu", "nvidia"), true);
  assert.equal(isVariantCompatibleWithPreference("linux-x64-rocm", "nvidia"), false);
});
