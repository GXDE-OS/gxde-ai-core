/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type Mock,
  type Mocked,
} from 'vitest';
import { GeminiAgent } from './acpRpcDispatcher.js';
import * as acp from '@agentclientprotocol/sdk';
import {
  AuthType,
  deleteAccount,
  getActiveAccount,
  loadAccountKey,
  PROVIDER_PRESETS,
  readAccounts,
  saveAccount,
  selectAccount,
  type Config,
  type MessageBus,
  type Storage,
} from '@google/gemini-cli-core';
import type { LoadedSettings } from '../config/settings.js';
import { loadCliConfig, type CliArgs } from '../config/config.js';
import { loadSettings, SettingScope } from '../config/settings.js';

vi.mock('../config/config.js', () => ({
  loadCliConfig: vi.fn(),
}));

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    readAccounts: vi.fn(),
    saveAccount: vi.fn(),
    deleteAccount: vi.fn(),
    selectAccount: vi.fn(),
    getActiveAccount: vi.fn(),
    loadAccountKey: vi.fn(),
  };
});

vi.mock('../config/settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/settings.js')>();
  return {
    ...actual,
    loadSettings: vi.fn(),
  };
});

describe('GeminiAgent - RPC Dispatcher', () => {
  let mockConfig: Mocked<Config>;
  let mockSettings: Mocked<LoadedSettings>;
  let mockArgv: CliArgs;
  let mockConnection: Mocked<acp.AgentSideConnection>;
  let agent: GeminiAgent;

  beforeEach(() => {
    mockConfig = {
      refreshAuth: vi.fn(),
      initialize: vi.fn(),
      waitForMcpInit: vi.fn(),
      getFileSystemService: vi.fn(),
      setFileSystemService: vi.fn(),
      getContentGeneratorConfig: vi.fn(),
      getActiveModel: vi.fn().mockReturnValue('gemini-pro'),
      getModel: vi.fn().mockReturnValue('gemini-pro'),
      getGeminiClient: vi.fn().mockReturnValue({
        startChat: vi.fn().mockResolvedValue({}),
      }),
      getMessageBus: vi.fn().mockReturnValue({
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      }),
      getApprovalMode: vi.fn().mockReturnValue('default'),
      isPlanEnabled: vi.fn().mockReturnValue(true),
      getGemini31LaunchedSync: vi.fn().mockReturnValue(false),
      getHasAccessToPreviewModel: vi.fn().mockReturnValue(false),
      getCheckpointingEnabled: vi.fn().mockReturnValue(false),
      getDisableAlwaysAllow: vi.fn().mockReturnValue(false),
      validatePathAccess: vi.fn().mockReturnValue(null),
      getWorkspaceContext: vi.fn().mockReturnValue({
        addReadOnlyPath: vi.fn(),
        getDirectories: vi.fn().mockReturnValue(['/tmp']),
      }),
      getPolicyEngine: vi.fn().mockReturnValue({
        addRule: vi.fn(),
      }),
      messageBus: {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      } as unknown as MessageBus,
      storage: {
        getWorkspaceAutoSavedPolicyPath: vi.fn(),
        getAutoSavedPolicyPath: vi.fn(),
      } as unknown as Storage,

      get config() {
        return this;
      },
    } as unknown as Mocked<Config>;
    mockSettings = {
      merged: {
        security: { auth: { selectedType: 'login_with_google' } },
        mcpServers: {},
      },
      setValue: vi.fn(),
      refreshProviderAccount: vi.fn(),
    } as unknown as Mocked<LoadedSettings>;
    mockArgv = {} as unknown as CliArgs;
    mockConnection = {
      sessionUpdate: vi.fn(),
      requestPermission: vi.fn(),
    } as unknown as Mocked<acp.AgentSideConnection>;

    (loadCliConfig as unknown as Mock).mockResolvedValue(mockConfig);
    (loadSettings as unknown as Mock).mockImplementation(() => ({
      merged: {
        security: {
          auth: { selectedType: AuthType.LOGIN_WITH_GOOGLE },
          enablePermanentToolApproval: true,
        },
        mcpServers: {},
      },
      setValue: vi.fn(),
    }));

    vi.mocked(readAccounts).mockReturnValue({
      version: 1,
      accounts: [],
      activeId: undefined,
    });
    vi.mocked(getActiveAccount).mockReturnValue(undefined);
    vi.mocked(loadAccountKey).mockResolvedValue(undefined);
    vi.mocked(saveAccount).mockResolvedValue(undefined);
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    vi.mocked(selectAccount).mockImplementation(() => {});

    agent = new GeminiAgent(mockConfig, mockSettings, mockArgv, mockConnection);
  });

  it('should initialize with provider-account-only auth methods', async () => {
    const response = await agent.initialize({
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
      protocolVersion: 1,
    });

    expect(response.protocolVersion).toBe(acp.PROTOCOL_VERSION);
    expect(response.authMethods).toEqual([
      {
        id: AuthType.PROVIDER_ACCOUNT,
        name: 'Provider account',
        description:
          'Use a provider account configured with /auth or the gxde-ai-core/auth/providers extension methods',
      },
    ]);
    expect(response.agentCapabilities?.loadSession).toBe(true);
    expect(response.agentCapabilities?._meta).toEqual({
      'gxde-ai-core': {
        providerAccounts: {
          methods: [
            'gxde-ai-core/auth/providers/list',
            'gxde-ai-core/auth/providers/current',
            'gxde-ai-core/auth/providers/save',
            'gxde-ai-core/auth/providers/delete',
            'gxde-ai-core/auth/providers/activate',
          ],
        },
        sessions: {
          setProvider: 'gxde-ai-core/session/setProvider',
          setModel: 'gxde-ai-core/session/setModel',
        },
      },
    });
  });

  it('should authenticate with an active provider account', async () => {
    const account = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test DeepSeek',
      providerId: 'deepseek',
      protocol: 'openai' as const,
      baseUrl: 'https://api.deepseek.com',
      models: [{ id: 'deepseek-chat' }],
      model: 'deepseek-chat',
    };
    vi.mocked(getActiveAccount).mockReturnValue(account);
    vi.mocked(loadAccountKey).mockResolvedValue('secret');

    await agent.authenticate({ methodId: AuthType.PROVIDER_ACCOUNT });

    expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
      AuthType.PROVIDER_ACCOUNT,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.PROVIDER_ACCOUNT,
    );
    expect(mockSettings.refreshProviderAccount).toHaveBeenCalled();
  });

  it('should reject non-provider authentication methods', async () => {
    await expect(
      agent.authenticate({ methodId: AuthType.LOGIN_WITH_GOOGLE }),
    ).rejects.toThrow('Only provider-account authentication is supported');
  });

  it('should reject authentication when no provider account is active', async () => {
    await expect(
      agent.authenticate({ methodId: AuthType.PROVIDER_ACCOUNT }),
    ).rejects.toThrow('No active provider account');
  });

  it('should reject authentication when the active account has no API key', async () => {
    const account = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test DeepSeek',
      providerId: 'deepseek',
      protocol: 'openai' as const,
      baseUrl: 'https://api.deepseek.com',
      models: [{ id: 'deepseek-chat' }],
      model: 'deepseek-chat',
    };
    vi.mocked(getActiveAccount).mockReturnValue(account);
    vi.mocked(loadAccountKey).mockResolvedValue(undefined);

    await expect(
      agent.authenticate({ methodId: AuthType.PROVIDER_ACCOUNT }),
    ).rejects.toThrow('has no API key');
  });

  it('should cancel a session', async () => {
    const mockSession = {
      cancelPendingPrompt: vi.fn(),
    };
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(mockSession),
    };

    await agent.cancel({ sessionId: 'test-session-id' });

    expect(mockSession.cancelPendingPrompt).toHaveBeenCalled();
  });

  it('should throw error when cancelling non-existent session', async () => {
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(undefined),
    };

    await expect(agent.cancel({ sessionId: 'unknown' })).rejects.toThrow(
      'Session not found',
    );
  });

  it('should delegate prompt to session', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    };
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(mockSession),
    };

    const result = await agent.prompt({
      sessionId: 'test-session-id',
      prompt: [],
    });

    expect(mockSession.prompt).toHaveBeenCalled();
    expect(result).toMatchObject({ stopReason: 'end_turn' });
  });

  it('should delegate setMode to session', async () => {
    const mockSession = {
      setMode: vi.fn().mockReturnValue({}),
    };
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(mockSession),
    };

    const result = await agent.setSessionMode({
      sessionId: 'test-session-id',
      modeId: 'plan',
    });

    expect(mockSession.setMode).toHaveBeenCalledWith('plan');
    expect(result).toEqual({});
  });

  it('should throw error when setting mode on non-existent session', async () => {
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(undefined),
    };

    await expect(
      agent.setSessionMode({
        sessionId: 'unknown',
        modeId: 'plan',
      }),
    ).rejects.toThrow('Session not found: unknown');
  });

  it('should delegate setModel to session (unstable)', async () => {
    const mockSession = {
      setModel: vi.fn().mockReturnValue({}),
    };
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(mockSession),
    };

    const result = await agent.unstable_setSessionModel({
      sessionId: 'test-session-id',
      modelId: 'gemini-2.0-pro-exp',
    });

    expect(mockSession.setModel).toHaveBeenCalledWith('gemini-2.0-pro-exp');
    expect(result).toEqual({});
  });

  it('should throw error when setting model on non-existent session (unstable)', async () => {
    (
      agent as unknown as { sessionManager: { getSession: Mock } }
    ).sessionManager = {
      getSession: vi.fn().mockReturnValue(undefined),
    };

    await expect(
      agent.unstable_setSessionModel({
        sessionId: 'unknown',
        modelId: 'gemini-2.0-pro-exp',
      }),
    ).rejects.toThrow('Session not found: unknown');
  });

  it('should delegate dispose to sessionManager', async () => {
    const disposeMock = vi.fn().mockResolvedValue(undefined);
    (agent as unknown as { sessionManager: { dispose: Mock } }).sessionManager =
      {
        dispose: disposeMock,
      };

    await agent.dispose();

    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  describe('provider account extension methods', () => {
    const account = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test DeepSeek',
      providerId: 'deepseek',
      protocol: 'openai' as const,
      baseUrl: 'https://api.deepseek.com',
      models: [{ id: 'deepseek-chat' }],
      model: 'deepseek-chat',
    };

    it('lists presets, accounts, and the active account ID', async () => {
      vi.mocked(readAccounts).mockReturnValue({
        version: 1,
        accounts: [account],
        activeId: account.id,
      });

      const result = await agent.extMethod(
        'gxde-ai-core/auth/providers/list',
        {},
      );

      expect(result).toEqual({
        presets: PROVIDER_PRESETS,
        accounts: [account],
        activeAccountId: account.id,
      });
    });

    it('reports the current account without exposing the API key', async () => {
      vi.mocked(getActiveAccount).mockReturnValue(account);
      vi.mocked(loadAccountKey).mockResolvedValue('secret');

      const result = await agent.extMethod(
        'gxde-ai-core/auth/providers/current',
        {},
      );

      expect(result).toEqual({ account, hasApiKey: true });
      expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('saves an account and generates an ID when omitted', async () => {
      const { id: _id, ...input } = account;

      const result = await agent.extMethod('gxde-ai-core/auth/providers/save', {
        account: input,
        apiKey: 'secret',
      });

      expect(saveAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          id: expect.any(String),
        }),
        'secret',
      );
      expect(result['account']).toMatchObject(input);
    });

    it('refuses to delete the active account', async () => {
      vi.mocked(getActiveAccount).mockReturnValue(account);

      await expect(
        agent.extMethod('gxde-ai-core/auth/providers/delete', {
          id: account.id,
        }),
      ).rejects.toThrow(
        'Switch to another account before deleting the active account.',
      );
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('deletes a non-active account', async () => {
      const result = await agent.extMethod(
        'gxde-ai-core/auth/providers/delete',
        { id: account.id },
      );

      expect(deleteAccount).toHaveBeenCalledWith(account.id);
      expect(result).toEqual({ deleted: true });
    });

    it('activates an existing account', async () => {
      vi.mocked(readAccounts).mockReturnValue({
        version: 1,
        accounts: [account],
        activeId: undefined,
      });
      vi.mocked(getActiveAccount).mockReturnValue(account);

      const result = await agent.extMethod(
        'gxde-ai-core/auth/providers/activate',
        { id: account.id, model: 'deepseek-chat' },
      );

      expect(selectAccount).toHaveBeenCalledWith(account.id, 'deepseek-chat');
      expect(result).toEqual({
        activeAccountId: account.id,
        account,
      });
    });

    it('rejects unknown extension methods', async () => {
      await expect(agent.extMethod('unknown/method', {})).rejects.toThrow(
        'Method not found: unknown/method',
      );
    });
  });

  describe('session switching extension methods', () => {
    const account = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Test Qwen',
      providerId: 'qwen',
      protocol: 'openai' as const,
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: [{ id: 'qwen3-coder-plus' }, { id: 'qwen3-max' }],
      model: 'qwen3-coder-plus',
    };

    it('switches the provider for one session and returns its models', async () => {
      const mockSession = {
        setProvider: vi.fn().mockResolvedValue({}),
        setModel: vi.fn(),
      };
      (
        agent as unknown as { sessionManager: { getSession: Mock } }
      ).sessionManager = {
        getSession: vi.fn().mockReturnValue(mockSession),
      };
      vi.mocked(readAccounts).mockReturnValue({
        version: 1,
        accounts: [account],
        activeId: undefined,
      });
      vi.mocked(loadAccountKey).mockResolvedValue('secret');

      const result = await agent.extMethod('gxde-ai-core/session/setProvider', {
        sessionId: 'session-1',
        providerAccountId: account.id,
        model: 'qwen3-max',
      });

      expect(mockSession.setProvider).toHaveBeenCalledWith(
        account,
        'secret',
        'qwen3-max',
      );
      expect(result).toEqual({
        sessionId: 'session-1',
        providerAccountId: account.id,
        model: 'qwen3-max',
        availableModels: [
          { modelId: 'qwen3-coder-plus', name: 'qwen3-coder-plus' },
          { modelId: 'qwen3-max', name: 'qwen3-max' },
        ],
      });
    });

    it('rejects provider switching when the account key is missing', async () => {
      const mockSession = {
        setProvider: vi.fn(),
        setModel: vi.fn(),
      };
      (
        agent as unknown as { sessionManager: { getSession: Mock } }
      ).sessionManager = {
        getSession: vi.fn().mockReturnValue(mockSession),
      };
      vi.mocked(readAccounts).mockReturnValue({
        version: 1,
        accounts: [account],
        activeId: undefined,
      });
      vi.mocked(loadAccountKey).mockResolvedValue(undefined);

      await expect(
        agent.extMethod('gxde-ai-core/session/setProvider', {
          sessionId: 'session-1',
          providerAccountId: account.id,
        }),
      ).rejects.toThrow('Account API key is missing');
      expect(mockSession.setProvider).not.toHaveBeenCalled();
    });

    it('switches the model for one session', async () => {
      const mockSession = {
        setProvider: vi.fn(),
        setModel: vi.fn(),
      };
      (
        agent as unknown as { sessionManager: { getSession: Mock } }
      ).sessionManager = {
        getSession: vi.fn().mockReturnValue(mockSession),
      };

      const result = await agent.extMethod('gxde-ai-core/session/setModel', {
        sessionId: 'session-1',
        modelId: 'qwen3-max',
      });

      expect(mockSession.setModel).toHaveBeenCalledWith('qwen3-max');
      expect(result).toEqual({
        sessionId: 'session-1',
        modelId: 'qwen3-max',
      });
    });

    it('rejects switching for an unknown session', async () => {
      (
        agent as unknown as { sessionManager: { getSession: Mock } }
      ).sessionManager = {
        getSession: vi.fn().mockReturnValue(undefined),
      };

      await expect(
        agent.extMethod('gxde-ai-core/session/setModel', {
          sessionId: 'missing',
          modelId: 'qwen3-max',
        }),
      ).rejects.toThrow('Session not found: missing');
    });
  });
});
