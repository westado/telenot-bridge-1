import ema from './locations/ema.mjs'
import eg from './locations/eg.mjs'
import og from './locations/og.mjs'

const config = {
    LogLevel: process.env.LOGLEVEL || 'debug',
    Connection: {
        mqttConfig: {
            broker: process.env.MQTTHOST || 'mqtt://localhost',
            port: parseInt(process.env.MQTTPORT, 10) || 1883,
            username: process.env.MQTTUSER || '',
            password: process.env.MQTTPASSWORD || '',
            publishTopic: process.env.PUBLISHTOPIC || 'telenot/alarm',
            commandTopic: process.env.COMMANDTOPIC || 'telenot/alarm/command',
            stateTopic: process.env.STATETOPIC || 'telenot/alarm/state',
            statusTopic: 'telenot/alarm/status',
            diagnosticsTopic: 'telenot/alarm/diagnostics',
            use_json_payload: process.env.USE_JSON_PAYLOAD === 'true',
        },
        telnetConfig: {
            host: process.env.TELNETHOST || 'localhost',
            port: parseInt(process.env.TELNETPORT, 10) || 1234,
        },
    },
    Discover: process.env.DISCOVER === 'true',
    homeassistant_autodiscovery: process.env.HOMEASSISTANT_AUTODISCOVERY === 'true',
    Telenot: {
        COMMAND_SB_STATE_ON: '680909687301050200',
        SICHERUNGSBEREICH: {
            name: 'SICHERUNGSBEREICH',
            offset: 10,
            positions: [...ema.sicherungsbereich],
        },
        SICHERUNGSBEREICH2: {
            name: 'SICHERUNGSBEREICH2',
            offset: 10,
            positions: [...ema.sicherungsbereich2],
        },
        MELDEBEREICHE: {
            name: 'MELDEBEREICHE',
            offset: 10,
            positions: [...ema.meldebereiche],
        },
        MELDEGRUPPEN: {
            name: 'MELDEGRUPPEN',
            offset: 12,
            positions: [...ema.meldegruppen, ...eg.meldegruppen, ...og.meldegruppen],
        },
    },
}

export default config
