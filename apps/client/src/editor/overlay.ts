import type { Annotations, HandOf } from '@/core/fingering/suggest';
import type { ScoreNote } from '@/core/musicxml';

import type { Positions } from './osmd';

const NS = 'http://www.w3.org/2000/svg';
/** Unités OSMD → unités du SVG. */
const U = 10;
/** Décalage du centre de la tête de note par rapport à sa position. */
const HEAD = 0.6;

/** Couleurs fixes : la partition reste sur fond blanc, même en sombre. */
const INK = { rh: '#1f5fbf', lh: '#b0306a' };

const LAYER_ID = 'fingering-layer';

/**
 * Calque des doigtés, par-dessus le SVG d'OSMD : chiffres au-dessus des
 * notes de la main droite, au-dessous de celles de la main gauche, empilés
 * dans les accords ; sélection en surbrillance.
 */
export const drawOverlay = (
    svg: SVGSVGElement,
    {
        notes,
        positions,
        annotations,
        selected,
        zoom,
        handOf,
    }: {
        notes: ScoreNote[];
        handOf: HandOf;
        positions: Positions;
        annotations: Annotations;
        selected: string | null;
        zoom: number;
    },
) => {
    svg.querySelector(`#${LAYER_ID}`)?.remove();
    const layer = document.createElementNS(NS, 'g');
    layer.setAttribute('id', LAYER_ID);
    layer.setAttribute('pointer-events', 'none');
    svg.append(layer);

    // Hauteurs extrêmes de chaque accord, pour empiler les chiffres.
    const extent = new Map<string, { min: number; max: number }>();
    for (const n of notes) {
        const p = positions.get(n.key);
        if (!p) continue;
        const e = extent.get(n.group) ?? { min: Infinity, max: -Infinity };
        extent.set(n.group, {
            min: Math.min(e.min, p.y),
            max: Math.max(e.max, p.y),
        });
    }

    for (const n of notes) {
        const p = positions.get(n.key);
        if (!p) continue;
        const cx = (p.x + HEAD) * U;
        if (n.key === selected) {
            const ring = document.createElementNS(NS, 'ellipse');
            ring.setAttribute('cx', String(cx));
            ring.setAttribute('cy', String(p.y * U));
            ring.setAttribute('rx', '11');
            ring.setAttribute('ry', '9');
            ring.setAttribute('fill', 'rgba(242,183,5,.35)');
            ring.setAttribute('stroke', '#d79c00');
            ring.setAttribute('stroke-width', '2');
            layer.append(ring);
        }
        const finger = annotations.f[n.key];
        if (!finger) continue;
        const e = extent.get(n.group)!;
        const right = handOf(n) !== 2;
        const y = right
            ? Math.min(p.top - 1.4, e.min - 2.6) - n.rank * 1.5
            : Math.max(p.top + 4 + 2.4, e.max + 3) +
              (n.size - 1 - n.rank) * 1.5;
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', String(cx));
        text.setAttribute('y', String(y * U));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute(
            'font-family',
            "'Bricolage Grotesque', Arial, sans-serif",
        );
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-size', String(Math.max(13, 12 / zoom)));
        text.setAttribute('fill', right ? INK.rh : INK.lh);
        // Suggestion pas encore confirmée : en clair et en italique.
        if (annotations.auto[n.key]) {
            text.setAttribute('fill-opacity', '0.5');
            text.setAttribute('font-style', 'italic');
        }
        text.textContent = String(finger);
        layer.append(text);
    }
};

/** Note la plus proche d'un point touché, ou null si aucune assez près. */
export const hitTest = (
    svg: SVGSVGElement,
    positions: Positions,
    clientX: number,
    clientY: number,
): string | null => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const ux = pt.x / U;
    const uy = pt.y / U;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const [key, p] of positions) {
        const dx = ux - (p.x + HEAD);
        const dy = uy - p.y;
        const d = dx * dx + dy * dy * 1.6;
        if (d < bestDistance) {
            bestDistance = d;
            best = key;
        }
    }
    return bestDistance < 9 ? best : null;
};

/** Hauteur à l'écran d'une note (px, depuis le haut de la fenêtre). */
export const screenY = (svg: SVGSVGElement, y: number) => {
    const ctm = svg.getScreenCTM();
    return ctm ? y * U * ctm.d + ctm.f : null;
};
