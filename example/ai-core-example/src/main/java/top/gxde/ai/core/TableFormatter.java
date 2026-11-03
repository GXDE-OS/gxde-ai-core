/* Formats accounts and models returned by gxde-ai-core as text tables.
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

import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.Account.TokenLimits;
import gxde.ai.agent.AccountServiceOuterClass.ModelMatch;
import java.util.ArrayList;
import java.util.List;

/** Renders server responses as left-aligned columns. */
public final class TableFormatter {
  private static final String UNKNOWN = "-";

  private TableFormatter() {}

  /**
   * Returns one row per account with its provider, endpoint and model count.
   *
   * @param accounts the accounts to list
   * @return the table, with a header row and one line per account
   */
  public static String formatAccounts(List<AgentAccount> accounts) {
    List<List<String>> rows = new ArrayList<>();
    rows.add(List.of("ACCOUNT", "PROVIDER", "BASE_URL", "MODELS"));
    for (AgentAccount account : accounts) {
      rows.add(
          List.of(
              account.getId(),
              stripPrefix(account.getProvider().name(), "PROVIDER_"),
              account.getBaseUrl(),
              Integer.toString(account.getModelsCount())));
    }
    return formatRows(rows);
  }

  /**
   * Returns one row per model with its UUID, owner and token limits.
   *
   * @param matches the models to list together with their owning accounts
   * @return the table, with a header row and one line per model
   */
  public static String formatModels(List<ModelMatch> matches) {
    List<List<String>> rows = new ArrayList<>();
    rows.add(List.of("UUID", "ACCOUNT", "MODEL", "CONTEXT", "MAX_IN", "MAX_OUT"));
    for (ModelMatch match : matches) {
      ModelDescriptor model = match.getModel();
      TokenLimits limits = model.getTokenLimits();
      rows.add(
          List.of(
              model.getUuid(),
              match.getAccountId(),
              model.getId(),
              formatTokens(limits.getContextWindowTokens()),
              formatTokens(limits.getMaxInputTokens()),
              formatTokens(limits.getMaxOutputTokens())));
    }
    return formatRows(rows);
  }

  /**
   * Returns one row per model of {@code account}.
   *
   * @param account the account whose models are listed
   * @return the table, with a header row and one line per model
   */
  public static String formatModels(AgentAccount account) {
    List<ModelMatch> matches = new ArrayList<>();
    for (ModelDescriptor model : account.getModelsList()) {
      matches.add(ModelMatch.newBuilder().setAccountId(account.getId()).setModel(model).build());
    }
    return formatModels(matches);
  }

  static String formatTokens(long tokens) {
    return tokens == 0 ? UNKNOWN : Long.toUnsignedString(tokens);
  }

  private static String stripPrefix(String text, String prefix) {
    return text.startsWith(prefix) ? text.substring(prefix.length()) : text;
  }

  private static String formatRows(List<List<String>> rows) {
    int columns = rows.get(0).size();
    int[] widths = new int[columns];
    for (List<String> row : rows) {
      for (int i = 0; i < columns; i++) {
        widths[i] = Math.max(widths[i], row.get(i).length());
      }
    }

    StringBuilder out = new StringBuilder();
    for (List<String> row : rows) {
      StringBuilder line = new StringBuilder();
      for (int i = 0; i < columns; i++) {
        if (i > 0) {
          line.append("  ");
        }

        line.append(String.format("%-" + widths[i] + "s", row.get(i)));
      }
      out.append(line.toString().stripTrailing()).append('\n');
    }
    return out.toString();
  }
}
