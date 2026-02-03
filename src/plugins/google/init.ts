import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";
import { GmailClient } from "./gmail.js";
import { CalendarClient } from "./calendar.js";

export default class Google extends PluginBase {
  private auth!: OAuth2Client;
  private gmail!: GmailClient;
  private calendar!: CalendarClient;

  desc(): string | null {
    return "Google integration providing Gmail and Calendar access.";
  }

  async load(athena: Athena) {
    this.auth = new google.auth.OAuth2(
      this.config.client_id,
      this.config.client_secret,
    );

    this.auth.setCredentials({
      refresh_token: this.config.refresh_token,
    });

    this.gmail = new GmailClient(this.auth);
    this.calendar = new CalendarClient(
      this.auth,
      this.config.default_timezone || "UTC",
    );

    this.registerGmailTools(athena);
    this.registerCalendarTools(athena);
  }

  private registerGmailTools(athena: Athena) {
    athena.registerTool(
      {
        name: "google/gmail-list-messages",
        desc: "Lists Gmail messages with optional search query. Returns message metadata without full body content.",
        args: {
          query: {
            type: "string",
            desc: "Gmail search query (e.g., 'from:example@gmail.com', 'is:unread', 'subject:meeting'). Uses Gmail search syntax.",
            required: false,
          },
          max_results: {
            type: "number",
            desc: "Maximum number of messages to return. Defaults to 10.",
            required: false,
          },
          label_ids: {
            type: "array",
            desc: "Filter by label IDs (e.g., ['INBOX', 'UNREAD']).",
            required: false,
            of: {
              type: "string",
              desc: "Label ID.",
              required: true,
            },
          },
        },
        retvals: {
          messages: {
            type: "array",
            desc: "List of message summaries.",
            required: true,
            of: {
              type: "object",
              desc: "Message summary.",
              required: true,
              of: {
                id: {
                  type: "string",
                  desc: "Message ID.",
                  required: true,
                },
                thread_id: {
                  type: "string",
                  desc: "Thread ID.",
                  required: true,
                },
                subject: {
                  type: "string",
                  desc: "Email subject.",
                  required: true,
                },
                from: {
                  type: "string",
                  desc: "Sender email address.",
                  required: true,
                },
                to: {
                  type: "string",
                  desc: "Recipient email address.",
                  required: true,
                },
                date: {
                  type: "string",
                  desc: "Date of the email.",
                  required: true,
                },
                snippet: {
                  type: "string",
                  desc: "Short snippet of the email body.",
                  required: true,
                },
                labels: {
                  type: "array",
                  desc: "Labels applied to this message.",
                  required: true,
                  of: {
                    type: "string",
                    desc: "Label name.",
                    required: true,
                  },
                },
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const messages = await this.gmail.listMessages(
            args.query,
            args.max_results || 10,
            args.label_ids,
          );
          return {
            messages: messages.map((m) => ({
              id: m.id,
              thread_id: m.threadId,
              subject: m.subject,
              from: m.from,
              to: m.to,
              date: m.date,
              snippet: m.snippet,
              labels: m.labels,
            })),
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: args.query
            ? `Searching Gmail for "${args.query}"...`
            : "Listing recent Gmail messages...",
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Found ${retvals.messages.length} messages.`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/gmail-get-message",
        desc: "Gets the full content of a specific Gmail message including the body.",
        args: {
          message_id: {
            type: "string",
            desc: "The message ID to retrieve.",
            required: true,
          },
        },
        retvals: {
          message: {
            type: "object",
            desc: "Full message content.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "Message ID.",
                required: true,
              },
              thread_id: {
                type: "string",
                desc: "Thread ID.",
                required: true,
              },
              subject: {
                type: "string",
                desc: "Email subject.",
                required: true,
              },
              from: {
                type: "string",
                desc: "Sender email address.",
                required: true,
              },
              to: {
                type: "string",
                desc: "Recipient email address.",
                required: true,
              },
              date: {
                type: "string",
                desc: "Date of the email.",
                required: true,
              },
              body: {
                type: "string",
                desc: "Full email body content.",
                required: true,
              },
              labels: {
                type: "array",
                desc: "Labels applied to this message.",
                required: true,
                of: {
                  type: "string",
                  desc: "Label name.",
                  required: true,
                },
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const message = await this.gmail.getMessage(args.message_id, true);
          if (!message) {
            throw new Error(`Message ${args.message_id} not found`);
          }
          return {
            message: {
              id: message.id,
              thread_id: message.threadId,
              subject: message.subject,
              from: message.from,
              to: message.to,
              date: message.date,
              body: message.body || "",
              labels: message.labels,
            },
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Retrieving message ${args.message_id}...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Retrieved message: "${retvals.message.subject}"`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/gmail-send-message",
        desc: "Sends a new email via Gmail.",
        args: {
          to: {
            type: "string",
            desc: "Recipient email address.",
            required: true,
          },
          subject: {
            type: "string",
            desc: "Email subject.",
            required: true,
          },
          body: {
            type: "string",
            desc: "Email body content (plain text).",
            required: true,
          },
          cc: {
            type: "string",
            desc: "CC recipient(s), comma-separated.",
            required: false,
          },
          bcc: {
            type: "string",
            desc: "BCC recipient(s), comma-separated.",
            required: false,
          },
        },
        retvals: {
          message_id: {
            type: "string",
            desc: "ID of the sent message.",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const messageId = await this.gmail.sendMessage({
            to: args.to,
            subject: args.subject,
            body: args.body,
            cc: args.cc,
            bcc: args.bcc,
          });
          return { message_id: messageId };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Sending email to ${args.to}: "${args.subject}"...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Email sent successfully. Message ID: ${retvals.message_id}`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/gmail-reply-message",
        desc: "Replies to an existing Gmail message, maintaining the thread.",
        args: {
          message_id: {
            type: "string",
            desc: "ID of the message to reply to.",
            required: true,
          },
          body: {
            type: "string",
            desc: "Reply body content (plain text).",
            required: true,
          },
          reply_all: {
            type: "boolean",
            desc: "Whether to reply to all recipients. Defaults to false.",
            required: false,
          },
        },
        retvals: {
          message_id: {
            type: "string",
            desc: "ID of the sent reply message.",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const messageId = await this.gmail.replyToMessage(
            args.message_id,
            args.body,
            args.reply_all || false,
          );
          return { message_id: messageId };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Replying to message ${args.message_id}...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Reply sent successfully. Message ID: ${retvals.message_id}`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/gmail-list-labels",
        desc: "Lists all Gmail labels (folders) available in the account.",
        args: {},
        retvals: {
          labels: {
            type: "array",
            desc: "List of labels.",
            required: true,
            of: {
              type: "object",
              desc: "Label information.",
              required: true,
              of: {
                id: {
                  type: "string",
                  desc: "Label ID.",
                  required: true,
                },
                name: {
                  type: "string",
                  desc: "Label name.",
                  required: true,
                },
              },
            },
          },
        },
      },
      {
        fn: async () => {
          const labels = await this.gmail.listLabels();
          return { labels };
        },
        explain_args: () => ({
          summary: "Listing Gmail labels...",
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Found ${retvals.labels.length} labels.`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/gmail-modify-labels",
        desc: "Adds or removes labels from a Gmail message.",
        args: {
          message_id: {
            type: "string",
            desc: "The message ID to modify.",
            required: true,
          },
          add_label_ids: {
            type: "array",
            desc: "Label IDs to add.",
            required: false,
            of: {
              type: "string",
              desc: "Label ID.",
              required: true,
            },
          },
          remove_label_ids: {
            type: "array",
            desc: "Label IDs to remove.",
            required: false,
            of: {
              type: "string",
              desc: "Label ID.",
              required: true,
            },
          },
        },
        retvals: {
          success: {
            type: "boolean",
            desc: "Whether the operation succeeded.",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          await this.gmail.modifyLabels(
            args.message_id,
            args.add_label_ids,
            args.remove_label_ids,
          );
          return { success: true };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Modifying labels for message ${args.message_id}...`,
        }),
        explain_retvals: () => ({
          summary: "Labels modified successfully.",
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/gmail-trash-message",
        desc: "Moves a Gmail message to trash.",
        args: {
          message_id: {
            type: "string",
            desc: "The message ID to trash.",
            required: true,
          },
        },
        retvals: {
          success: {
            type: "boolean",
            desc: "Whether the operation succeeded.",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          await this.gmail.trashMessage(args.message_id);
          return { success: true };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Moving message ${args.message_id} to trash...`,
        }),
        explain_retvals: () => ({
          summary: "Message moved to trash.",
        }),
      },
    );
  }

  private registerCalendarTools(athena: Athena) {
    athena.registerTool(
      {
        name: "google/calendar-list-calendars",
        desc: "Lists all calendars accessible to the user.",
        args: {},
        retvals: {
          calendars: {
            type: "array",
            desc: "List of calendars.",
            required: true,
            of: {
              type: "object",
              desc: "Calendar information.",
              required: true,
              of: {
                id: {
                  type: "string",
                  desc: "Calendar ID.",
                  required: true,
                },
                summary: {
                  type: "string",
                  desc: "Calendar name.",
                  required: true,
                },
                description: {
                  type: "string",
                  desc: "Calendar description.",
                  required: false,
                },
                primary: {
                  type: "boolean",
                  desc: "Whether this is the primary calendar.",
                  required: false,
                },
                time_zone: {
                  type: "string",
                  desc: "Calendar time zone.",
                  required: false,
                },
              },
            },
          },
        },
      },
      {
        fn: async () => {
          const calendars = await this.calendar.listCalendars();
          return {
            calendars: calendars.map((c) => ({
              id: c.id,
              summary: c.summary,
              description: c.description,
              primary: c.primary,
              time_zone: c.timeZone,
            })),
          };
        },
        explain_args: () => ({
          summary: "Listing calendars...",
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Found ${retvals.calendars.length} calendars.`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/calendar-list-events",
        desc: "Lists upcoming calendar events.",
        args: {
          calendar_id: {
            type: "string",
            desc: "Calendar ID. Use 'primary' for the main calendar.",
            required: false,
          },
          time_min: {
            type: "string",
            desc: "Start of time range (ISO 8601 format). Defaults to now.",
            required: false,
          },
          time_max: {
            type: "string",
            desc: "End of time range (ISO 8601 format).",
            required: false,
          },
          max_results: {
            type: "number",
            desc: "Maximum number of events to return. Defaults to 10.",
            required: false,
          },
          query: {
            type: "string",
            desc: "Free text search query.",
            required: false,
          },
        },
        retvals: {
          events: {
            type: "array",
            desc: "List of events.",
            required: true,
            of: {
              type: "object",
              desc: "Event information.",
              required: true,
              of: {
                id: {
                  type: "string",
                  desc: "Event ID.",
                  required: true,
                },
                summary: {
                  type: "string",
                  desc: "Event title.",
                  required: true,
                },
                description: {
                  type: "string",
                  desc: "Event description.",
                  required: false,
                },
                location: {
                  type: "string",
                  desc: "Event location.",
                  required: false,
                },
                start: {
                  type: "string",
                  desc: "Start time (ISO 8601 or date for all-day events).",
                  required: true,
                },
                end: {
                  type: "string",
                  desc: "End time (ISO 8601 or date for all-day events).",
                  required: true,
                },
                all_day: {
                  type: "boolean",
                  desc: "Whether this is an all-day event.",
                  required: true,
                },
                status: {
                  type: "string",
                  desc: "Event status.",
                  required: true,
                },
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const events = await this.calendar.listEvents(
            args.calendar_id || "primary",
            args.time_min,
            args.time_max,
            args.max_results || 10,
            args.query,
          );
          return {
            events: events.map((e) => ({
              id: e.id,
              summary: e.summary,
              description: e.description,
              location: e.location,
              start: e.start,
              end: e.end,
              all_day: e.allDay,
              status: e.status,
            })),
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: args.query
            ? `Searching calendar for "${args.query}"...`
            : "Listing upcoming calendar events...",
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Found ${retvals.events.length} events.`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/calendar-get-event",
        desc: "Gets detailed information about a specific calendar event.",
        args: {
          event_id: {
            type: "string",
            desc: "The event ID.",
            required: true,
          },
          calendar_id: {
            type: "string",
            desc: "Calendar ID. Use 'primary' for the main calendar.",
            required: false,
          },
        },
        retvals: {
          event: {
            type: "object",
            desc: "Event details.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "Event ID.",
                required: true,
              },
              summary: {
                type: "string",
                desc: "Event title.",
                required: true,
              },
              description: {
                type: "string",
                desc: "Event description.",
                required: false,
              },
              location: {
                type: "string",
                desc: "Event location.",
                required: false,
              },
              start: {
                type: "string",
                desc: "Start time.",
                required: true,
              },
              end: {
                type: "string",
                desc: "End time.",
                required: true,
              },
              all_day: {
                type: "boolean",
                desc: "Whether this is an all-day event.",
                required: true,
              },
              attendees: {
                type: "array",
                desc: "Event attendees.",
                required: false,
                of: {
                  type: "object",
                  desc: "Attendee information.",
                  required: true,
                  of: {
                    email: {
                      type: "string",
                      desc: "Attendee email.",
                      required: true,
                    },
                    response_status: {
                      type: "string",
                      desc: "Response status (accepted, declined, tentative, needsAction).",
                      required: false,
                    },
                  },
                },
              },
              organizer: {
                type: "object",
                desc: "Event organizer.",
                required: false,
                of: {
                  email: {
                    type: "string",
                    desc: "Organizer email.",
                    required: true,
                  },
                  display_name: {
                    type: "string",
                    desc: "Organizer display name.",
                    required: false,
                  },
                },
              },
              html_link: {
                type: "string",
                desc: "Link to view the event in Google Calendar.",
                required: false,
              },
              status: {
                type: "string",
                desc: "Event status.",
                required: true,
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const event = await this.calendar.getEvent(
            args.event_id,
            args.calendar_id || "primary",
          );
          if (!event) {
            throw new Error(`Event ${args.event_id} not found`);
          }
          return {
            event: {
              id: event.id,
              summary: event.summary,
              description: event.description,
              location: event.location,
              start: event.start,
              end: event.end,
              all_day: event.allDay,
              attendees: event.attendees?.map((a) => ({
                email: a.email,
                response_status: a.responseStatus,
              })),
              organizer: event.organizer
                ? {
                    email: event.organizer.email,
                    display_name: event.organizer.displayName,
                  }
                : undefined,
              html_link: event.htmlLink,
              status: event.status,
            },
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Retrieving event ${args.event_id}...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Retrieved event: "${retvals.event.summary}"`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/calendar-create-event",
        desc: "Creates a new calendar event.",
        args: {
          summary: {
            type: "string",
            desc: "Event title.",
            required: true,
          },
          start: {
            type: "string",
            desc: "Start time (ISO 8601 format, e.g., '2024-01-15T10:00:00').",
            required: true,
          },
          end: {
            type: "string",
            desc: "End time (ISO 8601 format).",
            required: true,
          },
          description: {
            type: "string",
            desc: "Event description.",
            required: false,
          },
          location: {
            type: "string",
            desc: "Event location.",
            required: false,
          },
          all_day: {
            type: "boolean",
            desc: "Whether this is an all-day event. If true, start/end should be dates (YYYY-MM-DD).",
            required: false,
          },
          attendees: {
            type: "array",
            desc: "Email addresses of attendees to invite.",
            required: false,
            of: {
              type: "string",
              desc: "Attendee email address.",
              required: true,
            },
          },
          calendar_id: {
            type: "string",
            desc: "Calendar ID. Use 'primary' for the main calendar.",
            required: false,
          },
          time_zone: {
            type: "string",
            desc: "Time zone for the event (e.g., 'America/New_York').",
            required: false,
          },
        },
        retvals: {
          event: {
            type: "object",
            desc: "Created event details.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "Event ID.",
                required: true,
              },
              summary: {
                type: "string",
                desc: "Event title.",
                required: true,
              },
              start: {
                type: "string",
                desc: "Start time.",
                required: true,
              },
              end: {
                type: "string",
                desc: "End time.",
                required: true,
              },
              html_link: {
                type: "string",
                desc: "Link to view the event in Google Calendar.",
                required: false,
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const event = await this.calendar.createEvent(
            {
              summary: args.summary,
              description: args.description,
              location: args.location,
              start: args.start,
              end: args.end,
              allDay: args.all_day,
              attendees: args.attendees,
              timeZone: args.time_zone,
            },
            args.calendar_id || "primary",
          );
          return {
            event: {
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
              html_link: event.htmlLink,
            },
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Creating event "${args.summary}"...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Event "${retvals.event.summary}" created successfully.`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/calendar-update-event",
        desc: "Updates an existing calendar event.",
        args: {
          event_id: {
            type: "string",
            desc: "The event ID to update.",
            required: true,
          },
          summary: {
            type: "string",
            desc: "New event title.",
            required: false,
          },
          start: {
            type: "string",
            desc: "New start time (ISO 8601 format).",
            required: false,
          },
          end: {
            type: "string",
            desc: "New end time (ISO 8601 format).",
            required: false,
          },
          description: {
            type: "string",
            desc: "New event description.",
            required: false,
          },
          location: {
            type: "string",
            desc: "New event location.",
            required: false,
          },
          attendees: {
            type: "array",
            desc: "New list of attendee email addresses (replaces existing attendees).",
            required: false,
            of: {
              type: "string",
              desc: "Attendee email address.",
              required: true,
            },
          },
          calendar_id: {
            type: "string",
            desc: "Calendar ID. Use 'primary' for the main calendar.",
            required: false,
          },
        },
        retvals: {
          event: {
            type: "object",
            desc: "Updated event details.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "Event ID.",
                required: true,
              },
              summary: {
                type: "string",
                desc: "Event title.",
                required: true,
              },
              start: {
                type: "string",
                desc: "Start time.",
                required: true,
              },
              end: {
                type: "string",
                desc: "End time.",
                required: true,
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const event = await this.calendar.updateEvent(
            args.event_id,
            {
              summary: args.summary,
              description: args.description,
              location: args.location,
              start: args.start,
              end: args.end,
              attendees: args.attendees,
            },
            args.calendar_id || "primary",
          );
          return {
            event: {
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
            },
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Updating event ${args.event_id}...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Event "${retvals.event.summary}" updated successfully.`,
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/calendar-delete-event",
        desc: "Deletes a calendar event.",
        args: {
          event_id: {
            type: "string",
            desc: "The event ID to delete.",
            required: true,
          },
          calendar_id: {
            type: "string",
            desc: "Calendar ID. Use 'primary' for the main calendar.",
            required: false,
          },
          notify_attendees: {
            type: "boolean",
            desc: "Whether to send cancellation notifications to attendees. Defaults to true.",
            required: false,
          },
        },
        retvals: {
          success: {
            type: "boolean",
            desc: "Whether the deletion succeeded.",
            required: true,
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          await this.calendar.deleteEvent(
            args.event_id,
            args.calendar_id || "primary",
            args.notify_attendees !== false,
          );
          return { success: true };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Deleting event ${args.event_id}...`,
        }),
        explain_retvals: () => ({
          summary: "Event deleted successfully.",
        }),
      },
    );

    athena.registerTool(
      {
        name: "google/calendar-quick-add",
        desc: "Creates an event using natural language (e.g., 'Lunch with John tomorrow at noon').",
        args: {
          text: {
            type: "string",
            desc: "Natural language description of the event.",
            required: true,
          },
          calendar_id: {
            type: "string",
            desc: "Calendar ID. Use 'primary' for the main calendar.",
            required: false,
          },
        },
        retvals: {
          event: {
            type: "object",
            desc: "Created event details.",
            required: true,
            of: {
              id: {
                type: "string",
                desc: "Event ID.",
                required: true,
              },
              summary: {
                type: "string",
                desc: "Event title.",
                required: true,
              },
              start: {
                type: "string",
                desc: "Start time.",
                required: true,
              },
              end: {
                type: "string",
                desc: "End time.",
                required: true,
              },
              html_link: {
                type: "string",
                desc: "Link to view the event.",
                required: false,
              },
            },
          },
        },
      },
      {
        fn: async (args: Dict<any>) => {
          const event = await this.calendar.quickAdd(
            args.text,
            args.calendar_id || "primary",
          );
          return {
            event: {
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
              html_link: event.htmlLink,
            },
          };
        },
        explain_args: (args: Dict<any>) => ({
          summary: `Creating event from "${args.text}"...`,
        }),
        explain_retvals: (args: Dict<any>, retvals: Dict<any>) => ({
          summary: `Event "${retvals.event.summary}" created successfully.`,
        }),
      },
    );
  }

  async unload(athena: Athena) {
    // Gmail tools
    athena.deregisterTool("google/gmail-list-messages");
    athena.deregisterTool("google/gmail-get-message");
    athena.deregisterTool("google/gmail-send-message");
    athena.deregisterTool("google/gmail-reply-message");
    athena.deregisterTool("google/gmail-list-labels");
    athena.deregisterTool("google/gmail-modify-labels");
    athena.deregisterTool("google/gmail-trash-message");

    // Calendar tools
    athena.deregisterTool("google/calendar-list-calendars");
    athena.deregisterTool("google/calendar-list-events");
    athena.deregisterTool("google/calendar-get-event");
    athena.deregisterTool("google/calendar-create-event");
    athena.deregisterTool("google/calendar-update-event");
    athena.deregisterTool("google/calendar-delete-event");
    athena.deregisterTool("google/calendar-quick-add");
  }
}
