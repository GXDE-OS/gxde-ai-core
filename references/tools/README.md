# Reference tool implementations

These files are copied from Hachimi CLI to serve as a reference for the tools
gxde-ai-core exposes to models. They are not built, linked or shipped with
gxde-ai-core.

## Source

- Repository: Hachimi CLI, a modified distribution of
  [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- Revision: `4011395bc9dc045991e1e6e8120b7d07f4c4521d` (2026-10-31)
- Path: `packages/core/src/tools/`

The files are copied unchanged from that revision. Test files and snapshots
were left out. Imports outside this directory, such as `../utils/` and
`../config/`, point to modules that were not copied.

## License

Unlike the rest of this repository, which is GPL-3.0-or-later, every file in
this directory stays under the Apache License, Version 2.0:

- [`LICENSE`](LICENSE) is the full license text.
- [`NOTICE`](NOTICE) is the Hachimi CLI attribution notice, copied unchanged.

Each source file keeps its original copyright and `SPDX-License-Identifier`
header. Copyright is held by Google LLC. `shell.ts` and `tool-names.ts` also
carry a notice of modifications by CharOfString.

Anyone who modifies a file here must add a notice to it saying that it was
changed, as Section 4(b) of the license requires. Anyone who ports code from
here into the GPL-licensed sources must keep the original copyright notice and
the Apache-2.0 attribution. Apache-2.0 code may be combined into GPLv3 works,
but GPLv3 code cannot be relicensed under Apache-2.0.

## Contents

| Tool | File |
| --- | --- |
| `glob` | `glob.ts` |
| `grep_search` | `ripGrep.ts` (ripgrep), `grep.ts` (git grep and built-in fallback), `grep-utils.ts` |
| `list_directory` (`ls`) | `ls.ts` |
| `read_file` | `read-file.ts` |
| `read_many_files` | `read-many-files.ts` |
| `replace` (`edit`) | `edit.ts`, `omissionPlaceholderDetector.ts` |
| `write_file` | `write-file.ts` |
| `run_shell_command` (`shell`) | `shell.ts` |
| `list_background_processes`, `read_background_output` | `shellBackgroundTools.ts` |
| `google_web_search` | `web-search.ts` |
| `web_fetch` | `web-fetch.ts` |
| `enter_plan_mode` | `enter-plan-mode.ts` |
| `exit_plan_mode` | `exit-plan-mode.ts` |
| `update_topic` | `topicTool.ts` |
| `complete_task` | `complete-task.ts` |
| `write_todos` | `write-todos.ts` |
| `tracker_create_task`, `tracker_update_task`, `tracker_get_task`, `tracker_list_tasks`, `tracker_add_dependency`, `tracker_visualize` | `trackerTools.ts`, `definitions/trackerTools.ts` |

Shared code the tools import from the same directory:

- `tools.ts`: base tool and invocation classes.
- `tool-names.ts`: tool names and aliases.
- `tool-error.ts`: error types.
- `constants.ts`.
- `jit-context.ts`.
- `modifiable-tool.ts`, `diff-utils.ts`, `diffOptions.ts`: support for editing
  a proposed change before it is applied.
- `definitions/`: parameter schemas and model-facing descriptions, with one
  set per model family.
