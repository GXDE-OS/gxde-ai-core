/**
 * @license
 * Copyright 2026 Qwen Team
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProviderPreset } from './types.js';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'coding-plan',
    label: 'Alibaba ModelStudio · Coding Plan',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'aliyun',
        label: 'China (Beijing)',
        url: 'https://coding.dashscope.aliyuncs.com/v1',
        documentationUrl: 'https://help.aliyun.com/zh/model-studio/coding-plan',
      },
      {
        id: 'alibabacloud',
        label: 'Singapore (International)',
        url: 'https://coding-intl.dashscope.aliyuncs.com/v1',
        documentationUrl:
          'https://www.alibabacloud.com/help/en/model-studio/coding-plan',
      },
    ],
    envKey: 'BAILIAN_CODING_PLAN_API_KEY',
    models: [
      {
        id: 'qwen3.5-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.6-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.7-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-5',
        contextWindowSize: 202752,
        enableThinking: true,
      },
      {
        id: 'kimi-k2.5',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'MiniMax-M2.5',
        contextWindowSize: 196608,
        enableThinking: true,
      },
      {
        id: 'qwen3-coder-plus',
        contextWindowSize: 1000000,
      },
      {
        id: 'qwen3-coder-next',
        contextWindowSize: 262144,
      },
      {
        id: 'qwen3-max-2026-01-23',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-4.7',
        contextWindowSize: 202752,
        enableThinking: true,
      },
    ],
  },
  {
    id: 'alibabaStandard',
    label: 'Alibaba ModelStudio · Standard API Key',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'cn-beijing',
        label: 'China (Beijing)',
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        documentationUrl:
          'https://bailian.console.aliyun.com/cn-beijing?tab=api#/api',
      },
      {
        id: 'sg-singapore',
        label: 'Singapore',
        url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        documentationUrl:
          'https://modelstudio.console.alibabacloud.com/ap-southeast-1?tab=api#/api/?type=model&url=2712195',
      },
      {
        id: 'us-virginia',
        label: 'US (Virginia)',
        url: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
        documentationUrl:
          'https://modelstudio.console.alibabacloud.com/us-east-1?tab=api#/api/?type=model&url=2712195',
      },
      {
        id: 'cn-hongkong',
        label: 'China (Hong Kong)',
        url: 'https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1',
        documentationUrl:
          'https://modelstudio.console.alibabacloud.com/cn-hongkong?tab=api#/api/?type=model&url=2712195',
      },
    ],
    envKey: 'DASHSCOPE_API_KEY',
    models: [
      {
        id: 'qwen3.6-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.7-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.7-max',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-5.3',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
        thinkingMandatory: true,
      },
      {
        id: 'glm-5.2',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-5.1',
        contextWindowSize: 202752,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'deepseek-v4-pro',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4.1-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4.1-flash-1017',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'qwen3.8-max',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'qwen3.8-max-0902',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'qwen3.8-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'deepseek-v4-pro-0813',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4-flash-0731',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'kimi-k3',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'max',
          canDisable: false,
          disableField: 'reasoning_effort',
        },
        thinkingMandatory: true,
      },
      {
        id: 'kimi-k2.7-code',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
        thinkingMandatory: true,
      },
      {
        id: 'kimi-k2.6',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
    ],
  },
  {
    id: 'token-plan',
    label: 'Alibaba ModelStudio · Token Plan',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'cn-beijing',
        label: 'China (Beijing)',
        url: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
        documentationUrl:
          'https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3028856',
      },
      {
        id: 'ap-southeast-1',
        label: 'Singapore (International)',
        url: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
        documentationUrl:
          'https://modelstudio.console.alibabacloud.com/ap-southeast-1?tab=doc#/doc/?type=model',
      },
    ],
    envKey: 'BAILIAN_TOKEN_PLAN_API_KEY',
    models: [
      {
        id: 'qwen3.7-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.6-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.7-max',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.8-max',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'qwen3.6-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'deepseek-v4-pro',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4-flash-0731',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4.1-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4.1-flash-1017',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'kimi-k2.7-code',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
        thinkingMandatory: true,
      },
      {
        id: 'kimi-k2.6',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'kimi-k2.5',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-5.3',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
        thinkingMandatory: true,
      },
      {
        id: 'glm-5.2',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-5.1',
        contextWindowSize: 202752,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'glm-5',
        contextWindowSize: 202752,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'MiniMax-M2.5',
        contextWindowSize: 196608,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
        thinkingMandatory: true,
      },
      {
        id: 'qwen3.8-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'deepseek-v4-pro-0813',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek API Key',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      {
        id: 'deepseek-v4-pro',
        contextWindowSize: 1000000,
        reasoning: {
          profile: 'deepseek-openai',
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'thinking',
        },
      },
      {
        id: 'deepseek-flash',
        contextWindowSize: 1000000,
        reasoning: {
          profile: 'deepseek-openai',
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'thinking',
        },
      },
    ],
  },
  {
    id: 'idealab',
    label: 'Idealab API Key',
    protocol: 'openai',
    baseUrl: 'https://idealab.alibaba-inc.com/api/openai/v1',
    envKey: 'IDEALAB_API_KEY',
    models: [
      {
        id: 'Qwen3.6-Plus-DogFooding',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
      {
        id: 'bailian/deepseek-v4-pro',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
      {
        id: 'bailian/deepseek-v4-flash',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
      {
        id: 'bailian/kimi-k2.6',
        contextWindowSize: 262144,
        enableThinking: true,
      },
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax API Key',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'international',
        label: 'International',
        url: 'https://api.minimax.io/v1',
        documentationUrl: 'https://www.minimax.io/platform',
      },
      {
        id: 'china',
        label: 'China',
        url: 'https://api.minimaxi.com/v1',
        documentationUrl: 'https://platform.minimaxi.com',
      },
    ],
    envKey: 'MINIMAX_API_KEY',
    models: [
      {
        id: 'MiniMax-M3',
        contextWindowSize: 1000000,
      },
      {
        id: 'MiniMax-M2.7',
        contextWindowSize: 204800,
      },
      {
        id: 'MiniMax-M2.7-highspeed',
        contextWindowSize: 204800,
      },
      {
        id: 'MiniMax-M2.5',
        contextWindowSize: 196608,
      },
      {
        id: 'MiniMax-M2.5-highspeed',
        contextWindowSize: 196608,
      },
    ],
  },
  {
    id: 'modelscope',
    label: 'ModelScope API Key',
    protocol: 'openai',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    envKey: 'MODELSCOPE_API_KEY',
    models: [
      {
        id: 'deepseek-ai/DeepSeek-V4-Flash',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
      {
        id: 'Qwen/Qwen3.5-397B-A17B',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
      {
        id: 'ZhipuAI/GLM-5.1',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
    ],
  },
  {
    id: 'moonshot',
    label: 'Kimi (Moonshot AI) API Key',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'international',
        label: 'International',
        url: 'https://api.moonshot.ai/v1',
        documentationUrl: 'https://platform.kimi.ai/docs',
      },
      {
        id: 'china',
        label: 'China',
        url: 'https://api.moonshot.cn/v1',
        documentationUrl: 'https://platform.moonshot.cn/docs',
      },
    ],
    envKey: 'MOONSHOT_API_KEY',
    models: [
      {
        id: 'kimi-k3',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'max',
          canDisable: false,
          disableField: 'reasoning_effort',
        },
        thinkingMandatory: true,
      },
      {
        id: 'kimi-k2.7-code',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'thinking',
        },
        thinkingMandatory: true,
      },
      {
        id: 'kimi-k2.7-code-highspeed',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          canDisable: false,
          disableField: 'thinking',
        },
        thinkingMandatory: true,
      },
      {
        id: 'kimi-k2.6',
        contextWindowSize: 262144,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'thinking',
        },
      },
    ],
  },
  {
    id: 'qwencloud-standard',
    label: 'QwenCloud · Standard API Key',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'cn-qianwenai',
        label: 'China — 千问AI平台',
        url: 'https://maas.qianwenaiapi.com/compatible-mode/v1',
        documentationUrl:
          'https://platform.qianwenai.com/docs/developer-guides/administration/api-keys',
        apiKeyUrl:
          'https://platform.qianwenai.com/docs/developer-guides/administration/api-keys',
      },
      {
        id: 'intl-qwencloud',
        label: 'International — QwenCloud',
        url: 'https://maas.qwencloudapi.com/compatible-mode/v1',
        documentationUrl:
          'https://docs.qwencloud.com/developer-guides/administration/api-keys',
        apiKeyUrl:
          'https://docs.qwencloud.com/developer-guides/administration/api-keys',
      },
    ],
    envKey: 'QWENCLOUD_API_KEY',
    models: [
      {
        id: 'qwen3.8-max',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'xhigh'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'qwen3.7-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.8-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'xhigh'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'deepseek-v4-pro-0813',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4.1-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'kimi-k3',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'max',
          canDisable: false,
          disableField: 'reasoning_effort',
        },
        thinkingMandatory: true,
      },
      {
        id: 'glm-5.3',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
    ],
  },
  {
    id: 'qwencloud-token-plan',
    label: 'QwenCloud · Token Plan',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'cn-qianwenai',
        label: 'China — 千问AI平台',
        url: 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
        documentationUrl:
          'https://platform.qianwenai.com/docs/token-plan/overview',
        apiKeyUrl: 'https://platform.qianwenai.com/docs/token-plan/overview',
      },
      {
        id: 'intl-qwencloud',
        label: 'International — QwenCloud',
        url: 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
        documentationUrl: 'https://docs.qwencloud.com/token-plan/overview',
        apiKeyUrl: 'https://docs.qwencloud.com/token-plan/overview',
      },
    ],
    envKey: 'QWENCLOUD_TOKEN_PLAN_API_KEY',
    models: [
      {
        id: 'qwen3.8-max',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'xhigh'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'qwen3.7-plus',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          toggleOnly: true,
          disableField: 'enable_thinking',
        },
        enableThinking: true,
      },
      {
        id: 'qwen3.8-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'medium', 'xhigh'],
          defaultEffort: 'xhigh',
          disableField: 'reasoning_effort',
        },
      },
      {
        id: 'deepseek-v4-pro-0813',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'deepseek-v4.1-flash',
        contextWindowSize: 1000000,
        reasoning: {
          thinking: true,
          efforts: ['low', 'high', 'max'],
          defaultEffort: 'high',
          disableField: 'enable_thinking',
        },
      },
      {
        id: 'glm-5.3',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
    ],
  },
  {
    id: 'zai',
    label: 'Z.AI API Key',
    protocol: 'openai',
    baseUrl: [
      {
        id: 'standard-api-key',
        label: 'Standard API Key',
        url: 'https://api.z.ai/api/paas/v4',
        documentationUrl: 'https://docs.z.ai/',
      },
      {
        id: 'coding-plan',
        label: 'Coding Plan',
        url: 'https://api.z.ai/api/coding/paas/v4',
        documentationUrl: 'https://docs.z.ai/',
      },
    ],
    envKey: 'ZAI_API_KEY',
    models: [
      {
        id: 'GLM-5.2',
        contextWindowSize: 1000000,
        enableThinking: true,
      },
      {
        id: 'GLM-5.1',
        contextWindowSize: 204800,
        enableThinking: true,
      },
      {
        id: 'GLM-5',
        contextWindowSize: 204800,
      },
      {
        id: 'GLM-5-Turbo',
        contextWindowSize: 204800,
      },
    ],
  },
];
