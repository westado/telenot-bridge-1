import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import MqttPublisher from '../src/services/mqtt/MqttPublisher.mjs'
import config from '../src/config/config.mjs'

describe('MqttPublisher', () => {
    let mockClient, mockLogger, mqttPublisher

    beforeEach(() => {
        mockClient = {
            publish: jest.fn(),
            connected: true,
        }

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        }

        mqttPublisher = new MqttPublisher(mockClient, mockLogger)
    })

    describe('publish', () => {
        it('should publish message to specified topic when connected', async () => {
            mockClient.publish.mockImplementation((topic, message, options, callback) =>
                callback(null),
            )

            await mqttPublisher.publish('test/topic', 'test message')

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Preparing to publish message to topic: test/topic',
            )
            expect(mockClient.publish).toHaveBeenCalledWith(
                'test/topic',
                'test message',
                { retain: true, qos: 0 },
                expect.any(Function),
            )
            expect(mockLogger.info).toHaveBeenCalledWith('Successfully published to test/topic')
        })

        it('should log and reject if not connected', async () => {
            mockClient.connected = false

            await expect(mqttPublisher.publish('test/topic', 'test message')).rejects.toThrow(
                'Not connected to MQTT broker',
            )
            expect(mockLogger.error).toHaveBeenCalledWith('Not connected to MQTT broker')
            expect(mockClient.publish).not.toHaveBeenCalled()
        })

        it('should use JSON payload if config option is enabled and message is JSON', async () => {
            config.Connection.mqttConfig.use_json_payload = true
            const jsonMessage = JSON.stringify({ key: 'value' })

            mockClient.publish.mockImplementation((topic, message, options, callback) =>
                callback(null),
            )

            await mqttPublisher.publish('test/topic', jsonMessage)

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Parsed message as JSON for topic test/topic',
            )
            expect(mockClient.publish).toHaveBeenCalledWith(
                'test/topic',
                jsonMessage,
                { retain: true, qos: 0 },
                expect.any(Function),
            )
        })

        it('should log warning and send as plain text if message is invalid JSON', async () => {
            config.Connection.mqttConfig.use_json_payload = true

            const invalidJsonMessage = "{ key: 'value' }"
            mockClient.publish.mockImplementation((topic, message, options, callback) =>
                callback(null),
            )

            await mqttPublisher.publish('test/topic', invalidJsonMessage)

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Invalid JSON format for message on topic test/topic. Sending as plain text.',
            )
            expect(mockClient.publish).toHaveBeenCalledWith(
                'test/topic',
                invalidJsonMessage,
                { retain: true, qos: 0 },
                expect.any(Function),
            )
        })

        it('should bypass JSON parsing for specified topics', async () => {
            config.Connection.mqttConfig.use_json_payload = true
            const stateTopic = config.Connection.mqttConfig.stateTopic
            const jsonMessage = JSON.stringify({ key: 'value' })

            mockClient.publish.mockImplementation((topic, message, options, callback) =>
                callback(null),
            )

            await mqttPublisher.publish(stateTopic, jsonMessage)

            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('Parsed message as JSON'),
            )
            expect(mockClient.publish).toHaveBeenCalledWith(
                stateTopic,
                jsonMessage,
                { retain: true, qos: 0 },
                expect.any(Function),
            )
        })

        it('should log error and reject if publish fails', async () => {
            const publishError = new Error('Publish error')
            mockClient.publish.mockImplementation((topic, message, options, callback) =>
                callback(publishError),
            )

            await expect(mqttPublisher.publish('test/topic', 'test message')).rejects.toThrow(
                'Publish error',
            )

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to publish to test/topic: Publish error',
            )
        })
    })

    describe('isConnected', () => {
        it('should return true if MQTT client is connected', () => {
            mockClient.connected = true
            expect(mqttPublisher.isConnected()).toBe(true)
        })

        it('should return false if MQTT client is not connected', () => {
            mockClient.connected = false
            expect(mqttPublisher.isConnected()).toBe(false)
        })
    })
})
