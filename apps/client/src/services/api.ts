import { hc } from 'hono/client';

import type { ApiType, Level, ReportReason, Sort } from '@server/types';

/** Client typé de l'API (`/api`, servie par le même domaine). */
export const api = hc<ApiType>('/api');

interface AnyResponse {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}

/**
 * Corps d'une réponse réussie : les réponses d'erreur typées (`ok: false`,
 * comme un 404 renvoyé par la route) sont écartées.
 */
type Success<R> = R extends { ok: false }
    ? never
    : R extends { json(): Promise<infer T> }
      ? T
      : never;

/** Résultat JSON d'un appel, ou erreur avec le message renvoyé par le serveur. */
export const json = async <R extends AnyResponse>(
    call: Promise<R>,
): Promise<Success<R>> => {
    let response: R;
    try {
        response = await call;
    } catch {
        throw new Error('Pas de connexion au serveur.');
    }
    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
            message?: string;
        };
        throw new Error(body.message ?? `Erreur ${response.status}`);
    }
    return (await response.json()) as Success<R>;
};

export interface CatalogQuery {
    q?: string;
    level?: Level;
    sort?: Sort;
    offset?: number;
    limit?: number;
}

/** Recherche dans le catalogue partagé (sans le contenu des partitions). */
export const fetchCatalog = ({ offset, limit, ...rest }: CatalogQuery = {}) =>
    json(
        api.catalog.$get({
            query: {
                ...Object.fromEntries(
                    Object.entries(rest).filter(([, v]) => v),
                ),
                ...(offset ? { offset: String(offset) } : {}),
                ...(limit ? { limit: String(limit) } : {}),
            },
        }),
    );

/** Une partition du catalogue, avec son MusicXML. */
export const fetchScore = (id: string) =>
    json(api.catalog[':id'].$get({ param: { id } }));

/** Signale un problème sur une partition du catalogue. */
export const reportScore = (
    id: string,
    reason: ReportReason,
    message: string,
) =>
    json(
        api.catalog[':id'].report.$post({
            param: { id },
            json: { reason, message },
        }),
    );
