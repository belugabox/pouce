import {
    type CSSVariablesResolver,
    type MantineColorsTuple,
    createTheme,
} from '@mantine/core';
import { useColorScheme, useLocalStorage } from '@mantine/hooks';

export type ColorScheme = 'light' | 'dark' | 'auto';

const COLOR_SCHEMES: ColorScheme[] = ['light', 'dark', 'auto'];

export const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string }[] = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'auto', label: 'Système' },
];

const isColorScheme = (value: unknown): value is ColorScheme =>
    COLOR_SCHEMES.includes(value as ColorScheme);

/** Fond de l'appli, clair et sombre (barres du système comprises). */
export const BACKGROUND = { light: '#e6ebf1', dark: '#121821' } as const;

/** Gris bleutés du prototype pour le mode sombre (Mantine : `dark`). */
const dark: MantineColorsTuple = [
    '#e7ecf3',
    '#c3cbd8',
    '#9aa6b8',
    '#6b7789',
    '#3a4657',
    '#2d3848',
    '#1b2330',
    '#121821',
    '#0d121a',
    '#080b10',
];

export const theme = createTheme({
    primaryColor: 'blue',
    colors: { dark },
    fontFamily:
        "'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', sans-serif",
    headings: {
        fontFamily:
            "'Bricolage Grotesque', 'Atkinson Hyperlegible', system-ui, sans-serif",
        fontWeight: '700',
    },
    defaultRadius: 'md',
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
    variables: {},
    light: {
        '--mantine-color-body': BACKGROUND.light,
        '--mantine-color-default': '#f7f9fb',
        '--mantine-color-default-border': '#c9d2dd',
        '--mantine-color-text': '#18202e',
        '--mantine-color-dimmed': '#5b6678',
    },
    dark: {
        '--mantine-color-body': BACKGROUND.dark,
    },
});

/** Mode de cet appareil : clair, sombre, ou celui du système. */
export const useAppearance = () => {
    const [saved, setColorScheme] = useLocalStorage<ColorScheme>({
        key: 'pouce:theme:mode',
        defaultValue: 'auto',
        getInitialValueInEffect: false,
    });
    const system = useColorScheme('light', { getInitialValueInEffect: false });
    const colorScheme = isColorScheme(saved) ? saved : 'auto';
    return {
        colorScheme,
        /** Clair ou sombre, une fois « Système » résolu. */
        resolved: colorScheme === 'auto' ? system : colorScheme,
        setColorScheme,
    };
};
