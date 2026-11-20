import { Box, Text } from '@mantine/core';

/**
 * Clavier de saisie en bas de l'écran : touches 1 à 5 et « Effacer », de
 * la couleur de la main de la note sélectionnée.
 */
export const FingerDock = ({
    hand,
    hint,
    onPick,
}: {
    hand: 'rh' | 'lh' | null;
    hint: string;
    onPick: (finger: number) => void;
}) => (
    <Box
        id="dock"
        data-hand={hand ?? ''}
        pos="fixed"
        left={0}
        right={0}
        bottom={0}
        px={12}
        pt={10}
        bg="var(--mantine-color-default)"
        style={{
            zIndex: 8,
            borderTop: '1px solid var(--mantine-color-default-border)',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
    >
        <Box maw={560} mx="auto">
            <Text
                fz="sm"
                c="dimmed"
                ta="center"
                mb={8}
                mih="1.4em"
                aria-live="polite"
            >
                {hint}
            </Text>
            <Box
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr) 1.1fr',
                    gap: 6,
                }}
            >
                {[1, 2, 3, 4, 5].map((finger) => (
                    <button
                        key={finger}
                        type="button"
                        className="pouce-key"
                        disabled={!hand}
                        onClick={() => onPick(finger)}
                    >
                        {finger}
                    </button>
                ))}
                <button
                    type="button"
                    className="pouce-key erase"
                    disabled={!hand}
                    onClick={() => onPick(0)}
                >
                    Effacer
                </button>
            </Box>
        </Box>
    </Box>
);
