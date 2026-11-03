/**
 * @license
 * Copyright 2026 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import {
  type AgentLoopContext,
  AuthType,
  clearCachedCredentialFile,
  getActiveAccount,
  getVersion,
  loadAccountKey,
  PROVIDER_PRESETS,
  type ProviderAccount,
  readAccounts,
  saveAccount,
  deleteAccount,
  selectAccount,
} from '@google/gemini-cli-core';
import * as acp from '@agentclientprotocol/sdk';
import { z } from 'zod';
import { SettingScope, type LoadedSettings } from '../config/settings.js';
import type { CliArgs } from '../config/config.js';
import { getAcpErrorMessage } from './acpErrors.js';
import { AcpSessionManager, type AuthDetails } from './acpSessionManager.js';
import { hasMeta } from './acpUtils.js';

// Make the A.C.P able to control the auth providers
// Now defining the communication schemas.
const providerModelSchema = z
  .object({
    id: z.string().trim().min(1),
    contextWindowSize: z.number().int().positive().optional(),
    enableThinking: z.boolean().optional(),
    thinkingMandatory: z.boolean().optional(),
    reasoning: z
      .object({
        profile: z.string().optional(),
        thinking: z.boolean().optional(),
        efforts: z.array(z.string()).optional(),
        defaultEffort: z.string().optional(),
        canDisable: z.boolean().optional(),
        toggleOnly: z.boolean().optional(),
        disableField: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const providerAccountInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  protocol: z.enum(['openai', 'anthropic', 'gemini']),
  baseUrl: z.string().url(),
  models: z.array(providerModelSchema).min(1),
  model: z.string().trim().min(1),
});

const providerSaveParamsSchema = z.object({
  account: providerAccountInputSchema,
  apiKey: z.string().optional(),
});

const providerIdSchema = z.object({
  id: z.string().uuid(),
});

const providerActivateParamsSchema = z.object({
  id: z.string().uuid(),
  model: z.string().trim().min(1).optional(),
});

export class GeminiAgent {
  private apiKey: string | undefined;
  private baseUrl: string | undefined;
  private customHeaders: Record<string, string> | undefined;
  private sessionManager: AcpSessionManager;

  constructor(
    private context: AgentLoopContext,
    private settings: LoadedSettings,
    argv: CliArgs,
    connection: acp.AgentSideConnection,
  ) {
    this.sessionManager = new AcpSessionManager(settings, argv, connection);
  }

  async dispose(): Promise<void> {
    await this.sessionManager.dispose();
  }

  async initialize(
    args: acp.InitializeRequest,
  ): Promise<acp.InitializeResponse> {
    if (args.clientCapabilities) {
      this.sessionManager.setClientCapabilities(args.clientCapabilities);
    }

    const authMethods = [
      {
        id: AuthType.LOGIN_WITH_GOOGLE,
        name: 'Log in with Google',
        description: 'Log in with your Google account',
      },
      {
        id: AuthType.USE_GEMINI,
        name: 'Gemini API key',
        description: 'Use an API key with Gemini Developer API',
        _meta: {
          'api-key': {
            provider: 'google',
          },
        },
      },
      {
        id: AuthType.USE_VERTEX_AI,
        name: 'Vertex AI',
        description: 'Use an API key with Vertex AI GenAI API',
      },
      {
        id: AuthType.GATEWAY,
        name: 'AI API Gateway',
        description: 'Use a custom AI API Gateway',
        _meta: {
          gateway: {
            protocol: 'google',
            restartRequired: 'false',
          },
        },
      },
    ];

    await this.context.config.initialize();
    const version = await getVersion();
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      authMethods,
      agentInfo: {
        name: 'gxde-ai-core',
        title: 'GXDE AI Core',
        version,
      },
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          image: true,
          audio: true,
          embeddedContext: true,
        },
        mcpCapabilities: {
          http: true,
          sse: true,
        },
        _meta: {
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
          },
        },
      },
    };
  }

  async authenticate(req: acp.AuthenticateRequest): Promise<void> {
    const { methodId } = req;
    const method = z.nativeEnum(AuthType).parse(methodId);
    const selectedAuthType = this.settings.merged.security.auth.selectedType;

    // Only clear credentials when switching to a different auth method
    if (selectedAuthType && selectedAuthType !== method) {
      await clearCachedCredentialFile();
    }
    // Check for api-key in _meta
    const meta = hasMeta(req) ? req._meta : undefined;
    const apiKey =
      typeof meta?.['api-key'] === 'string' ? meta['api-key'] : undefined;

    // Refresh auth with the requested method
    // This will reuse existing credentials if they're valid,
    // or perform new authentication if needed
    try {
      if (apiKey) {
        this.apiKey = apiKey;
      }

      // Extract gateway details if present
      const gatewaySchema = z.object({
        baseUrl: z.string().optional(),
        headers: z.record(z.string()).optional(),
      });

      let baseUrl: string | undefined;
      let headers: Record<string, string> | undefined;

      if (meta?.['gateway']) {
        const result = gatewaySchema.safeParse(meta['gateway']);
        if (result.success) {
          baseUrl = result.data.baseUrl;
          headers = result.data.headers;
        } else {
          throw new acp.RequestError(
            -32602,
            `Malformed gateway payload: ${result.error.message}`,
          );
        }
      }

      this.baseUrl = baseUrl;
      this.customHeaders = headers;

      await this.context.config.refreshAuth(
        method,
        apiKey ?? this.apiKey,
        baseUrl,
        headers,
      );
    } catch (e) {
      throw new acp.RequestError(-32000, getAcpErrorMessage(e));
    }
    this.settings.setValue(
      SettingScope.User,
      'security.auth.selectedType',
      method,
    );
  }

  private getAuthDetails(): AuthDetails {
    return {
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      customHeaders: this.customHeaders,
    };
  }

  async extMethod(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (method) {
      case 'gxde-ai-core/auth/providers/list':
        return this.listProviderAccounts();
      case 'gxde-ai-core/auth/providers/current':
        return this.currentProviderAccount();
      case 'gxde-ai-core/auth/providers/save':
        return this.saveProviderAccount(params);
      case 'gxde-ai-core/auth/providers/delete':
        return this.deleteProviderAccount(params);
      case 'gxde-ai-core/auth/providers/activate':
        return this.activateProviderAccount(params);
      default:
        throw new acp.RequestError(-32601, `Method not found: ${method}`);
    }
  }

  private listProviderAccounts(): Record<string, unknown> {
    const store = readAccounts();
    return {
      presets: PROVIDER_PRESETS,
      accounts: store.accounts,
      activeAccountId: store.activeId,
    };
  }

  private async currentProviderAccount(): Promise<Record<string, unknown>> {
    const account = getActiveAccount();
    if (!account) {
      return { account: null, hasApiKey: false };
    }
    const apiKey = await loadAccountKey(account.id);
    return { account, hasApiKey: Boolean(apiKey) };
  }

  private async saveProviderAccount(
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const parsed = providerSaveParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new acp.RequestError(
        -32602,
        `Invalid provider account: ${getAcpErrorMessage(parsed.error)}`,
      );
    }

    const account: ProviderAccount = {
      ...parsed.data.account,
      id: parsed.data.account.id ?? randomUUID(),
    };

    try {
      await saveAccount(account, parsed.data.apiKey);
    } catch (e) {
      throw new acp.RequestError(-32000, getAcpErrorMessage(e));
    }

    return { account };
  }

  private async deleteProviderAccount(
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const parsed = providerIdSchema.safeParse(params);
    if (!parsed.success) {
      throw new acp.RequestError(
        -32602,
        `Invalid provider account ID: ${getAcpErrorMessage(parsed.error)}`,
      );
    }

    const active = getActiveAccount();
    if (active?.id === parsed.data.id) {
      throw new acp.RequestError(
        -32000,
        'Switch to another account before deleting the active account.',
      );
    }

    try {
      await deleteAccount(parsed.data.id);
    } catch (e) {
      throw new acp.RequestError(-32000, getAcpErrorMessage(e));
    }

    return { deleted: true };
  }

  private activateProviderAccount(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const parsed = providerActivateParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new acp.RequestError(
        -32602,
        `Invalid provider account: ${getAcpErrorMessage(parsed.error)}`,
      );
    }

    const store = readAccounts();
    if (!store.accounts.some((account) => account.id === parsed.data.id)) {
      throw new acp.RequestError(
        -32000,
        `Provider account not found: ${parsed.data.id}`,
      );
    }

    try {
      selectAccount(parsed.data.id, parsed.data.model);
    } catch (e) {
      throw new acp.RequestError(-32000, getAcpErrorMessage(e));
    }

    const active = getActiveAccount();
    return {
      activeAccountId: active?.id ?? parsed.data.id,
      account: active ?? null,
    };
  }

  async newSession(
    params: acp.NewSessionRequest,
  ): Promise<acp.NewSessionResponse> {
    return this.sessionManager.newSession(params, this.getAuthDetails());
  }

  async loadSession(
    params: acp.LoadSessionRequest,
  ): Promise<acp.LoadSessionResponse> {
    return this.sessionManager.loadSession(params, this.getAuthDetails());
  }

  async cancel(params: acp.CancelNotification): Promise<void> {
    const session = this.sessionManager.getSession(params.sessionId);
    if (!session) {
      throw new acp.RequestError(
        -32602,
        `Session not found: ${params.sessionId}`,
      );
    }
    await session.cancelPendingPrompt();
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    const session = this.sessionManager.getSession(params.sessionId);
    if (!session) {
      throw new acp.RequestError(
        -32602,
        `Session not found: ${params.sessionId}`,
      );
    }
    return session.prompt(params);
  }

  async setSessionMode(
    params: acp.SetSessionModeRequest,
  ): Promise<acp.SetSessionModeResponse> {
    const session = this.sessionManager.getSession(params.sessionId);
    if (!session) {
      throw new acp.RequestError(
        -32602,
        `Session not found: ${params.sessionId}`,
      );
    }
    return session.setMode(params.modeId);
  }

  async unstable_setSessionModel(
    params: acp.SetSessionModelRequest,
  ): Promise<acp.SetSessionModelResponse> {
    const session = this.sessionManager.getSession(params.sessionId);
    if (!session) {
      throw new acp.RequestError(
        -32602,
        `Session not found: ${params.sessionId}`,
      );
    }
    return session.setModel(params.modelId);
  }
}
