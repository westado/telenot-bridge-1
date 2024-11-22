import { jest } from '@jest/globals'
import CommandHandler from '../src/services/telenot/CommandHandler.mjs'

describe('CommandHandler', () => {
    let commandHandler
    let mockLogger
    let mockTelenotService
    let mockVirtualStateHandler

    beforeEach(() => {
        // Create mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        }

        // Create mock Telenot service with required methods
        mockTelenotService = {
            disarmArea: jest.fn(),
            intArmArea: jest.fn(),
            extArmArea: jest.fn(),
            resetArmArea: jest.fn(),
        }

        // Create mock VirtualStateHandler
        mockVirtualStateHandler = {
            resetVirtualModes: jest.fn(),
            mapToInternalState: jest.fn((cmd) => cmd), // By default, return the same command
            mapToExternalState: jest.fn((state) => state), // By default, return the same state
            isVirtualNightMode: jest.fn(),
        }
    })

    describe('constructor', () => {
        it('should create instance with valid parameters', () => {
            expect(() => {
                commandHandler = new CommandHandler(
                    mockLogger,
                    mockTelenotService,
                    mockVirtualStateHandler,
                )
            }).not.toThrow()

            expect(commandHandler.logger).toBe(mockLogger)
            expect(commandHandler.telenotService).toBe(mockTelenotService)
            expect(commandHandler.virtualStateHandler).toBe(mockVirtualStateHandler)
        })

        it('should throw error if telenotService is missing', () => {
            expect(() => {
                new CommandHandler(mockLogger, null, mockVirtualStateHandler)
            }).toThrow('Invalid telenotService: missing required methods')
        })

        it('should throw error if virtualStateHandler is missing', () => {
            expect(() => {
                new CommandHandler(mockLogger, mockTelenotService, null)
            }).toThrow('VirtualStateHandler is required')
        })

        it('should throw error if telenotService is missing disarmArea', () => {
            const invalidService = { ...mockTelenotService }
            delete invalidService.disarmArea
            expect(() => {
                new CommandHandler(mockLogger, invalidService, mockVirtualStateHandler)
            }).toThrow('Invalid telenotService: missing required methods')
        })

        it('should throw error if telenotService is missing intArmArea', () => {
            const { ...invalidService } = mockTelenotService
            delete invalidService.intArmArea
            expect(() => {
                new CommandHandler(mockLogger, invalidService, mockVirtualStateHandler)
            }).toThrow('Invalid telenotService: missing required methods')
        })

        it('should throw error if telenotService is missing extArmArea', () => {
            const { ...invalidService } = mockTelenotService
            delete invalidService.extArmArea
            expect(() => {
                new CommandHandler(mockLogger, invalidService, mockVirtualStateHandler)
            }).toThrow('Invalid telenotService: missing required methods')
        })

        it('should throw error if telenotService is missing resetArmArea', () => {
            const { ...invalidService } = mockTelenotService
            delete invalidService.resetArmArea
            expect(() => {
                new CommandHandler(mockLogger, invalidService, mockVirtualStateHandler)
            }).toThrow('Invalid telenotService: missing required methods')
        })

        it('should initialize with default commands', () => {
            commandHandler = new CommandHandler(
                mockLogger,
                mockTelenotService,
                mockVirtualStateHandler,
            )
            expect(Object.keys(commandHandler._commandMap)).toEqual([
                'DISARM',
                'ARM_HOME',
                'ARM_AWAY',
                'ARM_NIGHT',
                'RESET',
            ])
        })
    })

    describe('handleCommand', () => {
        beforeEach(() => {
            commandHandler = new CommandHandler(
                mockLogger,
                mockTelenotService,
                mockVirtualStateHandler,
            )
        })

        it('should handle DISARM command', () => {
            const result = commandHandler.handleCommand('DISARM')

            expect(result).toBe(true)
            expect(mockVirtualStateHandler.resetVirtualModes).toHaveBeenCalled()
            expect(mockTelenotService.disarmArea).toHaveBeenCalledWith(1)
        })

        it('should handle ARM_HOME command', () => {
            const result = commandHandler.handleCommand('ARM_HOME')

            expect(result).toBe(true)
            expect(mockTelenotService.intArmArea).toHaveBeenCalledWith(1)
        })

        it('should handle ARM_AWAY command', () => {
            const result = commandHandler.handleCommand('ARM_AWAY')

            expect(result).toBe(true)
            expect(mockTelenotService.extArmArea).toHaveBeenCalledWith(1)
        })

        it('should handle ARM_NIGHT command', () => {
            const result = commandHandler.handleCommand('ARM_NIGHT')

            expect(result).toBe(true)
            expect(mockTelenotService.intArmArea).toHaveBeenCalledWith(1)
            expect(mockVirtualStateHandler.mapToInternalState).toHaveBeenCalledWith('ARM_NIGHT')
        })

        it('should handle RESET command', () => {
            const result = commandHandler.handleCommand('RESET')

            expect(result).toBe(true)
            expect(mockTelenotService.resetArmArea).toHaveBeenCalledWith(1)
        })

        it('should handle unknown commands', () => {
            const result = commandHandler.handleCommand('INVALID_COMMAND')

            expect(result).toBe(false)
            expect(mockLogger.verbose).toHaveBeenCalledWith('Unknown command: INVALID_COMMAND')
            expect(mockTelenotService.disarmArea).not.toHaveBeenCalled()
            expect(mockTelenotService.intArmArea).not.toHaveBeenCalled()
            expect(mockTelenotService.extArmArea).not.toHaveBeenCalled()
            expect(mockTelenotService.resetArmArea).not.toHaveBeenCalled()
        })

        it('should handle empty command', () => {
            const result = commandHandler.handleCommand('')

            expect(result).toBe(false)
            expect(mockLogger.verbose).toHaveBeenCalledWith('Unknown command: ')
        })

        it('should handle null command', () => {
            const result = commandHandler.handleCommand(null)

            expect(result).toBe(false)
            expect(mockLogger.verbose).toHaveBeenCalledWith('Unknown command: null')
        })

        it('should map commands through virtualStateHandler', () => {
            mockVirtualStateHandler.mapToInternalState.mockReturnValue('ARM_HOME')
            const result = commandHandler.handleCommand('ARM_NIGHT')

            expect(mockVirtualStateHandler.mapToInternalState).toHaveBeenCalledWith('ARM_NIGHT')
            expect(mockTelenotService.intArmArea).toHaveBeenCalledWith(1)
            expect(result).toBe(true)
        })
    })

    describe('addCommand', () => {
        beforeEach(() => {
            commandHandler = new CommandHandler(
                mockLogger,
                mockTelenotService,
                mockVirtualStateHandler,
            )
        })

        it('should add new command successfully', () => {
            const mockFunction = jest.fn()
            commandHandler.addCommand('NEW_COMMAND', mockFunction)

            expect(commandHandler._commandMap['NEW_COMMAND']).toBe(mockFunction)
        })

        it('should throw error when adding duplicate command', () => {
            const mockFunction = jest.fn()

            expect(() => {
                commandHandler.addCommand('DISARM', mockFunction)
            }).toThrow('Command DISARM already exists')
        })

        it('should execute newly added command', () => {
            const mockFunction = jest.fn()
            commandHandler.addCommand('NEW_COMMAND', mockFunction)

            const result = commandHandler.handleCommand('NEW_COMMAND')

            expect(result).toBe(true)
            expect(mockFunction).toHaveBeenCalled()
        })

        it('should handle adding multiple new commands', () => {
            const mockFunction1 = jest.fn()
            const mockFunction2 = jest.fn()

            commandHandler.addCommand('COMMAND1', mockFunction1)
            commandHandler.addCommand('COMMAND2', mockFunction2)

            commandHandler.handleCommand('COMMAND1')
            expect(mockFunction1).toHaveBeenCalled()

            commandHandler.handleCommand('COMMAND2')
            expect(mockFunction2).toHaveBeenCalled()
        })

        it('should maintain existing commands when adding new ones', () => {
            const mockFunction = jest.fn()
            commandHandler.addCommand('NEW_COMMAND', mockFunction)

            // Test new command
            commandHandler.handleCommand('NEW_COMMAND')
            expect(mockFunction).toHaveBeenCalled()

            // Test existing command
            commandHandler.handleCommand('DISARM')
            expect(mockTelenotService.disarmArea).toHaveBeenCalled()
        })
    })

    describe('error handling', () => {
        beforeEach(() => {
            commandHandler = new CommandHandler(
                mockLogger,
                mockTelenotService,
                mockVirtualStateHandler,
            )
        })

        it('should handle errors in command execution', () => {
            mockTelenotService.disarmArea.mockImplementation(() => {
                throw new Error('Command execution failed')
            })

            expect(() => {
                commandHandler.handleCommand('DISARM')
            }).toThrow('Command execution failed')
        })

        it('should handle errors in virtualStateHandler', () => {
            mockVirtualStateHandler.mapToInternalState.mockImplementation(() => {
                throw new Error('Virtual state handling failed')
            })

            expect(() => {
                commandHandler.handleCommand('ARM_NIGHT')
            }).toThrow('Virtual state handling failed')
        })

        it('should handle invalid command functions gracefully', () => {
            commandHandler.addCommand('INVALID', null)
            const result = commandHandler.handleCommand('INVALID')
            expect(result).toBe(false)
            expect(mockLogger.verbose).toHaveBeenCalledWith('Unknown command: INVALID')
        })
    })
})
