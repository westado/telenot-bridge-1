import config from '../../config/config.mjs'

/**
 * Handles Telenot sensor states and their changes.
 */
class StateManager {
    /**
     * Constructs a new StateManager instance.
     * @param {Object} logger - The logger object for logging messages.
     * @param {Object} mqttHandler - The MQTT handler for publishing messages.
     */
    constructor(logger, mqttHandler) {
        this.logger = logger
        this.mqttHandler = mqttHandler
        this.statesPrevious = new Map()
        this.lastPublishedStates = new Map()
        this.initialStatePublished = false
        this.config = config
    }

    /**
     * Reverses the binary representation of a number.
     * @param {number} num The number to reverse.
     * @returns {string} The reversed binary string.
     */
    static reverseBinary(num) {
        return num.toString(2).padStart(8, '0').split('').reverse().join('')
    }

    /**
     * Maps a binary value ('0' or '1') to a human-readable 'ON' or 'OFF' string.
     * If the value is '0' and inverted is true, or if the value is '1' and inverted is false,
     * the function returns 'ON', otherwise it returns 'OFF'.
     * @param {string} value - The binary value to map.
     * @param {boolean} inverted - Whether to invert the mapping.
     * @returns {string} The mapped value ('ON' or 'OFF').
     */
    static mapBinaryValue(value, inverted) {
        return (inverted ? value === '0' : value === '1') ? 'ON' : 'OFF'
    }

    /**
     * Handles a state change by comparing the given byteMap with the previous one,
     * and publishing state changes for each position in contentConfig.positions.
     * If the contentName is not yet known (i.e., the first state change), the function
     * will publish the initial state for all positions.
     * @param {Map<number, number>} byteMap - A Map of byte indices to byte values.
     * @param {string} contentName - The name of the content area.
     * @param {Object} contentConfig - The configuration for the content area.
     */
    async handleStateChange(byteMap, contentName, contentConfig) {
        const prevMap = this.statesPrevious.get(contentName) || new Map()

        if (!this.statesPrevious.has(contentName)) {
            this.statesPrevious.set(contentName, new Map(byteMap))
            await this.publishPositionStates(byteMap, contentConfig.positions, contentName)
            return
        }

        for (const [byteIndex, byteValue] of byteMap) {
            if (prevMap.get(byteIndex) !== byteValue) {
                await this.processStateChanges(
                    byteValue,
                    prevMap.get(byteIndex) || 0,
                    byteIndex,
                    contentConfig.positions,
                    contentName,
                )
            }
        }

        this.statesPrevious.set(contentName, new Map(byteMap))
    }

    /**
     * Processes state changes by comparing the new and old byte values,
     * and publishes state changes for relevant positions where differences
     * are detected.
     *
     * @param {number} newValue - The new byte value.
     * @param {number} oldValue - The previous byte value.
     * @param {number} byteIndex - The index of the byte being processed.
     * @param {Array<Object>} positions - The list of positions to check for state changes.
     * @param {string} contentName - The name of the content area.
     */
    async processStateChanges(newValue, oldValue, byteIndex, positions, contentName) {
        const newBinary = StateManager.reverseBinary(newValue)
        const oldBinary = StateManager.reverseBinary(oldValue)

        const relevantPositions = positions.filter((pos) => {
            const posIndex = parseInt(pos.hex, 16)
            return posIndex >= byteIndex * 8 && posIndex < (byteIndex + 1) * 8
        })

        for (const position of relevantPositions) {
            const bitIndex = parseInt(position.hex, 16) % 8
            if (newBinary[bitIndex] !== oldBinary[bitIndex]) {
                await this.publishState(
                    position,
                    newBinary[bitIndex],
                    byteIndex,
                    bitIndex,
                    contentName,
                )
            }
        }
    }

    /**
     * Publishes the state change and handles discovery logging if enabled.
     * @param {Object} position - The position object from config.
     * @param {string} bitValue - The new bit value ('0' or '1').
     * @param {number} byteIndex - The index of the byte.
     * @param {number} bitIndex - The index of the bit.
     * @param {string} contentName - The name of the content area.
     */
    async publishState(position, bitValue, byteIndex, bitIndex, contentName) {
        const state = StateManager.mapBinaryValue(bitValue, position.inverted)
        if (this.lastPublishedStates.get(position.topic) === state) {
            return
        }

        // Check if the position is **unknown** (i.e., lacks a defined name)
        const isUnknown = !position.name

        if (this.config.Discover && isUnknown) {
            this.logger.discover('--- Discovery Detection ---')
            this.logger.discover(
                `${contentName} - Byte:${byteIndex} Bit:${bitIndex} Position:${position.hex}: Hex:0x${Number(position.hex).toString(16)} Old: ${this.getPreviousBit(contentName, byteIndex, bitIndex)} - New: ${bitValue}`,
            )
        }

        // Proceed to publish only if property is defined and has a name
        if (position.name) {
            const payload = {
                id: `${position.name.toLowerCase().replace(/\s+/g, '_')}_${position.hex}`,
                name: position.name_ha,
                type: position.type,
                state,
                location: position.location,
                last_triggered: new Date().toISOString(),
            }

            try {
                await this.mqttHandler.publish(position.topic, JSON.stringify(payload), {
                    retain: true,
                })

                const formattedPayload = JSON.stringify(payload, null, 2)
                    .split('\n')
                    .map((line) => `\x1b[33m${line}\x1b[0m`)
                    .join('\n')

                this.logger.info(
                    `\x1b[36mPublished state change:\x1b[0m\n` +
                        `\x1b[36mTopic:\x1b[0m \x1b[35m${position.topic}\x1b[0m\n` +
                        `\x1b[36mPayload:\x1b[0m\n${formattedPayload}`,
                )

                this.lastPublishedStates.set(position.topic, state)
            } catch (error) {
                this.logger.error(`\x1b[31mFailed to publish ${position.topic}:\x1b[0m ${error}`)
            }
        }
    }

    /**
     * Retrieves the previous bit value for logging.
     * @param {string} contentName - The content area name.
     * @param {number} byteIndex - The byte index.
     * @param {number} bitIndex - The bit index.
     * @returns {string} The previous bit value ('0', '1', or 'N/A').
     */
    getPreviousBit(contentName, byteIndex, bitIndex) {
        const prevValue = this.statesPrevious.get(contentName)?.get(byteIndex)
        if (prevValue === undefined) {
            return 'N/A'
        }
        const prevBinary = StateManager.reverseBinary(prevValue)
        return prevBinary[bitIndex] !== undefined ? prevBinary[bitIndex] : 'N/A'
    }

    /**
     * Publishes state changes for all positions based on the given byte map.
     * @param {Map<number, number>} byteMap - The byte map to publish state changes from.
     * @param {Array<Object>} positions - The list of positions to check for state changes.
     * @param {string} contentName - The name of the content area.
     */
    async publishPositionStates(byteMap, positions, contentName) {
        for (const position of positions) {
            const byteIndex = Math.floor(parseInt(position.hex, 16) / 8)
            const bitIndex = parseInt(position.hex, 16) % 8
            const byteValue = byteMap.get(byteIndex)

            if (byteValue !== undefined) {
                const binaryStr = StateManager.reverseBinary(byteValue)
                if (binaryStr[bitIndex] !== undefined) {
                    await this.publishState(
                        position,
                        binaryStr[bitIndex],
                        byteIndex,
                        bitIndex,
                        contentName,
                    )
                }
            }
        }
    }

    /**
     * Publishes the current alarm state to the MQTT state topic.
     * @fires StateManager#log
     */
    async publishAlarmState() {
        const stateTopic = this.config.Connection.mqttConfig.stateTopic
        const currentState = this.determineAlarmState()

        this.logger.info(`\x1b[33mPublishing state: ${currentState} to ${stateTopic}\x1b[0m`)
        await this.mqttHandler.publish(stateTopic, currentState, {
            retain: true,
        })
    }

    /**
     * Determines the current alarm state from the last published states.
     * @returns {string} Either 'DISARMED', 'ARMED_HOME', or 'ARMED_AWAY'.
     */
    determineAlarmState() {
        if (this.lastPublishedStates.get('telenot/alarm/kg/ema_zentrale/extern_scharf') === 'ON') {
            return 'ARMED_AWAY'
        }
        if (this.lastPublishedStates.get('telenot/alarm/kg/ema_zentrale/intern_scharf') === 'ON') {
            return 'ARMED_HOME'
        }
        return 'DISARMED'
    }
}

export default StateManager
