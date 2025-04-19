import fs from "fs/promises";

import { format, transports } from "winston";
import yaml from "yaml";

import { Athena } from "./core/athena.js";
import logger from "./utils/logger.js";

const main = async () => {
  if (process.argv.length !== 3) {
    console.error(`usage: ${process.argv[0]} ${process.argv[1]} <config-file>`);
    process.exit(1);
  }

  const configFile = process.argv[2];
  const config = yaml.parse(await fs.readFile(configFile, "utf8"));

  if (config.quiet) {
    logger.transports[0].silent = true;
  }

  if (config.log_file) {
    logger.add(
      new transports.File({
        filename: config.log_file,
        format: format.combine(format.timestamp(), format.json()),
      }),
    );
    logger.info(`Log file: ${config.log_file}`);
  } else {
    logger.info("Log file is not set");
  }

  logger.info(`PID: ${process.pid}`);

  let statesFile = null;
  let states = {};
  if (config.states_file) {
    try {
      statesFile = await fs.open(config.states_file, "r+");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        statesFile = await fs.open(config.states_file, "w+");
      } else {
        throw err;
      }
    }
    try {
      states = yaml.parse(await statesFile.readFile("utf8"));
    } catch (err) {}
    if (!states) {
      states = {};
    }
    logger.info(`States file: ${config.states_file}`);
    logger.info(`States: ${JSON.stringify(states)}`);
  } else {
    logger.info("States file is not set");
  }

  const saveStates = async (athena: Athena, close: boolean = false) => {
    if (!statesFile) {
      return;
    }
    athena.gatherStates();
    await statesFile.truncate(0);
    await statesFile.write(yaml.stringify(athena.states), 0, "utf8");
    if (close) {
      await statesFile.close();
    }
    logger.info("States file is saved");
    logger.info(`States: ${JSON.stringify(athena.states)}`);
  };

  if (config.workdir) {
    logger.info(`Changing working directory to ${config.workdir}`);
    process.chdir(config.workdir);
  }

  const athena = new Athena(config, states);
  await athena.loadPlugins();

  let exiting = false;
  const cleanup = async (event: string) => {
    if (exiting) {
      return;
    }
    exiting = true;
    logger.warn(`${event} triggered, cleaning up...`);
    await saveStates(athena, true);
    await athena.unloadPlugins();
    logger.info("Athena is unloaded");
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("SIGHUP", () => cleanup("SIGHUP"));
  process.on("beforeExit", () => cleanup("beforeExit"));

  let reloading = false;
  process.on("SIGUSR1", async () => {
    if (reloading) {
      return;
    }
    reloading = true;
    logger.info("SIGUSR1 triggered, reloading...");
    await saveStates(athena);
    await athena.unloadPlugins();
    await athena.loadPlugins();
    logger.info("Athena is reloaded");
    reloading = false;
  });

  let savingStates = false;
  process.on("SIGUSR2", async () => {
    if (savingStates) {
      return;
    }
    savingStates = true;
    logger.info("SIGUSR2 triggered, saving states...");
    await saveStates(athena);
    savingStates = false;
  });

  logger.info("Athena is loaded");
};

main();
