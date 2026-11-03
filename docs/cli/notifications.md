# Notifications

GXDE AI Core can send system notifications to alert you when a session completes
or when it needs your attention, such as when it's waiting for you to approve a
tool call.

Notifications are particularly useful when running long-running tasks or using
[Plan Mode](./plan-mode.md), letting you switch to other windows while Gemini
CLI works in the background.

## Requirements

### Terminal support

The CLI uses the OSC 9 terminal escape sequence to trigger system notifications.
This is supported by several modern terminal emulators including iTerm2,
WezTerm, Ghostty, and Kitty. If your terminal does not support OSC 9
notifications, Gemini CLI falls back to a terminal bell (BEL) to get your
attention. Most terminals respond to BEL with a taskbar flash or system alert
sound.

## Configure notifications

Notifications are enabled by default. Each new approval request sends one
notification, including while the terminal is focused. Session completion
notifications remain suppressed while the terminal is focused.

Use `/notification on` or `/notification off` to persist the setting. Running
`/notification` without an argument shows the current state. You can also use
the `/settings` command or update your `settings.json` file.

1.  Open the settings dialog by typing `/settings` in an interactive session.
2.  Navigate to the **General** category.
3.  Toggle the **Enable Notifications** setting to **On**.

Alternatively, add the following to your `settings.json`:

```json
{
  "general": {
    "enableNotifications": true
  }
}
```

## Types of notifications

Gemini CLI sends notifications for the following events:

- **Action required:** Triggered when the model is waiting for user input or
  tool approval. This helps you know when the CLI has paused and needs you to
  intervene.
- **Session complete:** Triggered when a session finishes successfully. This is
  useful for tracking the completion of automated tasks.

## Next steps

- Start planning with [Plan Mode](./plan-mode.md).
- Configure your experience with other [settings](./settings.md).
