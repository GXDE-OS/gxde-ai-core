/* Tests for the account and model table formatter.
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

import static org.junit.jupiter.api.Assertions.assertEquals;

import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.Account.Provider;
import gxde.ai.agent.Account.TokenLimits;
import gxde.ai.agent.AccountServiceOuterClass.ModelMatch;
import java.util.List;
import org.junit.jupiter.api.Test;

class TableFormatterTest {
  @Test
  void formatAccountsAlignsColumns() {
    AgentAccount account =
        AgentAccount.newBuilder()
            .setId("openai")
            .setProvider(Provider.PROVIDER_OPENAI)
            .setBaseUrl("https://api.openai.com/v1")
            .addModels(ModelDescriptor.getDefaultInstance())
            .build();

    assertEquals(
        """
        ACCOUNT  PROVIDER  BASE_URL                   MODELS
        openai   OPENAI    https://api.openai.com/v1  1
        """,
        TableFormatter.formatAccounts(List.of(account)));
  }

  @Test
  void formatModelsShowsUnknownLimitsAsDash() {
    ModelDescriptor model =
        ModelDescriptor.newBuilder()
            .setId("gpt-4o")
            .setUuid("123e4567-e89b-42d3-a456-426614174000")
            .setTokenLimits(TokenLimits.newBuilder().setContextWindowTokens(128000))
            .build();
    ModelMatch match = ModelMatch.newBuilder().setAccountId("openai").setModel(model).build();

    assertEquals(
        """
        UUID                                  ACCOUNT  MODEL   CONTEXT  MAX_IN  MAX_OUT
        123e4567-e89b-42d3-a456-426614174000  openai   gpt-4o  128000   -       -
        """,
        TableFormatter.formatModels(List.of(match)));
  }

  @Test
  void formatTokensTreatsValuesAsUnsigned() {
    assertEquals("18446744073709551615", TableFormatter.formatTokens(-1));
  }
}
