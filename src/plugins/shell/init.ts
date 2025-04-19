import { exec } from "child_process";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";
import { ShellProcess } from "./shell-process.js";

export default class Shell extends PluginBase {
  processes: { [key: number]: ShellProcess } = {};

  async load(athena: Athena) {
    athena.registerEvent({
      name: "shell/stdout",
      desc: "Triggered when a shell command outputs to stdout",
      args: {
        pid: {
          type: "number",
          desc: "Process ID",
          required: true,
        },
        stdout: {
          type: "string",
          desc: "Standard output of the command",
          required: true,
        },
      },
      explain_args: (args: Dict<any>) => ({
        summary: `Process ${args.pid} output to stdout.`,
        details: args.stdout,
      }),
    });
    athena.registerEvent({
      name: "shell/terminated",
      desc: "Triggered when a shell command terminates",
      args: {
        pid: {
          type: "number",
          desc: "Process ID",
          required: true,
        },
        code: {
          type: "number",
          desc: "Exit code of the process",
          required: true,
        },
        stdout: {
          type: "string",
          desc: "The remaining output of the process",
          required: true,
        },
      },
      explain_args: (args: Dict<any>) => ({
        summary: `Process ${args.pid} terminated.`,
        details: args.stdout,
      }),
    });
    athena.registerTool(
      {
        name: "shell/exec",
        desc: "Executes a shell command. Whenever you need to run a shell command, or the user's request requires running a shell command, use this tool. When this tool returns, the command is still running. You need to wait for it to output or terminate.",
        args: {
          command: {
            type: "string",
            desc: "Shell command",
            required: true,
          },
        },
        retvals: {
          pid: {
            type: "number",
            desc: "The running process ID",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const process = new ShellProcess(args.command);
          process.on("stdout", (data) => {
            athena.emitEvent("shell/stdout", {
              pid: process.pid,
              stdout: data,
            });
          });
          process.on("close", (code) => {
            delete this.processes[process.pid];
            athena.emitEvent("shell/terminated", {
              pid: process.pid,
              code,
              stdout: process.stdout,
            });
          });
          this.processes[process.pid] = process;
          return { pid: process.pid };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Executing shell command ${args.command}...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `The shell command is assigned PID ${retvals.pid}.`,
        }),
      },
    );
    athena.registerTool(
      {
        name: "shell/write-stdin",
        desc: "Write string to stdin of the specified process.",
        args: {
          pid: {
            type: "number",
            desc: "Process ID",
            required: true,
          },
          data: {
            type: "string",
            desc: "The data to write to stdin.",
            required: true,
          },
        },
        retvals: {
          result: {
            type: "string",
            desc: "Result of the operation",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const process = this.processes[args.pid];
          if (!process) {
            throw new Error("Process not found");
          }
          process.write(args.data);
          return { result: "success" };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Writing to process ${args.pid}...`,
          details: args.data,
        }),
      },
    );
    athena.registerTool(
      {
        name: "shell/kill",
        desc: "Kills a running shell command. Whenever you need to kill a running shell command, or the user's request requires killing a running shell command, use this tool. Do not use this tool to terminate any other processes. Use shell/exec to execute a kill command instead.",
        args: {
          pid: {
            type: "number",
            desc: "Process ID",
            required: true,
          },
          signal: {
            type: "string",
            desc: "Signal to send to the process",
            required: false,
          },
        },
        retvals: {
          result: {
            type: "string",
            desc: "Result of the operation",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const process = this.processes[args.pid];
          if (!process) {
            throw new Error("Process not found");
          }
          process.kill(args.signal);
          return { result: "success" };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Killing process ${args.pid}...`,
          details: args.signal,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `The process ${args.pid} is killed.`,
        }),
      },
    );
    athena.registerTool(
      {
        name: "shell/apt-install",
        desc: "Installs a package using apt. Whenever you need to install a package using apt, or the user's request requires installing a package using apt, use this tool.",
        args: {
          package: {
            type: "string",
            desc: "Package name",
            required: true,
          },
        },
        retvals: {
          result: {
            desc: "Result of the installation",
            required: true,
            type: "string",
          },
        },
      },
      {
        fn: (args: Dict<any>) => {
          return new Promise((resolve, reject) => {
            exec(`apt install ${args.package} -y`, (error, stdout, stderr) => {
              if (error) {
                reject(Error(stderr));
              } else {
                resolve({ result: "success" });
              }
            });
          });
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Installing package ${args.package} using apt...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `The package ${args.package} is installed.`,
        }),
      },
    );
  }

  async unload(athena: Athena) {
    athena.deregisterTool("shell/exec");
    athena.deregisterTool("shell/write-stdin");
    athena.deregisterTool("shell/kill");
    athena.deregisterTool("shell/apt-install");
    athena.deregisterEvent("shell/stdout");
    athena.deregisterEvent("shell/terminated");
  }
}
