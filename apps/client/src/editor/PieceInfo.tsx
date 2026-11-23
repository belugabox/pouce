import {
    Anchor,
    Badge,
    Button,
    Divider,
    Group,
    Modal,
    Radio,
    Stack,
    Text,
    Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFlag } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import {
    type CatalogEntry,
    REPORT_REASONS,
    type ReportReason,
} from '@server/types';

import { estimateDifficulty } from '@/core/difficulty';
import type { ScoreIndex } from '@/core/musicxml';
import { reportScore } from '@/services/api';
import type { PieceSource } from '@/storage/db';

import { LEVEL_COLORS, formatDuration } from './format';

/** Ce qu'on sait d'une partition, du catalogue ou importée. */
export type PieceMeta = Pick<CatalogEntry, 'title' | 'composer'> &
    Partial<CatalogEntry> & { addedAt?: number };

const Row = ({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) => (
    <Group gap="xs" align="baseline" wrap="nowrap">
        <Text fz="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
            {label}
        </Text>
        <Text fz="sm" component="div" style={{ minWidth: 0 }}>
            {children}
        </Text>
    </Group>
);

const ReportForm = ({ id, onDone }: { id: string; onDone: () => void }) => {
    const [reason, setReason] = useState<ReportReason>('wrong');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const send = async () => {
        setSending(true);
        setError('');
        try {
            await reportScore(id, reason, message.trim());
            notifications.show({
                message: 'Merci, ton signalement est envoyé.',
            });
            onDone();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Stack gap="sm">
            <Radio.Group
                label="Quel est le problème ?"
                value={reason}
                onChange={(v) => setReason(v as ReportReason)}
            >
                <Stack gap={8} mt={6}>
                    {Object.entries(REPORT_REASONS).map(([value, label]) => (
                        <Radio key={value} value={value} label={label} />
                    ))}
                </Stack>
            </Radio.Group>
            <Textarea
                label="Précisions (facultatif)"
                placeholder="Par exemple : arrangement publié par un éditeur, notes fausses mesure 12…"
                autosize
                minRows={2}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.currentTarget.value)}
            />
            {error && (
                <Text c="red" fz="sm" role="alert">
                    {error}
                </Text>
            )}
            <Group justify="flex-end">
                <Button variant="default" onClick={onDone}>
                    Annuler
                </Button>
                <Button loading={sending} onClick={send}>
                    Envoyer
                </Button>
            </Group>
        </Stack>
    );
};

/** Fiche d'une partition : auteur, niveau, licence, source, signalement. */
export const PieceInfo = ({
    opened,
    onClose,
    piece,
    source,
    id,
    index,
}: {
    opened: boolean;
    onClose: () => void;
    piece: PieceMeta;
    source: PieceSource;
    id: string;
    index: ScoreIndex;
}) => {
    const [reporting, setReporting] = useState(false);
    // Partition importée : difficulté et durée calculées ici, à l'ouverture
    // de la fiche.
    const estimate = useMemo(
        () =>
            opened && (piece.difficulty == null || piece.duration == null)
                ? estimateDifficulty(index)
                : null,
        [opened, piece.difficulty, piece.duration, index],
    );
    const level = piece.level ?? estimate?.level;
    const difficulty = piece.difficulty ?? estimate?.score;
    const duration = piece.duration ?? estimate?.features.duration;
    const measures = piece.measures ?? estimate?.features.measures;
    const fromPdmx = piece.source === 'pdmx';

    return (
        <Modal
            opened={opened}
            onClose={() => {
                setReporting(false);
                onClose();
            }}
            title={piece.title}
            centered
        >
            <Stack gap="sm">
                <Row label="Compositeur">
                    {source === 'catalogue' && piece.composer ? (
                        <Anchor
                            component={Link}
                            to={`/?q=${encodeURIComponent(piece.composer)}`}
                            title="Ses autres partitions dans la bibliothèque"
                        >
                            {piece.composer}
                        </Anchor>
                    ) : (
                        piece.composer || 'Inconnu'
                    )}
                </Row>
                {piece.arranger && (
                    <Row label="Arrangement">{piece.arranger}</Row>
                )}
                {level && (
                    <Row label="Niveau">
                        <Group gap={8}>
                            <Badge
                                variant="light"
                                color={LEVEL_COLORS[level]}
                                tt="none"
                            >
                                {level}
                            </Badge>
                            {difficulty != null && (
                                <span>{difficulty.toFixed(1)} sur 10</span>
                            )}
                        </Group>
                    </Row>
                )}
                {duration != null && duration > 0 && (
                    <Row label="Durée">
                        environ {formatDuration(duration)}
                        {measures ? `, ${measures} mesures` : ''}
                    </Row>
                )}
                {source === 'catalogue' ? (
                    <>
                        <Row label="Licence">
                            {piece.licenseUrl ? (
                                <Anchor
                                    href={piece.licenseUrl}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {piece.license}
                                </Anchor>
                            ) : (
                                piece.license
                            )}
                        </Row>
                        <Row label="Source">
                            {fromPdmx ? (
                                <>
                                    Partition déposée sur{' '}
                                    {piece.sourceUrl ? (
                                        <Anchor
                                            href={piece.sourceUrl}
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            MuseScore
                                        </Anchor>
                                    ) : (
                                        'MuseScore'
                                    )}
                                    , recueillie par{' '}
                                    <Anchor
                                        href="https://zenodo.org/records/15571083"
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        PDMX
                                    </Anchor>{' '}
                                    (CC BY 4.0)
                                </>
                            ) : (
                                'Catalogue de Pouce'
                            )}
                        </Row>
                    </>
                ) : (
                    <Row label="Source">
                        Importée sur cet appareil
                        {piece.addedAt
                            ? ` le ${new Date(piece.addedAt).toLocaleDateString('fr-FR')}`
                            : ''}
                        . Elle n’est envoyée nulle part.
                    </Row>
                )}
                <Text fz="xs" c="dimmed">
                    Niveau estimé d’après les notes : vitesse, accords, écarts,
                    sauts, voix, et l’effort du meilleur doigté trouvé.
                </Text>
                {source === 'catalogue' && (
                    <>
                        <Divider />
                        {reporting ? (
                            <ReportForm
                                id={id}
                                onDone={() => setReporting(false)}
                            />
                        ) : (
                            <Group justify="space-between" wrap="nowrap">
                                <Text fz="sm" c="dimmed">
                                    Droits douteux, notes fausses ?
                                </Text>
                                <Button
                                    variant="default"
                                    leftSection={<IconFlag size={16} />}
                                    onClick={() => setReporting(true)}
                                >
                                    Signaler
                                </Button>
                            </Group>
                        )}
                    </>
                )}
            </Stack>
        </Modal>
    );
};
