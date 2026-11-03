/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import type { LoadedSettings } from '../../config/settings.js';
import { AuthType, type Config } from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { ProviderAccountsDialog } from './ProviderAccountsDialog.js';
import { AuthState } from '../types.js';

interface AuthDialogProps {
  config: Config;
  settings: LoadedSettings;
  setAuthState: (state: AuthState) => void;
  authError: string | null;
  onAuthError: (error: string | null) => void;
  setAuthContext: (context: { requiresRestart?: boolean }) => void;
}

export function AuthDialog({
  config,
  settings,
  setAuthState,
  authError,
  onAuthError,
  setAuthContext,
}: AuthDialogProps): React.JSX.Element {
  const [managingProviders, setManagingProviders] = useState(false);

  const items = [
    {
      label: 'Provider accounts (domestic models and custom endpoints)',
      value: AuthType.PROVIDER_ACCOUNT,
      key: AuthType.PROVIDER_ACCOUNT,
    },
  ];

  useKeypress(
    (key) => {
      if (key.name !== 'escape') {
        return false;
      }

      // Prevent exit if there is an error message.
      if (authError) {
        return true;
      }
      if (settings.merged.security.auth.selectedType === undefined) {
        // Prevent exiting if no auth method is set.
        onAuthError(
          'You must select a provider account to proceed. Press Ctrl+C twice to exit.',
        );
        return true;
      }

      onAuthError(null);
      setAuthState(AuthState.Authenticated);
      return true;
    },
    { isActive: !managingProviders },
  );

  if (managingProviders) {
    return (
      <ProviderAccountsDialog
        config={config}
        settings={settings}
        onBack={() => setManagingProviders(false)}
        onDone={() => {
          onAuthError(null);
          setAuthContext({});
          setAuthState(AuthState.Authenticated);
        }}
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.ui.focus}
      flexDirection="row"
      padding={1}
      width="100%"
      alignItems="flex-start"
    >
      <Text color={theme.text.accent}>? </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text bold color={theme.text.primary}>
          Get started
        </Text>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            Select a provider account to authenticate for this project.
          </Text>
        </Box>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={items}
            initialIndex={0}
            onSelect={() => setManagingProviders(true)}
            onHighlight={() => {
              onAuthError(null);
            }}
          />
        </Box>
        {authError && (
          <Box marginTop={1}>
            <Text color={theme.status.error}>{authError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Use Enter to select)</Text>
        </Box>
      </Box>
    </Box>
  );
}
