import {
  eventSource,
  Workflow,
  WorkflowContext,
  workflowEvent,
  WorkflowEvent,
  WorkflowEventData
} from '@llama-flow/core'
import { AsyncLocalStorage } from 'node:async_hooks'
import * as z from 'zod/v4/core'
import { AthenaContext } from './index.js'

type BasePlugin = {
  name: string
  setup (): (() => void) | void
}

type PluginWithSchema<Schema extends z.$ZodObject = z.$ZodObject> = {
  name: string
  config: Schema
  setup (config: z.infer<Schema>): (() => void) | void
}

export type Plugin = BasePlugin | PluginWithSchema

export function definePlugin<Schema extends z.$ZodObject = z.$ZodObject> (
  plugin: PluginWithSchema<Schema>
): PluginWithSchema
export function definePlugin (
  plugin: BasePlugin
): BasePlugin
export function definePlugin (plugin: any): any {
  return plugin
}

type PrimitiveArgument = {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
};

type Argument =
  | PrimitiveArgument
  | {
  type: 'object' | 'array';
  description: string;
  required: boolean;
  of?: Record<string, Argument> | Argument;
};

type ArgumentInstance<T extends Argument> =
  T extends PrimitiveArgument
    ? T['type'] extends 'string'
      ? T['required'] extends true
        ? string
        : string | undefined
      : T['type'] extends 'number'
        ? T['required'] extends true
          ? number
          : number | undefined
        : T['type'] extends 'boolean'
          ? T['required'] extends true
            ? boolean
            : boolean | undefined
          : never
    : T extends { of: Record<string, Argument> }
      ? T['required'] extends true
        ? { [K in keyof T['of']]: ArgumentInstance<T['of'][K]> }
        :
        | { [K in keyof T['of']]: ArgumentInstance<T['of'][K]> }
        | undefined
      : T extends { of: Argument }
        ? T['required'] extends true
          ? ArgumentInstance<T['of']>[]
          : ArgumentInstance<T['of']>[] | undefined
        : T extends { type: 'object' }
          ? T['required'] extends true
            ? { [K in keyof T['of']]: any }
            : { [K in keyof T['of']]: any } | undefined
          : T extends { type: 'array' }
            ? T['required'] extends true
              ? any[]
              : (any | undefined)[]
            : never;

export interface Explanation {
  summary: string;
  details?: string;
}

export interface AthenaTool<
  Args extends Record<string, Argument> = Record<string, Argument>,
  ReturnVals extends Argument | Record<string, Argument> = Argument,
> {
  name: string;
  description: string;
  args: Args;
  returnVals: ReturnVals;
  fn: (args: {
    [K in keyof Args]: Args[K] extends Argument
      ? ArgumentInstance<Args[K]>
      : never;
  }) => Promise<ReturnVals extends Argument ? ArgumentInstance<ReturnVals> : {
    [K in keyof ReturnVals]: ReturnVals[K] extends Argument
      ? ArgumentInstance<ReturnVals[K]>
      : never;
  }>;
  explainArgs?: (args: {
    [K in keyof Args]: Args[K] extends Argument
      ? ArgumentInstance<Args[K]>
      : never;
  }) => Explanation;
  explainReturnVals?: (
    args: {
      [K in keyof Args]: Args[K] extends Argument
        ? ArgumentInstance<Args[K]>
        : never;
    },
    returnVals: ReturnVals extends Argument ? ArgumentInstance<ReturnVals> : {
      [K in keyof ReturnVals]: ReturnVals[K] extends Argument
        ? ArgumentInstance<ReturnVals[K]>
        : never;
    }
  ) => Explanation;
}

/**
 * @internal
 */
export type PluginState = {
  get name (): string
  description: string | null

  get config (): Readonly<Record<string, any>>;
  get tools (): Map<string, AthenaTool>

  get athenaContext (): AthenaContext

  epoch: number
  cleanup?: () => void
}

/**
 * @internal
 */
function usePluginState () {
  const pluginState = pluginStateAsyncContext.getStore()
  if (!pluginState) {
    throw new Error('No workflow is available in the current context')
  }
  return pluginState
}

/**
 * @internal
 */
export const pluginStateAsyncContext = new AsyncLocalStorage<PluginState>()

/**
 * @internal
 */
export const pluginRegisterEvent = workflowEvent()

/**
 * @internal
 */
export const pluginUnregisterEvent = workflowEvent()

export function useTool<
  Args extends Record<string, Argument>,
  RetVals extends Argument | Record<string, Argument>,
  Tool extends AthenaTool<Args, RetVals>,
> (
  name: string,
  description: string,
  config: {
    args: Args;
    returnVals: RetVals;
  },
  impl: {
    fn: Tool['fn'];
    explainArgs?: Tool['explainArgs'];
    explainReturnVals?: Tool['explainReturnVals'];
  }
) {
  const tool = {
    name,
    description,
    ...config,
    ...impl
  }
  const pluginState = usePluginState()
  if (pluginState.tools.has(tool.name)) {
    throw new Error(`Tool with name "${tool.name}" already exists`)
  }
  pluginState.tools.set(tool.name, tool as unknown as AthenaTool)
}

export function sendEvent<Data> (event: WorkflowEventData<Data>) {
  const pluginState = usePluginState()
  pluginState.athenaContext.sendEvent(event)
}

export function onEvent<Data> (
  event: WorkflowEvent<Data>,
  handler: (data: WorkflowEventData<Data>) => void | WorkflowEventData<unknown> | Promise<void> | Promise<WorkflowEventData<unknown>>
) {
  const pluginState = usePluginState()
  const { handle } = pluginState.athenaContext
  handle([event], handler)
}

export {
  eventSource,
  WorkflowEvent,
  WorkflowEventData,
}

export function defineEvent (
  displayName?: string
) {
  const pluginState = usePluginState()
  const name = pluginState.name
  const uniqueId = name +
    (displayName ? `/${displayName}/${pluginState.epoch}` : pluginState.epoch++)
  return workflowEvent({
    uniqueId
  })
}

export function useDescription (
  description: string
) {
  const pluginState = usePluginState()
  pluginState.description = description
}
