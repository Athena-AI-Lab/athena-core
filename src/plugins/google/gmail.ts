import { gmail_v1, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface IGmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  labels: string[];
}

export interface IGmailSendOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

export class GmailClient {
  private gmail: gmail_v1.Gmail;

  constructor(auth: OAuth2Client) {
    this.gmail = google.gmail({ version: "v1", auth });
  }

  private encodeHeader(text: string): string {
    // Check if the text contains non-ASCII characters
    if (!/^[\x00-\x7F]*$/.test(text)) {
      // Encode using RFC 2047 MIME encoded-word syntax (Base64)
      const encoded = Buffer.from(text, "utf-8").toString("base64");
      return `=?UTF-8?B?${encoded}?=`;
    }
    return text;
  }

  async listMessages(
    query?: string,
    maxResults: number = 10,
    labelIds?: string[],
  ): Promise<IGmailMessage[]> {
    const response = await this.gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
      labelIds,
    });

    const messages = response.data.messages || [];
    const detailedMessages: IGmailMessage[] = [];

    for (const msg of messages) {
      if (msg.id) {
        const detail = await this.getMessage(msg.id, false);
        if (detail) {
          detailedMessages.push(detail);
        }
      }
    }

    return detailedMessages;
  }

  async getMessage(
    messageId: string,
    includeBody: boolean = true,
  ): Promise<IGmailMessage | null> {
    const response = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: includeBody ? "full" : "metadata",
      metadataHeaders: ["Subject", "From", "To", "Date"],
    });

    const message = response.data;
    if (!message) return null;

    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
      "";

    let body = "";
    if (includeBody && message.payload) {
      body = this.extractBody(message.payload);
    }

    return {
      id: message.id || "",
      threadId: message.threadId || "",
      subject: getHeader("Subject"),
      from: getHeader("From"),
      to: getHeader("To"),
      date: getHeader("Date"),
      snippet: message.snippet || "",
      body: includeBody ? body : undefined,
      labels: message.labelIds || [],
    };
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart): string {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }
      for (const part of payload.parts) {
        const nestedBody = this.extractBody(part);
        if (nestedBody) return nestedBody;
      }
    }

    return "";
  }

  async sendMessage(options: IGmailSendOptions): Promise<string> {
    const messageParts = [
      `To: ${options.to}`,
      `Subject: ${this.encodeHeader(options.subject)}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
    ];

    if (options.cc) {
      messageParts.splice(1, 0, `Cc: ${options.cc}`);
    }
    if (options.bcc) {
      messageParts.splice(1, 0, `Bcc: ${options.bcc}`);
    }
    if (options.inReplyTo) {
      messageParts.push(`In-Reply-To: ${options.inReplyTo}`);
    }
    if (options.references) {
      messageParts.push(`References: ${options.references}`);
    }

    messageParts.push("", options.body);

    const raw = Buffer.from(messageParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: options.threadId,
      },
    });

    return response.data.id || "";
  }

  async replyToMessage(
    messageId: string,
    body: string,
    replyAll: boolean = false,
  ): Promise<string> {
    const original = await this.getMessage(messageId);
    if (!original) {
      throw new Error(`Message ${messageId} not found`);
    }

    const originalResponse = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Cc", "Message-ID", "References"],
    });

    const headers = originalResponse.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
      "";

    const messageIdHeader = getHeader("Message-ID");
    const existingRefs = getHeader("References");
    const references = existingRefs
      ? `${existingRefs} ${messageIdHeader}`
      : messageIdHeader;

    let to = getHeader("From");
    let cc: string | undefined;

    if (replyAll) {
      const originalTo = getHeader("To");
      const originalCc = getHeader("Cc");
      const allRecipients = [originalTo, originalCc]
        .filter(Boolean)
        .join(", ");
      if (allRecipients) {
        cc = allRecipients;
      }
    }

    let subject = original.subject;
    if (!subject.toLowerCase().startsWith("re:")) {
      subject = `Re: ${subject}`;
    }

    return this.sendMessage({
      to,
      cc,
      subject,
      body,
      threadId: original.threadId,
      inReplyTo: messageIdHeader,
      references,
    });
  }

  async listLabels(): Promise<{ id: string; name: string }[]> {
    const response = await this.gmail.users.labels.list({
      userId: "me",
    });

    return (response.data.labels || []).map((label) => ({
      id: label.id || "",
      name: label.name || "",
    }));
  }

  async modifyLabels(
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[],
  ): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds,
        removeLabelIds,
      },
    });
  }

  async trashMessage(messageId: string): Promise<void> {
    await this.gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });
  }
}
