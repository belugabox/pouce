import type { PlayNote } from '@/core/playback';

/**
 * Lecture d'une partition avec Web Audio, sur les sons du Salamander Grand
 * Piano (Alexander Holm, CC BY 3.0, `public/piano/`) : une note enregistrée
 * toutes les tierces mineures, en deux forces de frappe (p et f), les notes
 * voisines obtenues en accélérant ou ralentissant la plus proche. Seuls les
 * sons utiles au morceau sont chargés, puis gardés (service worker). Sans
 * réseau ni son déjà gardé : un son de piano synthétisé.
 */

/** Avance de programmation, en secondes. */
const AHEAD = 0.4;
const TICK_MS = 40;
/** Attente maximale des sons avant de jouer (sinon : synthèse). */
const LOAD_TIMEOUT_MS = 8000;

const LOWEST = 21;
const HIGHEST = 108;

/** Note enregistrée la plus proche (la0, do1, ré♯1, fa♯1, la1… do8). */
export const sampleFor = (midi: number) =>
    Math.min(
        HIGHEST,
        Math.max(LOWEST, LOWEST + Math.round((midi - LOWEST) / 3) * 3),
    );

type Layer = 'p' | 'f';
/** Force de frappe des deux enregistrements (couches 6 et 12 sur 16). */
const LAYER_VELOCITY: Record<Layer, number> = { p: 0.42, f: 0.78 };
export const layerFor = (velocity: number): Layer =>
    velocity < 0.6 ? 'p' : 'f';

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface PlayHandlers {
    /** Une note commence (dans l'ordre des départs, du grave à l'aigu). */
    onNote?: (note: PlayNote) => void;
    /** Fin de la lecture (dernière note éteinte). */
    onEnd?: () => void;
}

export class Player {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private timer: ReturnType<typeof setInterval> | undefined;
    /** Lecture en cours (une nouvelle lecture annule celle qui se prépare). */
    private session = 0;
    private samples = new Map<string, Promise<AudioBuffer | null>>();

    get playing() {
        return this.timer !== undefined;
    }

    /**
     * Prépare le son pendant le geste de l'utilisateur (clic) : certains
     * navigateurs refusent de le démarrer après une attente (chargement).
     */
    unlock() {
        this.ctx ??= new AudioContext();
        void this.ctx.resume();
        return this.ctx;
    }

    /** Un son enregistré (null s'il ne se charge pas). */
    private sample(ctx: AudioContext, midi: number, layer: Layer) {
        const name = `${midi}-${layer}`;
        let pending = this.samples.get(name);
        if (!pending) {
            pending = fetch(`/piano/${name}.mp3`)
                .then((r) => {
                    if (!r.ok) throw new Error(String(r.status));
                    return r.arrayBuffer();
                })
                .then((data) => ctx.decodeAudioData(data))
                .catch(() => {
                    // Réessayer à la prochaine lecture (réseau revenu).
                    this.samples.delete(name);
                    return null;
                });
            this.samples.set(name, pending);
        }
        return pending;
    }

    /**
     * Joue les notes ; la promesse se résout quand le son démarre (après le
     * chargement des sons nécessaires).
     */
    async play(notes: PlayNote[], { onNote, onEnd }: PlayHandlers = {}) {
        this.stop();
        const session = ++this.session;
        if (!notes.length) {
            onEnd?.();
            return;
        }
        const ctx = this.unlock();

        // Sons nécessaires, chargés en parallèle (attente limitée).
        const needed = new Map<string, Promise<AudioBuffer | null>>();
        for (const n of notes) {
            const midi = sampleFor(n.midi);
            const layer = layerFor(n.velocity);
            const name = `${midi}-${layer}`;
            if (!needed.has(name)) {
                needed.set(name, this.sample(ctx, midi, layer));
            }
        }
        const buffers = new Map<string, AudioBuffer | null>();
        await Promise.race([
            Promise.all(
                [...needed].map(async ([name, p]) =>
                    buffers.set(name, await p),
                ),
            ),
            new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS)),
        ]);
        if (session !== this.session) return;

        // Son commun : compresseur (accords sans saturation) ; filtre doux
        // pour le son de secours.
        const master = ctx.createGain();
        master.gain.value = 0.9;
        const compressor = ctx.createDynamicsCompressor();
        master.connect(compressor).connect(ctx.destination);
        const synth = ctx.createBiquadFilter();
        synth.type = 'lowpass';
        synth.frequency.value = 3500;
        synth.connect(master);
        this.master = master;

        const origin = ctx.currentTime + 0.1;
        const end = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
        let scheduled = 0;
        let announced = 0;
        const tick = () => {
            const now = ctx.currentTime - origin;
            while (scheduled < notes.length) {
                const n = notes[scheduled]!;
                if (n.start > now + AHEAD) break;
                const midi = sampleFor(n.midi);
                const layer = layerFor(n.velocity);
                const buffer = buffers.get(`${midi}-${layer}`);
                if (buffer) {
                    this.sampled(ctx, master, n, origin, buffer, midi, layer);
                } else {
                    this.synthesized(ctx, synth, n, origin);
                }
                scheduled++;
            }
            while (announced < notes.length && notes[announced]!.start <= now) {
                onNote?.(notes[announced]!);
                announced++;
            }
            if (now > end + 0.4) {
                this.stop();
                onEnd?.();
            }
        };
        tick();
        this.timer = setInterval(tick, TICK_MS);
    }

    stop() {
        this.session++;
        if (this.timer !== undefined) clearInterval(this.timer);
        this.timer = undefined;
        const master = this.master;
        this.master = null;
        if (master && this.ctx) {
            master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
            setTimeout(() => master.disconnect(), 300);
        }
    }

    /** Une note enregistrée, transposée ; l'étouffoir l'éteint à la fin. */
    private sampled(
        ctx: AudioContext,
        out: AudioNode,
        note: PlayNote,
        origin: number,
        buffer: AudioBuffer,
        sampleMidi: number,
        layer: Layer,
    ) {
        const start = Math.max(ctx.currentTime, origin + note.start);
        const stop = start + note.dur;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 2 ** ((note.midi - sampleMidi) / 12);
        // Volume ajusté à la nuance, autour de la couche choisie.
        const level = Math.min(
            1.5,
            Math.max(0.35, note.velocity / LAYER_VELOCITY[layer]),
        );
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(level, start);
        gain.gain.setTargetAtTime(0, stop, 0.1);
        source.connect(gain).connect(out);
        source.start(start);
        source.stop(stop + 0.8);
        source.onended = () => gain.disconnect();
    }

    /** Son de secours : attaque franche, puis décroissance comme une corde. */
    private synthesized(
        ctx: AudioContext,
        out: AudioNode,
        note: PlayNote,
        origin: number,
    ) {
        const start = Math.max(ctx.currentTime, origin + note.start);
        const stop = start + note.dur;
        const f = frequency(note.midi);
        const decay = Math.max(0.25, 1.4 - (note.midi - 36) * 0.02);
        const peak =
            0.3 * note.velocity * Math.min(1, 1.3 - (note.midi - 60) * 0.008);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.006);
        gain.gain.setTargetAtTime(peak * 0.25, start + 0.006, decay);
        gain.gain.setTargetAtTime(0, stop, 0.08);
        gain.connect(out);

        const partials: [OscillatorType, number, number][] = [
            ['triangle', 1, 1],
            ['sine', 2, 0.25],
            ['sine', 3, 0.08],
        ];
        for (const [type, ratio, level] of partials) {
            const osc = ctx.createOscillator();
            osc.type = type;
            osc.frequency.value = f * ratio;
            const g = ctx.createGain();
            g.gain.value = level;
            osc.connect(g).connect(gain);
            osc.start(start);
            osc.stop(stop + 0.5);
            osc.onended = () => {
                g.disconnect();
                if (ratio === 1) gain.disconnect();
            };
        }
    }
}
