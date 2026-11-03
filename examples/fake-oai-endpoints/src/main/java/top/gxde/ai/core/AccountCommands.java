/* Implements the account commands of the example program.
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
import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.Account.ApiProtocol;
import gxde.ai.agent.Account.Authentication;
import gxde.ai.agent.Account.CredentialReference;
import gxde.ai.agent.Account.HeaderAuthentication;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.Account.NoAuthentication;
import gxde.ai.agent.Account.Provider;
import gxde.ai.agent.AccountServiceOuterClass.DetectModelsResponse;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Lists, creates, changes and removes accounts. */
final class AccountCommands {
  private static final Set<String> NO_FLAGS = Commands.flags();
  private static final Set<String> ADD_FLAGS =
      Commands.flags(
          "provider", "protocol", "base_url", "display_name", "api_key_env", "no_auth", "models");
  private static final Set<String> UPDATE_FLAGS =
      Commands.flags(
          "provider", "protocol", "base_url", "display_name", "api_key_env", "no_auth", "disabled");

  private final CoreClient client;
  private final PrintStream out;

  AccountCommands(CoreClient client, PrintStream out) {
    this.client = client;
    this.out = out;
  }

  void run(String verb, List<String> operands, CommandLine line) throws UsageException {
    switch (verb) {
      case "list" -> list(operands, line);
      case "show" -> show(operands, line);
      case "add" -> add(operands, line);
      case "update" -> update(operands, line);
      case "remove" -> remove(operands, line);
      case "detect" -> detect(operands, line);
      default -> throw new UsageException("Unknown account command \"" + verb + "\".");
    }
  }

  private void list(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 0, "account list");
    line.allowOnly(NO_FLAGS);
    out.print(TableFormatter.formatAccounts(client.listAccounts()));
  }

  private void show(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "account show <ID>");
    line.allowOnly(NO_FLAGS);
    out.print(TextFormat.printer().printToString(client.getAccount(operands.get(0))));
  }

  private void add(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "account add <ID> [flags]");
    line.allowOnly(ADD_FLAGS);
    AgentAccount.Builder account = AgentAccount.newBuilder().setId(operands.get(0));
    applyAccountFlags(line, account);
    for (String modelId : line.string("models").orElse("").split(",", -1)) {
      if (!modelId.isBlank()) {
        account.addModels(ModelDescriptor.newBuilder().setId(modelId.strip()));
      }
    }

    AgentAccount created = client.createAccount(account.build());
    out.print(TableFormatter.formatModels(created));
  }

  private void update(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "account update <ID> [flags]");
    line.allowOnly(UPDATE_FLAGS);
    AgentAccount.Builder account = AgentAccount.newBuilder().setId(operands.get(0));
    List<String> paths = applyAccountFlags(line, account);
    Optional<Boolean> disabled = line.bool("disabled");
    if (disabled.isPresent()) {
      account.setDisabled(disabled.get());
      paths.add("disabled");
    }

    if (paths.isEmpty()) {
      throw new UsageException("Nothing to update; give at least one flag.");
    }

    FieldMask mask = FieldMask.newBuilder().addAllPaths(paths).build();
    out.print(TableFormatter.formatAccounts(List.of(client.updateAccount(account.build(), mask))));
  }

  private void remove(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "account remove <ID>");
    line.allowOnly(NO_FLAGS);
    client.deleteAccount(operands.get(0));
    out.println("Removed account " + operands.get(0) + ".");
  }

  private void detect(List<String> operands, CommandLine line) throws UsageException {
    Commands.expectOperands(operands, 1, "account detect <ID>");
    line.allowOnly(NO_FLAGS);
    DetectModelsResponse response = client.detectModels(operands.get(0));
    if (response.getAddedModelIdsList().isEmpty()) {
      out.println("No new models.");
    } else {
      out.println("Added " + String.join(", ", response.getAddedModelIdsList()) + ".");
    }
    out.print(TableFormatter.formatModels(response.getAccount()));
  }

  private static List<String> applyAccountFlags(CommandLine line, AgentAccount.Builder account)
      throws UsageException {
    List<String> paths = new ArrayList<>();
    Optional<Provider> provider = line.protoEnum("provider", Provider.class, "PROVIDER_");
    if (provider.isPresent()) {
      account.setProvider(provider.get());
      paths.add("provider");
    }

    Optional<ApiProtocol> protocol = line.protoEnum("protocol", ApiProtocol.class, "API_PROTOCOL_");
    if (protocol.isPresent()) {
      account.setApiProtocol(protocol.get());
      paths.add("api_protocol");
    }

    Optional<String> baseUrl = line.string("base_url");
    if (baseUrl.isPresent()) {
      account.setBaseUrl(baseUrl.get());
      paths.add("base_url");
    }

    Optional<String> displayName = line.string("display_name");
    if (displayName.isPresent()) {
      account.setDisplayName(displayName.get());
      paths.add("display_name");
    }

    Optional<Authentication> auth = authentication(line);
    if (auth.isPresent()) {
      account.setAuth(auth.get());
      paths.add("auth");
    }
    return paths;
  }

  private static Optional<Authentication> authentication(CommandLine line) throws UsageException {
    Optional<String> apiKeyEnv = line.string("api_key_env");
    boolean noAuth = line.bool("no_auth").orElse(false);
    if (apiKeyEnv.isPresent() && noAuth) {
      throw new UsageException("Give either --api_key_env or --no_auth, not both.");
    }

    if (noAuth) {
      return Optional.of(
          Authentication.newBuilder().setNoAuth(NoAuthentication.getDefaultInstance()).build());
    }

    return apiKeyEnv.map(
        variable ->
            Authentication.newBuilder()
                .setHeader(
                    HeaderAuthentication.newBuilder()
                        .setCredential(
                            CredentialReference.newBuilder().setEnvironmentVariable(variable)))
                .build());
  }
}
