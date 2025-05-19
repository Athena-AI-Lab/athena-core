import { render } from "ink";
import React from "react";
import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";
import { App } from "./components/App.js";

interface Message {
  type: "user" | "athena" | "thinking" | "tool-call" | "tool-result" | "event";
  content: string;
  timestamp: string;
}

export default class CLIUI extends PluginBase {
  athena!: Athena;
  boundAthenaPrivateEventHandler!: (event: string, args: Dict<any>) => void;
  messages: Message[] = [];
  isThinking: boolean = false;
  prompt: string = "<User> ";

  desc() {
    return "You can interact with the user using UI tools and events. When the user asks you to do something, think about what information and/or details you need to do that. If you need something only the user can provide, you need to ask the user for that information. Ask the users about task details if the request is vague. Be proactive and update the user on your progress, milestones, and obstacles and how you are going to overcome them.";
  }

  async load(athena: Athena) {
    this.athena = athena;
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);

    athena.on("private-event", this.boundAthenaPrivateEventHandler);

    athena.registerEvent({
      name: "ui/message-received",
      desc: "Triggered when a message is received from the user.",
      args: {
        content: {
          type: "string",
          desc: "The message received from the user.",
          required: true,
        },
        time: {
          type: "string",
          desc: "The time the message was sent.",
          required: true,
        },
      },
    });

    athena.registerTool(
      {
        name: "ui/send-message",
        desc: "Sends a message to the user.",
        args: {
          content: {
            type: "string",
            desc: "The message to send to the user. Don't output any Markdown formatting.",
            required: true,
          },
        },
        retvals: {
          status: {
            type: "string",
            desc: "Status of the operation.",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          this.addMessage("athena", args.content);
          return { status: "success" };
        },
      },
    );

    athena.once("plugins-loaded", async () => {
      this.addMessage("athena", "Welcome to Athena!");
      this.renderUI();
    });
  }

  async unload(athena: Athena) {
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    athena.deregisterTool("ui/send-message");
    athena.deregisterEvent("ui/message-received");
  }

  athenaPrivateEventHandler(event: string, args: Dict<any>) {
    if (event === "cerebrum/thinking") {
      this.addMessage("thinking", args.content);
    } else if (event === "athena/tool-call") {
      this.addMessage("tool-call", args.summary);
    } else if (event === "athena/tool-result") {
      this.addMessage("tool-result", args.summary);
    } else if (event === "athena/event") {
      this.addMessage("event", args.summary);
    } else if (event === "cerebrum/busy") {
      this.isThinking = args.busy;
      this.prompt = args.busy ? "<Thinking> " : "<User> ";
      this.renderUI();
    }
  }

  addMessage(type: Message["type"], content: string) {
    this.messages.push({
      type,
      content,
      timestamp: new Date().toISOString(),
    });
    this.renderUI();
  }

  handleMessage(content: string) {
    this.addMessage("user", content);
    this.athena.emitEvent("ui/message-received", {
      content,
      time: new Date().toISOString(),
    });
  }

  renderUI() {
    render(
      React.createElement(App, {
        onMessage: this.handleMessage.bind(this),
        messages: this.messages,
        prompt: this.prompt,
        isThinking: this.isThinking,
      }),
    );
  }
}
