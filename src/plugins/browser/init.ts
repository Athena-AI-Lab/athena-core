import { BrowserUse } from "./browser-use.js";
import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class Browser extends PluginBase {
  athena!: Athena;
  browserUse: BrowserUse = new BrowserUse();
  boundPopupHandler!: (fromIndex: number, index: number) => void;
  boundDownloadStartedHandler!: (pageIndex: number, filename: string) => void;
  boundDownloadCompletedHandler!: (pageIndex: number, filename: string) => void;
  lock: boolean = false;

  desc() {
    return "You have access to a real browser. This browser is written in playwright so it can execute JavaScript. You can use the browser to navigate the web or check on the content of a webpage. Each call to the browser tools may change the index of the elements, so you must not call the browser tools multiple times in a row. You must always wait for the previous call to complete before making a new call.";
  }

  async load(athena: Athena) {
    this.athena = athena;
    await this.browserUse.init(this.config.headless);
    this.boundPopupHandler = this.popupHandler.bind(this);
    this.boundDownloadStartedHandler = this.downloadStartedHandler.bind(this);
    this.boundDownloadCompletedHandler =
      this.downloadCompletedHandler.bind(this);

    athena.registerEvent({
      name: "browser/popup",
      desc: "Triggered when a new page is popped up.",
      args: {
        from_index: {
          type: "number",
          desc: "The index of the page that initiated the popup.",
          required: true,
        },
        index: {
          type: "number",
          desc: "The index of the popped up page.",
          required: true,
        },
        url: {
          type: "string",
          desc: "The URL of the popped up page.",
          required: true,
        },
        title: {
          type: "string",
          desc: "The title of the popped up page.",
          required: true,
        },
        content: {
          type: "array",
          desc: "The content of the popped up page.",
          required: true,
        },
      },
      explain_args: (args: Dict<any>) => {
        return {
          summary: `A new page is popped up at index ${args.index} from index ${args.from_index}.`,
          details: `${args.url}\n${args.title}\n${JSON.stringify(
            args.content,
          )}`,
        };
      },
    });
    athena.registerEvent({
      name: "browser/download-started",
      desc: "Triggered when a download starts. You must wait for browser/download-completed to be triggered before accessing the file.",
      args: {
        page_index: {
          type: "number",
          desc: "The index of the page.",
          required: true,
        },
        filename: {
          type: "string",
          desc: "The filename of the downloaded file.",
          required: true,
        },
      },
      explain_args: (args: Dict<any>) => {
        return {
          summary: `A download starts at page ${args.page_index} with filename ${args.filename}.`,
        };
      },
    });
    athena.registerEvent({
      name: "browser/download-completed",
      desc: "Triggered when a download completes. You can now access the file.",
      args: {
        page_index: {
          type: "number",
          desc: "The index of the page.",
          required: true,
        },
        filename: {
          type: "string",
          desc: "The filename of the downloaded file.",
          required: true,
        },
      },
      explain_args: (args: Dict<any>) => {
        return {
          summary: `A download completes at page ${args.page_index} with filename ${args.filename}.`,
        };
      },
    });
    athena.registerTool(
      {
        name: "browser/new-page",
        desc: "Opens a new page in the browser.",
        args: {
          url: { type: "string", desc: "The URL to open.", required: true },
        },
        retvals: {
          index: {
            type: "number",
            desc: "The index of the new page.",
            required: true,
          },
          url: {
            type: "string",
            desc: "The URL of the new page.",
            required: true,
          },
          title: {
            type: "string",
            desc: "The title of the new page.",
            required: true,
          },
          content: {
            type: "array",
            desc: "The content of the new page.",
            required: true,
          },
        },
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Opening ${args.url} in the browser...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `${args.url} is successfully opened at page ${retvals.index}.`,
            details: `${retvals.url}\n${retvals.title}\n${JSON.stringify(
              retvals.content,
            )}`,
          };
        },
        fn: async (args: Dict<any>) => {
          return await this.withLock(async () => {
            const index = await this.browserUse.newPage(args.url);
            const metadata = await this.browserUse.getPageMetadata(index);
            return {
              index,
              ...metadata,
              content: await this.browserUse.getPageContent(index),
            };
          });
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/close-page",
        desc: "Closes the page. You must call this tool after you are done with the page to release the resources. This tool won't affect the index of any other pages. You won't be able to access the page after closing it.",
        args: {
          index: {
            type: "number",
            desc: "The index of the page.",
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
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Closing the page at index ${args.index}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The page at index ${args.index} is closed.`,
          };
        },
        fn: async (args: Dict<any>) => {
          return await this.withLock(async () => {
            await this.browserUse.closePage(args.index);
            return {
              status: "success",
            };
          });
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/click",
        desc: "Clicks on an element.",
        args: {
          page_index: {
            type: "number",
            desc: "The index of the page.",
            required: true,
          },
          node_index: {
            type: "number",
            desc: "The index of the element to click. If you want to click a checkbox or a radio button in a list, you must click the one before the corresponding text, not after; otherwise, the wrong element will be clicked.",
            required: true,
          },
        },
        retvals: {
          url: {
            type: "string",
            desc: "The URL of the page.",
            required: true,
          },
          title: {
            type: "string",
            desc: "The content of the page after clicking the element.",
            required: true,
          },
          content: {
            type: "array",
            desc: "The content of the page after clicking the element.",
            required: true,
          },
        },
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Clicking on the element at page ${args.page_index} and index ${args.node_index}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The element at page ${args.page_index} and index ${args.node_index} is clicked.`,
            details: `${retvals.url}\n${retvals.title}\n${JSON.stringify(
              retvals.content,
            )}`,
          };
        },
        fn: async (args) => {
          return await this.withLock(async () => {
            await this.browserUse.clickElement(
              args.page_index,
              args.node_index,
            );
            const metadata = await this.browserUse.getPageMetadata(
              args.page_index,
            );
            return {
              ...metadata,
              content: await this.browserUse.getPageContent(args.page_index),
            };
          });
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/fill",
        desc: "Fills text into an element.",
        args: {
          page_index: {
            type: "number",
            desc: "The index of the page.",
            required: true,
          },
          node_index: {
            type: "number",
            desc: "The index of the element to fill text into.",
            required: true,
          },
          text: {
            type: "string",
            desc: "The text to fill into the element.",
            required: true,
          },
        },
        retvals: {
          url: {
            type: "string",
            desc: "The URL of the page.",
            required: true,
          },
          title: {
            type: "string",
            desc: "The content of the page after filling text into the element.",
            required: true,
          },
          content: {
            type: "array",
            desc: "The content of the page after filling text into the element.",
            required: true,
          },
        },
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Filling ${args.text} into the element at page ${args.page_index} and index ${args.node_index}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The element at page ${args.page_index} and index ${args.node_index} is filled with ${args.text}.`,
            details: `${retvals.url}\n${retvals.title}\n${JSON.stringify(
              retvals.content,
            )}`,
          };
        },
        fn: async (args) => {
          return await this.withLock(
            async (): Promise<{
              title: string;
              url: string;
              content: any[];
            }> => {
              await this.browserUse.fillElement(
                args.page_index,
                args.node_index,
                args.text,
              );
              const metadata = await this.browserUse.getPageMetadata(
                args.page_index,
              );
              return {
                ...metadata,
                content: await this.browserUse.getPageContent(args.page_index),
              };
            },
          );
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/get-content",
        desc: "Gets the content of the page.",
        args: {
          index: {
            type: "number",
            desc: "The index of the page.",
            required: true,
          },
        },
        retvals: {
          url: {
            type: "string",
            desc: "The URL of the page.",
            required: true,
          },
          title: {
            type: "string",
            desc: "The content of the page.",
            required: true,
          },
          content: {
            type: "array",
            desc: "The content of the page.",
            required: true,
          },
        },
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Getting the content of the page at index ${args.index}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The content of the page at index ${args.index} is retrieved.`,
            details: `${retvals.url}\n${retvals.title}\n${JSON.stringify(
              retvals.content,
            )}`,
          };
        },
        fn: async (args) => {
          return await this.withLock(async () => {
            const metadata = await this.browserUse.getPageMetadata(args.index);
            return {
              ...metadata,
              content: await this.browserUse.getPageContent(args.index),
            };
          });
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/get-element-data",
        desc: "Gets the tag name and attributes of an element. Use this tool if you need to get the src of an image, the href of a link, or etc.",
        args: {
          page_index: {
            type: "number",
            desc: "The index of the page.",
            required: true,
          },
          node_index: {
            type: "number",
            desc: "The index of the element.",
            required: true,
          },
        },
        retvals: {
          tagName: {
            type: "string",
            desc: "The tag name of the element.",
            required: true,
          },
          attributes: {
            type: "object",
            desc: "The attributes of the element.",
            required: true,
          },
        },
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Getting the tag name and attributes of the element at page ${args.page_index} and index ${args.node_index}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The tag name and attributes of the element at page ${args.page_index} and index ${args.node_index} are retrieved.`,
            details: `${retvals.tagName}\n${JSON.stringify(retvals.attributes)}`,
          };
        },
        fn: async (args: Dict<any>) => {
          return await this.withLock(async () => {
            return this.browserUse.getElementData(
              args.page_index,
              args.node_index,
            );
          });
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/screenshot",
        desc: "Takes a screenshot of the page.",
        args: {
          index: {
            type: "number",
            desc: "The index of the page.",
            required: true,
          },
          path: {
            type: "string",
            desc: "The path to save the screenshot.",
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
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Taking a screenshot of the page at index ${args.index} and saving it to ${args.path}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The screenshot of the page at index ${args.index} is taken and saved to ${args.path}.`,
          };
        },
        fn: async (args: Dict<any>) => {
          return await this.withLock(async () => {
            await this.browserUse.screenshot(
              this.browserUse.pages[args.index].page,
              args.path,
            );
            return {
              status: "success",
            };
          });
        },
      },
    );
    athena.registerTool(
      {
        name: "browser/scroll-down",
        desc: "Scrolls down the page to load more content. If the webpage loads more content when you scroll down and you need to access the new content, you must call this tool to scroll to the bottom of the page.",
        args: {
          index: {
            type: "number",
            desc: "The index of the page.",
            required: true,
          },
        },
        retvals: {
          url: {
            type: "string",
            desc: "The URL of the page.",
            required: true,
          },
          title: {
            type: "string",
            desc: "The content of the page after scrolling down.",
            required: true,
          },
          content: {
            type: "array",
            desc: "The content of the page after scrolling down.",
            required: true,
          },
        },
      },
      {
        explain_args: (args: Dict<any>) => {
          return {
            summary: `Scrolling down the page at index ${args.index}...`,
          };
        },
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => {
          return {
            summary: `The page at index ${args.index} is scrolled down.`,
            details: `${retvals.url}\n${retvals.title}\n${JSON.stringify(
              retvals.content,
            )}`,
          };
        },
        fn: async (args) => {
          return await this.withLock(async () => {
            await this.browserUse.scrollDown(args.index);
            const metadata = await this.browserUse.getPageMetadata(args.index);
            return {
              ...metadata,
              content: await this.browserUse.getPageContent(args.index),
            };
          });
        },
      },
    );
    this.browserUse.on("popup", this.boundPopupHandler);
    this.browserUse.on("download-started", this.boundDownloadStartedHandler);
    this.browserUse.on(
      "download-completed",
      this.boundDownloadCompletedHandler,
    );
  }

  async popupHandler(fromIndex: number, index: number) {
    const metadata = await this.browserUse.getPageMetadata(index);
    this.athena.emitEvent("browser/popup", {
      from_index: fromIndex,
      index,
      ...metadata,
      content: await this.browserUse.getPageContent(index),
    });
  }

  async downloadStartedHandler(pageIndex: number, filename: string) {
    this.athena.emitEvent("browser/download-started", {
      page_index: pageIndex,
      filename,
    });
  }

  async downloadCompletedHandler(pageIndex: number, filename: string) {
    this.athena.emitEvent("browser/download-completed", {
      page_index: pageIndex,
      filename,
    });
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.lock) {
      throw new Error(
        "Browser is locked. Please wait for the previous call to complete before making a new call.",
      );
    }
    this.lock = true;
    try {
      const result = await fn();
      return result;
    } finally {
      this.lock = false;
    }
  }

  async unload(athena: Athena) {
    this.browserUse.removeListener("popup", this.boundPopupHandler);
    await this.browserUse.close();
    athena.deregisterTool("browser/new-page");
    athena.deregisterTool("browser/click");
    athena.deregisterTool("browser/fill");
    athena.deregisterTool("browser/get-content");
    athena.deregisterTool("browser/get-element-data");
    athena.deregisterTool("browser/screenshot");
    athena.deregisterTool("browser/scroll-down");
  }
}
