import fs from "fs";

import mime from "mime-types";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { WebSocket, WebSocketServer } from "ws";

import { Athena, Dict } from "../../core/athena.js";
import WebappUITransport from "./logger.js";
import { IWebappUIMessage } from "./message.js";
import { PluginBase } from "../plugin-base.js";
import { fileDigest } from "../../utils/crypto.js";
import logger from "../../utils/logger.js";

export default class WebappUI extends PluginBase {
  athena!: Athena;
  supabase!: SupabaseClient;
  userId: string = "";
  accessToken: string = "";
  wss?: WebSocketServer;
  connections: WebSocket[] = [];
  shutdownTimeout?: NodeJS.Timeout;
  logTransport!: WebappUITransport;
  boundAthenaPrivateEventHandler!: (event: string, args: Dict<any>) => void;

  desc() {
    return "You can interact with the user using UI tools and events. When the user asks you to do something, think about what information and/or details you need to do that. If you need something only the user can provide, you need to ask the user for that information. Ask the users about task details if the request is vague. Be proactive and update the user on your progress, milestones, and obstacles and how you are going to overcome them.";
  }

  async load(athena: Athena) {
    this.athena = athena;
    this.supabase = createClient(
      this.config.supabase.url,
      this.config.supabase.anon_key,
    );
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        this.userId = session?.user?.id ?? "";
        this.accessToken = session?.access_token ?? "";
        this.logger.info(`Token refreshed: ${this.accessToken}`);
        this.athena.emitPrivateEvent("webapp-ui/token-refreshed", {
          token: this.accessToken,
        });
      }
    });
    const { error } = await this.supabase.auth.verifyOtp({
      email: this.config.supabase.email,
      token: this.config.supabase.otp,
      type: "email",
    });
    if (error) {
      this.logger.error(error);
      throw new Error("Failed to verify OTP");
    }
    this.logTransport = new WebappUITransport(
      this.supabase,
      this.config.context_id,
    );
    logger.add(this.logTransport);
    const { data, error: error2 } = await this.supabase
      .from("contexts")
      .select("states")
      .eq("id", this.config.context_id);
    if (error2) {
      this.logger.error(`Failed to get context states: ${error2.message}`);
    } else if (data && data[0].states !== null) {
      this.athena.states = data[0].states;
      this.logger.info(
        `Loaded context states: ${JSON.stringify(data[0].states)}`,
      );
    }
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);
    athena.on("private-event", this.boundAthenaPrivateEventHandler);
    this.enableShutdownTimeout();
    athena.registerEvent({
      name: "ui/message-received",
      desc: "Triggered when a message is received from the user.",
      args: {
        content: {
          type: "string",
          desc: "The message received from the user.",
          required: true,
        },
        files: {
          type: "array",
          desc: "Files received from the user.",
          required: false,
          of: {
            type: "object",
            desc: "A file received from the user.",
            required: true,
            of: {
              name: {
                type: "string",
                desc: "The name of the file.",
                required: true,
              },
              location: {
                type: "string",
                desc: "The location of the file.",
                required: true,
              },
            },
          },
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
            desc: "The message to send to the user. This should be a valid Markdown message.",
            required: true,
          },
          files: {
            type: "array",
            desc: "Files to send to the user. Whenever the user requests a file or a download link to a file, you should use this argument to send the file to the user.",
            required: false,
            of: {
              type: "object",
              desc: "A file to send to the user.",
              required: true,
              of: {
                name: {
                  type: "string",
                  desc: "The name of the file.",
                  required: true,
                },
                location: {
                  type: "string",
                  desc: "The location of the file. Send URL or absolute path. Don't send relative paths.",
                  required: true,
                },
              },
            },
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
          if (args.files) {
            for (const file of args.files) {
              if (
                file.location.startsWith(
                  "https://oaidalleapiprodscus.blob.core.windows.net",
                )
              ) {
                // This is an image from DALL-E. Download it and upload it to Supabase to avoid expiration.
                const response = await fetch(file.location);
                const buffer = await response.arrayBuffer();
                const tempPath = `./${Date.now()}-${file.name}`;
                await fs.promises.writeFile(tempPath, Buffer.from(buffer));
                file.location = tempPath;
              }
              if (file.location.startsWith("http")) {
                continue;
              }
              const digest = await fileDigest(file.location);
              const storagePath = `${this.userId}/${digest.slice(
                0,
                2,
              )}/${digest.slice(2, 12)}/${encodeURIComponent(file.name).replace(
                /%/g,
                "_",
              )}`;
              const contentType = mime.lookup(file.location);
              const { error } = await this.supabase.storage
                .from(this.config.supabase.files_bucket)
                .upload(storagePath, fs.createReadStream(file.location), {
                  upsert: true,
                  contentType: contentType
                    ? contentType
                    : "application/octet-stream",
                  duplex: "half",
                });
              if (error) {
                throw new Error(
                  `Error uploading file ${file.name}: ${error.message}`,
                );
              }
              file.location = this.supabase.storage
                .from(this.config.supabase.files_bucket)
                .getPublicUrl(storagePath).data.publicUrl;
            }
          }
          const message: IWebappUIMessage = {
            type: "message",
            data: {
              role: "assistant",
              content: args.content,
              files: args.files,
              timestamp: Date.now(),
            },
          };
          this.supabase
            .from("messages")
            .insert({
              context_id: this.config.context_id,
              message,
            })
            .then(({ error }) => {
              if (error) {
                this.logger.error(error);
              }
            });
          await this.sendMessage(message);
          return { status: "success" };
        },
      },
    );
    athena.once("plugins-loaded", async () => {
      this.wss = new WebSocketServer({ port: this.config.port });
      this.wss.on("connection", (ws, req) => {
        this.disableShutdownTimeout();
        const ipPort = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        this.logger.info(`Client connected: ${ipPort}`);
        this.connections.push(ws);
        ws.on("message", (message) => {
          try {
            this.handleMessage(ws, message.toString());
          } catch (e) {}
        });
        const pingInterval = setInterval(() => {
          this.sendMessage({
            type: "ping",
            data: {},
          });
        }, 30000);
        ws.on("close", () => {
          this.logger.info(`Client disconnected: ${ipPort}`);
          clearInterval(pingInterval);
          const index = this.connections.indexOf(ws);
          if (index !== -1) {
            this.connections.splice(index, 1);
          }
          if (this.connections.length === 0) {
            this.enableShutdownTimeout();
          }
        });
        ws.on("error", (error) => {
          this.logger.error(`WebSocket error from ${ipPort}: ${error}`);
          clearInterval(pingInterval);
          ws.terminate();
          const index = this.connections.indexOf(ws);
          if (index !== -1) {
            this.connections.splice(index, 1);
          }
          if (this.connections.length === 0) {
            this.enableShutdownTimeout();
          }
        });
      });
      this.logger.info(`WebSocket server started on port ${this.config.port}`);
    });
  }

  async unload(athena: Athena) {
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    for (const ws of this.connections) {
      ws.terminate();
    }
    await new Promise<void>((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close(() => {
        resolve();
      });
    });
    this.athena.gatherStates();
    const { data, error } = await this.supabase
      .from("contexts")
      .update({
        states: this.athena.states,
      })
      .eq("id", this.config.context_id)
      .select();
    if (error) {
      this.logger.error(`Failed to update context states: ${error.message}`);
    } else {
      this.logger.info(`Updated context states: ${JSON.stringify(data)}`);
    }
    logger.remove(this.logTransport);
    await this.supabase.auth.signOut({
      scope: "local",
    });
    this.disableShutdownTimeout();
    athena.deregisterTool("ui/send-message");
    athena.deregisterEvent("ui/message-received");
  }

  enableShutdownTimeout() {
    this.disableShutdownTimeout();
    this.logger.info("Enabling shutdown timeout");
    this.shutdownTimeout = setTimeout(async () => {
      this.logger.warn("Timeout reached. Shutting down...");
      await this.athena.unloadPlugins();
      process.exit(0);
    }, this.config.shutdown_timeout * 1000);
  }

  disableShutdownTimeout() {
    if (this.shutdownTimeout) {
      this.logger.info("Disabling shutdown timeout");
      clearTimeout(this.shutdownTimeout);
      this.shutdownTimeout = undefined;
    }
  }

  handleMessage(ws: WebSocket, message: string) {
    for (const connection of this.connections) {
      if (connection === ws) {
        continue;
      }
      connection.send(message);
    }
    const obj = JSON.parse(message) as IWebappUIMessage;
    if (obj.type === "message") {
      this.supabase
        .from("messages")
        .insert({
          context_id: this.config.context_id,
          message: {
            type: "message",
            data: {
              role: "user",
              content: obj.data.content,
              files: obj.data.files,
              timestamp: Date.now(),
            },
          },
        })
        .then(({ error }) => {
          if (error) {
            this.logger.error(error);
          }
        });
      this.athena.emitEvent("ui/message-received", {
        content: obj.data.content,
        files: obj.data.files,
        time: new Date().toISOString(),
      });
    } else if (obj.type === "ping") {
      this.sendMessage({
        type: "pong",
        data: {},
      });
    }
  }

  async sendMessage(message: IWebappUIMessage) {
    const promises = [];
    for (const connection of this.connections) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          connection.send(JSON.stringify(message), (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        }),
      );
    }
    await Promise.all(promises);
  }

  athenaPrivateEventHandler(event: string, args: Dict<any>) {
    if (event === "cerebrum/thinking") {
      const message: IWebappUIMessage = {
        type: "thinking",
        data: {
          content: args.content,
          timestamp: Date.now(),
        },
      };
      this.supabase
        .from("messages")
        .insert({
          context_id: this.config.context_id,
          message,
        })
        .then(({ error }) => {
          if (error) {
            this.logger.error(error);
          }
        });
      this.sendMessage(message);
    } else if (event === "athena/tool-call") {
      const message: IWebappUIMessage = {
        type: "tool_call",
        data: {
          summary: args.summary,
          details: args.details,
          timestamp: Date.now(),
        },
      };
      this.supabase
        .from("messages")
        .insert({
          context_id: this.config.context_id,
          message,
        })
        .then(({ error }) => {
          if (error) {
            this.logger.error(error);
          }
        });
      this.sendMessage(message);
    } else if (event === "athena/tool-result") {
      const message: IWebappUIMessage = {
        type: "tool_result",
        data: {
          summary: args.summary,
          details: args.details,
          timestamp: Date.now(),
        },
      };
      this.supabase
        .from("messages")
        .insert({
          context_id: this.config.context_id,
          message,
        })
        .then(({ error }) => {
          if (error) {
            this.logger.error(error);
          }
        });
      this.sendMessage(message);
    } else if (event === "athena/event") {
      const message: IWebappUIMessage = {
        type: "event",
        data: {
          summary: args.summary,
          details: args.details,
          timestamp: Date.now(),
        },
      };
      this.supabase
        .from("messages")
        .insert({
          context_id: this.config.context_id,
          message,
        })
        .then(({ error }) => {
          if (error) {
            this.logger.error(error);
          }
        });
      this.sendMessage(message);
    } else if (event === "cerebrum/busy") {
      this.sendMessage({
        type: "busy",
        data: {
          busy: args.busy,
        },
      });
    } else if (event === "webapp-ui/request-token") {
      this.athena.emitPrivateEvent("webapp-ui/token-refreshed", {
        token: this.accessToken,
      });
    }
  }
}
