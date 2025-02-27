import Bolt, { type App as BoltApp, LogLevel } from "@slack/bolt";
import { AuthTestResponse } from "@slack/web-api";
import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

const { App } = Bolt;

export default class Slack extends PluginBase {
  app!: BoltApp;
  me!: AuthTestResponse;
  boundAthenaPrivateEventHandler!: (event: string, args: Dict<any>) => void;

  desc() {
    return `You can send and receive messages to and from Slack. Your username in Slack is ${this.me.user_id}. For channels, you don't have to respond to every message - only respond when asked to do something or when you have something useful to contribute. For direct messages, respond to every message unless explicitly told not to. When you receive a message, you can reply by calling the "slack/send-message" tool. Be mindful of the channel or conversation context before sending a message.`;
  }

  async load(athena: Athena) {
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);

    this.app = new App({
      token: this.config.bot_token,
      appToken: this.config.app_token,
      socketMode: true,
      logLevel: LogLevel.DEBUG,
    });

    this.me = await this.app.client.auth.test();

    athena.on("private-event", this.boundAthenaPrivateEventHandler);
    athena.emitPrivateEvent("slack/load", {
      content: "Plugin slack loaded with Socket Mode.",
    });

    // Register events
    athena.registerEvent({
      name: "slack/message-received",
      desc: "Triggered when a message is received from Slack via Socket Mode.",
      args: {
        ts: {
          type: "string",
          desc: "Timestamp of the message.",
          required: true,
        },
        user: {
          type: "string",
          desc: "ID of the user who sent the message.",
          required: false,
        },
        channel: {
          type: "string",
          desc: "Channel or conversation ID.",
          required: true,
        },
        channel_type: {
          type: "string",
          desc: "Type of channel (channel, group, im, etc.).",
          required: true,
        },
        text: {
          type: "string",
          desc: "Text content of the message.",
          required: false,
        },
        thread_ts: {
          type: "string",
          desc: "Timestamp of the parent message if this is a threaded reply.",
          required: false,
        },
        files: {
          type: "array",
          desc: "Files attached to the message.",
          required: false,
          of: {
            type: "object",
            desc: "File object.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "File ID.",
                required: true,
              },
              name: {
                type: "string",
                desc: "File name.",
                required: true,
              },
              url_private: {
                type: "string",
                desc: "Private URL to access the file.",
                required: true,
              },
              size: {
                type: "number",
                desc: "File size in bytes.",
                required: true,
              },
            },
          },
        },
      },
    });

    // Register tools
    athena.registerTool(
      {
        name: "slack/send-message",
        desc: "Send a message to a Slack channel or conversation.",
        args: {
          channel: {
            type: "string",
            desc: "Channel or conversation ID to send the message to.",
            required: true,
          },
          text: {
            type: "string",
            desc: "Text of the message to be sent.",
            required: true,
          },
          thread_ts: {
            type: "string",
            desc: "Timestamp of the parent message to reply in a thread.",
            required: false,
          },
        },
        retvals: {
          ts: {
            type: "string",
            desc: "Timestamp of the sent message.",
            required: false,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const result = await this.app.client.chat.postMessage({
            channel: args.channel,
            text: args.text,
            thread_ts: args.thread_ts,
          });
          return { ts: result.ts };
        },
      },
    );

    athena.registerTool(
      {
        name: "slack/edit-message",
        desc: "Edit a message in Slack.",
        args: {
          channel: {
            type: "string",
            desc: "Channel or conversation ID containing the message.",
            required: true,
          },
          ts: {
            type: "string",
            desc: "Timestamp of the message to edit.",
            required: true,
          },
          text: {
            type: "string",
            desc: "New text for the message.",
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
          await this.app.client.chat.update({
            channel: args.channel,
            ts: args.ts,
            text: args.text,
          });
          return { status: "success" };
        },
      },
    );

    athena.registerTool(
      {
        name: "slack/delete-message",
        desc: "Delete a message in Slack.",
        args: {
          channel: {
            type: "string",
            desc: "Channel or conversation ID containing the message.",
            required: true,
          },
          ts: {
            type: "string",
            desc: "Timestamp of the message to delete.",
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
          await this.app.client.chat.delete({
            channel: args.channel,
            ts: args.ts,
          });
          return { status: "success" };
        },
      },
    );

    this.app.message(async ({ message, say }) => {
      console.log("Received message:", message);
      if (message.subtype) {
        return;
      }
      if (!this.config.allowed_channel_ids.includes(message.channel)) {
        if (
          message.channel_type === "im" ||
          message.text?.toLowerCase().includes("channel id")
        ) {
          await say(
            `You appear to not have access to Athena, but FYI, your channel ID is ${message.channel}.`,
          );
        }
        return;
      }

      athena.emitEvent("slack/message-received", {
        ts: message.ts,
        user: message.user,
        channel: message.channel,
        channel_type: message.channel_type,
        text: message.text,
        thread_ts: message.thread_ts,
        files:
          message.files?.map((file) => ({
            id: file.id,
            name: file.name,
            url_private: file.url_private,
            size: file.size,
          })) ?? [],
      });
    });

    this.app.start(3000).then(() => {
      console.log("⚡️ Slack Bolt app is running!");
    });
  }

  async unload(athena: Athena) {
    athena.emitPrivateEvent("slack/unload", {
      content: "Plugin slack unloaded.",
    });
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    await this.app.stop();
    athena.deregisterTool("slack/send-message");
    athena.deregisterTool("slack/edit-message");
    athena.deregisterTool("slack/delete-message");
    athena.deregisterEvent("slack/message-received");
  }

  athenaPrivateEventHandler(event: string, args: Dict<any>) {
    if (args.content) {
      for (const channelId of this.config.admin_channel_ids) {
        this.app.client.chat
          .postMessage({
            channel: channelId,
            text: `${event}\n${args.content}`,
          })
          .catch(() => {});
      }
    }
    if (
      ["cerebrum/thinking", "athena/tool-call", "athena/tool-result"].includes(
        event,
      )
    ) {
      const message =
        event === "cerebrum/thinking"
          ? `Thinking: ${args.content}`
          : args.summary;
      for (const channelId of this.config.log_channel_ids) {
        this.app.client.chat
          .postMessage({
            channel: channelId,
            text: message,
          })
          .catch(() => {});
      }
    }
  }
}
