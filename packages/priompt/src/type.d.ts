export type Node =
  ArgProps
  | ToolProps
  | ExampleProps
  | PrimitiveNode

export type PrimitiveNode = string | number | boolean | null | undefined;

export type ToolXMLElement = Node[] | Node;

export type BaseProps = {
  children?: ToolXMLElement[] | ToolXMLElement;
};

export type ExampleProps = {
  children?: ToolXMLElement[] | ToolXMLElement
}

export type ToolProps = {
  name: string;
  description?: string;
  children?: ToolXMLElement[] | ToolXMLElement;
}

export type ArgProps = {
  name: string;
  children?: ToolXMLElement[] | ToolXMLElement;
}

export namespace JSX {
  interface IntrinsicElements {
    arg: ArgProps
    tool: ToolProps
    example: ExampleProps
  }

  type Element = ToolXMLElement;

  interface ElementAttributesProperty {
    props: BaseProps;
  }
}
