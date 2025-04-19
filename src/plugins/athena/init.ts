import { exec } from "child_process";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class AthenaPlugin extends PluginBase {
  desc() {
    return 'Athena is made up of plugins. Whenever you are told to implement a new feature or to "improve" yourself, you should create a new plugin. The way to do this is to create a new folder in the "src/plugins" directory. Inside the directory, create a new file called "init.ts". You must refer to other plugins, such as "python", as templates before creating your own. After you create the plugin, you can load it by using the "athena/load-plugin" tool. The args argument you pass to the tool can be accessed by the plugin as "this.config". You can also modify an existing plugin and reload it by using the same tool.';
  }

  async load(athena: Athena) {
    athena.registerTool(
      {
        name: "athena/load-plugin",
        desc: "Loads a plugin.",
        args: {
          name: {
            type: "string",
            desc: "The name of the plugin to load.",
            required: true,
          },
          args: {
            type: "object",
            desc: "The arguments to pass to the plugin.",
            required: true,
          },
        },
        retvals: {
          status: {
            type: "string",
            desc: "The status of the operation.",
            required: true,
          },
        },
      },
      {
        fn: async (args) => {
          if (athena.plugins[args.name]) {
            await athena.unloadPlugin(args.name);
          }
          await new Promise<void>((resolve, reject) => {
            exec("pnpm fast-build", (error, stdout, stderr) => {
              if (error) {
                reject(Error(stdout));
              } else {
                resolve();
              }
            });
          });
          try {
            await athena.loadPlugin(args.name, args.args);
            athena.emit("plugins-loaded");
          } catch (e) {
            try {
              await athena.unloadPlugin(args.name);
            } catch (e) {
              if (args.name in athena.plugins) {
                delete athena.plugins[args.name];
              }
            }
            throw e;
          }
          return { status: "success" };
        },
      },
    );
  }

  async unload(athena: Athena) {
    athena.deregisterTool("athena/load-plugin");
  }
}
