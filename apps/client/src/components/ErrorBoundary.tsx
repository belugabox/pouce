import { Box, Button, Group, Text, Title } from '@mantine/core';
import { Component, type ReactNode } from 'react';

/**
 * Module de la page introuvable : l'onglet tourne sur une ancienne version
 * (le service worker en a installé une nouvelle et vidé l'ancien cache).
 */
export const isStaleChunk = (error: unknown) =>
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|Failed to fetch module/i.test(
        error.message,
    );

const RELOAD_KEY = 'pouce:reloaded';

/**
 * Recharge la page pour prendre la nouvelle version, une seule fois par
 * minute : si le fichier manque encore, on montre l'erreur au lieu de
 * recharger en boucle.
 */
const reloadOnce = () => {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last < 60_000) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
        return false;
    }
    window.location.reload();
    return true;
};

interface State {
    error: unknown;
}

interface Props {
    children: ReactNode;
    /** Adresse : en changer efface l'erreur (retour arrière). */
    resetKey: string;
}

/**
 * Erreur au rendu d'une page : un message et de quoi repartir, au lieu
 * d'un écran blanc. Elle reste montée d'une page à l'autre : une erreur
 * levée en quittant une page (nettoyage d'un effet) l'atteint aussi.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: unknown): State {
        return { error };
    }

    componentDidUpdate(previous: Props) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    componentDidCatch(error: unknown) {
        console.error(error);
        if (isStaleChunk(error)) reloadOnce();
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        const stale = isStaleChunk(error);
        return (
            <Box p="xl" maw={520} mx="auto" ta="center" role="alert">
                <Title order={1} fz="h2" mt="xl" mb="sm">
                    {stale
                        ? 'Une nouvelle version de Pouce est arrivée'
                        : 'Quelque chose s’est mal passé'}
                </Title>
                <Text c="dimmed" mb="lg">
                    {stale
                        ? 'Recharge la page pour l’utiliser.'
                        : 'Tes doigtés sont gardés sur cet appareil. Recharge la page, ou reviens à la recherche.'}
                </Text>
                <Group justify="center">
                    <Button onClick={() => window.location.reload()}>
                        Recharger
                    </Button>
                    {/* Lien ordinaire : repart d'une page neuve. */}
                    <Button component="a" href="/" variant="default">
                        Revenir à la recherche
                    </Button>
                </Group>
            </Box>
        );
    }
}
