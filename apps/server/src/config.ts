import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    // Base SQLite (volume `/config` dans Docker).
    DATA_PATH: z.string().default('./data'),
    // Paquet de partitions PDMX (`scripts/pdmx`) ; défaut : `<DATA_PATH>/pdmx.jsonl.gz`.
    CATALOG_PACK: z.string().optional(),
    // Derrière un proxy : adresse du client lue dans `X-Forwarded-For`.
    TRUST_PROXY: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof schema> & {
    DB_FILE: string;
    CATALOG_PACK: string;
};

/** Configuration lue dans l'environnement ; arrête tout si elle est invalide. */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
    const result = schema.safeParse(env);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join('.')} : ${issue.message}`)
            .join(', ');
        throw new Error(`Configuration invalide : ${issues}`);
    }
    const dataPath = path.resolve(result.data.DATA_PATH);
    return {
        ...result.data,
        DATA_PATH: dataPath,
        DB_FILE: path.join(dataPath, 'pouce.db'),
        CATALOG_PACK: path.resolve(
            result.data.CATALOG_PACK ?? path.join(dataPath, 'pdmx.jsonl.gz'),
        ),
    };
};
