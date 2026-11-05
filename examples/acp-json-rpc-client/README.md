# GXDE AI Core ACP JSON-RPC Client Example

A minimal Java client for the GXDE AI Core **ACP** endpoint
(`gxde-ai-core --acp`). It speaks JSON-RPC 2.0 over newline-delimited JSON on
the agent's stdio and demonstrates every documented feature in one small
program.

## What it demonstrates

| Feature                                            | Where                                      |
| -------------------------------------------------- | ------------------------------------------ |
| `initialize` with capability negotiation           | `AcpClient#initialize`                     |
| Provider-account `authenticate`                    | `Main#authenticate`                        |
| `session/new` + multi-turn `prompt`                | `Main#newSession`, `Main#promptSync`       |
| Streaming `session/update` rendering               | `SessionUpdatePrinter`                     |
| `available_commands_update` → agent slash commands | `Main#handleNotification`, `Main#dispatch` |
| `session/request_permission`                       | `Main#handlePermission`                    |
| `fs/read_text_file` / `fs/write_text_file` proxy   | `Main#readTextFile`, `Main#writeTextFile`  |
| `session/cancel`                                   | `Main#cancel`                              |
| `session/load` (history replay)                    | `Main#loadSession`                         |
| `session/set_mode`                                 | `Main#setMode`                             |
| `session/set_model`                                | `Main#setModel`                            |
| `gxde-ai-core/auth/providers/*` extensions         | `Main#command`                             |
| `gxde-ai-core/session/setProvider` / `setModel`    | `Main#setProvider`, `Main#setModel`        |

`AcpClient` owns the child process, correlates request/response ids, and
dispatches agent-initiated requests (permissions, file access) on a separate
executor so the reader never blocks.

## Build and test

```bash
./gradlew build          # Spotless + Checkstyle + tests
./gradlew test           # integration tests against a scripted agent
./gradlew run            # interactive REPL
```

The tests spawn `FakeAcpAgent`, a scripted in-repo agent that streams a plan, a
tool call, a permission request and a file write, so the whole protocol is
covered without calling a real model.

## Usage

```bash
# interactive session
./gradlew run --args="--cwd /path/to/project"

# one prompt, then exit
./gradlew run --args="--prompt '用一句话介绍你自己'"

# scripted tour: two prompts, mode/model switch, reload
./gradlew run --args="--demo"

# resume the session id stored in .acp-session
./gradlew run --args="--resume"

# load a specific session (history is replayed as session/update)
./gradlew run --args="--load 244e3fd8-2491-469b-868b-3bc5ed60b715"
```

Options: `--agent <command>` (default `gxde-ai-core`), `--cwd <path>`,
`--session-file <path>`, `--resume`, `--load <sessionId>`, `--isolated-home`,
`--auth <methodId>`, `--prompt <text>`, `--demo`, `--no-fs`,
`--deny-permissions`, `--help`.

The client inherits the parent environment by default, so a source install reads
the accounts already configured in `~/.gemini`. Pass `--isolated-home` to set
`GXDE_AI_CORE_HOME` (when it is unset) and use the packaged `~/.gxde-ai-core`
configuration instead.

## Interactive commands

```text
<text>                      send a prompt on the current session
/prompt <text>              same as above
/cancel                     cancel the running prompt turn
/new                        create a new session
/load <sessionId>           load a stored session (history is replayed)
/session                    print the current session id
/mode <modeId>              session/set_mode
/model <modelId>            session/set_model

/providers                  list presets, accounts and the active account
/provider-current           current account plus hasApiKey
/provider-save <json>       {"account":{...},"apiKey":"sk-..."}
/provider-activate <id> [model]
/provider-delete <id>
/set-provider <accountId> [model]

/help, /quit
```

Slash commands advertised by the agent through `available_commands_update`
(`/init`, `/memory`, ...) are forwarded verbatim as prompts, so the agent's own
command set keeps working. Only the client commands above are handled locally.

Typical provider setup from the UI:

```text
/provider-save {"account":{"name":"DeepSeek","providerId":"deepseek","protocol":"openai","baseUrl":"https://api.deepseek.com","models":[{"id":"deepseek-chat"}],"model":"deepseek-chat"},"apiKey":"sk-..."}
/provider-activate <id>
```

Then `/new` (or restart with `--resume`) to use the account. ACP is
provider-account only, so `newSession` fails with a clear message until an
account with an API key is active. When that happens the client stays in the
REPL instead of exiting, so the account can be configured without restarting;
`/provider-activate` re-runs `authenticate` automatically.

## Code style

The project follows the
[Google Java Style Guide](https://google.github.io/styleguide/javaguide.html).

- **Spotless** formats sources with `google-java-format`:
  `./gradlew spotlessApply`
- **Checkstyle 14.4.0** enforces the official `google_checks.xml`
  (`config/checkstyle/checkstyle.xml`); any warning fails the build.
- `check` (and therefore `build`) runs both checks.

```bash
./gradlew checkstyleMain checkstyleTest   # style only
./gradlew check                           # style + tests
```

Reports are written to `build/reports/checkstyle/`.
