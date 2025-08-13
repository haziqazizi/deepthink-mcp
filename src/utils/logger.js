import winston from 'winston';

/**
 * Centralized logger for the AI Oracle MCP server
 */
export class Logger {
  constructor(component = 'AIOracle') {
    this.component = component;
    this.logger = this.createLogger();
  }

  createLogger() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV === 'development';

    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ];

    if (isDevelopment) {
      formats.push(
        winston.format.colorize(),
        winston.format.simple()
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(...formats),
      defaultMeta: { component: this.component },
      transports: [
        new winston.transports.Console({
          format: isDevelopment 
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
                  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
                  return `${timestamp} [${component}] ${level}: ${message} ${metaString}`;
                })
              )
            : winston.format.json()
        })
      ]
    });
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  verbose(message, meta = {}) {
    this.logger.verbose(message, meta);
  }
}
