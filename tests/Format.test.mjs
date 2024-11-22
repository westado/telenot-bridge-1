// tests/format.test.mjs
import { jest } from '@jest/globals'

describe('Logger Format', () => {
    let format

    beforeEach(async () => {
        const winstonMock = {
            colorize: jest.fn().mockImplementation(() => ({
                colorize: (color, text) => `${color}-${text}`,
            })),
            format: {
                colorize: () => ({
                    colorize: (color, text) => `${color}-${text}`,
                }),
            },
        }

        jest.unstable_mockModule('winston', () => ({
            __esModule: true,
            default: winstonMock,
            format: winstonMock.format,
        }))

        const formatModule = await import('../src/utils/Format.mjs')
        format = formatModule.default
    })

    it('should format Topic line correctly', () => {
        const message = 'State change published:\nTopic: test/topic'
        const result = format(message)
        expect(result).toBe('State change published:\nmagenta-Topic: yellow-test/topic')
    })
})
