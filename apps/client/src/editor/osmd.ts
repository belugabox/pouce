import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

/**
 * Rendu de la partition par OpenSheetMusicDisplay (SVG). OSMD ne sert qu'à
 * dessiner et à placer les notes : le moteur de doigtés lit le MusicXML.
 */

/** Place d'une note dessinée, en unités OSMD (×10 = unités du SVG). */
export interface NotePosition {
    x: number;
    y: number;
    /** Haut de la portée de la mesure. */
    top: number;
    staff: number;
}

export type Positions = Map<string, NotePosition>;

export const createOsmd = (container: HTMLElement) => {
    const osmd = new OpenSheetMusicDisplay(container, {
        backend: 'svg',
        autoResize: false,
        drawTitle: true,
        drawSubtitle: false,
        drawComposer: true,
        drawPartNames: false,
        // Les doigtés sont dessinés par Pouce, au-dessus et au-dessous.
        drawFingerings: false,
        drawCredits: false,
        autoBeam: true,
        followCursor: false,
        pageFormat: 'Endless',
    });
    const rules = osmd.EngravingRules;
    rules.StaffDistance = 9;
    rules.BetweenStaffDistance = 9;
    rules.MinimumDistanceBetweenSystems = 9;
    return osmd;
};

/**
 * Place de chaque note dessinée, sous la même clé que `indexScore`
 * (`partie|mesure|portée|attaque|rang`).
 */
export const collectPositions = (osmd: OpenSheetMusicDisplay): Positions => {
    const instruments = osmd.Sheet.Instruments;
    const found: (NotePosition & { group: string; pitch: number })[] = [];
    for (const row of osmd.GraphicSheet.MeasureList) {
        for (const gm of row) {
            if (!gm?.staffEntries) continue;
            const top = gm.PositionAndShape.AbsolutePosition.y;
            for (const gse of gm.staffEntries) {
                for (const gve of gse.graphicalVoiceEntries) {
                    if (gve.parentVoiceEntry?.IsGrace) continue;
                    for (const gn of gve.notes) {
                        const sn = gn.sourceNote;
                        if (!sn || sn.isRest() || !sn.Pitch) continue;
                        const staff = sn.ParentStaffEntry.ParentStaff;
                        const instrument = staff.ParentInstrument;
                        const pi = instruments.indexOf(instrument);
                        const si = instrument.Staves.indexOf(staff) + 1;
                        const mi = sn.SourceMeasure.measureListIndex;
                        const onset = sn.ParentVoiceEntry.Timestamp.RealValue;
                        const pos = gn.PositionAndShape.AbsolutePosition;
                        found.push({
                            group: `${pi}|${mi}|${si}|${onset.toFixed(4)}`,
                            pitch: sn.Pitch.Frequency,
                            x: pos.x,
                            y: pos.y,
                            top,
                            staff: si,
                        });
                    }
                }
            }
        }
    }
    // Rang dans l'accord, du grave à l'aigu, comme `indexScore`.
    const groups = new Map<string, typeof found>();
    for (const n of found) {
        if (!groups.has(n.group)) groups.set(n.group, []);
        groups.get(n.group)!.push(n);
    }
    const positions: Positions = new Map();
    for (const [group, notes] of groups) {
        notes.sort((a, b) => a.pitch - b.pitch);
        notes.forEach(({ x, y, top, staff }, rank) =>
            positions.set(`${group}|${rank}`, { x, y, top, staff }),
        );
    }
    return positions;
};
