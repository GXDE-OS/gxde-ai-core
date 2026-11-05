/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  getEnvironmentContext,
  getChatEnvironmentContext,
  getDirectoryContextString,
} from './environmentContext.js';
import type { Config } from '../config/config.js';
import type { Storage } from '../config/storage.js';
import { getFolderStructure } from './getFolderStructure.js';
import { readLanguagePreference } from './languagePreference.js';

vi.mock('../config/config.js');
vi.mock('./getFolderStructure.js', () => ({
  getFolderStructure: vi.fn(),
}));
vi.mock('./languagePreference.js', () => ({
  readLanguagePreference: vi.fn(),
}));
vi.mock('../tools/read-many-files.js');

describe('getDirectoryContextString', () => {
  let mockConfig: Partial<Config>;

  beforeEach(() => {
    mockConfig = {
      getWorkspaceContext: vi.fn().mockReturnValue({
        getDirectories: vi.fn().mockReturnValue(['/test/dir']),
      }),
      getFileService: vi.fn(),
      storage: {
        getProjectTempDir: vi.fn().mockReturnValue('/tmp/project-temp'),
      } as unknown as Storage,
    };
    vi.mocked(getFolderStructure).mockResolvedValue('Mock Folder Structure');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return context string for a single directory', async () => {
    const contextString = await getDirectoryContextString(mockConfig as Config);
    expect(contextString).toContain('- **Workspace Directories:**');
    expect(contextString).toContain('  - /test/dir');
    expect(contextString).toContain(
      '- **Directory Structure:**\n\nMock Folder Structure',
    );
  });

  it('should return context string for multiple directories', async () => {
    (
      vi.mocked(mockConfig.getWorkspaceContext!)().getDirectories as Mock
    ).mockReturnValue(['/test/dir1', '/test/dir2']);
    vi.mocked(getFolderStructure)
      .mockResolvedValueOnce('Structure 1')
      .mockResolvedValueOnce('Structure 2');

    const contextString = await getDirectoryContextString(mockConfig as Config);
    expect(contextString).toContain('- **Workspace Directories:**');
    expect(contextString).toContain('  - /test/dir1');
    expect(contextString).toContain('  - /test/dir2');
    expect(contextString).toContain(
      '- **Directory Structure:**\n\nStructure 1\nStructure 2',
    );
  });
});

describe('getEnvironmentContext', () => {
  let mockConfig: Partial<Config>;
  let mockToolRegistry: { getTool: Mock };

  beforeEach(() => {
    mockToolRegistry = {
      getTool: vi.fn(),
    };

    mockConfig = {
      getWorkspaceContext: vi.fn().mockReturnValue({
        getDirectories: vi.fn().mockReturnValue(['/test/dir']),
      }),
      getFileService: vi.fn(),
      getIncludeDirectoryTree: vi.fn().mockReturnValue(true),
      getEnvironmentMemory: vi.fn().mockReturnValue('Mock Environment Memory'),
      getSessionMemory: vi.fn().mockReturnValue('Mock Session Memory'),

      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
      storage: {
        getProjectTempDir: vi.fn().mockReturnValue('/tmp/project-temp'),
      } as unknown as Storage,
    };

    vi.mocked(getFolderStructure).mockResolvedValue('Mock Folder Structure');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return basic environment context for a single directory', async () => {
    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1);
    const context = parts[0].text;

    expect(context).toContain('<session_context>');
    expect(context).toContain('- **Workspace Directories:**');
    expect(context).toContain('  - /test/dir');
    expect(context).toContain(
      '- **Directory Structure:**\n\nMock Folder Structure',
    );
    expect(context).toContain('Mock Session Memory');
    expect(context).toContain('</session_context>');
    expect(getFolderStructure).toHaveBeenCalledWith('/test/dir', {
      fileService: undefined,
    });
  });

  it('should return basic environment context for multiple directories', async () => {
    (
      vi.mocked(mockConfig.getWorkspaceContext!)().getDirectories as Mock
    ).mockReturnValue(['/test/dir1', '/test/dir2']);
    vi.mocked(getFolderStructure)
      .mockResolvedValueOnce('Structure 1')
      .mockResolvedValueOnce('Structure 2');

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1);
    const context = parts[0].text;

    expect(context).toContain('<session_context>');
    expect(context).toContain('- **Workspace Directories:**');
    expect(context).toContain('  - /test/dir1');
    expect(context).toContain('  - /test/dir2');
    expect(context).toContain(
      '- **Directory Structure:**\n\nStructure 1\nStructure 2',
    );
    expect(context).toContain('</session_context>');
    expect(getFolderStructure).toHaveBeenCalledTimes(2);
  });

  it('should omit directory structure when getIncludeDirectoryTree is false', async () => {
    (vi.mocked(mockConfig.getIncludeDirectoryTree!) as Mock).mockReturnValue(
      false,
    );

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1);
    const context = parts[0].text;

    expect(context).toContain('<session_context>');
    expect(context).not.toContain('Directory Structure:');
    expect(context).not.toContain('Mock Folder Structure');
    expect(context).toContain('Mock Session Memory');
    expect(context).toContain('</session_context>');
    expect(getFolderStructure).not.toHaveBeenCalled();
  });

  it('should use session memory instead of environment memory', async () => {
    (mockConfig as Record<string, unknown>)['getSessionMemory'] = vi
      .fn()
      .mockReturnValue(
        '\n<loaded_context>\n<extension_context>\nExt Memory\n</extension_context>\n<project_context>\nProj Memory\n</project_context>\n</loaded_context>',
      );

    const parts = await getEnvironmentContext(mockConfig as Config);

    const context = parts[0].text;
    expect(context).not.toContain('Mock Environment Memory');
    expect(mockConfig.getEnvironmentMemory).not.toHaveBeenCalled();
    expect(context).toContain('<loaded_context>');
    expect(context).toContain('<extension_context>');
    expect(context).toContain('Ext Memory');
    expect(context).toContain('<project_context>');
    expect(context).toContain('Proj Memory');
    expect(context).toContain('</loaded_context>');
  });

  it('should handle read_many_files returning no content', async () => {
    const mockReadManyFilesTool = {
      build: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({ llmContent: '' }),
      }),
    };
    mockToolRegistry.getTool.mockReturnValue(mockReadManyFilesTool);

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1); // No extra part added
  });

  it('should handle read_many_files tool not being found', async () => {
    mockToolRegistry.getTool.mockReturnValue(null);

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1); // No extra part added
  });
});

describe('getChatEnvironmentContext', () => {
  beforeEach(() => {
    vi.mocked(readLanguagePreference).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the ACP chat session context with dynamic model and environment details', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00'));
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('qwen3-max'),
    } as unknown as Config;
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;

    const parts = getChatEnvironmentContext(mockConfig);

    expect(parts).toHaveLength(1);
    expect(parts[0].text).toBe(
      `<session_context>
You are a helpful assistant. You are qwen3-max. We are setting up the context for our chat.
Today's date is 2026年11月5日星期四 (formatted according to the user's locale).
My operating system is: ${process.platform}.
You are chatting with user right now, while tool calls remain available. Your primary task right now is to carry on the conversation; please keep your tone lively and positive.
User's preferred language is ${systemLocale}.
</session_context>`,
    );
  });

  it('should use the configured language preference', () => {
    vi.mocked(readLanguagePreference).mockReturnValue('请用简体中文回答');
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('qwen3-max'),
    } as unknown as Config;

    const parts = getChatEnvironmentContext(mockConfig);

    expect(parts[0].text).toContain(
      "User's preferred language is 请用简体中文回答.",
    );
  });
});
