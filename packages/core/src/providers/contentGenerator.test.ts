/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FinishReason, type GenerateContentParameters } from '@google/genai';
import {
  ProviderContentGenerator,
  ThinkTagSplitter,
  openAIMessages,
  readSSE,
} from './contentGenerator.js';
import { stripToolCallIdPrefixes } from '../core/geminiChat.js';
import type { ProviderAccount } from './types.js';

const account: ProviderAccount = {
  id: 'account',
  name: 'Test',
  providerId: 'deepseek',
  protocol: 'openai',
  baseUrl: 'https://example.test/v1',
  model: 'chat',
  models: [{ id: 'chat' }, { id: 'reasoner' }],
};

function sse(events: unknown[]) {
  return new Response(
    events
      .map(
        (e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\r\n\r\n`,
      )
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

afterEach(() => vi.unstubAllGlobals());
describe('provider protocol adapter', () => {
  it('accepts null id and function fields on streamed tool call deltas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call1',
                      function: { name: 'read_file', arguments: null },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: null,
                      function: { name: null, arguments: '{"path":"a"}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
          '[DONE]',
        ]),
      ),
    );
    const generator = new ProviderContentGenerator(
      account,
      'private-key',
      () => 'chat',
    );
    const result = await generator.generateContent({
      model: 'chat',
      contents: 'hi',
      config: { abortSignal: new AbortController().signal },
    });

    expect(result.functionCalls).toEqual([
      { id: 'call1', name: 'read_file', args: { path: 'a' } },
    ]);
  });

  it('routes auxiliary Gemini model names to the selected account model and joins streamed tools', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sse([
        { choices: [{ delta: { reasoning_content: 'think' } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call1',
                    function: { name: 'read_file', arguments: '{"pa' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: 'th":"a"}' } }],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
        { choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } },
        '[DONE]',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const generator = new ProviderContentGenerator(
      account,
      'private-key',
      () => 'reasoner',
    );
    const result = await generator.generateContent({
      model: 'gemini-flash',
      contents: 'hi',
      config: {
        abortSignal: controller.signal,
        tools: [
          {
            functionDeclarations: [
              { name: 'read_file', parametersJsonSchema: { type: 'object' } },
            ],
          },
        ],
      },
    });

    expect(result.functionCalls).toEqual([
      { id: 'call1', name: 'read_file', args: { path: 'a' } },
    ]);

    expect(result.candidates?.[0]?.content?.parts?.[0]).toEqual({
      text: 'think',
      thought: true,
    });

    expect(result.usageMetadata?.totalTokenCount).toBe(14);
    const history = [
      {
        role: 'model',
        parts: result.candidates![0].content!.parts!.filter(
          (part) => !part.thought,
        ),
      },
    ];
    const replay = openAIMessages({
      model: 'reasoner',
      contents: stripToolCallIdPrefixes(history, true),
    });

    expect(replay[0].reasoning_content).toBe('think');
    expect(
      stripToolCallIdPrefixes(history)[0].parts?.[0].thoughtSignature,
    ).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(JSON.parse(init.body).model).toBe('reasoner');
    expect(init.signal).toBe(controller.signal);
    expect(init.redirect).toBe('error');
  });

  it('splits parallel tool calls that share an index but have distinct ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call1',
                      function: {
                        name: 'list_directory',
                        arguments: '{"dir_path":"/a"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call2',
                      function: { name: 'read_file', arguments: '{"path":' },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, function: { arguments: '"b"}' } }],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
          '[DONE]',
        ]),
      ),
    );

    const result = await new ProviderContentGenerator(
      account,
      'private-key',
      () => 'chat',
    ).generateContent({ model: 'chat', contents: 'hi' });

    expect(result.functionCalls).toEqual([
      { id: 'call1', name: 'list_directory', args: { dir_path: '/a' } },
      { id: 'call2', name: 'read_file', args: { path: 'b' } },
    ]);
  });

  it('uses the requested model when the account has it', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        sse([
          { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] },
          '[DONE]',
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const generator = new ProviderContentGenerator(
      account,
      'private-key',
      () => 'chat',
    );

    await generator.generateContent({ model: 'reasoner', contents: 'hi' });
    await generator.generateContent({ model: 'gemini-flash', contents: 'hi' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('reasoner');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe('chat');
  });

  it('preserves tool call IDs and reasoning across subsequent turns', () => {
    const request: GenerateContentParameters = {
      model: 'chat',
      contents: [
        {
          role: 'model',
          parts: [
            { text: 'thinking', thought: true },
            {
              functionCall: {
                name: 'read_file',
                id: 'call1',
                args: { path: 'a' },
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call1',
                name: 'read_file',
                response: { output: 'contents' },
              },
            },
          ],
        },
      ],
    };

    const messages = openAIMessages(request);
    expect(messages[0]['reasoning_content']).toBe('thinking');
    expect(messages[1]).toMatchObject({ role: 'tool', tool_call_id: 'call1' });
  });

  it('parses Anthropic message and tool events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sse([
        { type: 'message_start', message: { usage: { input_tokens: 7 } } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'tool1', name: 'read_file' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"path":"a"}' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' },
          usage: { output_tokens: 3 },
        },
        { type: 'message_stop' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new ProviderContentGenerator(
      { ...account, protocol: 'anthropic' },
      'key',
      () => 'chat',
    ).generateContent({
      model: 'chat',
      contents: 'hello',
      config: { systemInstruction: 'system' },
    });

    expect(result.functionCalls?.[0]).toEqual({
      id: 'tool1',
      name: 'read_file',
      args: { path: 'a' },
    });

    expect(result.usageMetadata?.totalTokenCount).toBe(10);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/v1/messages');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      system: 'system',
      max_tokens: 8192,
    });
  });

  it('rejects Gemini-only tools rather than pretending to execute them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new ProviderContentGenerator(
        account,
        'key',
        () => 'chat',
      ).generateContent({
        model: 'chat',
        contents: 'Search the web',
        config: { tools: [{ googleSearch: {} }] },
      }),
    ).rejects.toThrow('Gemini built-in tools');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not treat a truncated stream as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sse([{ choices: [{ delta: { content: 'partial' } }] }]),
        ),
    );
    await expect(
      new ProviderContentGenerator(
        account,
        'key',
        () => 'chat',
      ).generateContent({ model: 'chat', contents: 'hi' }),
    ).rejects.toThrow('before a completion marker');
  });

  it('reports HTTP status without exposing echoed API keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('private-key echoed', { status: 401 })),
    );
    await expect(
      new ProviderContentGenerator(
        account,
        'private-key',
        () => 'chat',
      ).generateContent({ model: 'chat', contents: 'hi' }),
    ).rejects.toThrow('HTTP 401');
  });

  it('reports context window overflow without exposing the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message:
                "private-key: This model's maximum context length is 128000 tokens.",
            },
          }),
          { status: 400 },
        ),
      ),
    );
    const request = new ProviderContentGenerator(
      account,
      'private-key',
      () => 'chat',
    ).generateContent({ model: 'chat', contents: 'hi' });

    await expect(request).rejects.toMatchObject({
      message: 'Provider request exceeds the model context window. (HTTP 400)',
      status: 400,
    });
  });

  it('reports context window overflow from a streaming error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sse([
            { error: { code: 'context_length_exceeded', message: 'too long' } },
          ]),
        ),
    );
    await expect(
      new ProviderContentGenerator(
        account,
        'key',
        () => 'chat',
      ).generateContent({ model: 'chat', contents: 'hi' }),
    ).rejects.toThrow('Provider request exceeds the model context window.');
  });

  it('parses split UTF-8 and multiline SSE data', async () => {
    const bytes = new TextEncoder().encode('data: 你好\r\ndata: world\r\n\r\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) {
          controller.enqueue(Uint8Array.of(byte));
        }

        controller.close();
      },
    });

    const result = [];
    for await (const event of readSSE(body)) {
      result.push(event);
    }

    expect(result).toEqual(['你好\nworld']);
  });

  it('emits the stop reason after streamed text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          {
            choices: [{ delta: { content: 'Hello' }, finish_reason: 'stop' }],
          },
          '[DONE]',
        ]),
      ),
    );
    const result = await new ProviderContentGenerator(
      account,
      'key',
      () => 'chat',
    ).generateContent({ model: 'chat', contents: 'hi' });
    expect(result.text).toBe('Hello');
    expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
  });

  it('sends the user effort clamped to the model, else the preset default', async () => {
    const effortAccount: ProviderAccount = {
      ...account,
      model: 'tiered',
      models: [
        {
          id: 'tiered',
          reasoning: {
            thinking: true,
            efforts: ['high', 'max'],
            defaultEffort: 'high',
          },
        },
        { id: 'plain' },
      ],
    };
    const sent: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return sse([
          { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] },
          '[DONE]',
        ]);
      }),
    );
    let model = 'tiered';
    let effort: 'low' | 'xhigh' | undefined;
    const generator = new ProviderContentGenerator(
      effortAccount,
      'key',
      () => model,
      () => effort,
    );
    const send = () => generator.generateContent({ model, contents: 'hi' });

    await send();
    effort = 'low';
    await send();
    effort = 'xhigh';
    await send();
    model = 'plain';
    await send();

    expect(sent.map((body) => body['reasoning_effort'])).toEqual([
      'high',
      'high',
      'max',
      undefined,
    ]);
  });

  it('shows the reasoning field and <think> blocks as thoughts without replaying them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          { choices: [{ delta: { reasoning: 'Plan ' } }] },
          { choices: [{ delta: { content: '<thi' } }] },
          { choices: [{ delta: { content: 'nk>\nCheck the ' } }] },
          { choices: [{ delta: { content: 'input</th' } }] },
          { choices: [{ delta: { content: 'ink>\n\n' } }] },
          {
            choices: [
              {
                delta: {
                  content: 'Done',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call1',
                      function: { name: 'read_file', arguments: '{}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
          '[DONE]',
        ]),
      ),
    );
    const result = await new ProviderContentGenerator(
      account,
      'key',
      () => 'chat',
    ).generateContent({ model: 'chat', contents: 'hi' });
    const parts = result.candidates?.[0]?.content?.parts ?? [];

    expect(
      parts
        .filter((p) => p.thought)
        .map((p) => p.text)
        .join(''),
    ).toBe('Plan Check the input');
    expect(
      parts
        .filter((p) => p.text !== undefined && !p.thought)
        .map((p) => p.text)
        .join(''),
    ).toBe('Done');
    expect(parts.find((p) => p.functionCall)?.thoughtSignature).toBeUndefined();
  });
});

describe('ThinkTagSplitter', () => {
  const run = (chunks: string[]) => {
    const splitter = new ThinkTagSplitter();
    const parts = [
      ...chunks.flatMap((chunk) => splitter.push(chunk)),
      ...splitter.flush(),
    ];
    const join = (thought: boolean) =>
      parts
        .filter((p) => !!p.thought === thought)
        .map((p) => p.text)
        .join('');
    return { thought: join(true), answer: join(false) };
  };

  it('passes plain answers through unchanged', () => {
    expect(run(['Hello', ' world'])).toEqual({
      thought: '',
      answer: 'Hello world',
    });
  });

  it('keeps a tag that is not at the start of the answer', () => {
    expect(run(['Use ', '<think>', ' tags'])).toEqual({
      thought: '',
      answer: 'Use <think> tags',
    });
  });

  it('splits a leading block, including tags across chunks', () => {
    expect(run(['  <think>', 'a</', 'think', '>', '\n', 'b'])).toEqual({
      thought: 'a',
      answer: 'b',
    });
  });

  it('treats an unterminated block as thought', () => {
    expect(run(['<think>still going'])).toEqual({
      thought: 'still going',
      answer: '',
    });
  });

  it('releases a held partial open tag at the end', () => {
    expect(run(['<th'])).toEqual({ thought: '', answer: '<th' });
  });
});
