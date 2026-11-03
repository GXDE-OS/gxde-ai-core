/* Dispatches the account and model commands of the example program.
 * ----------------------------------------------------------------------------
 * Copyright (C) 2026 CharOfString <root@charofstring.cc>
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <https://www.gnu.org/licenses/>.
 */

package top.gxde.ai.core;

import java.io.PrintStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Runs one {@code account} or {@code model} command against a {@link CoreClient}. */
final class Commands {
  static final String SOCKET_FLAG = "socket";
  static final String USAGE =
      """
      Usage: ./gradlew -q run --args='[--socket=PATH] <command> [args]'

      Accounts:
        account list
        account show <ID>
        account add <ID> [--provider=P] [--protocol=X] [--base_url=URL]
            [--display_name=NAME] [--api_key_env=VAR | --no_auth] [--models=M1,M2,...]
        account update <ID> [--provider=P] [--protocol=X] [--base_url=URL]
            [--display_name=NAME] [--api_key_env=VAR | --no_auth] [--disabled[=false]]
        account remove <ID>
        account detect <ID>

      Models:
        model list [ACCOUNT]
        model search <QUERY>
        model show <UUID>
        model add <ACCOUNT> <MODEL> [--display_name=NAME] [--context_window=N]
            [--max_input_tokens=N] [--max_output_tokens=N]
        model update <ACCOUNT> <MODEL> [--display_name=NAME] [--context_window=N]
            [--max_input_tokens=N] [--max_output_tokens=N] [--disabled[=false]]
        model remove <ACCOUNT> <MODEL>

      P is openai, anthropic, google_gemini or custom.
      X is openai_chat_completions, openai_responses, anthropic_messages,
      gemini_generate_content or gemini_interactions.
      account add detects the models from the provider when --models is not given.
      API keys are read by gxde-ai-core from its own environment; pass only the
      variable name. PATH defaults to the socket gxde-ai-core listens on.
      """;

  private final AccountCommands accounts;
  private final ModelCommands models;

  Commands(CoreClient client, PrintStream out) {
    this.accounts = new AccountCommands(client, out);
    this.models = new ModelCommands(client, out);
  }

  void run(CommandLine line) throws UsageException {
    List<String> args = line.positionals();
    if (args.size() < 2) {
      throw new UsageException("Missing command.");
    }

    String verb = args.get(1);
    List<String> operands = args.subList(2, args.size());
    switch (args.get(0)) {
      case "account" -> accounts.run(verb, operands, line);
      case "model" -> models.run(verb, operands, line);
      default -> throw new UsageException("Unknown command \"" + args.get(0) + "\".");
    }
  }

  static void expectOperands(List<String> operands, int count, String usage)
      throws UsageException {
    if (operands.size() != count) {
      throw new UsageException("Usage: " + usage);
    }
  }

  static Set<String> flags(String... names) {
    Set<String> allowed = new HashSet<>(Set.of(names));
    allowed.add(SOCKET_FLAG);
    return Set.copyOf(allowed);
  }
}
