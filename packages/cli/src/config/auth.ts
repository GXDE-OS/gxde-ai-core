/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  getActiveAccount,
  loadAccountKey,
} from '@google/gemini-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export async function validateAuthMethod(
  authMethod: string,
): Promise<string | null> {
  loadEnvironment(loadSettings().merged, process.cwd());

  if (authMethod === AuthType.PROVIDER_ACCOUNT) {
    const account = getActiveAccount();
    return account && (await loadAccountKey(account.id))
      ? null
      : 'Select a provider account and enter its API key in /auth.';
  }

  return 'Only provider accounts are supported. Select a provider account in /auth.';
}
