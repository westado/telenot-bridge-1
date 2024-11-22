const TOPIC_PREFIX = 'telenot/alarm/og'

const og = {
    meldegruppen: [
        {
            hex: '0x08B',
            name: 'IM Flur',
            name_ha: 'Bewegungsmelder',
            type: 'bewegungsmelder',
            topic: `${TOPIC_PREFIX}/flur/bewegung`,
            location: 'Flur',
            inverted: true,
        },
        {
            hex: '0x088',
            name: 'MK Fenster Flur OG',
            name_ha: 'Magnetkontakt Fenster',
            type: 'magnetkontakt',
            topic: `${TOPIC_PREFIX}/flur/fenster`,
            location: 'Flur',
            inverted: true,
        },
        {
            hex: '0x092',
            name: 'RM Flur',
            name_ha: 'Rauchmelder',
            type: 'rauchmelder',
            topic: `${TOPIC_PREFIX}/flur/rauchmelder`,
            location: 'Flur',
            inverted: true,
        },
    ],
}

export default og
