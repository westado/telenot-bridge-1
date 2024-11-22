const TOPIC_PREFIX = 'telenot/alarm/eg'

const eg = {
    meldegruppen: [
        {
            hex: '0x075',
            name: 'IM Essen',
            name_ha: 'Bewegungsmelder',
            type: 'bewegungsmelder',
            topic: `${TOPIC_PREFIX}/esszimmer/bewegung`,
            location: 'Esszimmer',
            inverted: true,
        },
        {
            hex: '0x071',
            name: 'MK Fenster Essen',
            name_ha: 'Magnetkontakt Fenster (Links)',
            type: 'magnetkontakt',
            topic: `${TOPIC_PREFIX}/esszimmer/fenster_links`,
            location: 'Esszimmer',
            inverted: true,
        },
        {
            hex: '0x074',
            name: 'MK Fenster Essen',
            name_ha: 'Magnetkontakt Fenster (Mitte)',
            type: 'magnetkontakt',
            topic: `${TOPIC_PREFIX}/esszimmer/fenster_mitte`,
            location: 'Esszimmer',
            inverted: true,
        },
        {
            hex: '0x076',
            name: 'MK Fenster Essen',
            name_ha: 'Magnetkontakt Fenster (Rechts)',
            type: 'magnetkontakt',
            topic: `${TOPIC_PREFIX}/esszimmer/fenster_rechts`,
            location: 'Esszimmer',
            inverted: true,
        },
        {
            hex: '0x111',
            name: 'SK Tuer EG',
            name_ha: 'Schliesskontakt Tür',
            type: 'schliesskontakt',
            topic: `${TOPIC_PREFIX}/eingang/schliesskontakt`,
            location: 'Eingang',
            inverted: true,
        },
    ],
}

export default eg
