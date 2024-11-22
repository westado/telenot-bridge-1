import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import VirtualStateHandler from '../src/services/telenot/VirtualStateHandler.mjs'

describe('VirtualStateHandler', () => {
    let virtualStateHandler
    let mockLogger

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        }
        virtualStateHandler = new VirtualStateHandler(mockLogger)
    })

    describe('constructor', () => {
        it('should initialize with logger and default night mode false', () => {
            expect(virtualStateHandler.logger).toBe(mockLogger)
            expect(virtualStateHandler.virtualNightMode).toBe(false)
        })
    })

    describe('mapToExternalState', () => {
        it('should return armed_night when in night mode and state is armed_home', () => {
            virtualStateHandler.virtualNightMode = true
            expect(virtualStateHandler.mapToExternalState('armed_home')).toBe('armed_night')
        })

        it('should return original state when not in night mode', () => {
            expect(virtualStateHandler.mapToExternalState('armed_home')).toBe('armed_home')
            expect(virtualStateHandler.mapToExternalState('armed_away')).toBe('armed_away')
            expect(virtualStateHandler.mapToExternalState('disarmed')).toBe('disarmed')
        })

        it('should return original state for non-home states even in night mode', () => {
            virtualStateHandler.virtualNightMode = true
            expect(virtualStateHandler.mapToExternalState('armed_away')).toBe('armed_away')
            expect(virtualStateHandler.mapToExternalState('disarmed')).toBe('disarmed')
        })
    })

    describe('mapToInternalState', () => {
        it('should convert ARM_NIGHT to ARM_HOME and set night mode', () => {
            const result = virtualStateHandler.mapToInternalState('ARM_NIGHT')
            expect(result).toBe('ARM_HOME')
            expect(virtualStateHandler.virtualNightMode).toBe(true)
        })

        it('should clear night mode for non-night commands', () => {
            virtualStateHandler.virtualNightMode = true

            expect(virtualStateHandler.mapToInternalState('ARM_HOME')).toBe('ARM_HOME')
            expect(virtualStateHandler.virtualNightMode).toBe(false)

            virtualStateHandler.virtualNightMode = true
            expect(virtualStateHandler.mapToInternalState('ARM_AWAY')).toBe('ARM_AWAY')
            expect(virtualStateHandler.virtualNightMode).toBe(false)

            virtualStateHandler.virtualNightMode = true
            expect(virtualStateHandler.mapToInternalState('DISARM')).toBe('DISARM')
            expect(virtualStateHandler.virtualNightMode).toBe(false)
        })

        it('should return original command for all other commands', () => {
            expect(virtualStateHandler.mapToInternalState('ARM_HOME')).toBe('ARM_HOME')
            expect(virtualStateHandler.mapToInternalState('ARM_AWAY')).toBe('ARM_AWAY')
            expect(virtualStateHandler.mapToInternalState('DISARM')).toBe('DISARM')
        })
    })

    describe('isVirtualNightMode', () => {
        it('should return current night mode state', () => {
            expect(virtualStateHandler.isVirtualNightMode()).toBe(false)

            virtualStateHandler.virtualNightMode = true
            expect(virtualStateHandler.isVirtualNightMode()).toBe(true)

            virtualStateHandler.virtualNightMode = false
            expect(virtualStateHandler.isVirtualNightMode()).toBe(false)
        })
    })

    describe('resetVirtualModes', () => {
        it('should reset night mode to false', () => {
            virtualStateHandler.virtualNightMode = true
            virtualStateHandler.resetVirtualModes()
            expect(virtualStateHandler.virtualNightMode).toBe(false)
        })

        it('should handle multiple resets without error', () => {
            virtualStateHandler.resetVirtualModes()
            virtualStateHandler.resetVirtualModes()
            expect(virtualStateHandler.virtualNightMode).toBe(false)
        })

        it('should reset from both true and false states', () => {
            virtualStateHandler.virtualNightMode = true
            virtualStateHandler.resetVirtualModes()
            expect(virtualStateHandler.virtualNightMode).toBe(false)

            virtualStateHandler.virtualNightMode = false
            virtualStateHandler.resetVirtualModes()
            expect(virtualStateHandler.virtualNightMode).toBe(false)
        })
    })

    describe('state transitions', () => {
        it('should handle complete night mode cycle', () => {
            // Start normal (not in night mode)
            expect(virtualStateHandler.isVirtualNightMode()).toBe(false)
            expect(virtualStateHandler.mapToExternalState('armed_home')).toBe('armed_home')

            // Enable night mode
            virtualStateHandler.mapToInternalState('ARM_NIGHT')
            expect(virtualStateHandler.isVirtualNightMode()).toBe(true)
            expect(virtualStateHandler.mapToExternalState('armed_home')).toBe('armed_night')

            // Disarm from night mode
            virtualStateHandler.mapToInternalState('DISARM')
            expect(virtualStateHandler.isVirtualNightMode()).toBe(false)
            expect(virtualStateHandler.mapToExternalState('armed_home')).toBe('armed_home')
        })

        it('should handle switching from night mode to away mode', () => {
            // Enable night mode
            virtualStateHandler.mapToInternalState('ARM_NIGHT')
            expect(virtualStateHandler.isVirtualNightMode()).toBe(true)

            // Switch to away mode
            virtualStateHandler.mapToInternalState('ARM_AWAY')
            expect(virtualStateHandler.isVirtualNightMode()).toBe(false)
            expect(virtualStateHandler.mapToExternalState('armed_away')).toBe('armed_away')
        })
    })
})
