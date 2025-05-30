import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { Athena, Dict, IAthenaArgument } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

interface IMCPStdioConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Dict<string>;
}

interface IMCPStreamableHttpConfig {
  type: "streamable_http";
  url: string;
}

interface IMCPSSEConfig {
  type: "sse";
  url: string;
}

interface IMCPUnknownConfig {
  type: "unknown";
}

type IMCPConfig =
  | IMCPStdioConfig
  | IMCPStreamableHttpConfig
  | IMCPSSEConfig
  | IMCPUnknownConfig;

export default class MCP extends PluginBase {
  clients: Client[] = [];
  toolNames: string[] = [];

  async load(athena: Athena) {
    const servers: Dict<IMCPConfig> = this.config.servers;
    const promises: Promise<void>[] = [];
    for (const [name, config] of Object.entries(servers)) {
      promises.push(this.connectToServer(name, config, athena));
    }
    await Promise.all(promises);
  }

  async unload(athena: Athena) {
    for (const client of this.clients) {
      await client.close();
    }
    for (const toolName of this.toolNames) {
      athena.deregisterTool(toolName);
    }
  }

  async connectToServer(name: string, config: IMCPConfig, athena: Athena) {
    let transport:
      | StdioClientTransport
      | StreamableHTTPClientTransport
      | SSEClientTransport;
    if (config.type === "stdio") {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    } else if (config.type === "streamable_http") {
      transport = new StreamableHTTPClientTransport(new URL(config.url));
    } else if (config.type === "sse") {
      transport = new SSEClientTransport(new URL(config.url));
    } else {
      throw new Error(`Unknown MCP config type: ${config.type}`);
    }
    const client = new Client({
      name,
      version: "1.0.0",
    });
    this.clients.push(client);
    await client.connect(transport);
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      const toolName = `mcp/${name}/${tool.name}`;
      this.toolNames.push(toolName);
      athena.registerTool(
        {
          name: toolName,
          desc: tool.description ?? "",
          args: tool.inputSchema as Dict<IAthenaArgument>, // Not converting to Dict<IAthenaArgument> because such conversion will lose some information.
          retvals: {
            result: {
              type: "object",
              desc: "The result of the tool call",
              required: true,
            },
          },
        },
        {
          fn: async (args: Dict<any>) => {
            const result = await client.callTool({
              name: tool.name,
              arguments: args,
            });
            return {
              result: result.content as string,
            };
          },
          explain_args: (args: Dict<any>) => {
            return {
              summary: `Calling MCP tool ${toolName}...`,
              details: JSON.stringify(args),
            };
          },
          explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
            return {
              summary: `MCP tool ${toolName} returned.`,
              details: JSON.stringify(retvals),
            };
          },
        },
      );
    }
  }
}
