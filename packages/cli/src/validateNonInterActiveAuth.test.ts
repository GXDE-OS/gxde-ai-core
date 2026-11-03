/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import { validateNonInteractiveAuth } from './validateNonInterActiveAuth.js';
import {
  AuthType,
  OutputFormat,
  makeFakeConfig,
  debugLogger,
  ExitCodes,
  coreEvents,
} from '@google/gemini-cli-core';
import type { Config } from '@google/gemini-cli-core';
import * as auth from './config/auth.js';
import { type LoadedSettings } from './config/settings.js';

function createLocalMockConfig(overrides: Partial<Config> = {}): Config {
  const config = makeFakeConfig();
  Object.assign(config, overrides);
  return config;
}

describe('validateNonInterActiveAuth', () => {
  let debugLoggerErrorSpy: ReturnType<typeof vi.spyOn>;
  let coreEventsEmitFeedbackSpy: MockInstance;
  let processExitSpy: MockInstance;
  let mockSettings: LoadedSettings;

  beforeEach(() => {
    debugLoggerErrorSpy = vi
      .spyOn(debugLogger, 'error')
      .mockImplementation(() => {});
    coreEventsEmitFeedbackSpy = vi
      .spyOn(coreEvents, 'emitFeedback')
      .mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit(${code}) called`);
      });
    vi.spyOn(auth, 'validateAuthMethod').mockResolvedValue(null);
    mockSettings = {
      system: { path: '', settings: {} },
      systemDefaults: { path: '', settings: {} },
      user: { path: '', settings: {} },
      workspace: { path: '', settings: {} },
      errors: [],
      setValue: vi.fn(),
      merged: {
        security: {
          auth: {
            enforcedType: undefined,
          },
        },
      },
      isTrusted: true,
      migratedInMemoryScopes: new Set(),
      forScope: vi.fn(),
      computeMergedSettings: vi.fn(),
    } as unknown as LoadedSettings;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits if no auth type is configured', async () => {
    const nonInteractiveConfig = createLocalMockConfig({
      getOutputFormat: vi.fn().mockReturnValue(OutputFormat.TEXT),
      getContentGeneratorConfig: vi
        .fn()
        .mockReturnValue({ authType: undefined }),
    });
    try {
      await validateNonInteractiveAuth(
        undefined,
        undefined,
        nonInteractiveConfig,
        mockSettings,
      );
      expect.fail('Should have exited');
    } catch (e) {
      expect((e as Error).message).toContain(
        `process.exit(${ExitCodes.FATAL_AUTHENTICATION_ERROR}) called`,
      );
    }
    expect(debugLoggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Please select a provider account'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(
      ExitCodes.FATAL_AUTHENTICATION_ERROR,
    );
  });

  it('succeeds with a configured provider account', async () => {
    const nonInteractiveConfig = createLocalMockConfig({});
    await validateNonInteractiveAuth(
      AuthType.PROVIDER_ACCOUNT,
      undefined,
      nonInteractiveConfig,
      mockSettings,
    );
    expect(processExitSpy).not.toHaveBeenCalled();
    expect(debugLoggerErrorSpy).not.toHaveBeenCalled();
  });

  it('exits if validateAuthMethod returns error', async () => {
    vi.spyOn(auth, 'validateAuthMethod').mockResolvedValue('Auth error!');
    const nonInteractiveConfig = createLocalMockConfig({
      getOutputFormat: vi.fn().mockReturnValue(OutputFormat.TEXT),
      getContentGeneratorConfig: vi
        .fn()
        .mockReturnValue({ authType: undefined }),
    });
    try {
      await validateNonInteractiveAuth(
        AuthType.PROVIDER_ACCOUNT,
        undefined,
        nonInteractiveConfig,
        mockSettings,
      );
      expect.fail('Should have exited');
    } catch (e) {
      expect((e as Error).message).toContain(
        `process.exit(${ExitCodes.FATAL_AUTHENTICATION_ERROR}) called`,
      );
    }
    expect(debugLoggerErrorSpy).toHaveBeenCalledWith('Auth error!');
    expect(processExitSpy).toHaveBeenCalledWith(
      ExitCodes.FATAL_AUTHENTICATION_ERROR,
    );
  });

  it('skips validation if useExternalAuth is true', async () => {
    const validateAuthMethodSpy = vi
      .spyOn(auth, 'validateAuthMethod')
      .mockResolvedValue('Auth error!');
    const nonInteractiveConfig = createLocalMockConfig({});
    await validateNonInteractiveAuth(
      'invalid-auth-type' as AuthType,
      true,
      nonInteractiveConfig,
      mockSettings,
    );

    expect(validateAuthMethodSpy).not.toHaveBeenCalled();
    expect(debugLoggerErrorSpy).not.toHaveBeenCalled();
    expect(coreEventsEmitFeedbackSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('exits if configuredAuthType does not match enforcedType', async () => {
    mockSettings.merged.security.auth.enforcedType = AuthType.LOGIN_WITH_GOOGLE;
    const nonInteractiveConfig = createLocalMockConfig({
      getOutputFormat: vi.fn().mockReturnValue(OutputFormat.TEXT),
    });
    try {
      await validateNonInteractiveAuth(
        AuthType.PROVIDER_ACCOUNT,
        undefined,
        nonInteractiveConfig,
        mockSettings,
      );
      expect.fail('Should have exited');
    } catch (e) {
      expect((e as Error).message).toContain(
        `process.exit(${ExitCodes.FATAL_AUTHENTICATION_ERROR}) called`,
      );
    }
    expect(debugLoggerErrorSpy).toHaveBeenCalledWith(
      "The enforced authentication type is 'oauth-personal', but the current type is 'hachimi-provider-account'. Please re-authenticate with the correct type.",
    );
    expect(processExitSpy).toHaveBeenCalledWith(
      ExitCodes.FATAL_AUTHENTICATION_ERROR,
    );
  });

  describe('JSON output mode', () => {
    it(`prints JSON error when no auth is configured and exits with code ${ExitCodes.FATAL_AUTHENTICATION_ERROR}`, async () => {
      const nonInteractiveConfig = createLocalMockConfig({
        getOutputFormat: vi.fn().mockReturnValue(OutputFormat.JSON),
        getContentGeneratorConfig: vi
          .fn()
          .mockReturnValue({ authType: undefined }),
      });

      let thrown: Error | undefined;
      try {
        await validateNonInteractiveAuth(
          undefined,
          undefined,
          nonInteractiveConfig,
          mockSettings,
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown?.message).toBe(
        `process.exit(${ExitCodes.FATAL_AUTHENTICATION_ERROR}) called`,
      );
      const errorArg = coreEventsEmitFeedbackSpy.mock.calls[0]?.[1] as string;
      const payload = JSON.parse(errorArg);
      expect(payload.error.type).toBe('Error');
      expect(payload.error.code).toBe(ExitCodes.FATAL_AUTHENTICATION_ERROR);
      expect(payload.error.message).toContain(
        'Please select a provider account',
      );
    });

    it(`prints JSON error when enforced auth mismatches current auth and exits with code ${ExitCodes.FATAL_AUTHENTICATION_ERROR}`, async () => {
      mockSettings.merged.security.auth.enforcedType = AuthType.USE_GEMINI;
      const nonInteractiveConfig = createLocalMockConfig({
        getOutputFormat: vi.fn().mockReturnValue(OutputFormat.JSON),
        getContentGeneratorConfig: vi
          .fn()
          .mockReturnValue({ authType: undefined }),
      });

      let thrown: Error | undefined;
      try {
        await validateNonInteractiveAuth(
          AuthType.LOGIN_WITH_GOOGLE,
          undefined,
          nonInteractiveConfig,
          mockSettings,
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown?.message).toBe(
        `process.exit(${ExitCodes.FATAL_AUTHENTICATION_ERROR}) called`,
      );
      {
        const errorArg = coreEventsEmitFeedbackSpy.mock.calls[0]?.[1] as string;
        const payload = JSON.parse(errorArg);
        expect(payload.error.type).toBe('Error');
        expect(payload.error.code).toBe(ExitCodes.FATAL_AUTHENTICATION_ERROR);
        expect(payload.error.message).toContain(
          "The enforced authentication type is 'gemini-api-key', but the current type is 'oauth-personal'. Please re-authenticate with the correct type.",
        );
      }
    });

    it(`prints JSON error when validateAuthMethod fails and exits with code ${ExitCodes.FATAL_AUTHENTICATION_ERROR}`, async () => {
      vi.spyOn(auth, 'validateAuthMethod').mockResolvedValue('Auth error!');

      const nonInteractiveConfig = createLocalMockConfig({
        getOutputFormat: vi.fn().mockReturnValue(OutputFormat.JSON),
        getContentGeneratorConfig: vi
          .fn()
          .mockReturnValue({ authType: undefined }),
      });

      let thrown: Error | undefined;
      try {
        await validateNonInteractiveAuth(
          AuthType.PROVIDER_ACCOUNT,
          undefined,
          nonInteractiveConfig,
          mockSettings,
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown?.message).toBe(
        `process.exit(${ExitCodes.FATAL_AUTHENTICATION_ERROR}) called`,
      );
      {
        const errorArg = coreEventsEmitFeedbackSpy.mock.calls[0]?.[1] as string;
        const payload = JSON.parse(errorArg);
        expect(payload.error.type).toBe('Error');
        expect(payload.error.code).toBe(ExitCodes.FATAL_AUTHENTICATION_ERROR);
        expect(payload.error.message).toBe('Auth error!');
      }
    });
  });
});
