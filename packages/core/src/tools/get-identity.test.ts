/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetIdentityTool } from './get-identity.js';
import { MessageBus } from '../confirmation-bus/message-bus.js';
import type { PolicyEngine } from '../policy/policy-engine.js';
import type { Config } from '../config/config.js';
import { AuthType } from '../core/contentGenerator.js';
import { resetVersionCache } from '../utils/version.js';

const run = async (config: Partial<Config>) => {
  const tool = new GetIdentityTool(
    config as Config,
    new MessageBus(vi.mocked({} as PolicyEngine)),
  );
  return tool.build({}).execute({ abortSignal: new AbortController().signal });
};

describe('GetIdentityTool', () => {
  beforeEach(() => {
    vi.stubEnv('CLI_VERSION', '1.2.3');
    resetVersionCache();
  });

  it('reports the active provider account and model', async () => {
    const result = await run({
      getActiveModel: () => 'glm-5',
      getContentGeneratorConfig: () => ({
        authType: AuthType.PROVIDER_ACCOUNT,
        providerAccount: {
          id: 'a',
          name: 'work',
          providerId: 'coding-plan',
          protocol: 'openai',
          baseUrl: 'https://example.com',
          models: [],
          model: 'glm-5',
        },
      }),
    });

    expect(result.llmContent).toBe(
      [
        'Model: glm-5',
        'Provider: Alibaba ModelStudio · Coding Plan',
        'GXDE AI Core version: 1.2.3',
      ].join('\n'),
    );
    expect(result.returnDisplay).toBe(
      'glm-5 · Alibaba ModelStudio · Coding Plan',
    );
  });

  it('names a custom provider after its account', async () => {
    const result = await run({
      getActiveModel: () => 'glm-5.3',
      getContentGeneratorConfig: () => ({
        authType: AuthType.PROVIDER_ACCOUNT,
        providerAccount: {
          id: 'b',
          name: 'Bailian',
          providerId: 'custom',
          protocol: 'openai',
          baseUrl: 'https://example.com',
          models: [],
          model: 'glm-5.3',
        },
      }),
    });

    expect(result.llmContent).toContain('Provider: Bailian');
    expect(result.llmContent).not.toContain('custom');
    expect(result.llmContent).not.toContain('openai');
  });

  it('reports Gemini authentication without a provider account', async () => {
    const result = await run({
      getActiveModel: () => 'gemini-2.5-pro',
      getContentGeneratorConfig: () => ({ authType: AuthType.USE_GEMINI }),
    });

    expect(result.llmContent).toContain('Model: gemini-2.5-pro');
    expect(result.llmContent).toContain('Provider: Google Gemini');
  });
});
