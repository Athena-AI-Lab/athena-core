import readline from "readline";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class CLIUI extends PluginBase {
  athena!: Athena;
  boundHandleStdin!: (key: any) => void;
  boundAthenaPrivateEventHandler!: (event: string, args: Dict<any>) => void;
  rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    terminal: true,
  });
  prompt: string = "<User> ";
  currentInput: string = "";
  currentPos: number = 0;

  desc() {
    return "You can interact with the user using UI tools and events. When the user asks you to do something, think about what information and/or details you need to do that. If you need something only the user can provide, you need to ask the user for that information. Ask the users about task details if the request is vague. Be proactive and update the user on your progress, milestones, and obstacles and how you are going to overcome them.";
  }

  async load(athena: Athena) {
    this.athena = athena;
    this.boundAthenaPrivateEventHandler =
      this.athenaPrivateEventHandler.bind(this);
    this.boundHandleStdin = this.handleStdin.bind(this);

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
          this.printOutput(`<Athena> ${args.content}\n`);
          return { status: "success" };
        },
      },
    );
    athena.once("plugins-loaded", async () => {
      process.stdin.setRawMode(true);
      process.stdin.on("data", this.boundHandleStdin);
      this.printOutput("Welcome to Athena!\n");
      this.redrawPrompt();
    });
  }

  async unload(athena: Athena) {
    process.stdin.setRawMode(false);
    process.stdin.off("data", this.boundHandleStdin);
    this.rl.close();
    process.stdin.destroy();
    athena.off("private-event", this.boundAthenaPrivateEventHandler);
    athena.deregisterTool("ui/send-message");
    athena.deregisterEvent("ui/message-received");
  }

  athenaPrivateEventHandler(event: string, args: Dict<any>) {
    if (event === "cerebrum/thinking") {
      this.printOutput(`<Thinking> ${args.content}\n`);
    } else if (event === "athena/tool-call") {
      this.printOutput(`<Tool Call> ${args.summary}\n`);
    } else if (event === "athena/tool-result") {
      this.printOutput(`<Tool Result> ${args.summary}\n`);
    } else if (event === "athena/event") {
      this.printOutput(`<Event> ${args.summary}\n`);
    } else if (event === "cerebrum/busy") {
      this.changePrompt(args.busy ? "<Thinking> " : "<User> ");
    }
  }

  clearLine() {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  }

  redrawPrompt() {
    this.clearLine();
    process.stdout.write(this.prompt);
    process.stdout.write(this.currentInput);
    readline.cursorTo(process.stdout, this.prompt.length + this.currentPos);
  }

  printOutput(output: string) {
    this.clearLine();
    console.log(output);
    this.redrawPrompt();
  }

  changePrompt(prompt: string) {
    this.prompt = prompt;
    this.redrawPrompt();
  }

  handleStdin(key: any) {
    // Ctrl+C
    if (key.toString() === "\u0003") {
      process.kill(process.pid, "SIGINT");
      return;
    }

    // Enter key
    if (key.toString() === "\r" || key.toString() === "\n") {
      this.athena.emitEvent("ui/message-received", {
        content: this.currentInput,
        time: new Date().toISOString(),
      });
      this.currentInput = "";
      this.currentPos = 0;
      console.log("\n");
      this.redrawPrompt();
      return;
    }

    // Backspace
    if (key.toString() === "\u0008" || key.toString() === "\u007f") {
      if (this.currentPos > 0) {
        this.currentInput =
          this.currentInput.slice(0, this.currentPos - 1) +
          this.currentInput.slice(this.currentPos);
        this.currentPos--;
        this.redrawPrompt();
      }
      return;
    }

    // Left arrow
    if (key.toString() === "\u001b[D") {
      if (this.currentPos > 0) {
        this.currentPos--;
        this.redrawPrompt();
      }
      return;
    }

    // Right arrow
    if (key.toString() === "\u001b[C") {
      if (this.currentPos < this.currentInput.length) {
        this.currentPos++;
        this.redrawPrompt();
      }
      return;
    }

    // Regular character input
    if (key.toString().charCodeAt(0) >= 32 || key.toString().length > 1) {
      this.currentInput =
        this.currentInput.slice(0, this.currentPos) +
        key.toString() +
        this.currentInput.slice(this.currentPos);
      this.currentPos += key.toString().length;
      this.redrawPrompt();
    }
  }
}
