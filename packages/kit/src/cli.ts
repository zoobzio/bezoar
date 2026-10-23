import { parseArgs } from "node:util";

import { build } from "./build";

const HELP = `Usage: bezoar <command> [options]

Commands:
  build  Apply the roles, the migrations, the grants, and the seeds to a
         database in memory, describe the queries, check each under each
         role, and write the output directory. Offline and deterministic.

Options:
  -c, --config <file>  Config file (default: bezoar.config.ts)
  -r, --root <dir>     Project root (default: current directory)
  -h, --help           Show this help`;

const runBuild = async (config?: string, root?: string): Promise<void> => {
  const output = await build({ config, root });
  console.log(
    `@bezoar/kit: wrote ${output.files.length} files to ${output.outDir}`,
  );
};

const main = async (argv: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      root: { type: "string", short: "r" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }
  if (positionals.length === 1 && positionals[0] === "build") {
    return runBuild(values.config, values.root);
  }
  console.error(HELP);
  process.exitCode = 1;
};

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
