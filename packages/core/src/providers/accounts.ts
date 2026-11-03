/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import { homedir, GEMINI_DIR, getKeychainServiceName } from '../utils/paths.js';
import { HybridTokenStorage } from '../mcp/token-storage/hybrid-token-storage.js';
import type { ProviderAccount } from './types.js';

const credentials = new HybridTokenStorage(
  getKeychainServiceName('hachimi-provider-accounts'),
);

const accountSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1),
    providerId: z.string().min(1),
    protocol: z.enum(['openai', 'anthropic', 'gemini']),
    baseUrl: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return (
          ['https:', 'http:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }, 'Use an HTTP(S) base URL without credentials, query, or fragment'),
    models: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            contextWindowSize: z.number().int().positive().optional(),
          })
          .passthrough(),
      )
      .min(1),
    model: z.string().min(1),
  })
  .refine(
    (a) => a.models.some((m) => m.id === a.model),
    'Selected model must belong to the account',
  );

const storeSchema = z.object({
  version: z.literal(1),
  activeId: z.string().uuid().optional(),
  accounts: z.array(accountSchema),
});

export interface AccountStore {
  version: 1;
  activeId?: string;
  accounts: ProviderAccount[];
}

export function accountStorePath(): string {
  return path.join(homedir(), GEMINI_DIR, 'hachimi-accounts.json');
}

export function readAccounts(): AccountStore {
  try {
    return storeSchema.parse(
      JSON.parse(fs.readFileSync(accountStorePath(), 'utf8')),
    ) as AccountStore;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { version: 1, accounts: [] };
    }

    throw new Error(
      `Cannot read Hachimi accounts. Check ${accountStorePath()}.`,
      { cause: error },
    );
  }
}

export function getActiveAccount(): ProviderAccount | undefined {
  const store = readAccounts();
  return store.accounts.find((account) => account.id === store.activeId);
}

function writeAccounts(store: AccountStore): void {
  const target = accountStorePath();
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    storeSchema.parse(store);
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });

    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function mutateAccounts(update: (store: AccountStore) => void): void {
  const target = accountStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const release = lockfile.lockSync(target, { realpath: false });
  try {
    const store = readAccounts();
    update(store);
    writeAccounts(store);
  } finally {
    release();
  }
}

export async function saveAccount(
  account: ProviderAccount,
  apiKey?: string,
): Promise<void> {
  accountSchema.parse(account);
  if (apiKey !== undefined && !apiKey.trim()) {
    throw new Error('API key cannot be empty.');
  }

  const target = accountStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const release = await lockfile.lock(target, { realpath: false, retries: 3 });
  try {
    const store = readAccounts();
    const previous = await credentials.getCredentials(account.id);
    if (apiKey === undefined && !previous) {
      throw new Error('Enter an API key for this account.');
    }

    if (apiKey !== undefined) {
      await credentials.setCredentials({
        serverName: account.id,
        token: { accessToken: apiKey.trim(), tokenType: 'Bearer' },
        updatedAt: Date.now(),
      });
    }

    try {
      const index = store.accounts.findIndex((a) => a.id === account.id);
      if (index < 0) {
        store.accounts.push(account);
      } else {
        store.accounts[index] = account;
      }

      writeAccounts(store);
    } catch (error) {
      if (apiKey !== undefined) {
        if (previous) {
          await credentials.setCredentials(previous);
        } else {
          await credentials.deleteCredentials(account.id);
        }
      }

      throw error;
    }
  } finally {
    await release();
  }
}

export async function loadActiveAccountCredentials(): Promise<{
  account: ProviderAccount;
  apiKey: string;
}> {
  if (!getActiveAccount()) {
    throw new Error('Select a provider account with /auth.');
  }

  const release = await lockfile.lock(accountStorePath(), {
    realpath: false,
    retries: 3,
  });

  try {
    const account = getActiveAccount();
    if (!account) {
      throw new Error('Select a provider account with /auth.');
    }

    const apiKey = await loadAccountKey(account.id);
    if (!apiKey) {
      throw new Error('Account API key is missing. Edit the account in /auth.');
    }

    return { account, apiKey };
  } finally {
    await release();
  }
}

export async function loadAccountKey(id: string): Promise<string | undefined> {
  return (await credentials.getCredentials(id))?.token.accessToken;
}

export function selectAccount(id?: string, model?: string): void {
  mutateAccounts((store) => {
    if (id) {
      const account = store.accounts.find((a) => a.id === id);
      if (!account) {
        throw new Error('Account not found.');
      }

      if (model) {
        if (!account.models.some((m) => m.id === model)) {
          throw new Error('Model not configured for this account.');
        }

        account.model = model;
      }
    }

    store.activeId = id;
  });
}

export function setModelContextWindow(
  id: string,
  model: string,
  size?: number,
): void {
  mutateAccounts((store) => {
    const entry = store.accounts
      .find((a) => a.id === id)
      ?.models.find((m) => m.id === model);
    if (!entry) {
      throw new Error('Model not configured for this account.');
    }

    if (size === undefined) {
      delete entry.contextWindowSize;
    } else {
      entry.contextWindowSize = size;
    }
  });
}

export async function deleteAccount(id: string): Promise<void> {
  const target = accountStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const release = await lockfile.lock(target, { realpath: false, retries: 3 });
  try {
    const store = readAccounts();
    store.accounts = store.accounts.filter((a) => a.id !== id);
    if (store.activeId === id) {
      delete store.activeId;
    }

    writeAccounts(store);
    await credentials.deleteCredentials(id);
  } finally {
    await release();
  }
}
