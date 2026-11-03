/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { randomUUID } from 'node:crypto';
import { Box, Text } from 'ink';
import {
  AuthType,
  PROVIDER_PRESETS,
  readAccounts,
  getActiveAccount,
  saveAccount,
  selectAccount,
  deleteAccount,
  type ProviderAccount,
  type ProviderPreset,
  type Config,
} from '@google/gemini-cli-core';
import type { LoadedSettings } from '../../config/settings.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useTextBuffer } from '../components/shared/text-buffer.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';

export async function activateProviderAccount(
  config: Config,
  settings: LoadedSettings,
  account: ProviderAccount,
  model: string,
): Promise<void> {
  const enforced = settings.merged.security.auth.enforcedType;
  if (
    settings.merged.security.auth.useExternal ||
    (enforced && enforced !== AuthType.PROVIDER_ACCOUNT)
  ) {
    throw new Error(
      'Provider accounts are disabled by the configured authentication policy.',
    );
  }

  const previous = getActiveAccount();
  const previousModel = config.getModel();
  const previousAuth = settings.merged.security.auth.selectedType;
  try {
    selectAccount(account.id, model);
    config.setModel(model, true);
    await config.refreshAuth(AuthType.PROVIDER_ACCOUNT);
    settings.refreshProviderAccount();
    config.getGeminiClient().stripThoughtsFromHistory();
  } catch (error) {
    selectAccount(previous?.id, previous?.model);
    config.setModel(previousModel, true);
    settings.refreshProviderAccount();
    if (previousAuth) {
      await config.refreshAuth(previousAuth);
    }

    throw error;
  }
}

function InputStep({
  label,
  initial = '',
  secret = false,
  onSubmit,
  onBack,
}: {
  label: string;
  initial?: string;
  secret?: boolean;
  onSubmit: (value: string) => void;
  onBack: () => void;
}) {
  const buffer = useTextBuffer({
    initialText: initial,
    initialCursorOffset: initial.length,
    viewport: {
      width: Math.max(20, (process.stdout.columns || 80) - 12),
      height: 3,
    },
    singleLine: true,
  });

  return (
    <Box flexDirection="column">
      <Text>{label}</Text>
      <TextInput
        buffer={buffer}
        mask={secret}
        onSubmit={onSubmit}
        onCancel={onBack}
      />
      <Text dimColor>Enter to continue · Esc to go back</Text>
    </Box>
  );
}

const customPreset: ProviderPreset = {
  id: 'custom',
  label: 'Custom provider',
  protocol: 'openai',
  baseUrl: '',
  envKey: '',
  models: [],
};

type View =
  | 'accounts'
  | 'presets'
  | 'actions'
  | 'protocol'
  | 'endpoint'
  | 'name'
  | 'url'
  | 'key'
  | 'models'
  | 'review'
  | 'select-model'
  | 'delete';

interface Props {
  config: Config;
  settings: LoadedSettings;
  onDone: () => void;
  onBack: () => void;
  modelsOnly?: boolean;
}

export function ProviderAccountsDialog({
  config,
  settings,
  onDone,
  onBack,
  modelsOnly = false,
}: Props) {
  const [view, setView] = useState<View>(
    modelsOnly ? 'select-model' : 'accounts',
  );
  const [store, setStore] = useState(readAccounts);
  const [account, setAccount] = useState<ProviderAccount | undefined>(
    getActiveAccount,
  );
  const [preset, setPreset] = useState<ProviderPreset>(customPreset);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const back = () => {
    setError('');
    setApiKey('');
    if (modelsOnly || view === 'accounts') {
      onBack();
    } else {
      setView('accounts');
      setStore(readAccounts());
    }
  };

  const inputViews: View[] = ['name', 'url', 'key', 'models'];
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        back();
        return true;
      }

      return false;
    },
    { isActive: !busy && !inputViews.includes(view) },
  );
  const run = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const items = (entries: Array<[string, string]>) =>
    entries.map(([value, label]) => ({ key: value, value, label }));
  const choosePreset = (id: string) => {
    const selected = PROVIDER_PRESETS.find((p) => p.id === id) ?? customPreset;
    setPreset(selected);
    setEditing(false);
    setApiKey('');
    const urls = selected.baseUrl;
    setAccount({
      id: randomUUID(),
      name: selected.label,
      providerId: selected.id,
      protocol: selected.protocol,
      baseUrl: typeof urls === 'string' ? urls : urls[0].url,
      models: selected.models,
      model: selected.models[0]?.id ?? '',
    });

    setView(
      id === 'custom' ? 'protocol' : Array.isArray(urls) ? 'endpoint' : 'name',
    );
  };

  const activate = (model: string) =>
    run(async () => {
      if (!account) {
        return;
      }

      await activateProviderAccount(config, settings, account, model);
      onDone();
    });

  let content;
  if (busy) {
    content = <Text>Updating account…</Text>;
  } else if (view === 'accounts') {
    content = (
      <RadioButtonSelect
        items={items([
          ...store.accounts.map(
            (a) =>
              [
                a.id,
                `${a.id === store.activeId ? '● ' : ''}${a.name} — ${a.model} (${new URL(a.baseUrl).host})`,
              ] as [string, string],
          ),
          ['add', 'Add account from preset / custom provider'],
          ['back', 'Back to authentication'],
        ])}
        onSelect={(id) => {
          if (id === 'back') {
            onBack();
          } else if (id === 'add') {
            setView('presets');
          } else {
            setAccount(store.accounts.find((a) => a.id === id));
            setView('actions');
          }
        }}
      />
    );
  } else if (view === 'presets') {
    content = (
      <RadioButtonSelect
        items={items([
          ...PROVIDER_PRESETS.map((p) => [p.id, p.label] as [string, string]),
          ['custom', 'Custom provider (OpenAI / Anthropic / Gemini)'],
        ])}
        onSelect={choosePreset}
      />
    );
  } else if (view === 'protocol') {
    content = (
      <RadioButtonSelect
        items={items([
          ['openai', 'OpenAI-compatible (Chat Completions)'],
          ['anthropic', 'Anthropic-compatible (Messages)'],
          ['gemini', 'Gemini-compatible'],
        ])}
        onSelect={(value) => {
          setAccount({
            ...account!,
            protocol:
              value === 'anthropic'
                ? 'anthropic'
                : value === 'gemini'
                  ? 'gemini'
                  : 'openai',
          });

          setView('name');
        }}
      />
    );
  } else if (view === 'endpoint' && Array.isArray(preset.baseUrl)) {
    content = (
      <RadioButtonSelect
        items={items(
          preset.baseUrl.map((url) => [url.url, `${url.label} — ${url.url}`]),
        )}
        onSelect={(baseUrl) => {
          setAccount({ ...account!, baseUrl });
          setView('name');
        }}
      />
    );
  } else if (view === 'actions') {
    content = (
      <RadioButtonSelect
        items={items([
          ['use', 'Use this account / select model'],
          ['edit', 'Edit name, endpoint, key and models'],
          ['delete', 'Delete account'],
        ])}
        onSelect={(value) => {
          if (value === 'use') {
            setView('select-model');
          } else if (value === 'delete') {
            setView('delete');
          } else {
            setEditing(true);
            setApiKey('');
            setView('name');
          }
        }}
      />
    );
  } else if (view === 'name') {
    content = (
      <InputStep
        key="name"
        label="Account name (e.g. DeepSeek personal / work)"
        initial={account?.name}
        onBack={back}
        onSubmit={(name) => {
          if (!name.trim()) {
            setError('Enter an account name.');
            return;
          }

          setError('');
          setAccount({ ...account!, name: name.trim() });
          setView('url');
        }}
      />
    );
  } else if (view === 'url') {
    content = (
      <InputStep
        key="url"
        label="API base URL"
        initial={account?.baseUrl}
        onBack={back}
        onSubmit={(baseUrl) => {
          try {
            const url = new URL(baseUrl.trim());
            if (
              !['http:', 'https:'].includes(url.protocol) ||
              url.username ||
              url.password ||
              url.search ||
              url.hash
            ) {
              throw new Error();
            }
          } catch {
            setError(
              'Enter an HTTP(S) URL without credentials, query or fragment.',
            );
            return;
          }

          setError('');
          setAccount({
            ...account!,
            baseUrl: baseUrl.trim().replace(/\/$/, ''),
          });

          setView('key');
        }}
      />
    );
  } else if (view === 'key') {
    content = (
      <InputStep
        key="key"
        label={
          editing
            ? 'API key (blank keeps the saved key)'
            : 'API key (stored in the system keychain / encrypted fallback)'
        }
        secret
        onBack={back}
        onSubmit={(key) => {
          if (!key.trim() && !editing) {
            setError('Enter an API key.');
            return;
          }

          setError('');
          setApiKey(key.trim());
          setView('models');
        }}
      />
    );
  } else if (view === 'models') {
    content = (
      <InputStep
        key="models"
        label="Model IDs (comma-separated; editable preset defaults)"
        initial={account?.models.map((m) => m.id).join(', ')}
        onBack={back}
        onSubmit={(value) => {
          const ids = [
            ...new Set(
              value
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
            ),
          ];
          if (!ids.length) {
            setError('Enter at least one model ID.');
            return;
          }

          setError('');
          setAccount({
            ...account!,
            models: ids.map(
              (id) => account!.models.find((m) => m.id === id) ?? { id },
            ),
            model: ids.includes(account!.model) ? account!.model : ids[0],
          });

          setView('review');
        }}
      />
    );
  } else if (view === 'review') {
    content = (
      <Box flexDirection="column">
        <Text>
          {account?.name} · {account?.protocol}
        </Text>
        <Text>{account?.baseUrl}</Text>
        <Text>Models: {account?.models.map((m) => m.id).join(', ')}</Text>
        <Text>API key: {apiKey ? '•••••••• (new)' : '(unchanged)'}</Text>
        <RadioButtonSelect
          items={items([
            ['save', 'Save account'],
            ['activate', 'Save and select model'],
            ['cancel', 'Cancel'],
          ])}
          onSelect={(value) => {
            if (value === 'cancel') {
              back();
              return;
            }

            void run(async () => {
              await saveAccount(account!, apiKey || undefined);
              if (getActiveAccount()?.id === account!.id) {
                await activateProviderAccount(
                  config,
                  settings,
                  account!,
                  account!.model,
                );
              }

              setApiKey('');
              setStore(readAccounts());
              setView(value === 'activate' ? 'select-model' : 'accounts');
            });
          }}
        />
      </Box>
    );
  } else if (view === 'select-model' && account) {
    content = (
      <Box flexDirection="column">
        <Text>
          {account.name} — {account.baseUrl}
        </Text>
        <Text dimColor>
          Subsequent requests, including conversation history, use this account.
        </Text>
        <RadioButtonSelect
          items={items(
            account.models.map((m) => [
              m.id,
              `${m.id}${m.id === account.model ? ' (selected)' : ''}`,
            ]),
          )}
          onSelect={(model) => {
            void activate(model);
          }}
        />
      </Box>
    );
  } else if (view === 'delete') {
    content = (
      <Box flexDirection="column">
        <Text>Delete “{account?.name}” and its saved API key?</Text>
        <RadioButtonSelect
          items={items([
            ['cancel', 'Cancel'],
            ['delete', 'Delete'],
          ])}
          onSelect={(value) => {
            if (value === 'cancel') {
              setView('actions');
            } else {
              void run(async () => {
                if (account?.id === getActiveAccount()?.id) {
                  throw new Error(
                    'Switch to another account before deleting the active account.',
                  );
                }

                await deleteAccount(account!.id);
                setStore(readAccounts());
                setView('accounts');
              });
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.ui.focus}
      padding={1}
    >
      <Text bold>Hachimi · Provider accounts</Text>
      {content}
      {error && <Text color={theme.status.error}>{error}</Text>}
      {!inputViews.includes(view) && (
        <Text dimColor>↑/↓ to select · Enter to confirm · Esc to go back</Text>
      )}
    </Box>
  );
}
