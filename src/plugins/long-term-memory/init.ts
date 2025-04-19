import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";
import { load } from "sqlite-vec";
import { DatabaseSync } from "node:sqlite";
import OpenAI from "openai";
import { openaiDefaultHeaders } from "../../utils/constants.js";
interface ILongTermMemoryItem {
  desc: string;
  data: Dict<any>;
  created_at: string;
}

interface VecItemResult {
  desc: string;
  data: string;
}

export default class LongTermMemory extends PluginBase {
  store: Dict<ILongTermMemoryItem> = {};
  openai!: OpenAI;
  db!: DatabaseSync;
  desc() {
    return "You have a long-term memory. You must put whatever you think a human would remember long-term in here. This could be knowledge, experiences, or anything else you think is important. It's a key-value store. The key is a string, and the value is a JSON object. You will override the value if you store the same key again. If you want to recall something, you should list and/or retrieve it.";
  }

  async load(athena: Athena) {
    this.db = new DatabaseSync(this.config.persist_db ? this.config.db_file : ':memory:', {
      allowExtension: true
    });
    load(this.db);
    
    // TODO: Support migration for varying dimensions
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING 
      vec0(
        embedding float[${this.config.dimensions}],
        desc text,
        data text
      )
    `);

    const insertStmt = this.db.prepare(
      'INSERT INTO vec_items(embedding, desc, data) VALUES (?, ?, ?)'
    );
    
    this.openai = new OpenAI({
      baseURL: this.config.base_url,
      apiKey: this.config.api_key,
      defaultHeaders: openaiDefaultHeaders,
    });

    athena.registerTool({
      name: "ltm/store",
      desc: "Store some data to your long-term memory.",
      args: {
        desc: {
          type: "string",
          desc: "A description of the data.",
          required: true,
        },
        data: {
          type: "object",
          desc: "The data to store.",
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
        const embedding = await this.openai.embeddings.create({
          model: this.config.vector_model,
          dimensions: this.config.dimensions,
          input: args.desc,
          encoding_format: "float",
        });
        insertStmt.run(Float32Array.from(embedding.data[0].embedding), 
                       args.desc, 
                       JSON.stringify(args.data));
        return { status: "success" };
      },
    });
    // TODO: Implement remove
    athena.registerTool({
      name: "ltm/list",
      desc: "List your long-term memory.",
      args: {},
      retvals: {
        list: {
          type: "array",
          desc: "The list of metadata of the long-term memory.",
          required: true,
          of: {
            type: "object",
            desc: "The metadata of the long-term memory.",
            required: false,
            of: {
              desc: {
                type: "string",
                desc: "The description of the data.",
                required: true,
              },
            },
          },
        },
      },
      fn: async (args: Dict<any>) => {
        const list = this.db.prepare("SELECT desc, data FROM vec_items").all();
        return { list: list };
      },
    });
    athena.registerTool({
      name: "ltm/retrieve",
      desc: "Retrieve data from your long-term memory.",
      args: {
        query: {
          type: "string",
          desc: "The query to retrieve the data.",
          required: true,
        },
      },
      retvals: {
        list: {
          type: "array",
          desc: "Query results list of metadata of the long-term memory.",
          required: true,
          of: {
            type: "object",
            desc: "The desc and data of the long-term memory.",
            required: false,
            of: {
              desc: {
                type: "string",
                desc: "The description of the data.",
                required: true,
              },
              data: {
                type: "object",
                desc: "The data.",
                required: true,
              },
            },
          },
        },
      },
      fn: async (args: Dict<any>) => {
        const embedding = await this.openai.embeddings.create({
          model: this.config.vector_model,
          dimensions: this.config.dimensions,
          input: args.query,
          encoding_format: "float",
        });
        const results = this.db.prepare(
          `SELECT 
            distance,
            desc, 
            data
          FROM vec_items 
          WHERE embedding MATCH ?
          ORDER BY distance 
          LIMIT ${this.config.max_query_results}`
        ).all(Float32Array.from(embedding.data[0].embedding));
        if (!results || results.length === 0) {
          throw new Error("No results found");
        }
        return results.map(result => {
          if (!result || typeof result !== 'object') {
            throw new Error("Invalid result format");
          }
          return {
            desc: String(result.desc),
            data: JSON.parse(String(result.data)),
          };
        });
      },
    });
  }

  async unload(athena: Athena) {
    athena.deregisterTool("ltm/store");
    athena.deregisterTool("ltm/list");
    athena.deregisterTool("ltm/retrieve");
  }

  state() {
    return { store: this.store };
  }

  setState(state: Dict<any>) {
    this.store = state.store;
  }
}
