import { createLogger, format, transports } from "winston";

const logger = createLogger({
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.printf((info) => {
          return `[${info.timestamp}] [${info.level}] ${info.message}`;
        }),
      ),
    }),
  ],
});

export default logger;
