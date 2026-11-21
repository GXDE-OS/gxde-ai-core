/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 *
 * @license
 */

import type { ProviderAccount } from '@google/gemini-cli-core';

/** 供应商的 /models 接口统一 15 秒超时 */
function requestInit(init: RequestInit = {}): RequestInit {
  return { ...init, signal: AbortSignal.timeout(15000) };
}

function append(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, '')}${suffix}`;
}

/** baseUrl 自带 /v1 或 /v1beta 时不要再拼一层 */
function versioned(base: string, version: string, path: string): string {
  const root = base.replace(/\/+$/, '');
  return root.endsWith(`/${version}`)
    ? `${root}${path}`
    : `${root}/${version}${path}`;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, requestInit(init));
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body ? `: ${body.slice(0, 300)}` : '';
    throw new Error(`HTTP ${response.status} ${response.statusText}${detail}`);
  }
  return response.json();
}

function modelId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  if ('id' in value && typeof value.id === 'string') {
    return value.id;
  }
  if ('name' in value && typeof value.name === 'string') {
    // Gemini 的 name 形如 "models/gemini-2.5-pro"
    return value.name.replace(/^models\//, '');
  }
  return undefined;
}

function modelIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(modelId).filter((id): id is string => !!id))];
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  if ('data' in value && Array.isArray(value.data)) {
    return modelIds(value.data);
  }
  if ('models' in value && Array.isArray(value.models)) {
    return modelIds(value.models);
  }
  return [];
}

/**
 * 用账号的 API Key 去上游拉模型列表。
 * 只返回 id；调用方可以再补上下文窗口等元数据。
 */
export async function fetchProviderModels(
  account: ProviderAccount,
  apiKey: string,
): Promise<string[]> {
  switch (account.protocol) {
    case 'openai': {
      const value = await fetchJson(append(account.baseUrl, '/models'), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return modelIds(value);
    }
    case 'anthropic': {
      const value = await fetchJson(
        versioned(account.baseUrl, 'v1', '/models'),
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        },
      );
      return modelIds(value);
    }
    case 'gemini': {
      const url = `${versioned(account.baseUrl, 'v1beta', '/models')}?key=${encodeURIComponent(apiKey)}`;
      const value = await fetchJson(url, {});
      return modelIds(value);
    }
    default:
      throw new Error(`Unsupported protocol: ${String(account.protocol)}`);
  }
}
