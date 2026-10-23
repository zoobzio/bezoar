import type {
  Bezoar,
  Bundle,
  Definition,
  Executor,
  Role,
  Scoping,
} from "bezoar";

import type { BezoarRuntimeConfig } from "../../config";

import { useRuntimeConfig } from "#imports";
import { pg } from "@bezoar/pg";
import { pglite } from "@bezoar/pglite";
import { makeBezoar } from "bezoar";

export type { Arguments, Database, Query, Row } from "bezoar";

/**
 * What the service runs on: the executor of the owner, for the migrations,
 * the grants, and the seeds; the executor of the role, for the queries,
 * when the config names a role; and `close` for both.
 */
interface Connection {
  owner: Executor;
  scoped?: Executor;
  close(): Promise<void>;
}

/**
 * The service of an app: `useBezoar` for the service, scoped to the role
 * of the config when there is one; `useBezoarOwner` for the service over
 * every query as the login user, for the work of the plugin; `closeBezoar`
 * to close the connections.
 */
export interface Defined<
  D extends Definition,
  R extends Scoping<D> = undefined,
> {
  useBezoar: () => Bezoar<D, R>;
  useBezoarOwner: () => Bezoar<D>;
  closeBezoar: () => Promise<void>;
}

/**
 * Connects with the driver of the runtime config. With a role, the `pg`
 * driver opens a second pool that takes the role, and the `pglite` driver a
 * second executor over the one client, so the owner's work and the queries
 * of the role run on the same database as different users.
 *
 * @throws when the `pg` driver has no connection string.
 */
const connect = (config: BezoarRuntimeConfig): Connection => {
  const role = config.role === "" ? undefined : config.role;
  if (config.driver === "pglite") {
    const owner = pglite(config.dataDir === "" ? {} : config.dataDir);
    return {
      owner,
      scoped: role === undefined ? undefined : pglite(owner.client, { role }),
      close: () => owner.close(),
    };
  }
  if (config.url === "") {
    throw new Error(
      "bezoar: no connection string; set NUXT_BEZOAR_URL, or runtimeConfig.bezoar.url",
    );
  }
  const owner = pg(config.url);
  const scoped = role === undefined ? undefined : pg(config.url, { role });
  return {
    owner,
    scoped,
    close: async () => {
      await Promise.all([owner.close(), scoped?.close()]);
    },
  };
};

/**
 * Defines the service of an app over a contract and its SQL. The written
 * service of the build directory calls this with the modules of the build.
 *
 * `useBezoar` connects on its first call, with the driver of the runtime
 * config, and makes the service: over the role of the config when there is
 * one, as `makeBezoar` scopes it, and over every query otherwise. Every
 * call after returns the same service. `useBezoarOwner` is the service over
 * every query as the login user, which is `useBezoar` itself without a
 * role. `closeBezoar` closes the connections. The next `useBezoar`
 * connects again.
 *
 * `R` is the role the declaration of the app names, from the module
 * options; the runtime reads the role of the runtime config, which defaults
 * to it.
 *
 * @param contract - The contract of the build.
 * @param queries - The SQL of the build.
 */
export const defineService = <
  const D extends Definition,
  R extends Scoping<D> = undefined,
>(
  contract: D,
  queries: Bundle<D>,
): Defined<D, R> => {
  let connection: Connection | undefined;
  let owner: Bezoar<D> | undefined;
  let service: Bezoar<D, R> | undefined;

  const useBezoarOwner = (): Bezoar<D> => {
    if (owner === undefined) {
      connection = connect(useRuntimeConfig().bezoar);
      owner = makeBezoar(contract, { executor: connection.owner, queries });
    }
    return owner;
  };

  const useBezoar = (): Bezoar<D, R> => {
    if (service === undefined) {
      const over = useBezoarOwner();
      const { role } = useRuntimeConfig().bezoar;
      service =
        connection?.scoped === undefined
          ? (over as unknown as Bezoar<D, R>)
          : (makeBezoar(contract, {
              executor: connection.scoped,
              queries,
              role: role as Role<D>,
            }) as unknown as Bezoar<D, R>);
    }
    return service;
  };

  const closeBezoar = async (): Promise<void> => {
    const open = connection;
    connection = undefined;
    owner = undefined;
    service = undefined;
    await open?.close();
  };

  return { useBezoar, useBezoarOwner, closeBezoar };
};
