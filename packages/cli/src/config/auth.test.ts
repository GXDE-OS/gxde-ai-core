/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, type ProviderAccount } from '@google/gemini-cli-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAuthMethod } from './auth.js';

const account: ProviderAccount = {
  id: '00000000-0000-4000-8000-000000000000',
  name: 'Personal',
  providerId: 'deepseek',
  protocol: 'openai',
  baseUrl: 'https://api.deepseek.com',
  models: [{ id: 'deepseek-chat' }],
  model: 'deepseek-chat',
};

const state = vi.hoisted(() => ({
  account: undefined as ProviderAccount | undefined,
  key: undefined as string | undefined,
}));

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    getActiveAccount: vi.fn(() => state.account),
    loadAccountKey: vi.fn(async () => state.key),
  };
});

vi.mock('./settings.js', () => ({
  loadEnvironment: vi.fn(),
  loadSettings: vi.fn().mockReturnValue({
    merged: {},
  }),
}));

describe('validateAuthMethod', () => {
  beforeEach(() => {
    state.account = undefined;
    state.key = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for a provider account with a stored key', async () => {
    state.account = account;
    state.key = 'secret';
    expect(await validateAuthMethod(AuthType.PROVIDER_ACCOUNT)).toBeNull();
  });

  it('returns an error when no provider account is active', async () => {
    expect(await validateAuthMethod(AuthType.PROVIDER_ACCOUNT)).toBe(
      'Select a provider account and enter its API key in /auth.',
    );
  });

  it('returns an error when the active account has no stored key', async () => {
    state.account = account;
    expect(await validateAuthMethod(AuthType.PROVIDER_ACCOUNT)).toBe(
      'Select a provider account and enter its API key in /auth.',
    );
  });

  it.each([
    AuthType.LOGIN_WITH_GOOGLE,
    AuthType.USE_GEMINI,
    AuthType.USE_VERTEX_AI,
    AuthType.COMPUTE_ADC,
    AuthType.GATEWAY,
    AuthType.LEGACY_CLOUD_SHELL,
  ])('rejects the removed %s authentication method', async (authType) => {
    expect(await validateAuthMethod(authType)).toBe(
      'Only provider accounts are supported. Select a provider account in /auth.',
    );
  });

  it('rejects an invalid auth method', async () => {
    expect(await validateAuthMethod('invalid-method')).toBe(
      'Only provider accounts are supported. Select a provider account in /auth.',
    );
  });
});
