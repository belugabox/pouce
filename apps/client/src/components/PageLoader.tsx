import { Center, Loader } from '@mantine/core';

/** Chargement d'une page, au milieu de l'écran. */
export const PageLoader = () => (
    <Center h="60dvh">
        <Loader />
    </Center>
);
