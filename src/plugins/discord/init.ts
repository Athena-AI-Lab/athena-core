import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  SendableChannels,
  TextChannel,
} from "discord.js";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class Discord extends PluginBase {
  client!: Client;
  boundAthenaPrivateEventHandler!: (event: string, args: Dict<any>) => void;

  desc() {
    return `You can send and receive messages to and from Discord. Your username in Discord is ${this.client.user?.username}, display name is ${this.client.user?.displayName}, and id is ${this.client.user?.id}. For channels, you don't have to respond to every message. Just respond when you are asked to do something or have something useful to say. For private chats, you should respond to every message, unless being explicitly told not to. When you receive a message, you can reply to it by calling the "discord/send-message" tool. Be mindful about which chat you are in and the type of the chat before sending a message.`;
  }

  async load(athena: Athena) {
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });
    const clientReadyPromise = new Promise<void>((resolve) => {
      this.client.once(Events.ClientReady, () => {
        resolve();
      });
    });
    await this.client.login(this.config.bot_token);

    athena.on("private-event", this.boundAthenaPrivateEventHandler);
    athena.emitPrivateEvent("discord/load", {
      content: "Plugin discord loaded.",
    });

    athena.registerEvent({
      name: "discord/message-received",
      desc: "Triggered when a message is received from Discord.",
      args: {
        id: {
          type: "string",
          desc: "The ID of the message.",
          required: true,
        },
        author: {
          type: "object",
          desc: "The author of the message.",
          required: true,
          of: {
            id: {
              type: "string",
              desc: "The ID of the author.",
              required: true,
            },
            username: {
              type: "string",
              desc: "The username of the author.",
              required: true,
            },
            display_name: {
              type: "string",
              desc: "The display name of the author.",
              required: true,
            },
          },
        },
        channel: {
          type: "object",
          desc: "The channel the message is sent to.",
          required: true,
          of: {
            id: {
              type: "string",
              desc: "The ID of the channel.",
              required: true,
            },
            type: {
              type: "string",
              desc: "The type of the channel.",
              required: true,
            },
            name: {
              type: "string",
              desc: "The name of the channel.",
              required: false,
            },
          },
        },
        guild: {
          type: "object",
          desc: "The guild the message is sent to.",
          required: false,
          of: {
            id: {
              type: "string",
              desc: "The ID of the guild.",
              required: true,
            },
            name: {
              type: "string",
              desc: "The name of the guild.",
              required: true,
            },
          },
        },
        reply_to_message: {
          type: "object",
          desc: "The message being replied to.",
          required: false,
          of: {
            id: {
              type: "string",
              desc: "The ID of the message.",
              required: true,
            },
            author: {
              type: "object",
              desc: "The author of the message.",
              required: true,
              of: {
                id: {
                  type: "string",
                  desc: "The ID of the author.",
                  required: true,
                },
                username: {
                  type: "string",
                  desc: "The username of the author.",
                  required: true,
                },
                display_name: {
                  type: "string",
                  desc: "The display name of the author.",
                  required: true,
                },
              },
            },
            content: {
              type: "string",
              desc: "The content of the message.",
              required: true,
            },
            attachments: {
              type: "array",
              desc: "The attachments of the message.",
              required: false,
              of: {
                type: "object",
                desc: "The attachment.",
                required: true,
                of: {
                  id: {
                    type: "string",
                    desc: "The ID of the attachment.",
                    required: true,
                  },
                  name: {
                    type: "string",
                    desc: "The name of the attachment.",
                    required: true,
                  },
                  size: {
                    type: "number",
                    desc: "The size of the attachment in bytes.",
                    required: true,
                  },
                  content_type: {
                    type: "string",
                    desc: "The mime type of the attachment.",
                    required: true,
                  },
                  url: {
                    type: "string",
                    desc: "The URL of the attachment.",
                    required: true,
                  },
                },
              },
            },
            timestamp: {
              type: "number",
              desc: "The timestamp of the message.",
              required: true,
            },
          },
        },
        content: {
          type: "string",
          desc: "The content of the message.",
          required: true,
        },
        attachments: {
          type: "array",
          desc: "The attachments of the message.",
          required: false,
          of: {
            type: "object",
            desc: "The attachment.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "The ID of the attachment.",
                required: true,
              },
              name: {
                type: "string",
                desc: "The name of the attachment.",
                required: true,
              },
              size: {
                type: "number",
                desc: "The size of the attachment in bytes.",
                required: true,
              },
              content_type: {
                type: "string",
                desc: "The mime type of the attachment.",
                required: true,
              },
              url: {
                type: "string",
                desc: "The URL of the attachment.",
                required: true,
              },
            },
          },
        },
        timestamp: {
          type: "number",
          desc: "The timestamp of the message.",
          required: true,
        },
      },
    });

    athena.registerEvent({
      name: "discord/interaction-received",
      desc: "Triggered when an interaction is received from Discord.",
      args: {
        id: {
          type: "string",
          desc: "The ID of the interaction.",
          required: true,
        },
        user: {
          type: "object",
          desc: "The user who initiated the interaction.",
          required: true,
          of: {
            id: {
              type: "string",
              desc: "The ID of the user.",
              required: true,
            },
            username: {
              type: "string",
              desc: "The username of the user.",
              required: true,
            },
            display_name: {
              type: "string",
              desc: "The display name of the user.",
              required: true,
            },
          },
        },
        channel_id: {
          type: "string",
          desc: "The ID of the channel the interaction is in.",
          required: true,
        },
        message_id: {
          type: "string",
          desc: "The ID of the message the interaction is in.",
          required: true,
        },
        custom_id: {
          type: "string",
          desc: "The custom ID of the interaction.",
          required: true,
        },
        timestamp: {
          type: "number",
          desc: "The timestamp of the interaction.",
          required: true,
        },
      },
    });

    athena.registerTool({
      name: "discord/send-message",
      desc: "Send a message to a chat in Discord.",
      args: {
        channel_id: {
          type: "string",
          desc: "The ID of the channel to send the message to.",
          required: true,
        },
        reply_to_message_id: {
          type: "string",
          desc: "The ID of the message to reply to.",
          required: false,
        },
        content: {
          type: "string",
          desc: "The content of the message.",
          required: true,
        },
        files: {
          type: "array",
          desc: "The files to attach to the message.",
          required: false,
          of: {
            type: "object",
            desc: "The file to attach.",
            required: true,
            of: {
              name: {
                type: "string",
                desc: "The name of the file.",
                required: true,
              },
              desc: {
                type: "string",
                desc: "The description of the file.",
                required: false,
              },
              path: {
                type: "string",
                desc: "The path to the file. Could be local path or URL.",
                required: true,
              },
            },
          },
        },
        components: {
          type: "array",
          desc: "The components to attach to the message.",
          required: false,
          of: {
            type: "object",
            desc: "The component to attach to the message.",
            required: true,
          },
        },
      },
      retvals: {
        id: {
          type: "string",
          desc: "The ID of the message sent.",
          required: true,
        },
      },
      fn: async (args: Dict<any>) => {
        const channel = await this.client.channels.fetch(args.channel_id);
        if (!channel) {
          throw new Error("The channel does not exist.");
        }
        if (!channel.isTextBased()) {
          throw new Error("The channel is not text-based.");
        }
        return {
          id: (
            await (channel as SendableChannels).send({
              content: args.content,
              reply: args.reply_to_message_id
                ? {
                    messageReference: args.reply_to_message_id,
                  }
                : undefined,
              files: args.files
                ? args.files.map((file: Dict<any>) => ({
                    attachment: file.path,
                    name: file.name,
                    description: file.desc,
                  }))
                : undefined,
              components: args.components,
            })
          ).id,
        };
      },
    });

    athena.registerTool({
      name: "discord/edit-message",
      desc: "Edit a message in Discord.",
      args: {
        channel_id: {
          type: "string",
          desc: "The ID of the channel the message is in.",
          required: true,
        },
        message_id: {
          type: "string",
          desc: "The ID of the message to edit.",
          required: true,
        },
        content: {
          type: "string",
          desc: "The new content of the message.",
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
      fn: async (args: Dict<any>) => {
        const channel = await this.client.channels.fetch(args.channel_id);
        if (!channel) {
          throw new Error("The channel does not exist.");
        }
        if (!channel.isTextBased()) {
          throw new Error("The channel is not text-based.");
        }
        const message = await (channel as SendableChannels).messages.fetch(
          args.message_id,
        );
        if (!message) {
          throw new Error("The message does not exist.");
        }
        await message.edit(args.content);
        return { status: "success" };
      },
    });

    athena.registerTool({
      name: "discord/delete-message",
      desc: "Delete a message in Discord.",
      args: {
        channel_id: {
          type: "string",
          desc: "The ID of the channel the message is in.",
          required: true,
        },
        message_id: {
          type: "string",
          desc: "The ID of the message to delete.",
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
      fn: async (args: Dict<any>) => {
        const channel = await this.client.channels.fetch(args.channel_id);
        if (!channel) {
          throw new Error("The channel does not exist.");
        }
        if (!channel.isTextBased()) {
          throw new Error("The channel is not text-based.");
        }
        const message = await (channel as SendableChannels).messages.fetch(
          args.message_id,
        );
        if (!message) {
          throw new Error("The message does not exist.");
        }
        await message.delete();
        return { status: "success" };
      },
    });

    athena.once("plugins-loaded", () => {
      this.client.on(Events.MessageCreate, async (message) => {
        if (message.author.id === this.client.user?.id) {
          return;
        }
        const channelType =
          message.channel.type === ChannelType.DM ? "dm" : "guild";
        if (!this.config.allowed_channel_ids.includes(message.channel.id)) {
          if (
            channelType === "dm" ||
            message.content.toLowerCase().includes("channel id")
          ) {
            message.channel.send(
              `You appear to not have access to Athena, but FYI, your channel ID is ${message.channel.id}.`,
            );
          }
          return;
        }
        let reply_to_message;
        try {
          reply_to_message =
            message.reference && message.reference.messageId
              ? await message.channel.messages.fetch(
                  message.reference.messageId,
                )
              : undefined;
        } catch (e) {
          this.logger.error(e);
        }
        athena.emitEvent("discord/message-received", {
          id: message.id,
          author: {
            id: message.author.id,
            username: message.author.username,
            display_name: message.author.displayName,
          },
          channel: {
            id: message.channel.id,
            type: channelType,
            name:
              channelType === "guild"
                ? (message.channel as TextChannel).name
                : undefined,
          },
          guild:
            channelType === "guild"
              ? {
                  id: message.guild?.id,
                  name: message.guild?.name,
                }
              : undefined,
          reply_to_message: reply_to_message
            ? {
                id: reply_to_message.id,
                author: {
                  id: reply_to_message.author.id,
                  username: reply_to_message.author.username,
                  display_name: reply_to_message.author.displayName,
                },
                content: reply_to_message.content,
                attachments: reply_to_message.attachments
                  ? reply_to_message.attachments.map((attachment) => ({
                      id: attachment.id,
                      name: attachment.name,
                      size: attachment.size,
                      content_type: attachment.contentType,
                      url: attachment.url,
                    }))
                  : undefined,
                timestamp: reply_to_message.createdTimestamp,
              }
            : undefined,
          content: message.content,
          attachments: message.attachments
            ? message.attachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                size: attachment.size,
                content_type: attachment.contentType,
                url: attachment.url,
              }))
            : undefined,
          timestamp: message.createdTimestamp,
        });
      });

      this.client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) {
          return;
        }

        athena.emitEvent("discord/interaction-received", {
          id: interaction.id,
          user: {
            id: interaction.user.id,
            username: interaction.user.username,
            display_name: interaction.user.displayName,
          },
          channel_id: interaction.channelId,
          message_id: interaction.message?.id,
          custom_id: interaction.customId,
          timestamp: interaction.createdTimestamp,
        });

        await interaction.deferUpdate();
      });
    });

    await clientReadyPromise;
  }

  async unload(athena: Athena) {
    athena.emitPrivateEvent("discord/unload", {
      content: "Plugin discord unloaded.",
    });
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    await this.client.destroy();
    athena.deregisterTool("discord/send-message");
    athena.deregisterTool("discord/edit-message");
    athena.deregisterTool("discord/delete-message");
    athena.deregisterEvent("discord/message-received");
    athena.deregisterEvent("discord/interaction-received");
  }

  athenaPrivateEventHandler(event: string, args: Dict<any>) {
    if (args.content) {
      for (const channelId of this.config.admin_channel_ids) {
        this.client.channels.fetch(channelId).then((channel) => {
          if (channel && channel.isTextBased()) {
            (channel as TextChannel)
              .send(`${event}\n${args.content}`)
              .catch(() => {});
          }
        });
      }
    }
    if (
      ["cerebrum/thinking", "athena/tool-call", "athena/tool-result"].includes(
        event,
      )
    ) {
      const message = (() => {
        if (event === "cerebrum/thinking") {
          return `>>> ${args.content}`;
        }
        return `\`\`\`\n${args.summary}\n\`\`\``;
      })();
      for (const channelId of this.config.log_channel_ids) {
        this.client.channels.fetch(channelId).then((channel) => {
          if (channel && channel.isTextBased()) {
            (channel as TextChannel).send(message).catch(() => {});
          }
        });
      }
    }
  }
}
