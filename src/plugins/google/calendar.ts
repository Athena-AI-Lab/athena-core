import { calendar_v3, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface ICalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees?: { email: string; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
  status: string;
  htmlLink?: string;
  recurringEventId?: string;
}

export interface ICalendarEventCreate {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay?: boolean;
  attendees?: string[];
  reminders?: { method: string; minutes: number }[];
  timeZone?: string;
}

export interface ICalendarEventUpdate {
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  attendees?: string[];
}

export interface ICalendarInfo {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  timeZone?: string;
}

export class CalendarClient {
  private calendar: calendar_v3.Calendar;
  private defaultTimeZone: string;

  constructor(auth: OAuth2Client, defaultTimeZone: string = "UTC") {
    this.calendar = google.calendar({ version: "v3", auth });
    this.defaultTimeZone = defaultTimeZone;
  }

  async listCalendars(): Promise<ICalendarInfo[]> {
    const response = await this.calendar.calendarList.list();

    return (response.data.items || []).map((cal) => ({
      id: cal.id || "",
      summary: cal.summary || "",
      description: cal.description || undefined,
      primary: cal.primary || undefined,
      timeZone: cal.timeZone || undefined,
    }));
  }

  async listEvents(
    calendarId: string = "primary",
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 10,
    query?: string,
  ): Promise<ICalendarEvent[]> {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    };

    if (timeMin) {
      params.timeMin = new Date(timeMin).toISOString();
    } else {
      params.timeMin = new Date().toISOString();
    }

    if (timeMax) {
      params.timeMax = new Date(timeMax).toISOString();
    }

    if (query) {
      params.q = query;
    }

    const response = await this.calendar.events.list(params);

    return (response.data.items || []).map((event) =>
      this.formatEvent(event),
    );
  }

  async getEvent(
    eventId: string,
    calendarId: string = "primary",
  ): Promise<ICalendarEvent | null> {
    const response = await this.calendar.events.get({
      calendarId,
      eventId,
    });

    if (!response.data) return null;
    return this.formatEvent(response.data);
  }

  async createEvent(
    options: ICalendarEventCreate,
    calendarId: string = "primary",
  ): Promise<ICalendarEvent> {
    const timeZone = options.timeZone || this.defaultTimeZone;
    const eventBody: calendar_v3.Schema$Event = {
      summary: options.summary,
      description: options.description,
      location: options.location,
    };

    if (options.allDay) {
      eventBody.start = { date: options.start.split("T")[0] };
      eventBody.end = { date: options.end.split("T")[0] };
    } else {
      eventBody.start = {
        dateTime: new Date(options.start).toISOString(),
        timeZone,
      };
      eventBody.end = {
        dateTime: new Date(options.end).toISOString(),
        timeZone,
      };
    }

    if (options.attendees) {
      eventBody.attendees = options.attendees.map((email) => ({ email }));
    }

    if (options.reminders) {
      eventBody.reminders = {
        useDefault: false,
        overrides: options.reminders,
      };
    }

    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: eventBody,
      sendUpdates: options.attendees ? "all" : "none",
    });

    return this.formatEvent(response.data);
  }

  async updateEvent(
    eventId: string,
    options: ICalendarEventUpdate,
    calendarId: string = "primary",
  ): Promise<ICalendarEvent> {
    const existing = await this.calendar.events.get({
      calendarId,
      eventId,
    });

    const eventBody: calendar_v3.Schema$Event = {
      ...existing.data,
    };

    if (options.summary !== undefined) {
      eventBody.summary = options.summary;
    }
    if (options.description !== undefined) {
      eventBody.description = options.description;
    }
    if (options.location !== undefined) {
      eventBody.location = options.location;
    }

    if (options.start !== undefined || options.end !== undefined) {
      const isAllDay = options.allDay ?? !!existing.data.start?.date;

      if (options.start !== undefined) {
        if (isAllDay) {
          eventBody.start = { date: options.start.split("T")[0] };
        } else {
          eventBody.start = {
            dateTime: new Date(options.start).toISOString(),
            timeZone: existing.data.start?.timeZone || this.defaultTimeZone,
          };
        }
      }

      if (options.end !== undefined) {
        if (isAllDay) {
          eventBody.end = { date: options.end.split("T")[0] };
        } else {
          eventBody.end = {
            dateTime: new Date(options.end).toISOString(),
            timeZone: existing.data.end?.timeZone || this.defaultTimeZone,
          };
        }
      }
    }

    if (options.attendees !== undefined) {
      eventBody.attendees = options.attendees.map((email) => ({ email }));
    }

    const response = await this.calendar.events.update({
      calendarId,
      eventId,
      requestBody: eventBody,
      sendUpdates: options.attendees ? "all" : "none",
    });

    return this.formatEvent(response.data);
  }

  async deleteEvent(
    eventId: string,
    calendarId: string = "primary",
    sendUpdates: boolean = true,
  ): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: sendUpdates ? "all" : "none",
    });
  }

  async quickAdd(
    text: string,
    calendarId: string = "primary",
  ): Promise<ICalendarEvent> {
    const response = await this.calendar.events.quickAdd({
      calendarId,
      text,
    });

    return this.formatEvent(response.data);
  }

  private formatEvent(event: calendar_v3.Schema$Event): ICalendarEvent {
    const isAllDay = !!event.start?.date;
    let start: string;
    let end: string;

    if (isAllDay) {
      start = event.start?.date || "";
      end = event.end?.date || "";
    } else {
      start = event.start?.dateTime || "";
      end = event.end?.dateTime || "";
    }

    return {
      id: event.id || "",
      summary: event.summary || "",
      description: event.description || undefined,
      location: event.location || undefined,
      start,
      end,
      allDay: isAllDay,
      attendees: event.attendees?.map((a) => ({
        email: a.email || "",
        responseStatus: a.responseStatus || undefined,
      })),
      organizer: event.organizer
        ? {
            email: event.organizer.email || "",
            displayName: event.organizer.displayName || undefined,
          }
        : undefined,
      status: event.status || "",
      htmlLink: event.htmlLink || undefined,
      recurringEventId: event.recurringEventId || undefined,
    };
  }
}
