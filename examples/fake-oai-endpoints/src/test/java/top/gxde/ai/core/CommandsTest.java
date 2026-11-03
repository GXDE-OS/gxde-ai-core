/* Tests that each command sends the expected request to gxde-ai-core.
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.Account.ApiProtocol;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.Account.Provider;
import gxde.ai.agent.AccountServiceOuterClass.AddModelRequest;
import gxde.ai.agent.AccountServiceOuterClass.CreateAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.DeleteAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.UpdateAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.UpdateModelRequest;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CommandsTest {
  private final ByteArrayOutputStream out = new ByteArrayOutputStream();
  private FakeCore core;
  private Commands commands;

  @BeforeEach
  void setUp() throws IOException {
    core = FakeCore.start();
    commands = new Commands(core.client(), new PrintStream(out, true, StandardCharsets.UTF_8));
  }

  @AfterEach
  void tearDown() throws InterruptedException {
    core.close();
  }

  @Test
  void accountAddBuildsAccountWithModelsAndApiKey() throws UsageException {
    run(
        "account",
        "add",
        "local",
        "--provider=custom",
        "--protocol=openai_chat_completions",
        "--base_url=http://127.0.0.1:8080/v1",
        "--api_key_env=LOCAL_KEY",
        "--models=qwen3, llama ,");

    AgentAccount account = core.lastRequest(CreateAccountRequest.class).getAccount();
    assertEquals("local", account.getId());
    assertEquals(Provider.PROVIDER_CUSTOM, account.getProvider());
    assertEquals(ApiProtocol.API_PROTOCOL_OPENAI_CHAT_COMPLETIONS, account.getApiProtocol());
    assertEquals("http://127.0.0.1:8080/v1", account.getBaseUrl());
    assertEquals(
        "LOCAL_KEY", account.getAuth().getHeader().getCredential().getEnvironmentVariable());
    assertEquals(
        List.of("qwen3", "llama"),
        account.getModelsList().stream().map(ModelDescriptor::getId).toList());
  }

  @Test
  void accountAddWithoutModelsLeavesDetectionToServer() throws UsageException {
    run("account", "add", "openai", "--provider=openai", "--no_auth");

    AgentAccount account = core.lastRequest(CreateAccountRequest.class).getAccount();
    assertEquals(0, account.getModelsCount());
    assertTrue(account.getAuth().hasNoAuth());
  }

  @Test
  void accountUpdateSendsOnlyGivenFields() throws UsageException {
    run("account", "update", "openai", "--base_url=https://proxy/v1", "--disabled");

    UpdateAccountRequest request = core.lastRequest(UpdateAccountRequest.class);
    assertEquals(List.of("base_url", "disabled"), request.getUpdateMask().getPathsList());
    assertEquals("https://proxy/v1", request.getAccount().getBaseUrl());
    assertTrue(request.getAccount().getDisabled());
  }

  @Test
  void accountRemoveSendsId() throws UsageException {
    run("account", "remove", "openai");

    assertEquals("openai", core.lastRequest(DeleteAccountRequest.class).getAccountId());
    assertEquals("Removed account openai.\n", output());
  }

  @Test
  void modelAddSendsTokenLimits() throws UsageException {
    run("model", "add", "openai", "my-model", "--context_window=32768");

    AddModelRequest request = core.lastRequest(AddModelRequest.class);
    assertEquals("openai", request.getAccountId());
    assertEquals("my-model", request.getModel().getId());
    assertEquals(32768, request.getModel().getTokenLimits().getContextWindowTokens());
  }

  @Test
  void modelUpdateChangesContextWindowOnly() throws UsageException {
    run("model", "update", "openai", "gpt-4o", "--context_window=128000");

    UpdateModelRequest request = core.lastRequest(UpdateModelRequest.class);
    assertEquals(
        List.of("token_limits.context_window_tokens"), request.getUpdateMask().getPathsList());
    assertEquals(128000, request.getModel().getTokenLimits().getContextWindowTokens());
    assertFalse(request.getModel().getDisabled());
  }

  @Test
  void rejectsBadInputBeforeSendingRequests() {
    assertUsageError("account");
    assertUsageError("account", "rename", "openai");
    assertUsageError("account", "show");
    assertUsageError("account", "update", "openai");
    assertUsageError("account", "add", "x", "--api_key_env=KEY", "--no_auth");
    assertUsageError("account", "add", "x", "--provider=nope");
    assertUsageError("account", "remove", "openai", "--models=a");
    assertUsageError("model", "update", "openai", "gpt-4o");
    assertUsageError("model", "add", "openai", "m", "--context_window=lots");
    assertUsageError("model", "list", "a", "b");
    assertEquals(0, core.requestCount());
  }

  private void run(String... args) throws UsageException {
    commands.run(CommandLine.parse(args));
  }

  private void assertUsageError(String... args) {
    assertThrows(UsageException.class, () -> run(args), String.join(" ", args));
  }

  private String output() {
    return out.toString(StandardCharsets.UTF_8);
  }
}
