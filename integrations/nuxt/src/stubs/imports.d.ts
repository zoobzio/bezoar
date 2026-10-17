// Typecheck-only stub for the Nuxt `#imports` virtual module, on the server.
import type { BezoarRuntimeConfig } from "../config";

export declare function useRuntimeConfig(): {
  bezoar: BezoarRuntimeConfig;
};

export interface NitroApp {
  hooks: {
    hook: (name: "close", fn: () => Promise<void> | void) => void;
  };
}

export declare function defineNitroPlugin<T>(
  plugin: (nitroApp: NitroApp) => T,
): (nitroApp: NitroApp) => T;
