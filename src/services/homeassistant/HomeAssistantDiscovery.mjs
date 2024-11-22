// Constants
const MQTT_DISCOVERY_PREFIX = 'homeassistant'
const DEVICE_VENDOR = 'Telenot'
const REQUIRED_SENSOR_FIELDS = ['name_ha', 'type', 'topic', 'location', 'hex']

const DEVICE_CLASSES = {
    bewegungsmelder: 'motion',
    magnetkontakt: 'window',
    schliesskontakt: 'door',
    rauchmelder: 'smoke',
    wassermelder: 'moisture',
    ueberfallmelder: 'safety',
    gehaeuse: 'tamper',
    signalgeber: 'sound',
    sabotage: 'tamper',
    systemstatus: 'problem',
    sicherung: 'safety',
}

const ICONS = {
    bewegungsmelder: 'mdi:motion-sensor',
    magnetkontakt: 'mdi:window-open',
    schliesskontakt: 'mdi:door',
    rauchmelder: 'mdi:smoke-detector',
    wassermelder: 'mdi:water',
    ueberfallmelder: 'mdi:alert',
    gehaeuse: 'mdi:shield-home',
    signalgeber: 'mdi:bullhorn',
    sabotage: 'mdi:shield-alert',
    systemstatus: 'mdi:home-alert',
    sicherung: 'mdi:shield-check',
}

/**
 * Generates Home Assistant autodiscovery messages for the given sensors.
 */

class HomeAssistantDiscovery {
    constructor(logger, mqttHandler) {
        this.logger = logger
        this.mqttHandler = mqttHandler
        this.discoveryPrefix = MQTT_DISCOVERY_PREFIX
        this.deviceVendor = DEVICE_VENDOR
    }

    /**
     * Publishes Home Assistant discovery messages for the given sensors.
     *
     * @param {object[]} sensors - An array of sensor objects with the following properties:
     *   - name_ha: The name to use for the sensor in Home Assistant
     *   - type: The type of sensor (e.g. "bewegungsmelder", "rauchmelder", etc.)
     *   - topic: The MQTT topic to subscribe to for the sensor
     *   - location: The location of the sensor (e.g. "Living Room", "Kitchen", etc.)
     *   - hex: The hex code of the sensor
     *
     * @throws {Error} if discovery process fails
     */
    async publishDiscoveryMessages(sensors) {
        try {
            this.logger.info(`Starting discovery process for ${sensors.length} sensors...`)

            // Wait for initial MQTT connection
            if (!this.mqttHandler.isConnected()) {
                this.logger.info('Waiting for MQTT connection...')
                await new Promise((resolve) => setTimeout(resolve, 2000))
            }

            // Validate sensors
            const validSensors = sensors.filter((sensor) =>
                REQUIRED_SENSOR_FIELDS.every(
                    (field) => sensor[field] !== undefined && sensor[field] !== null,
                ),
            )

            if (validSensors.length !== sensors.length) {
                this.logger.warn(`Skipped ${sensors.length - validSensors.length} invalid sensors`)
            }

            // Group sensors by location
            const sensorsByLocation = validSensors.reduce((acc, sensor) => {
                if (!acc[sensor.location]) {
                    acc[sensor.location] = []
                }
                acc[sensor.location].push(sensor)
                return acc
            }, {})

            this.logger.info(`Found ${Object.keys(sensorsByLocation).length} locations to process`)

            // Process each location
            for (const [location, locationSensors] of Object.entries(sensorsByLocation)) {
                const deviceId = this.generateDeviceId(location)
                this.logger.info(
                    `Processing location: ${location} (${locationSensors.length} sensors) [Device ID: ${deviceId}]`,
                )

                const device = {
                    identifiers: [deviceId],
                    name: location,
                    model: 'Telenot Alarm System',
                    manufacturer: this.deviceVendor,
                    suggested_area: location,
                    hw_version: 'complex_system',
                    via_device: 'telenot_zentrale',
                }

                // Publish each sensor for this location
                for (const sensor of locationSensors) {
                    const entityId = this.generateEntityId(sensor)
                    const discoveryTopic = `${this.discoveryPrefix}/binary_sensor/telenot/${entityId}/config`

                    this.logger.info(
                        `  └─ Publishing entity: "${sensor.name_ha}" (${sensor.type}) for location "${location}"`,
                    )
                    this.logger.debug(`     ├─ Entity ID: ${entityId}`)
                    this.logger.debug(`     ├─ Topic: ${discoveryTopic}`)
                    this.logger.debug(`     └─ State Topic: ${sensor.topic}`)

                    const payload = {
                        name: sensor.name_ha,
                        unique_id: entityId,
                        device_class: DEVICE_CLASSES[sensor.type.toLowerCase()] || 'None',
                        state_topic: sensor.topic,
                        value_template: '{{ value_json.state }}',
                        payload_on: 'ON',
                        payload_off: 'OFF',
                        icon: ICONS[sensor.type.toLowerCase()] || 'mdi:help-circle',
                        json_attributes_topic: sensor.topic,
                        json_attributes_template: '{{ value_json | tojson }}',
                        device,
                        enabled_by_default: true,
                    }

                    try {
                        await this.mqttHandler.publish(discoveryTopic, JSON.stringify(payload), {
                            retain: true,
                        })
                    } catch (error) {
                        this.logger.error(
                            `     ⚠ Failed to publish sensor ${sensor.name_ha}:`,
                            error,
                        )
                        continue
                    }
                }

                this.logger.info(`✓ Completed location: ${location}`)
            }

            this.logger.info('===========================================')
            this.logger.info('Discovery process completed successfully')
            this.logger.info(`Total locations processed: ${Object.keys(sensorsByLocation).length}`)
            this.logger.info(`Total sensors processed: ${validSensors.length}`)
            this.logger.info('===========================================')
        } catch (error) {
            this.logger.error('Discovery process failed:', error)
            throw error
        }
    }

    /**
     * Generate a Home Assistant device ID from a location name.
     *
     * @param {string} location - The location name
     * @returns {string} The generated device ID
     *
     * The generated device ID is in the format `telenot_<location>`, where
     * `<location>` is the given location name, but with all non-alphanumeric
     * characters replaced with underscores and any leading or trailing
     * underscores removed.
     */
    generateDeviceId(location) {
        return `telenot_${location
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')}`
    }

    /**
     * Generate a Home Assistant entity ID from a sensor object.
     *
     * @param {Object} sensor - The sensor object containing details.
     * @param {string} sensor.location - The location of the sensor.
     * @param {string} sensor.name_ha - The name of the sensor in Home Assistant.
     * @param {string} sensor.type - The type of the sensor.
     * @returns {string} The generated entity ID.
     *
     * The generated entity ID is in the format `<location>_<type>_<name>`, where
     * `<location>` is the cleaned location name, `<type>` is the sensor type, and
     * `<name>` is the cleaned sensor name. All non-alphanumeric characters are
     * replaced with underscores, and any leading "telenot" prefix in the name is removed.
     */
    generateEntityId(sensor) {
        const cleanLocation = (sensor.location || 'unknown')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
        const cleanName = (sensor.name_ha || 'unknown')
            .toLowerCase()
            .replace(/^telenot\s+/i, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')

        const type = sensor.type ? sensor.type.toLowerCase() : 'unknown'

        return `${cleanLocation}_${type}_${cleanName}`
    }
}

export default HomeAssistantDiscovery
