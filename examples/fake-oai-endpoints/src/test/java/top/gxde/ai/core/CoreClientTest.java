/* Tests for the gxde-ai-core blocking client.
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
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.protobuf.FieldMask;
import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.AccountServiceOuterClass.DeleteModelRequest;
import gxde.ai.agent.AccountServiceOuterClass.ModelMatch;
import gxde.ai.agent.AccountServiceOuterClass.ResolvedModel;
import gxde.ai.agent.AccountServiceOuterClass.SearchModelsRequest;
import gxde.ai.agent.AccountServiceOuterClass.UpdateAccountRequest;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CoreClientTest {
  private FakeCore core;
  private CoreClient client;

  @BeforeEach
  void setUp() throws IOException {
    core = FakeCore.start();
    client = core.client();
  }

  @AfterEach
  void tearDown() throws InterruptedException {
    core.close();
  }

  @Test
  void listAccountsReturnsServerAccounts() {
    assertEquals(List.of(FakeCore.ACCOUNT), client.listAccounts());
  }

  @Test
  void searchModelsSendsQueryAndAccount() {
    List<ModelMatch> matches = client.searchModels("GPT", "openai");

    SearchModelsRequest request = core.lastRequest(SearchModelsRequest.class);
    assertEquals("GPT", request.getQuery());
    assertEquals("openai", request.getAccountId());
    assertEquals(FakeCore.MODEL, matches.get(0).getModel());
  }

  @Test
  void updateAccountSendsMask() {
    AgentAccount account = AgentAccount.newBuilder().setId("openai").setDisabled(true).build();
    FieldMask mask = FieldMask.newBuilder().addPaths("disabled").build();

    assertEquals(account, client.updateAccount(account, mask));
    assertEquals(mask, core.lastRequest(UpdateAccountRequest.class).getUpdateMask());
  }

  @Test
  void deleteModelSendsBothIds() {
    client.deleteModel("openai", "gpt-4o");

    DeleteModelRequest request = core.lastRequest(DeleteModelRequest.class);
    assertEquals("openai", request.getAccountId());
    assertEquals("gpt-4o", request.getModelId());
  }

  @Test
  void getModelByUuidReturnsOwner() {
    ResolvedModel resolved = client.getModelByUuid(FakeCore.UUID);

    assertEquals(FakeCore.MODEL, resolved.getModel());
    assertEquals("openai", resolved.getAccount().getId());
  }

  @Test
  void getModelByUuidPropagatesServerError() {
    StatusRuntimeException e =
        assertThrows(StatusRuntimeException.class, () -> client.getModelByUuid("missing"));

    assertEquals(Status.Code.NOT_FOUND, e.getStatus().getCode());
  }
}
