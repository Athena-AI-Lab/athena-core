import { EventEmitter } from "events";
import { JSDOM } from "jsdom";
import { Browser, BrowserContext, chromium, Page } from "playwright";

import { getSelector, IPageNode, parseDom, toExternalNodes } from "./dom.js";

interface IPageState {
  page: Page;
  pageNodes: IPageNode[];
}

type IBrowserUsePageMetadata = {
  url: string;
  title: string;
};

interface IElementData {
  tagName: string;
  attributes: { [key: string]: string };
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export class BrowserUse extends EventEmitter {
  browser!: Browser;
  context!: BrowserContext;
  pages: IPageState[] = [];

  async init(headless: boolean) {
    this.browser = await chromium.launch({
      headless,
      args: [
        "--no-sandbox",
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      handleSIGHUP: false,
      handleSIGINT: false,
      handleSIGTERM: false,
    });

    this.context = await this.browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      screen: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      permissions: ["geolocation"],
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          {
            0: {
              type: "application/x-google-chrome-pdf",
              suffixes: "pdf",
              description: "Portable Document Format",
              enabledPlugin: true,
            },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin",
          },
        ],
      });
    });
  }

  async newPage(url: string) {
    const page = await this.context.newPage();
    await page.goto(url, { waitUntil: "commit" });
    await this.waitForLoading(page);
    this.pages.push({ page, pageNodes: [] });
    const pageIndex = this.pages.length - 1;
    page.on("popup", async (popup) => {
      await this.waitForLoading(popup);
      this.pages.push({ page: popup, pageNodes: [] });
      this.emit("popup", pageIndex, this.pages.length - 1);
    });
    page.on("download", async (download) => {
      const filename = download.suggestedFilename();
      this.emit("download-started", pageIndex, filename);
      await download.saveAs(filename);
      this.emit("download-completed", pageIndex, filename);
    });
    return pageIndex;
  }

  async closePage(pageIndex: number) {
    const pageState = this.pages[pageIndex];
    await pageState.page.close();
  }

  async getPageContent(pageIndex: number) {
    const pageState = this.pages[pageIndex];
    const pageNodes = parseDom(
      new JSDOM(await pageState.page.content(), {
        url: pageState.page.url(),
        resources: "usable",
        pretendToBeVisual: true,
      }),
    );
    pageState.pageNodes = pageNodes.allNodes;
    return toExternalNodes(pageNodes.topLevelNodes);
  }

  async clickElement(pageIndex: number, nodeIndex: number) {
    const pageState = this.pages[pageIndex];
    const page = pageState.page;
    const pageNode = pageState.pageNodes[nodeIndex];
    if (pageNode.type !== "clickable") {
      throw new Error("Node is not clickable");
    }
    await page.locator(getSelector(pageNode.node)).click({
      force: true,
      noWaitAfter: true,
    });
    await this.waitForLoading(page);
  }

  async fillElement(pageIndex: number, nodeIndex: number, value: string) {
    const pageState = this.pages[pageIndex];
    const page = pageState.page;
    const pageNode = pageState.pageNodes[nodeIndex];
    if (pageNode.type !== "fillable") {
      throw new Error("Node is not fillable");
    }
    await page.locator(getSelector(pageNode.node)).fill(value, {
      force: true,
      noWaitAfter: true,
    });
    await this.waitForLoading(page);
  }

  async getPageMetadata(pageIndex: number): Promise<IBrowserUsePageMetadata> {
    const pageState = this.pages[pageIndex];
    const page = pageState.page;
    return {
      title: await page.title(),
      url: page.url(),
    };
  }

  getElementData(pageIndex: number, nodeIndex: number): IElementData {
    const pageState = this.pages[pageIndex];
    const pageNode = pageState.pageNodes[nodeIndex];
    return {
      tagName: (pageNode.node as Element).tagName.toLowerCase(),
      attributes: Object.fromEntries(
        Array.from((pageNode.node as Element).attributes).map((attr) => [
          attr.name,
          attr.value,
        ]),
      ),
    };
  }

  async scrollDown(pageIndex: number) {
    const pageState = this.pages[pageIndex];
    const page = pageState.page;
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.waitForLoading(page);
  }

  async waitForLoading(page: Page) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const waitForLoad = async () => {
      try {
        await page.waitForLoadState();
      } catch (error) {}
    };
    const waitForLoad2 = async () => {
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch (error) {}
    };
    await Promise.any([waitForLoad(), waitForLoad2()]);
    await page.waitForTimeout(2000);
  }

  async screenshot(page: Page, path: string) {
    await page.screenshot({ path: path });
  }

  async close() {
    await this.context.close();
    await this.browser.close();
  }
}
