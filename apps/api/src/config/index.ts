import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { parseEnv } from './env.js';

// On a developer machine, read the repo-root .env. In Docker/CI the variables are injected
// by the environment and the file does not exist, which dotenv silently ignores.
// Variables that are already set (e.g. by Vitest or Docker) are never overridden.
loadDotenv({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true });

// Throws at import time if anything is missing or invalid → the process exits
// before it can listen on a port with a broken configuration (fail fast).
export const config = parseEnv(process.env);

export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
