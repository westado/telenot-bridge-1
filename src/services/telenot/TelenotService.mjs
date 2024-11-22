import config from '../../config/config.mjs'
import StateManager from './StateManager.mjs'
import CommandHandler from './CommandHandler.mjs'
import SocketManager from '../socket/SocketManager.mjs'
import SocketHandler from '../socket/SocketHandler.mjs'
import VirtualStateHandler from './VirtualStateHandler.mjs'

/**
 * Handles communication between Telenot and MQTT including state and command handling.
 */
class Telenot {
    /**
     * Constructs a new Telenot instance, initializing the logger, MQTT handler,
     * and related managers and handlers.
     *
     * @param {Object} logger - The logger object for logging messages.
     * @param {Object} mqttHandler - The MQTT handler for managing MQTT connections.
     */
    constructor(logger, mqttHandler) {
        this.logger = logger
        this.mqttHandler = mqttHandler

        // Initialize managers and handlers in correct order
        this.virtualStateHandler = new VirtualStateHandler(logger)
        this.stateManager = new StateManager(logger, mqttHandler)
        this.socketManager = new SocketManager(logger, config)
        this.socketHandler = new SocketHandler(
            logger,
            this,
            this.socketManager,
            this.virtualStateHandler,
        )
        this.commandHandler = new CommandHandler(logger, this, this.virtualStateHandler)

        this.isInitialized = false
    }

    /**
     * Initializes the Telenot system, setting up MQTT and socket connections.
     * This method is idempotent and will not re-initialize the system if it has
     * already been initialized. If initialization fails, an error is thrown.
     */
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Telenot is already initialized. Skipping initialization.')
            return
        }

        try {
            await this.setupConnections()
            this.isInitialized = true
            this.logger.info('Telenot initialized successfully')
        } catch (error) {
            this.logger.error(`Failed to initialize Telenot: ${error.message}`)
            throw error
        }
    }

    /**
     * Sets up MQTT and socket connections, including message handlers.
     * This method is called by `init()` and should not be called directly.
     * @private
     * @returns {Promise<void>}
     */
    async setupConnections() {
        const { publishTopic, commandTopic } = config.Connection.mqttConfig

        // Setup MQTT
        await Promise.all([
            this.mqttHandler.subscribe(publishTopic),
            this.mqttHandler.subscribe(commandTopic),
        ])

        // Setup MQTT message handlers
        this.mqttHandler.removeAllListeners()
        this.mqttHandler.onMessage((topic, msg) => {
            if (topic === publishTopic) {
                this.logger.verbose('Publishing current states...')
                this.stateManager.publishAlarmState()
            } else if (topic === commandTopic) {
                this.commandHandler.handleCommand(msg)
            }
        })

        // Setup Socket
        this.socketManager.createConnection(
            (data) => this.socketHandler.handleData(data),
            (error) => this.logger.error(`Socket error: ${error}`),
            () => this.logger.info('Socket connection closed'),
        )

        // Publish initial alarm state
        await this.stateManager.publishAlarmState()
    }

    /**
     * Decodes a hex string and updates the state manager.
     * @param {string} hex - The hex string to decode.
     * @param {string} contentName - The name of the content area.
     * @private
     */
    decodeHex(hex, contentName) {
        const contentConfig = config.Telenot[contentName]
        if (!contentConfig) {
            this.logger.error(`Unknown content name: ${contentName}`)
            return
        }

        const parts = [...hex.slice(contentConfig.offset)]
        const byteMap = new Map(parts.map((value, index) => [index, value]))

        this.stateManager.handleStateChange(byteMap, contentName, contentConfig)
    }

    /**
     * Sends a command to the Telenot system.
     * @param {string} command - The command to send, as a hex string.
     * @param {string} [action='Command'] - The action to log when sending the command.
     * @returns {Promise<void>} Resolves when the command is sent successfully, rejects if there is an error.
     * @throws {Error} If the command is invalid or the socket is not connected.
     */
    sendCommand(command, action = 'Command') {
        this.logger.debug(`Attempting to send command: ${command} for action: ${action}`)

        if (!command) {
            this.logger.warn(`Cannot send command: Invalid command generated for ${action}`)
            return Promise.reject(new Error(`Invalid command generated for ${action}`))
        }

        if (!this.socketManager.getConnectionStatus()) {
            this.logger.error('Cannot send command: Socket is not connected')
            return Promise.reject(new Error('Socket is not connected'))
        }

        this.logger.info(`Sending ${action}: ${command}`)

        return this.socketManager
            .sendData(Buffer.from(this.hexToBytes(command)))
            .then(() => {
                this.logger.info(`${action} sent successfully: ${command}`)
            })
            .catch((error) => {
                this.logger.error(`Failed to send ${action}: ${error.message}`)
                throw error // Ensure the error propagates
            })
    }

    /**
     * Creates a command message to be sent to the Telenot system.
     * @param {number} address - The address of the area to control.
     * @param {string} baseHex - The base hex code for the command.
     * @param {string} commandHex - The hex code for the specific command.
     * @returns {string} The fully formed command message as a hex string.
     * @throws {Error} If the address is invalid (not between 1 and 8).
     */
    createCommandMessage(address, baseHex, commandHex) {
        if (address < 1 || address > 8) {
            this.logger.error('Invalid parameter(s) for SB area')
            return 'error'
        }

        const hex = (baseHex + address * 8).toString(16)
        let msg = `${config.Telenot.COMMAND_SB_STATE_ON}0${hex}02${commandHex}`
        msg = `${msg}${this.calculateChecksum(msg)}16`

        return msg
    }

    /**
     * Calculates the checksum for a given message.
     * The checksum is the sum of all bytes (excluding the first 8 bytes) in the message,
     * represented as a two-digit hexadecimal number.
     * If the message is empty, returns '00'.
     * @param {string} message - The message to calculate the checksum for.
     * @returns {string} The calculated checksum as a two-digit hexadecimal number.
     */
    calculateChecksum(message) {
        if (!message) {
            return '00' // or handle it as appropriate
        }

        return message
            .slice(8)
            .match(/.{1,2}/g)
            .reduce((sum, byte) => sum + parseInt(byte, 16), 0)
            .toString(16)
            .slice(-2)
    }

    /**
     * Converts a hexadecimal string into a byte array.
     * @param {string} hex - The hexadecimal string to convert.
     * @returns {Array<number>} The byte array representation of the hex string.
     */
    hexToBytes(hex) {
        return hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    }

    /**
     * Sends a disarm command to the Telenot system for a specified area.
     * @param {number} address - The address of the area to disarm.
     */
    disarmArea(address) {
        this.sendCommand(this.createCommandMessage(address, 1320, 'E1'), 'disarmArea')
    }

    /**
     * Sends an internal arm command to the Telenot system for a specified area.
     * @param {number} address - The address of the area to internally arm.
     */
    intArmArea(address) {
        this.sendCommand(this.createCommandMessage(address, 1321, '62'), 'intArmArea')
    }

    /**
     * Sends an external arm command to the Telenot system for a specified area.
     * @param {number} address - The address of the area to externally arm.
     */
    extArmArea(address) {
        this.sendCommand(this.createCommandMessage(address, 1322, '61'), 'extArmArea')
    }

    /**
     * Sends a reset command to the Telenot system for a specified area.
     * @param {number} address - The address of the area to reset.
     */
    resetArmArea(address) {
        this.sendCommand(this.createCommandMessage(address, 1323, '52'), 'resetArmArea')
    }
}

export default Telenot
