import TelegramBot from "node-telegram-bot-api";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class Telegram extends PluginBase {
  bot!: TelegramBot;
  me!: TelegramBot.User;
  boundAthenaPrivateEventHandler!: (event: string, args: Dict<any>) => void;

  desc() {
    return `You can send and receive messages to and from Telegram. Your username in Telegram is ${this.me.username} and your display name is ${this.me.first_name}. For group chats, you don't have to respond to every message. Just respond when you are asked to do something or have something useful to say. For private chats, you should respond to every message, unless being explicitly told not to. When you receive a message, you can reply to it by calling the "telegram/send-message" tool. Be mindful about which chat you are in and the type of the chat before sending a message.`;
  }

  async load(athena: Athena) {
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);

    this.bot = new TelegramBot(this.config.bot_token, { polling: true });
    this.me = await this.bot.getMe();

    athena.on("private-event", this.boundAthenaPrivateEventHandler);
    athena.emitPrivateEvent("telegram/load", {
      content: "Plugin telegram loaded.",
    });

    athena.registerEvent({
      name: "telegram/message-received",
      desc: "Triggered when a message is received from Telegram.",
      args: {
        message_id: {
          type: "number",
          desc: "Unique message identifier inside this chat.",
          required: true,
        },
        from: {
          type: "object",
          desc: "Sender of the message.",
          required: false,
          of: {
            id: {
              type: "number",
              desc: "Unique identifier for this user or bot.",
              required: true,
            },
            first_name: {
              type: "string",
              desc: "User's or bot's first name.",
              required: true,
            },
            last_name: {
              type: "string",
              desc: "User's or bot's last name.",
              required: false,
            },
            username: {
              type: "string",
              desc: "User's or bot's username.",
              required: false,
            },
          },
        },
        chat: {
          type: "object",
          desc: "Chat the message belongs to.",
          required: true,
          of: {
            id: {
              type: "number",
              desc: "Unique identifier for this chat.",
              required: true,
            },
            type: {
              type: "string",
              desc: "Type of the chat.",
              required: true,
            },
            title: {
              type: "string",
              desc: "Title, for supergroups, channels and group chats.",
              required: false,
            },
          },
        },
        reply_to_message: {
          type: "object",
          desc: "For replies in the same chat and message thread, the original message.",
          required: false,
          of: {
            message_id: {
              type: "number",
              desc: "Unique message identifier inside this chat.",
              required: true,
            },
            from: {
              type: "object",
              desc: "Sender of the message.",
              required: false,
              of: {
                id: {
                  type: "number",
                  desc: "Unique identifier for this user or bot.",
                  required: true,
                },
                first_name: {
                  type: "string",
                  desc: "User's or bot's first name.",
                  required: true,
                },
                last_name: {
                  type: "string",
                  desc: "User's or bot's last name.",
                  required: false,
                },
                username: {
                  type: "string",
                  desc: "User's or bot's username.",
                  required: false,
                },
              },
            },
            text: {
              type: "string",
              desc: "For text messages, the actual UTF-8 text of the message.",
              required: false,
            },
            sticker_emoji: {
              type: "string",
              desc: "Emoji of the sticker.",
              required: false,
            },
            photo: {
              type: "array",
              desc: "Available sizes of the photo.",
              required: false,
              of: {
                type: "object",
                desc: "This object represents one size of a photo or a file / sticker thumbnail.",
                required: true,
                of: {
                  file_id: {
                    type: "string",
                    desc: "Identifier for this file, which can be used to download or reuse the file.",
                    required: true,
                  },
                  width: {
                    type: "number",
                    desc: "Photo width.",
                    required: true,
                  },
                  height: {
                    type: "number",
                    desc: "Photo height.",
                    required: true,
                  },
                  url: {
                    type: "string",
                    desc: "URL of the photo.",
                    required: true,
                  },
                },
              },
            },
            video: {
              type: "object",
              desc: "Message is a video, information about the video.",
              required: false,
              of: {
                file_id: {
                  type: "string",
                  desc: "Identifier for this file, which can be used to download or reuse the file.",
                  required: true,
                },
                width: {
                  type: "number",
                  desc: "Video width as defined by the sender.",
                  required: true,
                },
                height: {
                  type: "number",
                  desc: "Video height as defined by the sender.",
                  required: true,
                },
                duration: {
                  type: "number",
                  desc: "Duration of the video in seconds as defined by the sender",
                  required: true,
                },
                url: {
                  type: "string",
                  desc: "URL of the photo.",
                  required: true,
                },
              },
            },
            file: {
              type: "object",
              desc: "File in the message.",
              required: false,
              of: {
                file_id: {
                  type: "string",
                  desc: "Identifier for this file, which can be used to download or reuse the file.",
                  required: true,
                },
                file_name: {
                  type: "string",
                  desc: "Original filename as defined by the sender.",
                  required: true,
                },
                file_size: {
                  type: "number",
                  desc: "File size in bytes.",
                  required: true,
                },
                url: {
                  type: "string",
                  desc: "URL of the file.",
                  required: true,
                },
              },
            },
            date: {
              type: "string",
              desc: "Date the message was sent.",
              required: true,
            },
          },
        },
        text: {
          type: "string",
          desc: "For text messages, the actual UTF-8 text of the message.",
          required: false,
        },
        sticker_emoji: {
          type: "string",
          desc: "Emoji of the sticker.",
          required: false,
        },
        photo: {
          type: "array",
          desc: "Available sizes of the photo.",
          required: false,
          of: {
            type: "object",
            desc: "This object represents one size of a photo or a file / sticker thumbnail.",
            required: true,
            of: {
              file_id: {
                type: "string",
                desc: "Identifier for this file, which can be used to download or reuse the file.",
                required: true,
              },
              width: {
                type: "number",
                desc: "Photo width.",
                required: true,
              },
              height: {
                type: "number",
                desc: "Photo height.",
                required: true,
              },
              url: {
                type: "string",
                desc: "URL of the photo.",
                required: true,
              },
            },
          },
        },
        video: {
          type: "object",
          desc: "Message is a video, information about the video.",
          required: false,
          of: {
            file_id: {
              type: "string",
              desc: "Identifier for this file, which can be used to download or reuse the file.",
              required: true,
            },
            width: {
              type: "number",
              desc: "Video width as defined by the sender.",
              required: true,
            },
            height: {
              type: "number",
              desc: "Video height as defined by the sender.",
              required: true,
            },
            duration: {
              type: "number",
              desc: "Duration of the video in seconds as defined by the sender",
              required: true,
            },
            url: {
              type: "string",
              desc: "URL of the photo.",
              required: true,
            },
          },
        },
        file: {
          type: "object",
          desc: "File in the message.",
          required: false,
          of: {
            file_id: {
              type: "string",
              desc: "Identifier for this file, which can be used to download or reuse the file.",
              required: true,
            },
            file_name: {
              type: "string",
              desc: "Original filename as defined by the sender.",
              required: true,
            },
            file_size: {
              type: "number",
              desc: "File size in bytes.",
              required: true,
            },
            url: {
              type: "string",
              desc: "URL of the file.",
              required: true,
            },
          },
        },
        date: {
          type: "string",
          desc: "Date the message was sent.",
          required: true,
        },
      },
    });

    athena.registerEvent({
      name: "telegram/callback-query-received",
      desc: "Triggered when a callback query is received from Telegram.",
      args: {
        id: {
          type: "string",
          desc: "Unique identifier for this query.",
          required: true,
        },
        from: {
          type: "object",
          desc: "Sender.",
          required: true,
          of: {
            id: {
              type: "number",
              desc: "Unique identifier for this user or bot.",
              required: true,
            },
            first_name: {
              type: "string",
              desc: "User's or bot's first name.",
              required: true,
            },
            last_name: {
              type: "string",
              desc: "User's or bot's last name.",
              required: false,
            },
            username: {
              type: "string",
              desc: "User's or bot's username.",
              required: false,
            },
          },
        },
        message: {
          type: "object",
          desc: "Message sent by the bot with the callback button that originated the query.",
          required: true,
          of: {
            chat_id: {
              type: "number",
              desc: "Unique identifier for the chat the message belongs to.",
              required: true,
            },
            message_id: {
              type: "number",
              desc: "Unique message identifier inside this chat.",
              required: true,
            },
          },
        },
        data: {
          type: "string",
          desc: "Data associated with the callback button. Be aware that the message originated the query can contain no callback buttons with this data.",
          required: false,
        },
      },
    });

    athena.registerTool({
      name: "telegram/send-message",
      desc: "Send a message to a chat in Telegram.",
      args: {
        chat_id: {
          type: "number",
          desc: "Unique identifier for the target chat or username of the target channel.",
          required: true,
        },
        reply_to_message_id: {
          type: "number",
          desc: "Identifier of the message that will be replied to in the current chat.",
          required: false,
        },
        text: {
          type: "string",
          desc: "Text of the message to be sent, 1-4096 characters after entities parsing.",
          required: true,
        },
        photo: {
          type: "string",
          desc: "Photo to send. Pass a local filename or a URL.",
          required: false,
        },
        file: {
          type: "string",
          desc: "File to send. Pass a local filename or a URL.",
          required: false,
        },
        reply_markup: {
          type: "object",
          desc: "Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove a reply keyboard or to force a reply from the user.",
          required: false,
        },
      },
      retvals: {
        message_id: {
          type: "number",
          desc: "Unique message identifier inside this chat.",
          required: true,
        },
      },
      fn: async (args: Dict<any>) => {
        if (args.photo) {
          const message = await this.bot.sendPhoto(args.chat_id, args.photo, {
            caption: args.text,
            reply_to_message_id: args.reply_to_message_id,
            reply_markup: args.reply_markup,
          });
          return { message_id: message.message_id };
        }
        if (args.file) {
          const message = await this.bot.sendDocument(args.chat_id, args.file, {
            caption: args.text,
            reply_to_message_id: args.reply_to_message_id,
            reply_markup: args.reply_markup,
          });
          return { message_id: message.message_id };
        }
        const message = await this.bot.sendMessage(args.chat_id, args.text, {
          reply_to_message_id: args.reply_to_message_id,
          reply_markup: args.reply_markup,
        });
        return { message_id: message.message_id };
      },
    });

    athena.registerTool({
      name: "telegram/edit-message",
      desc: "Edit a message in Telegram.",
      args: {
        chat_id: {
          type: "number",
          desc: "Unique identifier for the target chat or username of the target channel.",
          required: true,
        },
        message_id: {
          type: "number",
          desc: "Unique message identifier inside this chat.",
          required: true,
        },
        text: {
          type: "string",
          desc: "New text of the message.",
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
      fn: async (args: Dict<any>) => {
        await this.bot.editMessageText(args.text, {
          chat_id: args.chat_id,
          message_id: args.message_id,
        });
        return { status: "success" };
      },
    });

    athena.registerTool({
      name: "telegram/delete-message",
      desc: "Delete a message in Telegram.",
      args: {
        chat_id: {
          type: "number",
          desc: "Unique identifier for the target chat or username of the target channel.",
          required: true,
        },
        message_id: {
          type: "number",
          desc: "Unique message identifier inside this chat.",
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
      fn: async (args: Dict<any>) => {
        await this.bot.deleteMessage(args.chat_id, args.message_id);
        return { status: "success" };
      },
    });

    athena.once("plugins-loaded", () => {
      this.bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const chatType = msg.chat.type;
        if (!this.config.allowed_chat_ids.includes(chatId)) {
          if (
            chatType === "private" ||
            msg.text?.toLowerCase().includes("chat id")
          ) {
            this.bot.sendMessage(
              chatId,
              `You appear to not have access to Athena, but FYI, your chat ID is ${chatId}.`,
            );
          }
          return;
        }
        let photo;
        if (msg.photo) {
          photo = [];
          for (const size of msg.photo) {
            photo.push({
              file_id: size.file_id,
              width: size.width,
              height: size.height,
              url: await this.getFileUrl(size.file_id),
            });
          }
        }
        let video;
        try {
          if (msg.video) {
            video = {
              file_id: msg.video.file_id,
              width: msg.video.width,
              height: msg.video.height,
              duration: msg.video.duration,
              url: await this.getFileUrl(msg.video.file_id),
            };
          }
        } catch (e) {}
        let reply_to_message_photo;
        try {
          if (msg.reply_to_message?.photo) {
            reply_to_message_photo = [];
            for (const size of msg.reply_to_message.photo) {
              reply_to_message_photo.push({
                file_id: size.file_id,
                width: size.width,
                height: size.height,
                url: await this.getFileUrl(size.file_id),
              });
            }
          }
        } catch (e) {}
        let reply_to_message_video;
        if (msg.reply_to_message?.video) {
          reply_to_message_video = {
            file_id: msg.reply_to_message.video.file_id,
            width: msg.reply_to_message.video.width,
            height: msg.reply_to_message.video.height,
            duration: msg.reply_to_message.video.duration,
            // url: await this.getFileUrl(msg.reply_to_message.video.file_id),
          };
        }
        athena.emitEvent("telegram/message-received", {
          message_id: msg.message_id,
          from: msg.from
            ? {
                id: msg.from.id,
                first_name: msg.from.first_name,
                last_name: msg.from.last_name,
                username: msg.from.username,
              }
            : undefined,
          chat: {
            id: msg.chat.id,
            type: chatType,
            title: msg.chat.title,
          },
          reply_to_message: msg.reply_to_message
            ? {
                message_id: msg.reply_to_message.message_id,
                from: msg.reply_to_message.from
                  ? {
                      id: msg.reply_to_message.from.id,
                      first_name: msg.reply_to_message.from.first_name,
                      last_name: msg.reply_to_message.from.last_name,
                      username: msg.reply_to_message.from.username,
                    }
                  : undefined,
                text: msg.reply_to_message.text || msg.reply_to_message.caption,
                sticker_emoji: msg.reply_to_message.sticker?.emoji,
                photo: reply_to_message_photo,
                video: reply_to_message_video,
                file: msg.reply_to_message.document
                  ? {
                      file_id: msg.reply_to_message.document.file_id,
                      file_name: msg.reply_to_message.document.file_name,
                      file_size: msg.reply_to_message.document.file_size,
                      url: await this.getFileUrl(
                        msg.reply_to_message.document.file_id,
                      ),
                    }
                  : undefined,
                date: new Date(msg.reply_to_message.date * 1000).toISOString(),
              }
            : undefined,
          text: msg.text || msg.caption,
          sticker_emoji: msg.sticker?.emoji,
          photo: photo,
          video: video,
          file: msg.document
            ? {
                file_id: msg.document.file_id,
                file_name: msg.document.file_name,
                file_size: msg.document.file_size,
                url: await this.getFileUrl(msg.document.file_id),
              }
            : undefined,
          date: new Date(msg.date * 1000).toISOString(),
        });
      });

      this.bot.on("callback_query", async (query) => {
        athena.emitEvent("telegram/callback-query-received", {
          id: query.id,
          from: {
            id: query.from.id,
            first_name: query.from.first_name,
            last_name: query.from.last_name,
            username: query.from.username,
          },
          message: {
            chat_id: query.message?.chat.id,
            message_id: query.message?.message_id,
          },
          data: query.data,
        });
        await this.bot.answerCallbackQuery(query.id);
      });
    });
  }

  async unload(athena: Athena) {
    athena.emitPrivateEvent("telegram/unload", {
      content: "Plugin telegram unloaded.",
    });
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    await this.bot.stopPolling();
    athena.deregisterTool("telegram/send-message");
    athena.deregisterTool("telegram/edit-message");
    athena.deregisterTool("telegram/delete-message");
    athena.deregisterEvent("telegram/message-received");
    athena.deregisterEvent("telegram/callback-query-received");
  }

  async getFileUrl(fileId: string) {
    const file = await this.bot.getFile(fileId);
    return `https://api.telegram.org/file/bot${this.config.bot_token}/${file.file_path}`;
  }

  athenaPrivateEventHandler(event: string, args: Dict<any>) {
    if (args.content) {
      for (const chatId of this.config.admin_chat_ids) {
        this.bot
          .sendMessage(chatId, `${event}\n${args.content}`)
          .catch(() => {});
      }
    }
    if (
      ["cerebrum/thinking", "athena/tool-call", "athena/tool-result"].includes(
        event,
      )
    ) {
      const message = (() => {
        if (event === "cerebrum/thinking") {
          return `Thinking: ${args.content}`;
        }
        return args.summary;
      })();
      for (const chatId of this.config.log_chat_ids) {
        this.bot.sendMessage(chatId, message).catch(() => {});
      }
    }
  }
}
