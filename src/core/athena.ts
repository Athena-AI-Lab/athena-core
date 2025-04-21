import { EventEmitter } from "events";

import { PluginBase } from "../plugins/plugin-base.js";
import logger from "../utils/logger.js";

export type Dict<T> = { [key: string]: T };

type IAthenaArgumentPrimitive = {
  type: "string" | "number" | "boolean";
  desc: string;
  required: boolean;
};

export type IAthenaArgument =
  | IAthenaArgumentPrimitive
  | {
      type: "object" | "array";
      desc: string;
      required: boolean;
      of?: Dict<IAthenaArgument> | IAthenaArgument;
    };
type IAthenaArgumentInstance<T extends IAthenaArgument> =
  T extends IAthenaArgumentPrimitive
    ? T["type"] extends "string"
      ? T["required"] extends true
        ? string
        : string | undefined
      : T["type"] extends "number"
        ? T["required"] extends true
          ? number
          : number | undefined
        : T["type"] extends "boolean"
          ? T["required"] extends true
            ? boolean
            : boolean | undefined
          : never
    : T extends { of: Dict<IAthenaArgument> }
      ? T["required"] extends true
        ? { [K in keyof T["of"]]: IAthenaArgumentInstance<T["of"][K]> }
        :
            | { [K in keyof T["of"]]: IAthenaArgumentInstance<T["of"][K]> }
            | undefined
      : T extends { of: IAthenaArgument }
        ? T["required"] extends true
          ? IAthenaArgumentInstance<T["of"]>[]
          : IAthenaArgumentInstance<T["of"]>[] | undefined
        : T extends { type: "object" }
          ? T["required"] extends true
            ? { [K in keyof T["of"]]: any }
            : { [K in keyof T["of"]]: any } | undefined
          : T extends { type: "array" }
            ? T["required"] extends true
              ? any[]
              : (any | undefined)[]
            : never;

export interface IAthenaTool<
  Args extends Dict<IAthenaArgument> = Dict<IAthenaArgument>,
  RetArgs extends Dict<IAthenaArgument> = Dict<IAthenaArgument>,
> {
  name: string;
  desc: string;
  args: Args;
  retvals: RetArgs;
  fn: (args: {
    [K in keyof Args]: Args[K] extends IAthenaArgument
      ? IAthenaArgumentInstance<Args[K]>
      : never;
  }) => Promise<{
    [K in keyof RetArgs]: RetArgs[K] extends IAthenaArgument
      ? IAthenaArgumentInstance<RetArgs[K]>
      : never;
  }>;
  explain_args?: (args: Dict<any>) => IAthenaExplanation;
  explain_retvals?: (args: Dict<any>, retvals: Dict<any>) => IAthenaExplanation;
}

export interface IAthenaEvent {
  name: string;
  desc: string;
  args: Dict<IAthenaArgument>;
  explain_args?: (args: Dict<any>) => IAthenaExplanation;
}

export interface IAthenaExplanation {
  summary: string;
  details?: string;
}

export class Athena extends EventEmitter {
  config: Dict<any>;
  states: Dict<Dict<any>>;
  plugins: Dict<PluginBase>;
  tools: Dict<IAthenaTool<any, any>>;
  events: Dict<IAthenaEvent>;

  constructor(config: Dict<any>, states: Dict<Dict<any>>) {
    super();
    this.config = config;
    this.states = states;
    this.plugins = {};
    this.tools = {};
    this.events = {};
  }

  async loadPlugins() {
    const plugins = this.config.plugins;
    if (!plugins) {
      logger.warn("No plugins found in config");
    }
    for (const [name, args] of Object.entries(plugins)) {
      await this.loadPlugin(name, args ?? {});
    }
    this.emit("plugins-loaded");
  }

  async unloadPlugins() {
    const plugins = Object.keys(this.plugins);
    for (const name of plugins) {
      try {
        await this.unloadPlugin(name);
      } catch (error) {
        logger.error(`Failed to unload plugin ${name}: ${error}`);
        if (name in this.plugins) {
          delete this.plugins[name];
        }
      }
    }
  }

  async loadPlugin(name: string, args: Dict<any>) {
    if (name in this.plugins) {
      throw new Error(`Plugin ${name} already loaded`);
    }
    const Plugin = (await import(`../plugins/${name}/init.js`)).default;
    const plugin = new Plugin(args) as PluginBase;
    plugin.logger = logger.child({
      plugin: name,
    });
    this.plugins[name] = plugin;
    await plugin.load(this);
    const state = this.states[name];
    if (state) {
      plugin.setState(state);
    }
    logger.warn(`Plugin ${name} is loaded`);
  }

  async unloadPlugin(name: string) {
    if (!(name in this.plugins)) {
      throw new Error(`Plugin ${name} not loaded`);
    }
    this.gatherState(name);
    await this.plugins[name].unload(this);
    delete this.plugins[name];
    logger.warn(`Plugin ${name} is unloaded`);
  }

  registerTool<
    Args extends Dict<IAthenaArgument>,
    RetArgs extends Dict<IAthenaArgument>,
    Tool extends IAthenaTool<Args, RetArgs>,
  >(
    config: {
      name: string;
      desc: string;
      args: Args;
      retvals: RetArgs;
    },
    toolImpl: {
      fn: Tool["fn"];
      explain_args?: Tool["explain_args"];
      explain_retvals?: Tool["explain_retvals"];
    },
  ) {
    const tool = {
      ...config,
      ...toolImpl,
    };
    if (tool.name in this.tools) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools[tool.name] = tool as unknown as IAthenaTool<any, any>;
    logger.warn(`Tool ${tool.name} is registered`);
  }

  deregisterTool(name: string) {
    if (!(name in this.tools)) {
      throw new Error(`Tool ${name} not registered`);
    }
    delete this.tools[name];
    logger.warn(`Tool ${name} is deregistered`);
  }

  registerEvent(event: IAthenaEvent) {
    if (event.name in this.events) {
      throw new Error(`Event ${event.name} already registered`);
    }
    this.events[event.name] = event;
    logger.warn(`Event ${event.name} is registered`);
  }

  deregisterEvent(name: string) {
    if (!(name in this.events)) {
      throw new Error(`Event ${name} not registered`);
    }
    delete this.events[name];
    logger.warn(`Event ${name} is deregistered`);
  }

  gatherState(plugin: string) {
    if (!(plugin in this.plugins)) {
      throw new Error(`Plugin ${plugin} not loaded`);
    }
    const state = this.plugins[plugin].state();
    if (state) {
      this.states[plugin] = state;
    }
  }

  gatherStates() {
    for (const plugin of Object.keys(this.plugins)) {
      try {
        this.gatherState(plugin);
      } catch (error) {
        logger.error(`Failed to gather state for plugin ${plugin}: ${error}`);
      }
    }
  }

  async callTool(name: string, args: Dict<any>) {
    if (!(name in this.tools)) {
      throw new Error(`Tool ${name} not registered`);
    }
    const tool = this.tools[name];
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    if (tool.explain_args) {
      this.emitPrivateEvent("athena/tool-call", tool.explain_args(args));
    }
    const retvals = await tool.fn(args);
    if (tool.explain_retvals) {
      this.emitPrivateEvent(
        "athena/tool-result",
        tool.explain_retvals(args, retvals),
      );
    }
    return retvals;
  }

  emitEvent(name: string, args: Dict<any>) {
    if (!(name in this.events)) {
      throw new Error(`Event ${name} not registered`);
    }
    const event = this.events[name];
    if (event.explain_args) {
      this.emitPrivateEvent("athena/event", event.explain_args(args));
    }
    this.emit("event", name, args);
  }

  emitPrivateEvent(name: string, args: Dict<any>) {
    this.emit("private-event", name, args);
  }
}
