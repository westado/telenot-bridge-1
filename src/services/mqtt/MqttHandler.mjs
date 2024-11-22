import mqtt from 'mqtt'
import config from '../../config/config.mjs'
import MqttPublisher from './MqttPublisher.mjs'

/**
 * Handles MQTT connections, subscriptions, and message handling.
 */
class MqttHandler {
    /**
     * Creates a new MqttHandler instance.
     * @param {Object} logger - The logger object for logging messages.
     */
    constructor(logger) {
        this.mqttClient = null
        this.logger = logger
        this._isConnected = false
        this.reconnectTimer = null
        this.mqttReconnectAttempts = 0
        this.maxMqttReconnectAttempts = 10
        this.telenot = null
        this.mqttPublisher = null
        this.messageListeners = []
        this.connectionPromise = null
        this.reconnectInProgress = false
    }

    /**
     * Initializes the MQTT handler.
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.connect()
        this.mqttPublisher = new MqttPublisher(this.mqttClient, this.logger)
        await this.subscribeToCommandTopic()
        this.setupReconnection()
    }

    /**
     * Connects to the MQTT broker.
     * @returns {Promise<void>}
     */
    connect() {
        if (this._isConnected) {
            this.logger.debug('Already connected to MQTT broker')
            return Promise.resolve()
        }

        if (this.connectionPromise) {
            return this.connectionPromise
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            const { broker, port, clientId, username, password, publishTopic } =
                config.Connection.mqttConfig
            const url = `${broker}:${port}`

            this.mqttClient = mqtt.connect(url, {
                clientId,
                username,
                password,
                clean: true,
                reconnectPeriod: 5000,
                connectTimeout: 30000,
                keepalive: 60,
                qos: 1,
                will: {
                    topic: `${publishTopic}/status`,
                    payload: 'offline',
                    qos: 1,
                    retain: true,
                },
            })

            this.mqttClient.on('connect', () => {
                this._isConnected = true
                this.mqttReconnectAttempts = 0
                this.reconnectInProgress = false
                this.logger.info('Connected to MQTT broker')
                // Publish online status
                this.mqttClient.publish(`${publishTopic}/status`, 'online', {
                    retain: true,
                    qos: 1,
                })
                resolve()
            })

            this.mqttClient.on('error', (err) => {
                this.logger.error('Connection to MQTT broker failed', err)
                this._isConnected = false
                if (this.mqttReconnectAttempts >= this.maxMqttReconnectAttempts) {
                    this.logger.error('Max MQTT reconnection attempts reached')
                    reject(new Error('Max MQTT reconnection attempts reached'))
                }
            })

            this.mqttClient.on('close', () => {
                this._isConnected = false
                this.logger.info('MQTT connection closed')
                this.connectionPromise = null
                if (!this.reconnectInProgress) {
                    this.handleReconnection()
                }
            })

            this.mqttClient.on('offline', () => {
                this._isConnected = false
                this.logger.warn('MQTT client is offline')
                this.connectionPromise = null
                if (!this.reconnectInProgress) {
                    this.handleReconnection()
                }
            })
        })

        return this.connectionPromise
    }

    /**
     * Manages the reconnection process to the MQTT broker if the connection is lost.
     * The function will attempt to reconnect until the connection is established or
     * the maximum number of reconnection attempts is reached. It ensures that only
     * one reconnection process is in progress at a time. Logs each reconnection
     * attempt and handles errors during the process. If the maximum attempts are
     * exceeded without success, an error is logged.
     * @async
     */
    async handleReconnection() {
        if (this.reconnectInProgress) {
            return
        }

        this.reconnectInProgress = true
        while (!this._isConnected && this.mqttReconnectAttempts < this.maxMqttReconnectAttempts) {
            try {
                this.mqttReconnectAttempts++
                this.logger.info(
                    `Attempting to reconnect to MQTT broker (${this.mqttReconnectAttempts}/${this.maxMqttReconnectAttempts})`,
                )
                await this.connect()
                if (this._isConnected) {
                    break
                }
            } catch (error) {
                this.logger.error(`Reconnection attempt failed: ${error.message}`)
            }
            await new Promise((resolve) => setTimeout(resolve, 5000))
        }

        if (!this._isConnected && this.mqttReconnectAttempts >= this.maxMqttReconnectAttempts) {
            this.logger.error('Max MQTT reconnection attempts reached')
        }

        this.reconnectInProgress = false
    }

    /**
     * Sets up reconnection handlers.
     * @private
     */
    setupReconnection() {
        this.mqttClient.on('reconnect', () => {
            this.mqttReconnectAttempts++
            this.logger.info(
                `Attempting to reconnect to MQTT broker (${this.mqttReconnectAttempts}/${this.maxMqttReconnectAttempts})`,
            )
        })
    }

    /**
     * Checks if the MQTT client is connected.
     * @returns {boolean} True if connected, false otherwise.
     */
    isConnected() {
        if (!this.mqttClient) {
            return false
        }
        return this._isConnected && this.mqttClient.connected
    }

    /**
     * Subscribes to the command topic.
     * @returns {Promise<void>}
     * @private
     */
    async subscribeToCommandTopic() {
        const commandTopic = config.Connection.mqttConfig.commandTopic
        try {
            await this.subscribe(commandTopic)
            this.onMessage((topic, message) => this.handleCommand(topic, message))
        } catch (err) {
            this.logger.error(`Failed to subscribe to command topic: ${err}`)
        }
    }

    /**
     * Subscribes to a specific MQTT topic.
     * @param {string} topic - The topic to subscribe to.
     * @returns {Promise<void>}
     */
    subscribe(topic) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('Not connected to MQTT broker'))
                return
            }
            this.mqttClient.subscribe(topic, (err) => {
                if (err) {
                    this.logger.error(`Failed to subscribe to ${topic}`, err)
                    reject(err)
                } else {
                    this.logger.info(`MQTT Handler subscribed to ${topic}`)
                    resolve()
                }
            })
        })
    }

    /**
     * Publishes a message to a specific MQTT topic.
     * @param {string} topic - The topic to publish to.
     * @param {string|Buffer} message - The message to publish.
     * @param {Object} [options={}] - Optional MQTT publish options.
     * @returns {Promise<void>}
     */
    publish(topic, message, options = {}) {
        return this.mqttPublisher.publish(topic, message, options)
    }

    /**
     * Adds a message listener.
     * @param {function} callback - The callback function to handle messages.
     */
    onMessage(callback) {
        this.messageListeners.push(callback)
        if (this.mqttClient) {
            this.mqttClient.on('message', (topic, message) => {
                this.messageListeners.forEach((listener) => listener(topic, message.toString()))
            })
        }
    }

    /**
     * Removes all message listeners.
     */
    removeAllListeners() {
        this.messageListeners = []
        if (this.mqttClient) {
            this.mqttClient.removeAllListeners('message')
        }
    }

    /**
     * Handles incoming command messages.
     * @param {string} topic - The topic of the command message.
     * @param {string} message - The command message.
     * @private
     */
    handleCommand(topic, message) {
        const commandTopic = config.Connection.mqttConfig.commandTopic
        // console.log('Topic comparison:', {
        //     receivedTopic: topic,
        //     configTopic: commandTopic,
        //     areEqual: topic === commandTopic,
        // })
        if (topic === commandTopic) {
            this.logger.info(`Received command on topic: ${commandTopic}`)
            if (this.telenot) {
                this.telenot.handleCommandMessage(message)
            } else {
                this.logger.warn('Telenot instance not set, cannot handle command')
            }
        }
    }

    /**
     * Sets the Telenot instance for command handling.
     * @param {Object} telenotInstance - The Telenot instance.
     */
    setTelenotInstance(telenotInstance) {
        this.telenot = telenotInstance
    }

    /**
     * Closes the MQTT connection.
     * @returns {Promise<void>}
     */
    async close() {
        this.logger.info('Closing MQTT connection')
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
        }
        if (this.mqttClient && this.mqttClient.connected) {
            await new Promise((resolve) => this.mqttClient.end(false, resolve))
        }
        this._isConnected = false
    }
}

export default MqttHandler
