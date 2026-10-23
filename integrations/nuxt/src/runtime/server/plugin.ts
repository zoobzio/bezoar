import { migrations, roles, seeds } from "#bezoar/build";
import { closeBezoar, useBezoar, useBezoarOwner } from "#bezoar/service";

import { definePlugin } from "./startup";

/**
 * The plugin of the app. Nitro resolves a plugin by path, so the plugin is a
 * file of the runtime; what differs by app, the service and the build, comes
 * from the virtual modules the module adds to the server build.
 */
export default definePlugin({
  useBezoar,
  useBezoarOwner,
  closeBezoar,
  migrations,
  seeds,
  roles,
});
