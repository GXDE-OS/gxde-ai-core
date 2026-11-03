/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { GET_IDENTITY_TOOL_NAME } from './tool-names.js';
import { AuthType } from '../core/contentGenerator.js';
import { PROVIDER_PRESETS } from '../providers/presets.js';
import { getVersion } from '../utils/version.js';

const DESCRIPTION =
  'Looks up which model and provider are answering in this session, and the GXDE AI Core version. Use it when the user asks about the model, provider or version instead of guessing, since the model can change mid-session. Answer in your own words, briefly, and mention only what the user asked about.';

type GetIdentityParams = Record<string, never>;

export class GetIdentityTool extends BaseDeclarativeTool<
  GetIdentityParams,
  ToolResult
> {
  static readonly Name = GET_IDENTITY_TOOL_NAME;

  constructor(
    private readonly config: Config,
    messageBus: MessageBus,
  ) {
    super(
      GetIdentityTool.Name,
      'Get Identity',
      DESCRIPTION,
      Kind.Read,
      { type: 'object', properties: {} },
      messageBus,
      false,
      false,
    );
  }

  protected createInvocation(
    params: GetIdentityParams,
    messageBus: MessageBus,
  ): GetIdentityInvocation {
    return new GetIdentityInvocation(this.config, params, messageBus);
  }
}

class GetIdentityInvocation extends BaseToolInvocation<
  GetIdentityParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: GetIdentityParams,
    messageBus: MessageBus,
  ) {
    super(params, messageBus, GetIdentityTool.Name, 'Get Identity');
  }

  getDescription(): string {
    return '';
  }

  async execute(): Promise<ToolResult> {
    const generator = this.config.getContentGeneratorConfig();
    const account =
      generator?.authType === AuthType.PROVIDER_ACCOUNT
        ? generator.providerAccount
        : undefined;
    const provider = account
      ? (PROVIDER_PRESETS.find((p) => p.id === account.providerId)?.label ??
        account.name)
      : 'Google Gemini';
    const model = this.config.getActiveModel();

    return {
      llmContent: [
        `Model: ${model}`,
        `Provider: ${provider}`,
        `GXDE AI Core version: ${await getVersion()}`,
      ].join('\n'),
      returnDisplay: `${model} · ${provider}`,
    };
  }
}
