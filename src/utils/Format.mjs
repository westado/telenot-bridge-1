import winston from 'winston'

/**
 * Formats a log message by colorizing lines that contain a "Topic:" identifier.
 *
 * The function splits the input message into lines and checks each line for the presence of "Topic:".
 * If found, it colorizes the "Topic:" text in magenta and the topic content in yellow.
 *
 * @param {string} message - The log message to be formatted.
 * @returns {string} - The formatted message with colorized "Topic:" lines.
 */
export default function formatMessage(message) {
    const lines = message.split('\n')
    const colorize = winston.format.colorize().colorize

    return lines
        .map((line) => {
            if (line.includes('Topic:')) {
                const [prefix, topic] = line.split('Topic:')
                return `${prefix}${colorize('magenta', 'Topic:')} ${colorize('yellow', topic.trim())}`
            }
            return line
        })
        .join('\n')
}
