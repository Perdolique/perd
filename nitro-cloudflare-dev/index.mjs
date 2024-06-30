import { resolve, relative } from 'node:path';
import { promises } from 'node:fs';
import { fileURLToPath } from 'mlly';
import consola from 'consola';
import { colorize } from 'consola/utils';
import { findFile } from 'pkg-types';

async function nitroModule(nitro) {
  if (!nitro.options.dev) {
    return;
  }
  let configPath = nitro.options.cloudflareDev?.configPath;
  if (!configPath) {
    configPath = await findFile("wrangler.toml", {
      startingFrom: nitro.options.srcDir
    }).catch(() => void 0);
  }
  const persistDir = resolve(
    nitro.options.rootDir,
    nitro.options.cloudflareDev?.persistDir || ".wrangler/state/v3"
  );
  const gitIgnorePath = await findFile(".gitignore", {
    startingFrom: nitro.options.rootDir
  }).catch(() => void 0);
  let addedToGitIgnore = false;
  if (gitIgnorePath && persistDir === ".wrangler/state/v3") {
    const gitIgnore = await promises.readFile(gitIgnorePath, "utf8");
    if (!gitIgnore.includes(".wrangler/state/v3")) {
      await promises.writeFile(gitIgnorePath, gitIgnore + "\n.wrangler/state/v3\n").catch(() => {
      });
      addedToGitIgnore = true;
    }
  }
  if (!nitro.options.cloudflareDev?.silent) {
    consola.box(
      [
        "\u{1F525} Cloudflare context bindings enabled for dev server",
        "",
        `Config path: \`${configPath ? relative(".", configPath) : colorize("yellow", "cannot find `wrangler.toml`")}\``,
        `Persist dir: \`${relative(".", persistDir)}\` ${addedToGitIgnore ? colorize("green", "(added to `.gitignore`)") : ""}`
      ].join("\n")
    );
  }
  nitro.options.runtimeConfig.wrangler = {
    ...nitro.options.runtimeConfig.wrangler,
    shamefullyPatchR2Buckets: nitro.options.cloudflareDev?.shamefullyPatchR2Buckets,
    configPath,
    persistDir,
    environment: nitro.options.cloudflareDev?.environmnet
  };
  nitro.options.externals.inline = nitro.options.externals.inline || [];
  nitro.options.externals.inline.push(
    fileURLToPath(new URL("runtime/", import.meta.url))
  );
  nitro.options.plugins = nitro.options.plugins || [];
  nitro.options.plugins.push(
    fileURLToPath(new URL("runtime/plugin.dev", import.meta.url))
  );
}
const index = (arg1, arg2) => {
  if (arg2?.options?.nitro) {
    arg2.hooks.hook("nitro:config", (nitroConfig) => {
      nitroConfig.modules = nitroConfig.modules || [];
      nitroConfig.modules.push(nitroModule);
    });
  } else {
    nitroModule(arg1);
  }
};

export { index as default };
