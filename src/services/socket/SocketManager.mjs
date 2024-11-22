import net from 'net'

/**
 * Manages socket connections for communication with a TCP converter.
 */
class SocketManager {
    /**
     * Creates a new SocketManager instance.
     * @param {Object} logger - The logger object for logging messages.
     * @param {Object} config - The configuration object containing connection details.
     * @throws {Error} If the config object is invalid.
     */
    constructor(logger, config) {
        if (!config?.Connection?.telnetConfig) {
            throw new Error('Invalid config: missing Connection.telnetConfig')
        }

        this.logger = logger
        this.config = config
        this.socket = null
        this.isConnected = false
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectInterval = 5000 // 5 seconds
        this.reconnectTimeout = null // Store the timeout handle for reconnection
    }

    /**
     * Creates a new socket connection.
     * @param {function} onData - Callback function for data events.
     * @param {function} onError - Callback function for error events.
     * @param {function} onClose - Callback function for close events.
     * @returns {net.Socket} The created socket.
     */
    createConnection(onData = () => {}, onError = () => {}, onClose = () => {}) {
        const socket = new net.Socket()
        const { port, host } = this.config.Connection.telnetConfig

        socket.connect(port, host, () => {
            this.logger.info(`Connected to TCP converter at ${host}:${port}`)
            this.isConnected = true
            this.reconnectAttempts = 0
        })

        socket.on('data', onData)
        socket.on('error', (error) => {
            this.isConnected = false
            onError(error)
            this.handleReconnect()
        })
        socket.on('close', () => {
            this.isConnected = false
            onClose()
            this.handleReconnect()
        })

        socket.setTimeout(15000)
        socket.on('timeout', () => {
            this.logger.warn('Socket connection timed out. Ending connection...')
            this.isConnected = false
            socket.end()
            this.handleReconnect()
        })

        this.socket = socket
        return socket
    }

    /**
     * Handles reconnection attempts.
     * @private
     */
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            this.logger.info(
                `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
            )

            // Clear any existing timeout before setting a new one
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout)
            }

            // Store the timeout handle
            this.reconnectTimeout = setTimeout(() => {
                this.createConnection(
                    () => {},
                    () => {},
                    () => {},
                )
            }, this.reconnectInterval)
        } else {
            this.logger.error(
                'Max reconnection attempts reached. Please check the connection manually.',
            )
        }
    }

    /**
     * Sends data through the socket.
     * @param {Buffer|string} data - The data to send.
     * @returns {Promise<void>} A promise that resolves when the data is sent, or rejects on error.
     */
    sendData(data) {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.isConnected) {
                reject(new Error('Socket is not connected'))
                return
            }
            // Ensure data is a Buffer for consistent hex conversion
            const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data)

            this.socket.write(bufferData, (err) => {
                if (err) {
                    this.logger.error(`Error writing data to socket: ${err}`)
                    reject(err)
                } else {
                    this.logger.debug(
                        `Data successfully written to socket: ${bufferData.toString('hex')}`,
                    )
                    resolve()
                }
            })
        })
    }

    /**
     * Closes the socket connection.
     */
    closeConnection() {
        // Clear reconnect timeout if it exists
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
        }

        if (this.socket && !this.socket.destroyed) {
            this.socket.destroy()
            this.isConnected = false
            this.logger.info('Socket connection closed')
        }
    }

    /**
     * Gets the current connection status.
     * @returns {boolean} True if connected, false otherwise.
     */
    getConnectionStatus() {
        return this.isConnected
    }
}

export default SocketManager
