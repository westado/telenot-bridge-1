import { jest, afterEach } from '@jest/globals'
import path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

describe('Logger Initialization', () => {
    let logger
    let initLogger

    beforeEach(async () => {
        jest.clearAllMocks()
        jest.resetModules()

        // Mock fs.promises.mkdir
        jest.spyOn(fs.promises, 'mkdir').mockResolvedValue()

        // Mock console.error
        jest.spyOn(console, 'error').mockImplementation(() => {})

        // Import initLogger after mocks are set up
        initLogger = (await import('../src/utils/Logger.mjs')).default
    })

    afterEach(() => {
        jest.restoreAllMocks()
        delete process.env.NODE_ENV
    })

    it('should create the logs directory', async () => {
        await initLogger({ LogLevel: 'info' })
        const logsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/logs')
        expect(fs.promises.mkdir).toHaveBeenCalledWith(logsDir, { recursive: true })
    })

    it('should set custom log levels and colors', async () => {
        logger = await initLogger({ LogLevel: 'info' })
        expect(logger.levels).toEqual({
            error: 0,
            warn: 1,
            info: 2,
            discover: 3,
            verbose: 4,
            debug: 5,
        })
    })

    it('should create a logger with correct configuration', async () => {
        logger = await initLogger({ LogLevel: 'info' })
        expect(logger.level).toBe('info')
        expect(logger.levels).toEqual({
            error: 0,
            warn: 1,
            info: 2,
            discover: 3,
            verbose: 4,
            debug: 5,
        })
        expect(logger.transports.length).toBeGreaterThan(0)
        expect(logger.format).toBeDefined()
    })

    it('should configure Console and File transports correctly', async () => {
        logger = await initLogger({ LogLevel: 'info' })

        const transportNames = logger.transports.map(
            (t) => t.name || t.constructor.name.toLowerCase(),
        )

        expect(transportNames).toContain('console')
        expect(transportNames).toContain('file')
    })

    it('should log an error if initialization fails', async () => {
        fs.promises.mkdir.mockRejectedValue(new Error('Failed to create logs directory'))
        await initLogger({ LogLevel: 'info' })
        expect(console.error).toHaveBeenCalledWith(
            'Logger initialization failed:',
            expect.any(Error),
        )
    })

    it('should fallback to console logging on initialization failure', async () => {
        // Simulate an error during logger initialization
        jest.spyOn(fs.promises, 'mkdir').mockRejectedValue(new Error('Initialization failed'))
        logger = await initLogger({ LogLevel: 'info' })
        expect(console.error).toHaveBeenCalledWith(
            'Logger initialization failed:',
            expect.any(Error),
        )
        expect(logger.error).toBeInstanceOf(Function)
    })

    it('should set log level based on NODE_ENV', async () => {
        jest.resetModules()
        process.env.NODE_ENV = 'development'

        // Re-import initLogger to pick up new environment variable
        initLogger = (await import('../src/utils/Logger.mjs')).default
        logger = await initLogger()
        expect(logger.level).toBe('debug')
    })

    it('should use fallback console logger on initialization failure', async () => {
        // Simulate an error during logger initialization
        jest.spyOn(fs.promises, 'mkdir').mockRejectedValue(new Error('Initialization failed'))
        logger = await initLogger({ LogLevel: 'info' })

        // Spy on console.log
        jest.spyOn(console, 'log').mockImplementation(() => {})

        // Use the fallback logger to log a message
        logger.info('Fallback logger test message')

        // Check if console.log was called with the expected format
        expect(console.log).toHaveBeenCalledWith('[INFO]', 'Fallback logger test message')
    })

    it('should log messages correctly', async () => {
        logger = await initLogger({ LogLevel: 'info' })

        jest.spyOn(logger, 'info')
        logger.info('Test message')

        expect(logger.info).toHaveBeenCalledWith('Test message')
    })

    it('should use the custom formatter for discover level logs', async () => {
        logger = await initLogger({ LogLevel: 'discover' })

        const testMessage = 'Testing discover level log'

        // Create a promise that resolves when the log is processed
        const logPromise = new Promise((resolve) => {
            // Find the 'discover' transport
            const discoverTransport = logger.transports.find(
                (t) => t.options && t.options.level === 'discover',
            )

            expect(discoverTransport).toBeDefined()

            // Mock the log method
            jest.spyOn(discoverTransport, 'log').mockImplementation((info, callback) => {
                // Extract and verify the formatted message
                const formattedMessage = info[Symbol.for('message')]

                // Verify timestamp format and message content
                const expectedTimestampFormat = new RegExp(
                    `^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2} \\[discover\\] ${testMessage}$`,
                )

                expect(formattedMessage).toMatch(expectedTimestampFormat)

                // Call the callback and resolve the promise
                if (callback) {
                    resolve()
                }
            })

            // Log the message
            logger.discover(testMessage)
        })

        // Wait for the log to be processed
        await logPromise
    })
})

describe('Logger Initialization', () => {
    let logger
    let initLogger
    let formatMessageMock

    beforeEach(async () => {
        jest.clearAllMocks()
        jest.resetModules()
        jest.spyOn(fs.promises, 'mkdir').mockResolvedValue()
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        jest.restoreAllMocks()
        delete process.env.NODE_ENV
    })

    it('should call formatMessage when message includes "State change published:"', async () => {
        formatMessageMock = jest.fn((message) => `Formatted: ${message}`)

        await jest.unstable_mockModule('../src/utils/Format.mjs', () => ({
            default: formatMessageMock,
        }))

        await jest.isolateModulesAsync(async () => {
            initLogger = (await import('../src/utils/Logger.mjs')).default
            logger = await initLogger({ LogLevel: 'info' })

            const testMessage = 'State change published: device on'
            logger.info(testMessage)

            expect(formatMessageMock).toHaveBeenCalledWith(testMessage)
        })
    })
})
