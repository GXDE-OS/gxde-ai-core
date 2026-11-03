/* Implements the model commands of the example program.
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

import com.google.protobuf.FieldMask;
import com.google.protobuf.TextFormat;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.Account.TokenLimits;
import gxde.ai.agent.AccountServiceOuterClass.ModelMatch;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Lists, finds, adds, changes and removes the models of an account. */
final class ModelCommands {
  private static final Set<String> NO_FLAGS = Commands.flags();
  private static final Set<String> ADD_FLAGS =
      Commands.flags("display_name", "context_window", "max_input_tokens", "max_output_tokens");
  private static final Set<String> UPDATE_FLAGS =
      Commands.flags(
          "display_name", "context_window", "max_input_tokens", "max_output_tokens", "disabled");

  private final CoreClient client;
  private final PrintStream out;

  ModelCommands(CoreClient client, PrintStream out) {
    this.client = client;
    this.out = out;
  }

  void run(String verb, List<String> operands, CommandLine line) throws UsageException {
    switch (verb) {
      case "list" -> list(operands, line);
      case "search" -> search(operands, line);
      case "show" -> show(operands, line);
      case "add" -> add(operands, line);
      case "update" -> update(operands, line);
      case "remove" -> remove(operands, line);
      default -> throw new UsageException("Unknown model command \"" + verb + "\".");
    }
  }

  private void list(List<String> operands, CommandLine line) throws UsageException {
    if (operands.size() > 1) {
      throw new UsageException("Usage: model list [ACCOUNT]");
    }

    line.allowOnly(NO_FLAGS);
    String accountId = operands.isEmpty() ? "" : operands.get(0);
    out.print(TableFormatter.formatModels(client.searchModels("", accountId)));
  }

  private void search(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "model search <QUERY>");
    line.allowOnly(NO_FLAGS);
    out.print(TableFormatter.formatModels(client.searchModels(operands.get(0), "")));
  }

  private void show(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "model show <UUID>");
    line.allowOnly(NO_FLAGS);
    out.print(TextFormat.printer().printToString(client.getModelByUuid(operands.get(0))));
  }

  private void add(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 2, "model add <ACCOUNT> <MODEL> [flags]");
    line.allowOnly(ADD_FLAGS);
    ModelDescriptor.Builder model = ModelDescriptor.newBuilder().setId(operands.get(1));
    applyModelFlags(line, model);
    printModel(operands.get(0), client.addModel(operands.get(0), model.build()));
  }

  private void update(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 2, "model update <ACCOUNT> <MODEL> [flags]");
    line.allowOnly(UPDATE_FLAGS);
    ModelDescriptor.Builder model = ModelDescriptor.newBuilder().setId(operands.get(1));
    List<String> paths = applyModelFlags(line, model);
    Optional<Boolean> disabled = line.bool("disabled");
    if (disabled.isPresent()) {
      model.setDisabled(disabled.get());
      paths.add("disabled");
    }

    if (paths.isEmpty()) {
      throw new UsageException("Nothing to update; give at least one flag.");
    }

    FieldMask mask = FieldMask.newBuilder().addAllPaths(paths).build();
    printModel(operands.get(0), client.updateModel(operands.get(0), model.build(), mask));
  }

  private void remove(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 2, "model remove <ACCOUNT> <MODEL>");
    line.allowOnly(NO_FLAGS);
    client.deleteModel(operands.get(0), operands.get(1));
    out.println("Removed model " + operands.get(1) + " from account " + operands.get(0) + ".");
  }

  private void printModel(String accountId, ModelDescriptor model) {
    ModelMatch match = ModelMatch.newBuilder().setAccountId(accountId).setModel(model).build();
    out.print(TableFormatter.formatModels(List.of(match)));
  }

  private static List<String> applyModelFlags(CommandLine line, ModelDescriptor.Builder model)
      throws UsageException {
    List<String> paths = new ArrayList<>();
    Optional<String> displayName = line.string("display_name");
    if (displayName.isPresent()) {
      model.setDisplayName(displayName.get());
      paths.add("display_name");
    }

    TokenLimits.Builder limits = model.getTokenLimitsBuilder();
    Optional<Long> contextWindow = line.unsignedLong("context_window");
    if (contextWindow.isPresent()) {
      limits.setContextWindowTokens(contextWindow.get());
      paths.add("token_limits.context_window_tokens");
    }

    Optional<Long> maxInput = line.unsignedLong("max_input_tokens");
    if (maxInput.isPresent()) {
      limits.setMaxInputTokens(maxInput.get());
      paths.add("token_limits.max_input_tokens");
    }

    Optional<Long> maxOutput = line.unsignedLong("max_output_tokens");
    if (maxOutput.isPresent()) {
      limits.setMaxOutputTokens(maxOutput.get());
      paths.add("token_limits.max_output_tokens");
    }
    return paths;
  }
}
