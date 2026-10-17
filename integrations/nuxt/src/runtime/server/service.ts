import type { Bezoar, Bundle, Definition, Executor } from "bezoar";

import type { BezoarRuntimeConfig } from "../../config";

import { useRuntimeConfig } from "#imports";
import { pg } from "@bezoar/pg";
import { pglite } from "@bezoar/pglite";
import { makeBezoar } from "bezoar";

export type { Arguments, Query, Row } from "bezoar";

/**
 * An executor the service can close.
 */
interface Connection extends Executor {
  close(): Promise<void>;
}

/**
 * The service of an app: `useBezoar` for the service, `closeBezoar`
 * to close its connection.
 */
export interface Defined<D extends Definition> {
  useBezoar: () => Bezoar<D>;
  closeBezoar: () => Promise<void>;
}

/**
 * Connects with the driver of the runtime config.
 *
 * @throws when the `pg` driver has no connection string.
 */
const connect = (config: BezoarRuntimeConfig): Connection => {
  if (config.driver === "pglite") {
    return pglite(config.dataDir === "" ? {} : config.dataDir);
  }
  if (config.url === "") {
    throw new Error(
      "bezoar: no connection string; set NUXT_BEZOAR_URL, or runtimeConfig.bezoar.url",
    );
  }
  return pg(config.url);
};

/**
 * Defines the service of an app over a contract and its SQL. The written
 * service of the build directory calls this with the modules of the build.
 *
 * `useBezoar` connects on its first call, with the driver of the runtime
 * config, and makes the service. Every call after returns the same service.
 * `closeBezoar` closes the connection. The next `useBezoar` connects
 * again.
 *
 * @param contract - The contract of the build.
 * @param queries - The SQL of the build.
 */
export const defineService = <const D extends Definition>(
  contract: D,
  queries: Bundle<D>,
): Defined<D> => {
  let connection: Connection | undefined;
  let service: Bezoar<D> | undefined;

  const useBezoar = (): Bezoar<D> => {
    if (service === undefined) {
      connection = connect(useRuntimeConfig().bezoar);
      service = makeBezoar(contract, { executor: connection, queries });
    }
    return service;
  };

  const closeBezoar = async (): Promise<void> => {
    const open = connection;
    connection = undefined;
    service = undefined;
    await open?.close();
  };

  return { useBezoar, closeBezoar };
};
