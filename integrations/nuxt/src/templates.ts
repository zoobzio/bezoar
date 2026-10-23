import { existsSync } from "node:fs";
import { join } from "node:path";

import { ENTRIES, EXPORTS, ROLES, ROLES_EXPORT, VIRTUAL } from "./constant";

/**
 * The paths a virtual module imports from: the output directory of the kit
 * build, and the runtime directory of the module.
 */
export interface Sources {
  build: string;
  runtime: string;
}

/**
 * A module of a directory, as an import specifier.
 */
const from = (directory: string, file: string): string =>
  JSON.stringify(join(directory, file));

/**
 * The build of the app: the modules of the kit build, re-exported. The only
 * module that knows where the build lives. A build without a roles module
 * exports no grant, so a build made before roles existed still serves.
 *
 * @param sources - The directories the module imports from.
 */
export const build = ({ build: directory }: Sources): string =>
  [
    ...ENTRIES.map(
      (entry) =>
        `export { ${EXPORTS[entry]} } from ${from(directory, `${entry}.mjs`)};`,
    ),
    existsSync(join(directory, `${ROLES}.mjs`))
      ? `export { ${ROLES_EXPORT} } from ${from(directory, `${ROLES}.mjs`)};`
      : `export const ${ROLES_EXPORT} = Object.freeze([]);`,
    "",
  ].join("\n");

/**
 * The service of the app: the contract and the SQL of the build, given to
 * `defineService` of the runtime.
 *
 * @param sources - The directories the module imports from.
 */
export const service = ({ runtime }: Sources): string =>
  [
    `import { contract, queries } from ${JSON.stringify(VIRTUAL.build)};`,
    `import { defineService } from ${from(runtime, "service.js")};`,
    "",
    "export const { useBezoar, useBezoarOwner, closeBezoar } = defineService(contract, queries);",
    "",
  ].join("\n");

/**
 * The declaration of the service: it declares the virtual service module,
 * with types that derive from the contract of the build, so `useBezoar()`
 * is typed by the build. With a role, `useBezoar()` is typed by the queries
 * of the role.
 *
 * The block is an ambient module declaration, so it refers to the build and
 * the runtime through `import()` types: an import declaration in an ambient
 * module may not name a module by path (TS2439), and `skipLibCheck` would
 * hide that error and leave every type `any`.
 *
 * @param sources - The directories the declaration refers to.
 * @param role - The role of the module options, if any.
 */
export const declaration = (
  { build, runtime }: Sources,
  role?: string,
): string => {
  const contract = `typeof import(${from(build, "index.mjs")}).contract`;
  const service = `import(${from(runtime, "service.js")})`;
  const defined = `${service}.Defined<AppBezoarContract, AppBezoarRole>`;
  return [
    `declare module ${JSON.stringify(VIRTUAL.service)} {`,
    `  export type AppBezoarContract = ${contract};`,
    `  export type AppBezoarRole = ${role === undefined ? "undefined" : JSON.stringify(role)};`,
    `  export const useBezoar: ${defined}["useBezoar"];`,
    `  export const useBezoarOwner: ${defined}["useBezoarOwner"];`,
    `  export const closeBezoar: ${defined}["closeBezoar"];`,
    "  export type AppBezoar = ReturnType<typeof useBezoar>;",
    `  export type AppBezoarQuery = ${service}.Query<AppBezoarContract>;`,
    `  export type AppBezoarArguments<Q extends AppBezoarQuery> = ${service}.Arguments<AppBezoarContract, Q>;`,
    `  export type AppBezoarRow<Q extends AppBezoarQuery> = ${service}.Row<AppBezoarContract, Q>;`,
    `  export type AppBezoarDatabase = ${service}.Database<AppBezoarContract>;`,
    "}",
    "",
  ].join("\n");
};
