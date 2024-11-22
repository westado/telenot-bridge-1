/**
 * Create a virtual state "armed_night" for Telenot to be consumed by HomeAsssistant.
 */
class VirtualStateHandler {
    /**
     * Creates a new VirtualStateHandler instance.
     * @param {Object} logger - The logger object for logging messages.
     */
    constructor(logger) {
        this.logger = logger
        this.virtualNightMode = false
    }

    mapToExternalState(internalState) {
        if (internalState === 'armed_home' && this.virtualNightMode) {
            return 'armed_night'
        }
        return internalState
    }

    mapToInternalState(command) {
        if (command === 'ARM_NIGHT') {
            this.virtualNightMode = true
            return 'ARM_HOME'
        }

        this.virtualNightMode = false
        return command
    }

    isVirtualNightMode() {
        return this.virtualNightMode
    }

    resetVirtualModes() {
        this.virtualNightMode = false
    }
}

export default VirtualStateHandler
