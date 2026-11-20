import { Anchor, List, Modal, Stack, Text, Title } from '@mantine/core';

const Link = ({ href, children }: { href: string; children: string }) => (
    <Anchor href={href} target="_blank" rel="noopener">
        {children}
    </Anchor>
);

/** À propos : d'où viennent les partitions, ce qui reste sur l'appareil. */
export const AboutModal = ({
    opened,
    onClose,
}: {
    opened: boolean;
    onClose: () => void;
}) => (
    <Modal opened={opened} onClose={onClose} title="À propos de Pouce" centered>
        <Stack gap="md" fz="sm">
            <Text fz="sm">
                Pouce t’aide à trouver une partition de piano libre de droits et
                à y noter tes doigtés, avec une suggestion automatique qui
                cherche l’enchaînement de doigts le moins fatigant.
            </Text>
            <div>
                <Title order={3} fz="md" mb={4}>
                    Les partitions de la bibliothèque
                </Title>
                <List spacing={4} fz="sm">
                    <List.Item>
                        Uniquement des œuvres du domaine public (compositeur
                        mort depuis plus de 70 ans) ou traditionnelles, dans des
                        versions publiées en CC0 ou dans le domaine public.
                    </List.Item>
                    <List.Item>
                        La plupart viennent de{' '}
                        <Link href="https://zenodo.org/records/15571083">
                            PDMX
                        </Link>{' '}
                        (Long et al., 2024, licence CC BY 4.0), un recueil de
                        partitions déposées sur MuseScore par leurs auteurs.
                    </List.Item>
                    <List.Item>
                        Une partition te semble protégée ou fausse ? Ouvre sa
                        fiche et signale-la : elle sera vérifiée.
                    </List.Item>
                </List>
            </div>
            <div>
                <Title order={3} fz="md" mb={4}>
                    Tes données
                </Title>
                <Text fz="sm">
                    Tes doigtés, tes réglages et les partitions que tu importes
                    restent dans ce navigateur : ils ne sont envoyés nulle part.
                    Les partitions de la bibliothèque déjà ouvertes restent
                    disponibles hors ligne.
                </Text>
            </div>
            <Text fz="xs" c="dimmed">
                Rendu des partitions :{' '}
                <Link href="https://opensheetmusicdisplay.org/">
                    OpenSheetMusicDisplay
                </Link>{' '}
                (BSD-3-Clause).
            </Text>
        </Stack>
    </Modal>
);
