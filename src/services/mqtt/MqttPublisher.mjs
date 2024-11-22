import config from '../../config/config.mjs'

/**
 * Handles MQTT message publishing.
 */
class MqttPublisher {
    /**
     * Creates a new MqttPublisher instance.
     * @param {Object} mqttClient - The MQTT client used for publishing messages.
     * @param {Object} logger - The logger object for logging messages.
     */
    constructor(mqttClient, logger) {
        this.mqttClient = mqttClient
        this.logger = logger
    }

    /**
     * Publishes a message to a specified MQTT topic.
     * @param {string} topic - The MQTT topic to publish to.
     * @param {string|Buffer} message - The message to publish.
     * @param {Object} [options={ retain: true, qos: 0 }] - Optional MQTT publish options.
     * @returns {Promise<void>} A promise that resolves when the message is published, or rejects on error.
     */
    publish(topic, message, options = { retain: true, qos: 0 }) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                const error = new Error('Not connected to MQTT broker')
                this.logger.error(error.message)
                reject(error)
                return
            }

            this.logger.debug(`Preparing to publish message to topic: ${topic}`)
            let payload = message

            if (config.Connection.mqttConfig.use_json_payload && typeof message === 'string') {
                // Skip JSON parsing for specified topics
                const skipJsonParsing = topic === config.Connection.mqttConfig.stateTopic

                if (!skipJsonParsing) {
                    try {
                        const messageObj = JSON.parse(message)
                        payload = JSON.stringify(messageObj)
                        this.logger.debug(`Parsed message as JSON for topic ${topic}`)
                    } catch {
                        this.logger.warn(
                            `Invalid JSON format for message on topic ${topic}. Sending as plain text.`,
                        )
                        payload = message
                    }
                } else {
                    // For specified topics, use the message as is
                    payload = message
                }
            }

            this.mqttClient.publish(topic, payload, options, (err) => {
                if (err) {
                    this.logger.error(`Failed to publish to ${topic}: ${err.message}`)
                    reject(err)
                } else {
                    this.logger.info(`Successfully published to ${topic}`)
                    resolve()
                }
            })
        })
    }

    /**
     * Checks if the MQTT client is currently connected.
     * @returns {boolean} True if connected, false otherwise.
     */
    isConnected() {
        return this.mqttClient.connected
    }
}

export default MqttPublisher
