import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import formatMessage from './Format.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        discover: 3,
        verbose: 4,
        debug: 5,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        discover: 'cyan',
        mqtt: 'cyan',
        http: 'magenta',
        verbose: 'blue',
        debug: 'white',
        silly: 'grey',
    },
}

/**
 * Initializes a winston logger with custom levels, colors, and transports.
 * @param {object} [options] - Options object.
 * @param {string} [options.LogLevel] - The initial log level. Defaults to
 *   `'debug'` in development mode or `'info'` otherwise.
 * @returns {winston.Logger} A winston logger instance with custom transports
 *   and format.
 */
async function initLogger({ LogLevel } = {}) {
    try {
        const logsDir = path.join(__dirname, '..', 'logs')
        await fs.promises.mkdir(logsDir, { recursive: true })

        winston.addColors(customLevels.colors)

        const logLevel = LogLevel || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')

        const logFormat = winston.format.printf(({ level, message, label, timestamp }) => {
            if (typeof message === 'string' && message.includes('State change published:')) {
                message = formatMessage(message)
            }

            message = message
                .split('\n')
                .map((line, i) => (i === 0 ? line : `    ${line}`))
                .join('\n')

            return `${timestamp} [${label}] ${level}: ${message}`
        })

        // Define a filter format for 'discover' level logs
        const filterDiscover = winston.format((info) => (info.level === 'discover' ? info : false))

        const logger = winston.createLogger({
            level: logLevel,
            levels: customLevels.levels,
            format: winston.format.combine(
                winston.format.label({ label: 'Telenot' }),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                logFormat,
            ),
            transports: [
                // Console Transport
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize({ all: true }),
                        logFormat,
                    ),
                }),
                // File Transport for Errors
                new winston.transports.File({
                    filename: path.join(logsDir, 'error.log'),
                    level: 'error',
                }),
                // Combined File Transport
                new winston.transports.File({
                    filename: path.join(logsDir, 'combined.log'),
                }),
                // Transport for Discover Logs with Daily Rotation
                new DailyRotateFile({
                    filename: path.join(logsDir, 'discover-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'discover',
                    format: winston.format.combine(
                        filterDiscover(),
                        winston.format.timestamp({
                            format: 'YYYY-MM-DD HH:mm:ss',
                        }),
                        winston.format.printf(
                            ({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`,
                        ),
                    ),
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '90d',
                }),
            ],
        })

        return logger
    } catch (error) {
        console.error('Logger initialization failed:', error)
        return Object.fromEntries(
            Object.keys(customLevels.levels).map((level) => [
                level,
                // eslint-disable-next-line no-console
                (...args) => console.log(`[${level.toUpperCase()}]`, ...args),
            ]),
        )
    }
}

export default initLogger
