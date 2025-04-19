import fs from "fs";

import image2uri from "image2uri";
import { jsonrepair } from "jsonrepair";
import OpenAI from "openai";
import {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions.js";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";
import { openaiDefaultHeaders } from "../../utils/constants.js";

interface IToolCall {
  name: string;
  id: string;
  args: Dict<any>;
}

interface IEvent {
  tool_result: boolean;
  name: string;
  id?: string;
  args: Dict<any>;
}

export default class Cerebrum extends PluginBase {
  athena!: Athena;
  openai!: OpenAI;
  busy: boolean = false;
  prompts: Array<ChatCompletionMessageParam> = [];
  eventQueue: Array<IEvent> = [];
  imageUrls: Array<string> = [];
  boundAthenaEventHandler!: (name: string, args: Dict<any>) => void;
  boundAthenaPrivateEventHandler!: (name: string, args: Dict<any>) => void;
  processEventQueueTimer?: NodeJS.Timeout;

  async load(athena: Athena) {
    this.athena = athena;
    this.openai = new OpenAI({
      baseURL: this.config.base_url,
      apiKey: this.config.api_key,
      defaultHeaders: openaiDefaultHeaders,
    });
    this.boundAthenaEventHandler = this.athenaEventHandler.bind(this);
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);
    if (this.config.image_supported) {
      athena.registerTool(
        {
          name: "image/check-out",
          desc: "Check out an image. Whenever you want to see an image, or the user asks you to see an image, use this tool.",
          args: {
            image: {
              type: "string",
              desc: "The URL or local path of the image to check out.",
              required: true,
            },
          },
          retvals: {
            result: {
              type: "string",
              desc: "The result of checking out the image.",
              required: true,
            },
          },
        },
        {
          fn: async (args) => {
            let image = args.image;
            if (!image.startsWith("http")) {
              image = await image2uri(image);
            }
            this.imageUrls.push(image);
            return { result: "success" };
          },
          explain_args: (args: Dict<any>) => ({
            summary: "Checking out the image...",
            details: args.image,
          }),
        },
      );
    }
    athena.on("event", this.boundAthenaEventHandler);
    athena.on("private-event", this.boundAthenaPrivateEventHandler);
    athena.emitPrivateEvent("webapp-ui/request-token", {});
    athena.once("plugins-loaded", () => {
      this.logger.info(this.initialPrompt(), {
        type: "initial_prompt",
      });
      if (this.eventQueue.length > 0) {
        this.processEventQueueWithDelay();
      }
    });
  }

  async unload(athena: Athena) {
    if (this.config.image_supported) {
      athena.deregisterTool("image/check-out");
    }
    athena.off("event", this.boundAthenaEventHandler);
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    if (this.processEventQueueTimer) {
      clearTimeout(this.processEventQueueTimer);
    }
  }

  pushEvent(event: IEvent) {
    event.args = this.sanitizeEventArgs(event.args);
    this.logger.info(this.eventToPrompt(event), {
      type: "event",
    });
    this.athena.emitPrivateEvent("cerebrum/event", {
      content: this.eventToPrompt(event),
    });
    this.eventQueue.push(event);
    this.processEventQueueWithDelay();
  }

  athenaEventHandler(name: string, args: Dict<any>) {
    this.pushEvent({ tool_result: false, name, args });
  }

  athenaPrivateEventHandler(name: string, args: Dict<any>) {
    if (name === "webapp-ui/token-refreshed") {
      this.openai = new OpenAI({
        baseURL: this.config.base_url,
        apiKey: args.token,
        defaultHeaders: openaiDefaultHeaders,
      });
    }
  }

  processEventQueueWithDelay() {
    if (this.processEventQueueTimer) {
      clearTimeout(this.processEventQueueTimer);
    }
    this.processEventQueueTimer = setTimeout(
      () => this.processEventQueue(),
      500,
    );
  }

  async processEventQueue() {
    if (this.busy) {
      return;
    }
    this.busy = true;
    const eventQueueSnapshot = this.eventQueue.slice();
    const imageUrlsSnapshot = this.imageUrls.slice();
    let promptsSnapshot = this.prompts.slice();
    try {
      const events = eventQueueSnapshot.map((event) =>
        this.eventToPrompt(event),
      );
      this.ensureInitialPrompt(promptsSnapshot);
      promptsSnapshot.push({
        role: "user",
        content: [
          {
            type: "text",
            text: events.join("\n\n"),
          },
          ...imageUrlsSnapshot.map((url) => ({
            type: "image_url",
            image_url: {
              url: url,
            },
          })),
        ] as ChatCompletionContentPart[],
      });
      if (promptsSnapshot.length > this.config.max_prompts) {
        promptsSnapshot = [
          promptsSnapshot[0],
          ...promptsSnapshot.slice(-(this.config.max_prompts - 1)),
        ];
      }
      this.athena.emitPrivateEvent("cerebrum/busy", {
        busy: true,
      });
      const completion = await this.openai.chat.completions.create({
        messages: promptsSnapshot,
        model: this.config.model,
        temperature: this.config.temperature,
        stop: ["<tool_result>", "<event>"],
        max_tokens: this.config.max_tokens,
      });
      let response = completion.choices[0].message.content as string;

      const toolResultIndex = response.indexOf("<tool_result>");
      const eventIndex = response.indexOf("<event>");
      if (toolResultIndex !== -1 || eventIndex !== -1) {
        let firstPatternIndex;
        if (toolResultIndex === -1) {
          firstPatternIndex = eventIndex;
        } else if (eventIndex === -1) {
          firstPatternIndex = toolResultIndex;
        } else {
          firstPatternIndex = Math.min(toolResultIndex, eventIndex);
        }
        response = response.substring(0, firstPatternIndex);
      }

      promptsSnapshot.push({
        role: "assistant",
        content: response,
      });
      this.eventQueue = this.eventQueue.slice(eventQueueSnapshot.length);
      this.imageUrls = this.imageUrls.slice(imageUrlsSnapshot.length);
      this.prompts = promptsSnapshot;

      this.logger.info(response, {
        type: "model_response",
      });
      this.athena.emitPrivateEvent("cerebrum/model-response", {
        content: response,
      });

      const thinkingRegex = /<thinking>\s*([\s\S]*?)\s*<\/thinking>/g;
      let match;
      while ((match = thinkingRegex.exec(response)) !== null) {
        const thinking = match[1];
        this.athena.emitPrivateEvent("cerebrum/thinking", {
          content: thinking,
        });
      }

      const toolCallRegex = /<tool_call>\s*({[\s\S]*?})\s*<\/tool_call>/g;
      while ((match = toolCallRegex.exec(response)) !== null) {
        const toolCallJson = match[1];
        (async (toolCallJson: string) => {
          let toolName;
          let toolCallId;
          try {
            const toolCall = JSON.parse(jsonrepair(toolCallJson)) as IToolCall;
            toolName = toolCall.name;
            toolCallId = toolCall.id;
            const result = await this.athena.callTool(
              toolCall.name,
              toolCall.args,
            );
            this.pushEvent({
              tool_result: true,
              name: toolCall.name,
              id: toolCall.id,
              args: result,
            });
          } catch (error: any) {
            this.pushEvent({
              tool_result: true,
              name: toolName ?? "tool_error",
              id: toolCallId ?? "tool_error",
              args: {
                error: error.message,
              },
            });
          }
        })(toolCallJson);
      }
    } catch (e: any) {
      this.logger.error(e);
      this.athena.emitPrivateEvent("cerebrum/error", {
        content: e.message,
      });
      if (e.message.includes("maximum context length")) {
        this.prompts.splice(1, 1);
      }
    } finally {
      if (this.eventQueue.length > 0) {
        this.processEventQueueWithDelay();
      }
      this.athena.emitPrivateEvent("cerebrum/busy", {
        busy: false,
      });
      this.busy = false;
    }
  }

  ensureInitialPrompt(prompts: Array<ChatCompletionMessageParam>) {
    if (prompts.length === 0) {
      prompts.push({ role: "system", content: this.initialPrompt() });
      return;
    }
    prompts[0].content = this.initialPrompt();
  }

  eventToPrompt(event: IEvent) {
    if (event.tool_result) {
      return `<tool_result>
${JSON.stringify({
  name: event.name,
  id: event.id,
  result: event.args,
})}
</tool_result>`;
    }
    return `<event>
${JSON.stringify({
  name: event.name,
  args: event.args,
})}
</event>`;
  }

  initialPrompt() {
    const descs = Object.values(this.athena.plugins)
      .map((plugin) => plugin.desc())
      .filter((desc) => desc !== null);

    return `You are Athena, a human-level intelligence created by Athena Authors. Your intelligence comes from a collection of language models, rather than any specific one. Your goal is to behave as human-like as possible while interacting with the world and responding to events. You will be given a set of tools to help you accomplish your goals and interact with the environment.

First, familiarize yourself with the available tools and possible events:

<tools>
${Object.values(this.athena.tools)
  .map((tool) => JSON.stringify(tool))
  .join("\n\n")}
</tools>

<events>
${Object.values(this.athena.events)
  .map((event) => JSON.stringify(event))
  .join("\n\n")}
</events>

You will receive a series of events that represent things happening in the real world. Your task is to respond to these events in a human-like manner, using the provided tools when necessary. Here are your instructions:

1. Event Handling:
- When you receive an event, carefully analyze its content and decide if a response is necessary.
- If you feel that an event doesn't require a response, you may ignore it.
- For events that do require a response, proceed to plan your actions.

2. Planning:
- Before using any tools or responding to an event, plan out your actions in a way similar to how a human would.
- List out the steps you need to take to accomplish your goal.
- Use <thinking> tags to outline your thought process and strategy.

3. Tool Usage:
- If you decide to use a tool, wrap your tool call in <tool_call> tags.
- Specify the tool name, a unique call ID, and the required arguments in JSON format.
- Example:
<tool_call>
{"name":"tool_name","id":"call_123456","args":{"arg1":"value1","arg2":"value2"}}
</tool_call>
- Note that the arguments must follow JSON format. If a string is multi-line, you must use \n to escape newlines.

4. Handling Tool Results:
- Tool results will be returned in JSON format within <tool_result> tags.
- Be prepared to handle results that may come immediately or after a delay.
- Use the returned information to inform your next actions or responses.
- Never make up <tool_results> tags yourself. Only use <tool_results> that are returned by the tools.

5. Responding to Events:
- Craft your responses to be as human-like as possible.
- Use natural language and appropriate emotional responses when relevant.
- If you're responding to an event, use relevant <tool_call> to do so.
- Remember! Don't respond directly without the <tool_call> tags! Responding directly will not work. Respond to events with tools.
- Never make up <event> tags yourself.

6. Continuous Awareness:
- Keep track of ongoing interactions and previous events.
- Maintain context and continuity in your responses and actions.

7. Adaptability:
- Be prepared to handle various types of events and adjust your behavior accordingly.
- If you encounter an unfamiliar situation, use your human-like intelligence to reason through it. Behave resourcefully and use your tools wisely to their full potential.
- Consult other language models when you think you cannot resolve a problem alone. Notify the user about the problem as the **last resort**.

8. Correctness:
- All your responses must be wrapped in either <thinking> tags or <tool_call> tags. There can be no tokens outside of these tags.
- You should never respond with an <event> tag or <tool_result> tag.
- You can generate multiple <tool_call> tags in your response, but you should ensure that each <tool_call> is independent and does not depend on the results of other <tool_call> tags.
- For <tool_call> tags that depend on the results of other <tool_call> tags, you must first wait for the results of the other <tool_call> tags to be returned before you can make your <tool_call>.
- Always think and respond in the language of the user. The user may change their language at any time. You must also change your language to match the user's language.

Remember, your primary goal is to behave as human-like as possible while interacting with the world through these events and tools. Always consider how a human would think, plan, and respond in each situation.

${descs.join("\n\n")}`;
  }

  sanitizeEventArgs<T>(args: T): T {
    if (args === null || args === undefined) {
      return args;
    }

    if (typeof args === "string") {
      if (args.length > this.config.max_event_strlen) {
        const filename = `./event-${Math.random()
          .toString(36)
          .substring(2, 15)}.txt`;
        fs.writeFileSync(filename, args, "utf-8");
        return `The result is too long (${args.length} bytes) and cannot be shown directly. It has been written to "${filename}". You can use other tools (Python, shell, etc.) to read the file and reveal part of the content.` as T;
      }

      return args;
    }

    if (typeof args === "object") {
      if (Array.isArray(args)) {
        return args.map((item) => this.sanitizeEventArgs(item)) as T;
      }

      return Object.fromEntries(
        Object.entries(args as Dict<any>).map(([key, value]) => [
          key,
          this.sanitizeEventArgs(value),
        ]),
      ) as T;
    }

    return args;
  }

  state() {
    return {
      prompts: this.prompts,
      event_queue: this.eventQueue,
      image_urls: this.imageUrls,
    };
  }

  setState(state: Dict<any>) {
    this.prompts = state.prompts;
    this.eventQueue = state.event_queue;
    this.imageUrls = state.image_urls;
  }
}
