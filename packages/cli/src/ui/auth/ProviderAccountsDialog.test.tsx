/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'ink';
import {
  AuthType,
  type ProviderAccount,
  type Config,
  getActiveAccount,
  selectAccount,
  saveAccount,
} from '@google/gemini-cli-core';
import { createMockSettings } from '../../test-utils/settings.js';
import { renderWithProviders } from '../../test-utils/render.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { TextInput } from '../components/shared/TextInput.js';
import {
  ProviderAccountsDialog,
  activateProviderAccount,
} from './ProviderAccountsDialog.js';

const state = vi.hoisted(() => ({
  active: undefined as ProviderAccount | undefined,
  accounts: [] as ProviderAccount[],
}));
vi.mock('@google/gemini-cli-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/gemini-cli-core')>()),
  getActiveAccount: vi.fn(() => state.active),
  readAccounts: vi.fn(() => ({
    version: 1,
    accounts: state.accounts,
    activeId: state.active?.id,
  })),
  selectAccount: vi.fn((id?: string, model?: string) => {
    const a = state.accounts.find((a) => a.id === id);
    state.active = a ? { ...a, model: model ?? a.model } : undefined;
  }),
  saveAccount: vi.fn(async (account: ProviderAccount) => {
    state.accounts = [
      ...state.accounts.filter((a) => a.id !== account.id),
      account,
    ];
  }),
  deleteAccount: vi.fn(),
}));
vi.mock('../components/shared/RadioButtonSelect.js', () => ({
  RadioButtonSelect: vi.fn(() => <Text>select</Text>),
}));
vi.mock('../components/shared/TextInput.js', () => ({
  TextInput: vi.fn(() => <Text>input</Text>),
}));

const personal: ProviderAccount = {
  id: 'personal',
  name: 'Personal',
  providerId: 'deepseek',
  protocol: 'openai',
  baseUrl: 'https://personal.example/v1',
  models: [{ id: 'chat' }, { id: 'reasoner' }],
  model: 'chat',
};

function configMock() {
  return {
    getModel: vi.fn(() => 'chat'),
    setModel: vi.fn(),
    refreshAuth: vi.fn().mockResolvedValue(undefined),
    getGeminiClient: () => ({ stripThoughtsFromHistory: vi.fn() }),
  } as unknown as Config;
}

async function choose(value: string) {
  const props = vi.mocked(RadioButtonSelect).mock.calls.at(-1)![0];
  await act(async () => {
    props.onSelect(value);
  });
}

async function input(value: string) {
  const props = vi.mocked(TextInput).mock.calls.at(-1)![0];
  await act(async () => {
    props.onSubmit?.(value);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.active = undefined;
  state.accounts = [];
});

describe('provider account dialog', () => {
  it('offers Qwen presets and creates a second named account without exposing the key', async () => {
    state.accounts = [personal];
    const settings = createMockSettings();
    const done = vi.fn();
    const rendered = await renderWithProviders(
      <ProviderAccountsDialog
        config={configMock()}
        settings={settings}
        onDone={done}
        onBack={vi.fn()}
      />,
    );
    await choose('add');
    const options = vi.mocked(RadioButtonSelect).mock.calls.at(-1)![0].items;
    expect(options.map((o) => o.value)).toEqual(
      expect.arrayContaining([
        'deepseek',
        'moonshot',
        'minimax',
        'zai',
        'modelscope',
        'idealab',
        'coding-plan',
        'qwencloud-token-plan',
        'custom',
      ]),
    );
    expect(options.map((o) => o.value)).not.toEqual(
      expect.arrayContaining(['grok', 'openrouter', 'requesty']),
    );
    await choose('deepseek');
    await input('Work');
    await input('https://work.example/v1');
    expect(vi.mocked(TextInput).mock.calls.at(-1)![0].mask).toBe(true);
    await input('secret-work-key');
    await input('chat, reasoner');
    await choose('save');
    expect(saveAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Work',
        providerId: 'deepseek',
        model: 'chat',
        baseUrl: 'https://work.example/v1',
      }),
      'secret-work-key',
    );
    expect(state.accounts).toHaveLength(2);
    expect(getActiveAccount()).toBeUndefined();
    expect(done).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('allows canceling the wizard without saving', async () => {
    const rendered = await renderWithProviders(
      <ProviderAccountsDialog
        config={configMock()}
        settings={createMockSettings()}
        onDone={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await choose('add');
    await choose('deepseek');
    await act(async () => {
      vi.mocked(TextInput).mock.calls.at(-1)![0].onCancel?.();
    });

    expect(saveAccount).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('switches accounts and models without saving Gemini auth settings', async () => {
    state.accounts = [personal];
    const settings = createMockSettings();
    const write = vi.spyOn(settings, 'setValue');
    const config = configMock();
    await activateProviderAccount(config, settings, personal, 'reasoner');
    expect(selectAccount).toHaveBeenCalledWith(personal.id, 'reasoner');
    expect(config.refreshAuth).toHaveBeenCalledWith(AuthType.PROVIDER_ACCOUNT);
    expect(settings.merged.model.name).toBe('reasoner');
    expect(settings.merged.security.auth.selectedType).toBe(
      AuthType.PROVIDER_ACCOUNT,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('restores selection and runtime auth after a failed switch', async () => {
    const work = { ...personal, id: 'work', name: 'Work' };
    state.accounts = [personal, work];
    state.active = personal;
    const settings = createMockSettings();
    const config = configMock();
    vi.mocked(config.refreshAuth).mockRejectedValueOnce(
      new Error('key unavailable'),
    );
    await expect(
      activateProviderAccount(config, settings, work, 'reasoner'),
    ).rejects.toThrow('key unavailable');
    expect(getActiveAccount()?.id).toBe(personal.id);
    expect(config.setModel).toHaveBeenLastCalledWith('chat', true);
    expect(config.refreshAuth).toHaveBeenCalledTimes(2);
  });

  it('respects enforced auth and does not select an account', async () => {
    const settings = createMockSettings({
      security: { auth: { enforcedType: AuthType.LOGIN_WITH_GOOGLE } },
    });

    await expect(
      activateProviderAccount(configMock(), settings, personal, 'chat'),
    ).rejects.toThrow('authentication policy');
    expect(selectAccount).not.toHaveBeenCalled();
  });

  it('restores the active account only in memory, leaving user and workspace settings intact', () => {
    state.active = personal;
    const settings = createMockSettings({
      model: { name: 'gemini-model' },
      security: { auth: { selectedType: AuthType.LOGIN_WITH_GOOGLE } },
    });

    expect(settings.merged.model.name).toBe('chat');
    expect(settings.user.settings.model?.name).toBe('gemini-model');
    state.active = undefined;
    settings.refreshProviderAccount();
    expect(settings.merged.security.auth.selectedType).toBe(
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings.merged.model.name).toBe('gemini-model');
  });
});
