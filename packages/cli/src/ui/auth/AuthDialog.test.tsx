/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { renderWithProviders } from '../../test-utils/render.js';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { AuthDialog } from './AuthDialog.js';
import { AuthType, type Config } from '@google/gemini-cli-core';
import type { LoadedSettings } from '../../config/settings.js';
import { AuthState } from '../types.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { ProviderAccountsDialog } from './ProviderAccountsDialog.js';
import { Text } from 'ink';

vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

vi.mock('../components/shared/RadioButtonSelect.js', () => ({
  RadioButtonSelect: vi.fn(({ items, initialIndex }) => (
    <>
      {items.map((item: { value: string; label: string }, index: number) => (
        <Text key={item.value}>
          {index === initialIndex ? '(selected)' : '(not selected)'}{' '}
          {item.label}
        </Text>
      ))}
    </>
  )),
}));

vi.mock('./ProviderAccountsDialog.js', () => ({
  ProviderAccountsDialog: vi.fn(() => <Text>Provider accounts dialog</Text>),
}));

const mockedUseKeypress = useKeypress as Mock;
const mockedRadioButtonSelect = RadioButtonSelect as Mock;

describe('AuthDialog', () => {
  let props: {
    config: Config;
    settings: LoadedSettings;
    setAuthState: (state: AuthState) => void;
    authError: string | null;
    onAuthError: (error: string | null) => void;
    setAuthContext: (context: { requiresRestart?: boolean }) => void;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    props = {
      config: {} as Config,
      settings: {
        merged: {
          security: {
            auth: {},
          },
        },
        setValue: vi.fn(),
      } as unknown as LoadedSettings,
      setAuthState: vi.fn(),
      authError: null,
      onAuthError: vi.fn(),
      setAuthContext: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('only offers provider accounts', async () => {
    const { unmount } = await renderWithProviders(<AuthDialog {...props} />);
    const { items, initialIndex } = mockedRadioButtonSelect.mock.calls[0][0];

    expect(items).toEqual([
      {
        label: 'Provider accounts (domestic models and custom endpoints)',
        value: AuthType.PROVIDER_ACCOUNT,
        key: AuthType.PROVIDER_ACCOUNT,
      },
    ]);
    expect(initialIndex).toBe(0);
    unmount();
  });

  it('opens the provider accounts dialog when selected', async () => {
    const { unmount } = await renderWithProviders(<AuthDialog {...props} />);
    const { onSelect } = mockedRadioButtonSelect.mock.calls[0][0];

    await act(async () => {
      onSelect(AuthType.PROVIDER_ACCOUNT);
    });

    expect(ProviderAccountsDialog).toHaveBeenCalled();
    unmount();
  });

  it('does not exit on escape when no provider account is selected', async () => {
    const { unmount } = await renderWithProviders(<AuthDialog {...props} />);
    const keypressHandler = mockedUseKeypress.mock.calls[0][0];

    keypressHandler({ name: 'escape' });

    expect(props.onAuthError).toHaveBeenCalledWith(
      'You must select a provider account to proceed. Press Ctrl+C twice to exit.',
    );
    expect(props.setAuthState).not.toHaveBeenCalled();
    unmount();
  });

  it('returns to the app on escape when a provider account is selected', async () => {
    props.settings.merged.security.auth.selectedType =
      AuthType.PROVIDER_ACCOUNT;
    const { unmount } = await renderWithProviders(<AuthDialog {...props} />);
    const keypressHandler = mockedUseKeypress.mock.calls[0][0];

    keypressHandler({ name: 'escape' });

    expect(props.onAuthError).toHaveBeenCalledWith(null);
    expect(props.setAuthState).toHaveBeenCalledWith(AuthState.Authenticated);
    unmount();
  });

  it('does nothing on escape when an auth error is present', async () => {
    props.authError = 'Something went wrong';
    const { lastFrame, unmount } = await renderWithProviders(
      <AuthDialog {...props} />,
    );
    const keypressHandler = mockedUseKeypress.mock.calls[0][0];

    expect(keypressHandler({ name: 'escape' })).toBe(true);
    expect(props.onAuthError).not.toHaveBeenCalled();
    expect(props.setAuthState).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Something went wrong');
    unmount();
  });
});
