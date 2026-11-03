/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '../../test-utils/render.js';
import { useAuthCommand, validateAuthMethodWithSettings } from './useAuth.js';
import { AuthType, type Config } from '@google/gemini-cli-core';
import { AuthState } from '../types.js';
import type { LoadedSettings } from '../../config/settings.js';

const mockValidateAuthMethod = vi.fn();

vi.mock('../../config/auth.js', () => ({
  validateAuthMethod: (authType: AuthType) => mockValidateAuthMethod(authType),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAuthMethodWithSettings', () => {
    it('should return error if auth type is enforced and does not match', async () => {
      const settings = {
        merged: {
          security: {
            auth: {
              enforcedType: AuthType.LOGIN_WITH_GOOGLE,
            },
          },
        },
      } as LoadedSettings;

      const error = await validateAuthMethodWithSettings(
        AuthType.PROVIDER_ACCOUNT,
        settings,
      );
      expect(error).toContain('Authentication is enforced to be oauth');
    });

    it('should return null if useExternal is true', async () => {
      const settings = {
        merged: {
          security: {
            auth: {
              useExternal: true,
            },
          },
        },
      } as LoadedSettings;

      const error = await validateAuthMethodWithSettings(
        AuthType.PROVIDER_ACCOUNT,
        settings,
      );
      expect(error).toBeNull();
    });

    it('should call validateAuthMethod for provider accounts', async () => {
      const settings = {
        merged: {
          security: {
            auth: {},
          },
        },
      } as LoadedSettings;

      mockValidateAuthMethod.mockResolvedValue('Validation Error');
      const error = await validateAuthMethodWithSettings(
        AuthType.PROVIDER_ACCOUNT,
        settings,
      );
      expect(error).toBe('Validation Error');
      expect(mockValidateAuthMethod).toHaveBeenCalledWith(
        AuthType.PROVIDER_ACCOUNT,
      );
    });
  });

  describe('useAuthCommand', () => {
    const mockConfig = {
      refreshAuth: vi.fn(),
    } as unknown as Config;

    const createSettings = (selectedType?: AuthType) =>
      ({
        merged: {
          security: {
            auth: {
              selectedType,
            },
          },
        },
      }) as LoadedSettings;

    let deferredRefreshAuth: {
      resolve: () => void;
      reject: (e: Error) => void;
    };

    beforeEach(() => {
      vi.mocked(mockConfig.refreshAuth).mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            deferredRefreshAuth = { resolve, reject };
          }),
      );
    });

    it('should initialize with Unauthenticated state', async () => {
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(AuthType.PROVIDER_ACCOUNT), mockConfig),
      );
      expect(result.current.authState).toBe(AuthState.Unauthenticated);

      await act(async () => {
        deferredRefreshAuth.resolve();
      });

      expect(result.current.authState).toBe(AuthState.Authenticated);
    });

    it('should set error if no auth type is selected', async () => {
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(undefined), mockConfig),
      );

      expect(result.current.authError).toBe(
        'Select a provider account in /auth.',
      );
      expect(result.current.authState).toBe(AuthState.Updating);
    });

    it('should reject removed authentication methods', async () => {
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_GEMINI), mockConfig),
      );

      expect(result.current.authError).toBe(
        'Only provider accounts are supported. Select a provider account in /auth.',
      );
      expect(result.current.authState).toBe(AuthState.Updating);
      expect(mockConfig.refreshAuth).not.toHaveBeenCalled();
    });

    it('should set error if validation fails', async () => {
      mockValidateAuthMethod.mockResolvedValue('Validation Failed');
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(AuthType.PROVIDER_ACCOUNT), mockConfig),
      );

      expect(result.current.authError).toBe('Validation Failed');
      expect(result.current.authState).toBe(AuthState.Updating);
    });

    it('should authenticate successfully for a provider account', async () => {
      mockValidateAuthMethod.mockResolvedValue(null);
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(AuthType.PROVIDER_ACCOUNT), mockConfig),
      );

      await act(async () => {
        deferredRefreshAuth.resolve();
      });

      expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
        AuthType.PROVIDER_ACCOUNT,
      );
      expect(result.current.authState).toBe(AuthState.Authenticated);
      expect(result.current.authError).toBeNull();
    });

    it('should handle refreshAuth failure', async () => {
      mockValidateAuthMethod.mockResolvedValue(null);
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(AuthType.PROVIDER_ACCOUNT), mockConfig),
      );

      await act(async () => {
        deferredRefreshAuth.reject(new Error('Auth Failed'));
      });

      expect(result.current.authError).toContain('Failed to sign in');
      expect(result.current.authState).toBe(AuthState.Updating);
    });

    it('should transition to Updating without setting authError on ChangeAuthRequestedError', async () => {
      mockValidateAuthMethod.mockResolvedValue(null);
      const { ChangeAuthRequestedError } = await import(
        '@google/gemini-cli-core'
      );
      const { result } = await renderHook(() =>
        useAuthCommand(createSettings(AuthType.PROVIDER_ACCOUNT), mockConfig),
      );

      await act(async () => {
        deferredRefreshAuth.reject(new ChangeAuthRequestedError());
      });

      expect(result.current.authError).toBeNull();
      expect(result.current.authState).toBe(AuthState.Updating);
    });
  });
});
