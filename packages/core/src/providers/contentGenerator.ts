/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentResponse,
  FinishReason,
  type Content,
  type Part,
  type GenerateContentParameters,
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentResponse,
} from '@google/genai';
import { z } from 'zod';
import type { ContentGenerator } from '../core/contentGenerator.js';
import { PROVIDER_REASONING_PREFIX, type ProviderAccount } from './types.js';
import {
  getProviderReasoningEffort,
  type ReasoningEffort,
} from '../core/reasoningEffort.js';
import { isContextWindowExceededError } from '../utils/errors.js';

type Json = Record<string, unknown>;

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

const openAIChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullish(),
            reasoning_content: z.string().nullish(),
            reasoning: z.string().nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number(),
                  // Some OpenAI-compatible providers send null instead of
                  // omitting these fields on continuation deltas.
                  id: z.string().nullish(),
                  function: z
                    .object({
                      name: z.string().nullish(),
                      arguments: z.string().nullish(),
                    })
                    .nullish(),
                }),
              )
              .optional(),
          })
          .optional(),
        finish_reason: z.string().nullish(),
      }),
    )
    .optional(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .nullish(),
  error: z.unknown().optional(),
});

const anthropicEventSchema = z.object({
  type: z.string(),
  index: z.number().optional(),
  content_block: z
    .object({
      type: z.string(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  delta: z
    .object({
      text: z.string().optional(),
      thinking: z.string().optional(),
      partial_json: z.string().optional(),
      stop_reason: z.string().nullish(),
    })
    .optional(),
  message: z
    .object({
      usage: z.object({ input_tokens: z.number().optional() }).optional(),
    })
    .optional(),
  usage: z.object({ output_tokens: z.number().optional() }).optional(),
  error: z.unknown().optional(),
});

const CONTEXT_WINDOW_EXCEEDED =
  'Provider request exceeds the model context window.';

function streamError(error: unknown): Error {
  return new Error(
    isContextWindowExceededError(JSON.stringify(error) ?? '')
      ? CONTEXT_WINDOW_EXCEEDED
      : 'Provider reported a streaming error.',
  );
}

type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIMessage {
  role: string;
  content: string | MessageBlock[];
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

function contents(value: GenerateContentParameters['contents']): Content[] {
  return (Array.isArray(value) ? value : [value]).map((item) => {
    if (typeof item === 'string') {
      return { role: 'user', parts: [{ text: item }] };
    }

    if (Array.isArray(item)) {
      return {
        role: 'user',
        parts: item.map((part: Part | string) =>
          typeof part === 'string' ? { text: part } : part,
        ),
      };
    }

    if ('parts' in item) {
      return item;
    }

    if (
      'text' in item ||
      'inlineData' in item ||
      'fileData' in item ||
      'functionCall' in item ||
      'functionResponse' in item
    ) {
      return { role: 'user', parts: [item] };
    }

    return { role: 'user', parts: [] };
  });
}

function systemText(request: GenerateContentParameters): string {
  const value = request.config?.systemInstruction;
  if (!value) {
    return '';
  }

  return contents(value)
    .flatMap((c) => c.parts ?? [])
    .map((p) => p.text ?? '')
    .join('\n');
}

function toolSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toolSchema);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => k !== 'propertyOrdering')
      .map(([k, v]) => [
        k,
        k === 'type' && typeof v === 'string' ? v.toLowerCase() : toolSchema(v),
      ]),
  );
}

export function openAIMessages(
  request: GenerateContentParameters,
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];
  const system = systemText(request);
  if (system) {
    result.push({ role: 'system', content: system });
  }

  const pending: Array<{ id: string; name: string }> = [];
  for (const content of contents(request.contents)) {
    const parts = content.parts ?? [];
    const calls: NonNullable<OpenAIMessage['tool_calls']> = [];
    const blocks: MessageBlock[] = [];
    let reasoning = '';
    for (const part of parts) {
      if (part.text !== undefined) {
        if (part.thought) {
          reasoning += part.text;
        } else {
          blocks.push({ type: 'text', text: part.text });
        }
      } else if (part.inlineData) {
        if (!part.inlineData.mimeType?.startsWith('image/')) {
          throw new Error('This provider route supports inline images only.');
        }

        blocks.push({
          type: 'image_url',
          image_url: {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          },
        });
      } else if (part.functionCall) {
        if (
          !reasoning &&
          part.thoughtSignature?.startsWith(PROVIDER_REASONING_PREFIX)
        ) {
          reasoning = Buffer.from(
            part.thoughtSignature.slice(PROVIDER_REASONING_PREFIX.length),
            'base64',
          ).toString('utf8');
        }

        const call = part.functionCall;
        const id =
          call.id || `call_${pending.length}_${result.length}_${calls.length}`;
        pending.push({ id, name: call.name ?? '' });
        calls.push({
          id,
          type: 'function',
          function: {
            name: call.name ?? '',
            arguments: JSON.stringify(call.args ?? {}),
          },
        });
      } else if (part.functionResponse) {
        const response = part.functionResponse;
        const index = pending.findIndex((c) =>
          response.id ? c.id === response.id : c.name === response.name,
        );
        const id = response.id ?? pending[index]?.id;
        if (!id) {
          throw new Error('Tool response has no matching tool call.');
        }

        if (index >= 0) {
          pending.splice(index, 1);
        }

        result.push({
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify(response.response ?? {}),
        });
      } else if (part.fileData) {
        throw new Error(
          'File URIs are not supported by this provider route; use inline content.',
        );
      }
    }

    if (blocks.length || calls.length || reasoning) {
      const textOnly = blocks.every((b) => b['type'] === 'text');
      result.push({
        role: content.role === 'model' ? 'assistant' : 'user',
        content: textOnly
          ? blocks.map((b) => (b.type === 'text' ? b.text : '')).join('')
          : blocks,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
        ...(calls.length ? { tool_calls: calls } : {}),
      });
    }
  }

  return result;
}

function anthropicMessages(
  request: GenerateContentParameters,
): Array<{ role: string; content: Json[] }> {
  const result: Array<{ role: string; content: Json[] }> = [];
  for (const message of openAIMessages(request)) {
    if (message['role'] === 'system') {
      continue;
    }

    const role = message['role'] === 'assistant' ? 'assistant' : 'user';
    const blocks: Json[] = [];
    if (message['role'] === 'tool') {
      blocks.push({
        type: 'tool_result',
        tool_use_id: message['tool_call_id'],
        content: message['content'],
      });
    } else {
      const content = message['content'];
      if (typeof content === 'string' && content) {
        blocks.push({ type: 'text', text: content });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block['type'] === 'text') {
            blocks.push(block);
          } else {
            const url = block.image_url.url;
            const match = /^data:([^;]+);base64,(.*)$/.exec(url);
            if (!match) {
              throw new Error('Invalid image data.');
            }

            blocks.push({
              type: 'image',
              source: { type: 'base64', media_type: match[1], data: match[2] },
            });
          }
        }
      }

      for (const call of message.tool_calls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: call.id,
          name: call.function.name,
          input: JSON.parse(call.function.arguments),
        });
      }
    }

    if (!blocks.length) {
      continue;
    }

    const previous = result[result.length - 1];
    if (previous?.['role'] === role) {
      previous.content.push(...blocks);
    } else {
      result.push({ role, content: blocks });
    }
  }

  return result;
}

export async function* readSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (!line && data.length) {
          yield data.join('\n');
          data = [];
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).trimStart());
        }
      }

      if (done) {
        break;
      }
    }

    if (buffer.startsWith('data:')) {
      data.push(buffer.slice(5).trimStart());
    }

    if (data.length) {
      yield data.join('\n');
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function response(
  parts: Part[],
  finishReason?: FinishReason,
): GenerateContentResponse {
  const result = new GenerateContentResponse();
  result.candidates = [
    {
      index: 0,
      content: { role: 'model', parts },
      ...(finishReason ? { finishReason } : {}),
    },
  ];
  return result;
}

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

/** Length of the longest suffix of `text` that is a prefix of `tag`. */
function partialTagLength(text: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) {
      return n;
    }
  }

  return 0;
}

/**
 * Splits streamed content from servers that inline reasoning as a leading
 * `<think>…</think>` block into thought and answer parts. Only a block at the
 * very start of the content counts, so answers that mention the tag are kept.
 */
export class ThinkTagSplitter {
  private state: 'start' | 'thinking' | 'answer' = 'start';

  private buffer = '';

  private trimAnswerStart = false;

  push(text: string): Part[] {
    this.buffer += text;
    const parts: Part[] = [];
    if (this.state === 'start') {
      const trimmed = this.buffer.trimStart();
      if (
        !trimmed ||
        (trimmed.length < THINK_OPEN.length && THINK_OPEN.startsWith(trimmed))
      ) {
        return parts;
      }

      if (trimmed.startsWith(THINK_OPEN)) {
        this.state = 'thinking';
        this.buffer = trimmed.slice(THINK_OPEN.length).replace(/^\s+/, '');
      } else {
        this.state = 'answer';
      }
    }

    if (this.state === 'thinking') {
      const end = this.buffer.indexOf(THINK_CLOSE);
      if (end === -1) {
        const keep = partialTagLength(this.buffer, THINK_CLOSE);
        this.emit(parts, this.buffer.slice(0, this.buffer.length - keep), true);
        this.buffer = this.buffer.slice(this.buffer.length - keep);
        return parts;
      }

      this.emit(parts, this.buffer.slice(0, end), true);
      this.buffer = this.buffer.slice(end + THINK_CLOSE.length);
      this.state = 'answer';
      this.trimAnswerStart = true;
    }

    if (this.trimAnswerStart) {
      this.buffer = this.buffer.replace(/^\s+/, '');
      this.trimAnswerStart = !this.buffer;
    }

    this.emit(parts, this.buffer, false);
    this.buffer = '';
    return parts;
  }

  /** Releases text held back while waiting for a possible tag. */
  flush(): Part[] {
    const parts: Part[] = [];
    this.emit(parts, this.buffer, this.state === 'thinking');
    this.buffer = '';
    return parts;
  }

  private emit(parts: Part[], text: string, thought: boolean): void {
    if (text) {
      parts.push(thought ? { text, thought: true } : { text });
    }
  }
}

export class ProviderContentGenerator implements ContentGenerator {
  constructor(
    private readonly account: ProviderAccount,
    private readonly apiKey: string,
    private readonly currentModel: () => string,
    private readonly currentEffort: () => ReasoningEffort | undefined = () =>
      undefined,
  ) {}

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return {
      totalTokens: Math.ceil(
        Buffer.byteLength(JSON.stringify(request.contents), 'utf8') / 3,
      ),
    };
  }

  async embedContent(): Promise<EmbedContentResponse> {
    throw new Error('Embeddings are not supported by this provider route.');
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const parts: Part[] = [];
    let last = response([]);
    for await (const chunk of await this.generateContentStream(request)) {
      parts.push(...(chunk.candidates?.[0]?.content?.parts ?? []));
      last = chunk;
    }

    const result = response(parts, last.candidates?.[0]?.finishReason);
    result.usageMetadata = last.usageMetadata;
    return result;
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const anthropic = this.account.protocol === 'anthropic';
    const current = this.currentModel();
    const model =
      this.account.models.find((m) => m.id === request.model) ??
      this.account.models.find((m) => m.id === current) ??
      this.account.models.find((m) => m.id === this.account.model)!;
    if (
      request.config?.tools?.some((tool) => !('functionDeclarations' in tool))
    ) {
      throw new Error(
        'This provider route does not support Gemini built-in tools. Use function tools or an MCP server instead.',
      );
    }

    const declarations =
      request.config?.tools?.flatMap((tool) =>
        'functionDeclarations' in tool ? (tool.functionDeclarations ?? []) : [],
      ) ?? [];
    const tools = declarations.map((tool) =>
      anthropic
        ? {
            name: tool.name,
            description: tool.description,
            input_schema: toolSchema(
              tool.parametersJsonSchema ??
                tool.parameters ?? { type: 'object', properties: {} },
            ),
          }
        : {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: toolSchema(
                tool.parametersJsonSchema ??
                  tool.parameters ?? { type: 'object', properties: {} },
              ),
            },
          },
    );
    const body: Json = {
      model: model.id,
      stream: true,
      messages: anthropic
        ? anthropicMessages(request)
        : openAIMessages(request),
      ...(tools.length ? { tools } : {}),
      ...(request.config?.temperature !== undefined
        ? { temperature: request.config.temperature }
        : {}),
      ...(request.config?.topP !== undefined
        ? { top_p: request.config.topP }
        : {}),
      ...(anthropic
        ? {
            system: systemText(request),
            max_tokens: request.config?.maxOutputTokens ?? 8192,
          }
        : {
            stream_options: { include_usage: true },
            ...(request.config?.maxOutputTokens
              ? { max_tokens: request.config.maxOutputTokens }
              : {}),
          }),
    };

    if (!anthropic) {
      const reasoning = model.reasoning;
      const effort = getProviderReasoningEffort(model, this.currentEffort());
      if (effort) {
        body['reasoning_effort'] = effort;
      }

      if (reasoning?.disableField === 'thinking') {
        body['thinking'] = { type: 'enabled' };
      }

      if (model.enableThinking !== undefined) {
        body['enable_thinking'] = model.enableThinking;
      }

      if (request.config?.responseMimeType === 'application/json') {
        body['response_format'] = { type: 'json_object' };
      }
    }

    const base = this.account.baseUrl.replace(/\/$/, '');
    const url = anthropic
      ? `${base}${base.endsWith('/v1') ? '' : '/v1'}/messages`
      : `${base}/chat/completions`;
    const result = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: request.config?.abortSignal,
      headers: {
        'Content-Type': 'application/json',
        ...(anthropic
          ? { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify(body),
    });

    if (!result.ok) {
      const text = await result.text().catch(() => '');

      throw Object.assign(
        new Error(
          isContextWindowExceededError({
            status: result.status,
            message: text.slice(0, 4096),
          })
            ? `${CONTEXT_WINDOW_EXCEEDED} (HTTP ${result.status})`
            : `Provider request failed (HTTP ${result.status}). Check the account endpoint, key, model and quota.`,
        ),
        { status: result.status },
      );
    }

    if (!result.body) {
      throw new Error('Provider returned an empty response stream.');
    }

    return this.parseStream(result.body, anthropic);
  }

  private async *parseStream(
    body: ReadableStream<Uint8Array>,
    anthropic: boolean,
  ): AsyncGenerator<GenerateContentResponse> {
    const calls: ToolCall[] = [];
    const open = new Map<number, ToolCall>();
    let finish: FinishReason | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoning = '';
    const thinkTags = new ThinkTagSplitter();
    for await (const data of readSSE(body)) {
      if (data === '[DONE]') {
        break;
      }

      const parts: Part[] = [];
      if (anthropic) {
        const event = anthropicEventSchema.parse(JSON.parse(data));
        if (event.type === 'error') {
          throw streamError(event.error);
        }

        if (event.message?.usage) {
          inputTokens = event.message.usage.input_tokens ?? 0;
        }

        if (event.usage) {
          outputTokens = event.usage.output_tokens ?? outputTokens;
        }

        if (event.content_block?.type === 'tool_use') {
          const call = {
            id: event.content_block.id ?? '',
            name: event.content_block.name ?? '',
            arguments: '',
          };
          calls.push(call);
          open.set(event.index ?? 0, call);
        }

        if (event.delta?.text) {
          parts.push({ text: event.delta.text });
        }

        if (event.delta?.thinking) {
          parts.push({ text: event.delta.thinking, thought: true });
        }

        if (event.delta?.partial_json) {
          const call = open.get(event.index ?? 0);
          if (call) {
            call.arguments += event.delta.partial_json;
          }
        }

        if (event.delta?.stop_reason) {
          finish =
            event.delta.stop_reason === 'max_tokens'
              ? FinishReason.MAX_TOKENS
              : FinishReason.STOP;
        }
      } else {
        const chunk = openAIChunkSchema.parse(JSON.parse(data));
        if (chunk.error) {
          throw streamError(chunk.error);
        }

        const choice = chunk.choices?.[0];
        // Only reasoning_content is replayed to the provider; the `reasoning`
        // field and <think> blocks are shown but not sent back.
        if (choice?.delta?.reasoning_content) {
          reasoning += choice.delta.reasoning_content;
          parts.push({ text: choice.delta.reasoning_content, thought: true });
        } else if (choice?.delta?.reasoning) {
          parts.push({ text: choice.delta.reasoning, thought: true });
        }

        if (choice?.delta?.content) {
          parts.push(...thinkTags.push(choice.delta.content));
        }

        for (const delta of choice?.delta?.tool_calls ?? []) {
          let call = open.get(delta.index);
          if (!call || (delta.id && call.id && delta.id !== call.id)) {
            call = { id: '', name: '', arguments: '' };
            calls.push(call);
            open.set(delta.index, call);
          }

          if (delta.id) {
            call.id = delta.id;
          }

          if (delta.function?.name) {
            call.name += delta.function.name;
          }

          if (delta.function?.arguments) {
            call.arguments += delta.function.arguments;
          }
        }

        if (choice?.finish_reason) {
          finish =
            choice.finish_reason === 'length'
              ? FinishReason.MAX_TOKENS
              : choice.finish_reason === 'content_filter'
                ? FinishReason.SAFETY
                : FinishReason.STOP;
        }

        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        }
      }

      if (parts.length) {
        yield response(parts);
      }
    }

    if (!finish) {
      throw new Error(
        'Provider stream ended before a completion marker. Please retry.',
      );
    }

    const held = thinkTags.flush();
    if (held.length) {
      yield response(held);
    }

    const parts: Part[] = [];
    for (const call of calls) {
      if (!call.id || !call.name) {
        throw new Error('Provider returned an incomplete tool call.');
      }

      const args: unknown = JSON.parse(call.arguments || '{}');
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('Invalid tool arguments from provider.');
      }

      parts.push({
        ...(reasoning && parts.length === 0
          ? {
              thoughtSignature:
                PROVIDER_REASONING_PREFIX +
                Buffer.from(reasoning).toString('base64'),
            }
          : {}),
        functionCall: {
          id: call.id,
          name: call.name,
          args: z.record(z.unknown()).parse(args),
        },
      });
    }

    const final = response(parts, finish);
    final.usageMetadata = {
      promptTokenCount: inputTokens,
      candidatesTokenCount: outputTokens,
      totalTokenCount: inputTokens + outputTokens,
    };

    yield final;
  }
}
