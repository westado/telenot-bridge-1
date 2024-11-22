import { jest, afterEach } from '@jest/globals'
import StateManager from '../src/services/telenot/StateManager.mjs'
import config from '../src/config/config.mjs'

describe('StateManager', () => {
    let stateManager
    let mockLogger
    let mockMqttHandler

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        }

        mockMqttHandler = {
            publish: jest.fn().mockResolvedValue(),
        }

        stateManager = new StateManager(mockLogger, mockMqttHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('Static Methods', () => {
        describe('reverseBinary', () => {
            it('should reverse the binary representation of a number', () => {
                expect(StateManager.reverseBinary(5)).toBe('10100000') // 5 in binary is '00000101', reversed is '10100000'
                expect(StateManager.reverseBinary(255)).toBe('11111111')
                expect(StateManager.reverseBinary(0)).toBe('00000000')
            })
        })

        describe('mapBinaryValue', () => {
            it('should map binary value to "ON" when value is "1" and not inverted', () => {
                expect(StateManager.mapBinaryValue('1', false)).toBe('ON')
            })

            it('should map binary value to "OFF" when value is "0" and not inverted', () => {
                expect(StateManager.mapBinaryValue('0', false)).toBe('OFF')
            })

            it('should invert the mapping when inverted is true', () => {
                expect(StateManager.mapBinaryValue('0', true)).toBe('ON')
                expect(StateManager.mapBinaryValue('1', true)).toBe('OFF')
            })
        })
    })

    describe('handleStateChange', () => {
        it('should publish position states on first state change', async () => {
            const byteMap = new Map([
                [0, 255], // 11111111
                [1, 0], // 00000000
            ])
            const contentName = 'TEST_CONTENT'
            const contentConfig = {
                positions: [
                    {
                        hex: '00',
                        topic: 'test/topic/1',
                        name: 'Test Position 1',
                        name_ha: 'Test HA 1',
                        type: 'binary',
                        location: 'Test Location',
                        inverted: false,
                    },
                    {
                        hex: '08',
                        topic: 'test/topic/2',
                        name: 'Test Position 2',
                        name_ha: 'Test HA 2',
                        type: 'binary',
                        location: 'Test Location',
                        inverted: true,
                    },
                ],
            }

            await stateManager.handleStateChange(byteMap, contentName, contentConfig)

            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(2)
            expect(mockLogger.info).toHaveBeenCalledTimes(2)
        })

        it('should detect and publish state changes', async () => {
            const mockContentConfig = {
                positions: [
                    {
                        hex: '10', // This will map to byte index 2 (16/8=2), bit 0 (16%8=0)
                        topic: 'test/topic',
                        name: 'Test Sensor',
                        name_ha: 'Test Sensor',
                        type: 'sensor',
                        location: 'Test Location',
                        inverted: false,
                    },
                ],
            }

            // Initial state - byte index 2 is 0
            const initialByteMap = new Map([[2, 0]])
            await stateManager.handleStateChange(initialByteMap, 'TEST_CONTENT', mockContentConfig)

            // Clear the initial publish calls
            mockMqttHandler.publish.mockClear()

            // Change state - byte index 2 changes to 1 (bit 0 changes from 0 to 1)
            const updatedByteMap = new Map([[2, 1]])
            await stateManager.handleStateChange(updatedByteMap, 'TEST_CONTENT', mockContentConfig)

            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(1)
        })

        it('should not publish state if there is no change', async () => {
            const contentConfig = {
                positions: [
                    {
                        hex: '00',
                        topic: 'test/topic/1',
                        name: 'Test Position 1',
                        name_ha: 'Test HA 1',
                        type: 'binary',
                        location: 'Test Location',
                        inverted: false,
                    },
                ],
            }

            const byteMap = new Map([[0, 1]])

            await stateManager.handleStateChange(byteMap, 'TEST_CONTENT', contentConfig)
            await stateManager.handleStateChange(byteMap, 'TEST_CONTENT', contentConfig)

            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(1)
        })
    })

    describe('discovery logging', () => {
        beforeEach(() => {
            mockLogger.discover = jest.fn()
            stateManager.config.Discover = true
        })

        it('should log discovery info for unknown positions', async () => {
            const byteIndex = 0
            const bitIndex = 1
            const position = { hex: '01', topic: 'test/topic' } // No name = unknown position
            const contentName = 'TEST_CONTENT'

            await stateManager.publishState(position, '1', byteIndex, bitIndex, contentName)

            expect(mockLogger.discover).toHaveBeenCalledWith('--- Discovery Detection ---')
            expect(mockLogger.discover).toHaveBeenCalledWith(
                expect.stringContaining(
                    `${contentName} - Byte:${byteIndex} Bit:${bitIndex} Position:${position.hex}`,
                ),
            )
        })
    })

    describe('getPreviousBit', () => {
        it('should return N/A when contentName does not exist', () => {
            expect(stateManager.getPreviousBit('UNKNOWN', 0, 0)).toBe('N/A')
        })

        it('should return N/A when byteIndex does not exist', () => {
            stateManager.statesPrevious.set('TEST', new Map())
            expect(stateManager.getPreviousBit('TEST', 99, 0)).toBe('N/A')
        })

        it('should return the correct previous bit', () => {
            stateManager.statesPrevious.set('TEST', new Map([[0, 5]])) // 5 = 00000101
            expect(stateManager.getPreviousBit('TEST', 0, 0)).toBe('1')
            expect(stateManager.getPreviousBit('TEST', 0, 1)).toBe('0')
            expect(stateManager.getPreviousBit('TEST', 0, 2)).toBe('1')
        })
    })

    describe('publishState', () => {
        const testPosition = {
            hex: '00',
            topic: 'test/topic/1',
            name: 'Test Position 1',
            name_ha: 'Test HA 1',
            type: 'binary',
            location: 'Test Location',
            inverted: false,
        }

        it('should publish state and log info on success', async () => {
            const bitValue = '1'

            await stateManager.publishState(testPosition, bitValue)

            const [topic, payload, options] = mockMqttHandler.publish.mock.calls[0]
            const parsedPayload = JSON.parse(payload)

            expect(topic).toBe('test/topic/1')
            expect(parsedPayload).toMatchObject({
                id: 'test_position_1_00',
                name: 'Test HA 1',
                type: 'binary',
                state: 'ON',
                location: 'Test Location',
            })
            expect(parsedPayload.last_triggered).toEqual(expect.any(String))
            expect(options).toEqual({ retain: true })
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Published state change:'),
            )
            expect(stateManager.lastPublishedStates.get('test/topic/1')).toBe('ON')
        })

        it('should not publish if the state is the same as last published', async () => {
            const bitValue = '1'

            await stateManager.publishState(testPosition, bitValue)
            await stateManager.publishState(testPosition, bitValue)

            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(1)
        })

        it('should log error on publish failure', async () => {
            const bitValue = '1'
            const error = new Error('Publish failed')
            mockMqttHandler.publish.mockRejectedValueOnce(error)

            await stateManager.publishState(testPosition, bitValue)

            expect(mockLogger.error).toHaveBeenCalledWith(
                `\x1b[31mFailed to publish ${testPosition.topic}:\x1b[0m ${error}`,
            )
        })
    })

    describe('publishAlarmState', () => {
        it('should publish the correct alarm state and log info', async () => {
            jest.spyOn(stateManager, 'determineAlarmState').mockReturnValue('ARMED_HOME')

            await stateManager.publishAlarmState()

            expect(mockMqttHandler.publish).toHaveBeenCalledWith(
                config.Connection.mqttConfig.stateTopic,
                'ARMED_HOME',
                { retain: true },
            )
            expect(mockLogger.info).toHaveBeenCalledWith(
                `\x1b[33mPublishing state: ARMED_HOME to ${config.Connection.mqttConfig.stateTopic}\x1b[0m`,
            )
        })

        it('should handle publish failure and log error', async () => {
            const error = new Error('Publish failed')
            jest.spyOn(stateManager, 'determineAlarmState').mockReturnValue('DISARMED')
            mockMqttHandler.publish.mockRejectedValueOnce(error)

            await expect(stateManager.publishAlarmState()).rejects.toThrow(error)

            expect(mockLogger.info).toHaveBeenCalledWith(
                `\x1b[33mPublishing state: DISARMED to ${config.Connection.mqttConfig.stateTopic}\x1b[0m`,
            )
        })
    })

    describe('determineAlarmState', () => {
        it('should return ARMED_AWAY when extern_scharf is ON', () => {
            stateManager.lastPublishedStates.set(
                'telenot/alarm/kg/ema_zentrale/extern_scharf',
                'ON',
            )
            expect(stateManager.determineAlarmState()).toBe('ARMED_AWAY')
        })

        it('should return ARMED_HOME when intern_scharf is ON and extern_scharf is not ON', () => {
            stateManager.lastPublishedStates.set(
                'telenot/alarm/kg/ema_zentrale/intern_scharf',
                'ON',
            )
            expect(stateManager.determineAlarmState()).toBe('ARMED_HOME')
        })

        it('should return DISARMED when neither extern_scharf nor intern_scharf is ON', () => {
            stateManager.lastPublishedStates.set(
                'telenot/alarm/kg/ema_zentrale/extern_scharf',
                'OFF',
            )
            stateManager.lastPublishedStates.set(
                'telenot/alarm/kg/ema_zentrale/intern_scharf',
                'OFF',
            )
            expect(stateManager.determineAlarmState()).toBe('DISARMED')
        })
    })

    describe('publishPositionStates', () => {
        it('should publish states for all positions based on byteMap', async () => {
            const byteMap = new Map([
                [0, 255], // 11111111
                [1, 0], // 00000000
            ])
            const positions = [
                {
                    hex: '00',
                    topic: 'test/topic/1',
                    name: 'Test Position 1',
                    name_ha: 'Test HA 1',
                    type: 'binary',
                    location: 'Test Location',
                    inverted: false,
                },
                {
                    hex: '08',
                    topic: 'test/topic/2',
                    name: 'Test Position 2',
                    name_ha: 'Test HA 2',
                    type: 'binary',
                    location: 'Test Location',
                    inverted: true,
                },
            ]

            await stateManager.publishPositionStates(byteMap, positions)

            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(2)
        })
    })

    describe('processStateChanges', () => {
        it('should publish state changes based on bit differences', async () => {
            const newValue = 1 // 00000001
            const oldValue = 0 // 00000000
            const byteIndex = 0
            const positions = [
                {
                    hex: '00',
                    topic: 'test/topic/1',
                    name: 'Test Position 1',
                    name_ha: 'Test HA 1',
                    type: 'binary',
                    location: 'Test Location',
                    inverted: false,
                },
            ]

            await stateManager.processStateChanges(newValue, oldValue, byteIndex, positions)

            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(1)
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Published state change:'),
            )
        })

        it('should handle inverted positions correctly', async () => {
            const newValue = 0 // 00000000
            const oldValue = 1 // 00000001
            const byteIndex = 0
            const positions = [
                {
                    hex: '00',
                    topic: 'test/topic/1',
                    name: 'Test Position 1',
                    name_ha: 'Test HA 1',
                    type: 'binary',
                    location: 'Test Location',
                    inverted: true,
                },
            ]

            await stateManager.processStateChanges(newValue, oldValue, byteIndex, positions)

            expect(mockMqttHandler.publish).toHaveBeenCalledWith(
                'test/topic/1',
                expect.stringMatching(
                    /^\{"id":"test_position_1_00","name":"Test HA 1","type":"binary","state":"ON","location":"Test Location","last_triggered":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"\}$/,
                ),
                { retain: true },
            )
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Published state change:'),
            )
        })
    })
})
