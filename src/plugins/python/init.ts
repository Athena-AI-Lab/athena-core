import { exec } from "child_process";

import { PythonShell } from "python-shell";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class Python extends PluginBase {
  async load(athena: Athena) {
    athena.registerTool(
      {
        name: "python/exec",
        desc: "Executes Python code. Whenever you need to run Python code or do *any* kind of math calculations, or the user's request requires running Python code or doing math calculations, use this tool. You must print the final result to get it. Otherwise the stdout will be empty. Only use Python when it's necessary. If you already have all the information you need for some simple task, don't use Python. Whenever you need to get stock data, use Python with the yfinance package. If you need to plot something, use Python with the matplotlib package; use seaborn-v0_8-darkgrid or fivethirtyeight style and configurations of your choice (like font size, DPI=300, etc.) to get a high quality plot.",
        args: {
          code: {
            type: "string",
            desc: "Python code",
            required: true,
          },
        },
        retvals: {
          stdout: {
            type: "string",
            desc: "Standard output of the code",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          return {
            stdout: (await PythonShell.runString(args.code)).join("\n"),
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Executing Python code...`,
          details: args.code,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `The Python code has finished.`,
          details: retvals.stdout,
        }),
      },
    );
    athena.registerTool(
      {
        name: "python/exec-file",
        desc: "Executes Python code from a file. Whenever you need to run a Python file, or the user's request requires running Python file, use this tool.",
        args: {
          path: {
            type: "string",
            desc: "Path to the Python file",
            required: true,
          },
          args: {
            type: "array",
            desc: "Arguments to pass to the Python file",
            required: false,
            of: {
              type: "string",
              desc: "Argument to pass",
              required: true,
            },
          },
        },
        retvals: {
          stdout: {
            desc: "Standard output of the code",
            required: true,
            type: "string",
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          return {
            stdout: (
              await PythonShell.run(args.path, { args: args.args })
            ).join("\n"),
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Executing Python file ${args.path}...`,
          details: args.args ? args.args.join(", ") : "",
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `The Python file has finished.`,
          details: retvals.stdout,
        }),
      },
    );
    athena.registerTool(
      {
        name: "python/pip-install",
        desc: "Installs a Python package using pip. Whenever you need to use a package that is not installed, or the user's request requires installing a package, use this tool. Don't use shell to install packages.",
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
            exec(
              `python -m pip install ${args.package} --break-system-packages --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple`,
              (error, stdout, stderr) => {
                if (error) {
                  reject(Error(stderr));
                } else {
                  resolve({ result: "success" });
                }
              },
            );
          });
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Installing Python package ${args.package}...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `The Python package ${args.package} is installed.`,
        }),
      },
    );
  }

  async unload(athena: Athena) {
    athena.deregisterTool("python/exec");
    athena.deregisterTool("python/exec-file");
    athena.deregisterTool("python/pip-install");
  }
}
