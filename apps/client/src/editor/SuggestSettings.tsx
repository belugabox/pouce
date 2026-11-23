import {
    Button,
    Group,
    Modal,
    NumberInput,
    SegmentedControl,
    Stack,
    Text,
} from '@mantine/core';
import { useEffect, useState } from 'react';

import {
    type HandChoice,
    type HandMap,
    type StaffInfo,
    defaultHands,
} from '@/core/fingering/hands';
import type { PieceSettings } from '@/storage/db';

const CHOICES = [
    { value: '1', label: 'Main droite' },
    { value: '2', label: 'Main gauche' },
    { value: '0', label: 'Ignorée' },
];

const staffLabel = (s: StaffInfo, partNames: string[], partCount: number) => {
    const name = partNames[s.part] || `Partie ${s.part + 1}`;
    const staff = `portée ${s.staff}`;
    return partCount > 1 || s.staff > 1 || partNames[s.part]
        ? `${name}, ${staff}`
        : staff;
};

/**
 * Réglages de la suggestion : tempo de jeu (on joue souvent plus lentement
 * qu'écrit) et main de chaque portée.
 */
export const SuggestSettings = ({
    opened,
    onClose,
    settings,
    onChange,
    staves,
    partNames,
    scoreTempo,
}: {
    opened: boolean;
    onClose: () => void;
    settings: PieceSettings;
    onChange: (value: PieceSettings) => void;
    staves: StaffInfo[];
    partNames: string[];
    scoreTempo: number;
}) => {
    const defaults = defaultHands(staves);
    const [tempo, setTempo] = useState<number | string>('');
    const [hands, setHands] = useState<HandMap>({});
    const partCount = new Set(staves.map((s) => s.part)).size;

    useEffect(() => {
        if (!opened) return;
        setTempo(settings.tempo ?? Math.round(scoreTempo));
        setHands({ ...defaults, ...settings.hands });
        // Valeurs relues à chaque ouverture seulement.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened]);

    const save = () => {
        const t = Number(tempo);
        const changed = Object.fromEntries(
            Object.entries(hands).filter(([k, v]) => defaults[k] !== v),
        );
        onChange({
            tempo:
                t >= 20 && t <= 400 && Math.round(t) !== Math.round(scoreTempo)
                    ? Math.round(t)
                    : undefined,
            hands: Object.keys(changed).length ? changed : undefined,
        });
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Réglages de la suggestion"
            centered
        >
            <Stack gap="lg">
                <div>
                    <NumberInput
                        label="Tempo de jeu (♩ par minute)"
                        description={`Écrit dans la partition : ♩ = ${Math.round(scoreTempo)}. Plus lent, les déplacements de la main coûtent moins.`}
                        min={20}
                        max={400}
                        step={5}
                        value={tempo}
                        onChange={setTempo}
                    />
                </div>
                {staves.length > 0 && (
                    <Stack gap="sm">
                        <Text fw={600} fz="sm">
                            Qui joue chaque portée ?
                        </Text>
                        {staves.map((s) => (
                            <div key={s.key}>
                                <Text fz="sm" c="dimmed" mb={4}>
                                    {staffLabel(s, partNames, partCount)}
                                </Text>
                                <SegmentedControl
                                    fullWidth
                                    data={CHOICES}
                                    value={String(hands[s.key] ?? 0)}
                                    onChange={(v) =>
                                        setHands((h) => ({
                                            ...h,
                                            [s.key]: Number(v) as HandChoice,
                                        }))
                                    }
                                    aria-label={`Main pour ${staffLabel(s, partNames, partCount)}`}
                                />
                            </div>
                        ))}
                    </Stack>
                )}
                <Group justify="space-between">
                    <Button
                        variant="subtle"
                        color="gray"
                        onClick={() => {
                            setTempo(Math.round(scoreTempo));
                            setHands(defaults);
                        }}
                    >
                        Valeurs de la partition
                    </Button>
                    <Button onClick={save}>Enregistrer</Button>
                </Group>
            </Stack>
        </Modal>
    );
};
