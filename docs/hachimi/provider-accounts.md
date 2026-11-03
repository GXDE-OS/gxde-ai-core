# Provider accounts

Hachimi authenticates through named API-key accounts. Run `hachimi`, then use
`/auth` → **Provider accounts**. This is the only authentication method; Google
login, Gemini API keys, and Vertex AI are not available.

## Add an account

1. Choose **Add account from preset / custom provider**.
2. Choose a preset and, where offered, its region or plan endpoint.
3. Enter a recognizable account name, such as `DeepSeek personal` or
   `DeepSeek work`.
4. Confirm the API base URL and enter the API key. Key input is masked.
5. Review or edit the comma-separated model IDs.
6. Review the endpoint and models, then choose **Save and select model**.

Saving alone does not send an API request. The first prompt tests the actual
credential, model availability and quota. Preset model availability depends on
your provider account; model IDs and endpoints are editable.

## Presets

The initial catalog is adapted from the supplied local Qwen Code checkout:

- DeepSeek
- Kimi / Moonshot
- MiniMax
- Z.AI
- ModelScope
- iDealab
- Alibaba ModelStudio: Standard API Key, Coding Plan, Token Plan
- QwenCloud: Standard API Key, Token Plan

Region and plan endpoint choices are preserved. Presets are bundled snapshots;
Hachimi does not automatically download changes from Qwen Code. Dedicated image
models are omitted from this chat-model selector.

Custom providers support OpenAI-compatible **Chat Completions**, Anthropic
**Messages**, and the Gemini API. OpenAI Responses and Qwen OAuth are not part
of this account manager. Use a custom provider to connect any additional
endpoint.

## Switch, edit and remove accounts

Use `/auth` → **Provider accounts** to select a saved account. A provider can
have multiple accounts, including accounts at different endpoints. Each account
has its own API key and model list. The selection survives restart and is also
used by headless `hachimi -p ...` runs.

Use `/model` to switch between the active account's models. `/model set <id>` is
temporary; append `--persist` to remember it. Add missing model IDs by editing
the account. Preset context-window limits are used for compression; manually
added models default to a conservative 32,768 tokens. Advanced users can set a
positive `contextWindowSize` on a model in the account metadata file.

Editing an account with a blank API-key field retains its existing key. Editing
the active account refreshes its runtime configuration. Switch away from an
account before deleting it; deletion removes its saved key.

Switching providers keeps conversation history: subsequent requests send that
history to the selected endpoint. The selector displays this before switching.

To stop using a provider account, run `/auth signout`. This deactivates the
active provider account while preserving it for later selection. Provider
accounts are the only authentication method, so there is no separate Gemini
login to return to.

## Storage and compatibility

Account metadata and the active selection live in
`~/.gemini/hachimi-accounts.json`, written atomically with user-only
permissions. API keys are stored separately under the
`hachimi-provider-accounts` keychain service, using the existing encrypted-file
fallback where a system keychain is unavailable. They are not stored in account
metadata, shown in review screens, or placed in command history.

The packaged `gxde-ai-core` and `hachimi` launchers enable isolated
configuration. They use `~/.gxde-ai-core/` instead of `~/.gemini/` and prefix
keychain entries with `gxde-ai-core-`, so settings, accounts, history,
extensions and credentials do not overlap with Gemini CLI or Hachimi CLI. Set
`GXDE_AI_CORE_HOME` to change the base directory.

`GEMINI_CLI_HOME` also relocates this storage for source and npm installs.
Existing `GEMINI.md`, `.gemini/`, and `~/.gemini/settings.json` behavior remains
compatible. Provider selection is applied to Hachimi's in-memory settings; it
does not overwrite the saved authentication type or preferred model. Enforced
authentication and external authentication settings take precedence over
provider accounts.

OpenAI-compatible and Anthropic routes support streamed text, tool calls and
inline images. Embeddings, remote file URIs and Gemini built-in tools (such as
Google Search) are not supported by those adapters; use an MCP search service
where needed. Token counts use a conservative local estimate when the protocol
has no token-count endpoint. DeepSeek reasoning is retained across tool rounds.
