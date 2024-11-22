/**
 * Handles commands for a Telenot security system.
 */
class CommandHandler {
    /**
     * Creates a new CommandHandler instance.
     * @param {Object} logger - The logger object for logging messages.
     * @param {Object} telenotService - The Telenot service for executing commands.
     * @param {Object} virtualStateHandler - The virtual state handler for managing virtual modes.
     * @throws {Error} If the telenotService is missing required methods.
     */
    constructor(logger, telenotService, virtualStateHandler) {
        if (
            !telenotService ||
            typeof telenotService.disarmArea !== 'function' ||
            typeof telenotService.intArmArea !== 'function' ||
            typeof telenotService.extArmArea !== 'function' ||
            typeof telenotService.resetArmArea !== 'function'
        ) {
            throw new Error('Invalid telenotService: missing required methods')
        }

        if (!virtualStateHandler) {
            throw new Error('VirtualStateHandler is required')
        }

        this.logger = logger
        this.telenotService = telenotService
        this.virtualStateHandler = virtualStateHandler

        /**
         * A map of command strings to their corresponding actions.
         * @type {Object.<string, function>}
         * @private
         */
        this._commandMap = {
            DISARM: () => {
                this.virtualStateHandler.resetVirtualModes()
                return this.telenotService.disarmArea(1)
            },
            ARM_HOME: () => this.telenotService.intArmArea(1),
            ARM_AWAY: () => this.telenotService.extArmArea(1),
            ARM_NIGHT: () => {
                this.virtualStateHandler.mapToInternalState('ARM_NIGHT')
                return this.telenotService.intArmArea(1)
            },
            RESET: () => this.telenotService.resetArmArea(1),
        }
    }

    /**
     * Handles a received command by executing the corresponding action.
     * @param {string} command - The command to handle.
     * @returns {boolean} True if the command was handled, false otherwise.
     */
    handleCommand(command) {
        const internalCommand = this.virtualStateHandler.mapToInternalState(command)
        const action = this._commandMap[internalCommand]

        if (action) {
            this.logger.verbose(
                `Executing command: ${command} (internal: ${internalCommand})${
                    command === 'ARM_NIGHT' ? ' [Virtual Night Mode]' : ''
                }`,
            )
            action()
            return true
        } else {
            this.logger.verbose(`Unknown command: ${command}`)
            return false
        }
    }

    /**
     * Adds a new command to the command map.
     * @param {string} commandName - The name of the command.
     * @param {function} commandFunction - The function to execute for this command.
     * @throws {Error} If the command name already exists.
     */
    addCommand(commandName, commandFunction) {
        if (this._commandMap[commandName]) {
            throw new Error(`Command ${commandName} already exists`)
        }
        this._commandMap[commandName] = commandFunction
    }
}

export default CommandHandler
