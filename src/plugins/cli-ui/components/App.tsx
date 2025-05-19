import React, { useState } from "react";
import { Box, Text, useInput, useApp, Key } from "ink";
import { Dict } from "../../../core/athena.js";

interface Message {
  type: "user" | "athena" | "thinking" | "tool-call" | "tool-result" | "event";
  content: string;
  timestamp: string;
}

interface AppProps {
  onMessage: (content: string) => void;
  messages: Message[];
  prompt: string;
  isThinking: boolean;
}

export const App: React.FC<AppProps> = ({
  onMessage,
  messages,
  prompt,
  isThinking,
}) => {
  const [input, setInput] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const { exit } = useApp();

  useInput((char: string, key: Key) => {
    // Handle Ctrl+C
    if (key.ctrl && char === "c") {
      exit();
      return;
    }

    // Handle Enter
    if (key.return) {
      if (input.trim()) {
        onMessage(input);
      }
      setInput("");
      setCursorPosition(0);
      return;
    }

    // Handle Backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newInput =
          input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(cursorPosition - 1);
      }
      return;
    }

    // Handle Left Arrow
    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
      return;
    }

    // Handle Right Arrow
    if (key.rightArrow) {
      setCursorPosition(Math.min(input.length, cursorPosition + 1));
      return;
    }

    // Handle regular character input
    if (char && char.length === 1) {
      const newInput =
        input.slice(0, cursorPosition) + char + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(cursorPosition + 1);
    }
  });

  return (
    <Box flexDirection="column">
      {messages.map((message) => (
        <Box key={message.timestamp} marginBottom={1}>
          <Text>
            {message.type === "user" && "<User> "}
            {message.type === "athena" && "<Athena> "}
            {message.type === "thinking" && "<Thinking> "}
            {message.type === "tool-call" && "<Tool Call> "}
            {message.type === "tool-result" && "<Tool Result> "}
            {message.type === "event" && "<Event> "}
            {message.content}
          </Text>
        </Box>
      ))}
      <Box>
        <Text>{prompt}</Text>
        <Text>
          {input.slice(0, cursorPosition)}
          <Text inverse> </Text>
          {input.slice(cursorPosition)}
        </Text>
      </Box>
    </Box>
  );
};
