import { JSDOM } from "jsdom";

export interface IPageTextNode {
  type: "text";
  index: number;
  node: Node;
}

export interface IPageImageNode {
  type: "image";
  index: number;
  node: Element;
}

export interface IPageClickableNode {
  type: "clickable";
  index: number;
  node: Element;
  children: IPageNode[];
}

export interface IPageFillableNode {
  type: "fillable";
  index: number;
  node: Element;
}

export type IPageNode =
  | IPageTextNode
  | IPageImageNode
  | IPageClickableNode
  | IPageFillableNode;

export interface IExternalImageNode {
  type: "image";
  index: number;
  text?: string;
}

export interface IExternalClickableNode {
  type: "clickable";
  index: number;
  subtype?: string;
  text?: string;
  children?: IExternalNode[];
}

export interface IExternalFillableNode {
  type: "fillable";
  index: number;
  subtype?: string;
  text?: string;
}

export type IExternalNode =
  | string
  | IExternalImageNode
  | IExternalClickableNode
  | IExternalFillableNode;

const isVisible = (element: Element): boolean => {
  return !["script", "style"].includes(element.tagName.toLowerCase());
};

const isImage = (element: Element): boolean => {
  return element.matches("img");
};

const isClickable = (element: Element, dom: JSDOM): boolean => {
  let style: CSSStyleDeclaration | null = null;
  try {
    style = dom.window.getComputedStyle(element);
  } catch (e) {}
  return (
    element.matches(
      'a, button, [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], [onclick], label[for]',
    ) || style?.cursor === "pointer"
  );
};

const isFillable = (element: Element): boolean => {
  return (
    element.matches(
      'input[type="text"], input[type="password"], input[type="email"], input[type="number"], input[type="search"], input[type="tel"], input[type="url"], textarea, [contenteditable="true"]',
    ) ||
    (element.tagName.toLowerCase() === "input" &&
      element.getAttribute("type") == null)
  );
};

export const parseDom = (
  dom: JSDOM,
): { allNodes: IPageNode[]; topLevelNodes: IPageNode[] } => {
  const allNodes: IPageNode[] = [];

  const walk = (node: Node): IPageNode[] => {
    if (
      node.nodeType === dom.window.Node.ELEMENT_NODE &&
      !isVisible(node as Element)
    ) {
      return [];
    }

    if (node.nodeType === dom.window.Node.TEXT_NODE) {
      if (!node.textContent?.trim()) {
        return [];
      }

      const pageNode: IPageTextNode = {
        type: "text",
        index: allNodes.length,
        node,
      };
      allNodes.push(pageNode);
      return [pageNode];
    }

    if (node.nodeType !== dom.window.Node.ELEMENT_NODE) {
      return [];
    }

    const element = node as Element;

    if (isImage(element)) {
      const pageNode: IPageImageNode = {
        type: "image",
        index: allNodes.length,
        node: element,
      };
      allNodes.push(pageNode);
      return [pageNode];
    }

    if (isFillable(element)) {
      const pageNode: IPageFillableNode = {
        type: "fillable",
        index: allNodes.length,
        node: element,
      };
      allNodes.push(pageNode);
      return [pageNode];
    }

    const children = Array.from(node.childNodes).flatMap(walk);
    if (!isClickable(element, dom)) {
      return children;
    }

    const pageNode: IPageClickableNode = {
      type: "clickable",
      index: allNodes.length,
      node: element,
      children,
    };
    allNodes.push(pageNode);
    return [pageNode];
  };

  const topLevelNodes = walk(dom.window.document.body);
  return { allNodes, topLevelNodes };
};

export const toExternalNode = (pageNode: IPageNode): IExternalNode => {
  if (pageNode.type === "text") {
    return pageNode.node.textContent!;
  }

  if (pageNode.type === "image") {
    const alt = pageNode.node.getAttribute("alt")?.trim();
    return {
      type: "image",
      index: pageNode.index,
      text: alt === "" ? undefined : alt,
    };
  }

  if (pageNode.type === "fillable") {
    const value = pageNode.node.getAttribute("value")?.trim() ?? "";
    return {
      type: "fillable",
      index: pageNode.index,
      subtype: pageNode.node.getAttribute("type")?.trim(),
      text:
        (value !== "" ? value : undefined) ??
        (pageNode.node as HTMLElement).innerText?.trim() ??
        pageNode.node.getAttribute("placeholder")?.trim() ??
        undefined,
    };
  }

  const children = pageNode.children.map(toExternalNode);
  const isChildrenAllText = children.every(
    (child) => typeof child === "string",
  );

  return {
    type: "clickable",
    index: pageNode.index,
    subtype:
      pageNode.node.getAttribute("type")?.trim() ??
      pageNode.node.tagName.toLowerCase(),
    text:
      isChildrenAllText && children.length > 0
        ? children.join(" ").trim()
        : (pageNode.node.getAttribute("value")?.trim() ?? undefined),
    children: isChildrenAllText ? undefined : children,
  };
};

export const toExternalNodes = (pageNodes: IPageNode[]): IExternalNode[] => {
  const result: IExternalNode[] = [];

  for (const node of pageNodes.map(toExternalNode)) {
    if (
      typeof node === "string" &&
      result.length > 0 &&
      typeof result[result.length - 1] === "string"
    ) {
      result[result.length - 1] = `${result[result.length - 1]} ${node}`;
    } else {
      result.push(node);
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (typeof result[i] === "string") {
      result[i] = (result[i] as string).trim();
    }
  }

  return result;
};

export const getSelector = (element: Element): string => {
  const path: Element[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLowerCase() !== "body") {
    path.unshift(current);
    current = current.parentElement;
  }
  if (current) {
    path.unshift(current);
  }

  const selector = path
    .map((e) => {
      const index =
        Array.from(e.parentElement?.children || [])
          .filter((child) => child.tagName === e.tagName)
          .indexOf(e) + 1;
      const nthChild = index > 0 ? `:nth-of-type(${index})` : "";
      return `${e.tagName.toLowerCase()}${nthChild}`;
    })
    .join(" > ");

  return selector;
};
