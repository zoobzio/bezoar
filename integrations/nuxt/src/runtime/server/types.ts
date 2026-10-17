import type { BezoarRuntimeConfig } from "../../config";

declare module "nuxt/schema" {
  interface RuntimeConfig {
    bezoar: BezoarRuntimeConfig;
  }
}
