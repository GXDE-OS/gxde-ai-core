package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** End-to-end tests that drive the client against a scripted ACP agent. */
class AcpClientTest {
  @TempDir Path tempDir;

  @Test
  void performsFullLifecycle() throws Exception {
    List<JsonNode> updates = new CopyOnWriteArrayList<>();
    try (AcpClient client = startClient(updates)) {
      JsonNode init = client.initialize(true);
      assertEquals("fake-agent", init.path("agentInfo").path("name").asText());
      assertEquals(
          "hachimi-provider-account", init.path("authMethods").path(0).path("id").asText());

      client.authenticate("hachimi-provider-account");

      JsonNode session = client.newSession(tempDir);
      String sessionId = session.path("sessionId").asText();
      assertEquals("fake-session-1", sessionId);
      assertEquals("default", session.path("modes").path("currentModeId").asText());
      assertEquals("fake-1", session.path("models").path("currentModelId").asText());

      JsonNode prompt = client.prompt(sessionId, "hello");
      assertEquals("end_turn", prompt.path("stopReason").asText());
      assertEquals(15, prompt.path("usage").path("totalTokens").asInt());
      assertTrue(
          Files.readString(tempDir.resolve("agent-note.txt")).contains("written by the agent"));
      assertTrue(hasUpdate(updates, "plan"));
      assertTrue(hasUpdate(updates, "tool_call"));
      assertTrue(hasUpdate(updates, "agent_message_chunk"));

      client.setMode(sessionId, "plan");
      client.setModel(sessionId, "fake-2");

      JsonNode providers = client.ext("gxde-ai-core/auth/providers/list", Json.object());
      assertTrue(providers.path("accounts").isArray());
      JsonNode saved = client.ext("gxde-ai-core/auth/providers/save", providerSaveParams());
      assertEquals("DeepSeek", saved.path("account").path("name").asText());
      client.ext("gxde-ai-core/auth/providers/activate", idParams("active-id"));
      client.ext("gxde-ai-core/auth/providers/current", Json.object());
      client.ext("gxde-ai-core/auth/providers/delete", idParams("other-id"));
      client.ext("gxde-ai-core/session/setProvider", setProviderParams());
      client.ext("gxde-ai-core/session/setModel", modelParams(sessionId, "fake-2"));

      JsonNode loaded = client.loadSession(sessionId, tempDir);
      assertTrue(loaded.has("modes"));
    }
  }

  @Test
  void cancelsRunningPrompt() throws Exception {
    List<JsonNode> updates = new CopyOnWriteArrayList<>();
    ExecutorService executor = Executors.newSingleThreadExecutor();
    try (AcpClient client = startClient(updates)) {
      client.initialize(false);
      String sessionId = client.newSession(tempDir).path("sessionId").asText();

      Future<JsonNode> prompt = executor.submit(() -> client.prompt(sessionId, "slow request"));
      Thread.sleep(300);
      client.cancel(sessionId);

      JsonNode result = prompt.get(5, TimeUnit.SECONDS);
      assertEquals("cancelled", result.path("stopReason").asText());
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void mainRunsOneShotPrompt() throws Exception {
    String output = captureMainOutput("--prompt", "hello");

    assertTrue(output.contains("Connected to Fake Agent"), output);
    assertTrue(output.contains("[stop] end_turn"), output);
    assertTrue(Files.readString(tempDir.resolve(".acp-session")).contains("fake-session-1"));
  }

  @Test
  void mainRunsScriptedDemo() throws Exception {
    String output = captureMainOutput("--demo");

    assertTrue(output.contains("=== demo: two-turn conversation ==="), output);
    assertTrue(output.contains("echo: 你好"), output);
    assertTrue(output.contains("[set_mode] plan"), output);
    assertTrue(output.contains("[setModel] fake-2"), output);
    assertTrue(output.contains("=== demo: reload the same session ==="), output);
    assertTrue(output.contains("Loaded session: fake-session-1"), output);
  }

  @Test
  void replDispatchesCommands() throws Exception {
    String script =
        """
        /providers
        /provider-current
        /provider-save {"account":{"name":"DeepSeek","providerId":"deepseek","protocol":"openai","baseUrl":"https://api.deepseek.com","models":[{"id":"deepseek-chat"}],"model":"deepseek-chat"},"apiKey":"sk-test"}
        /provider-activate active-id
        /provider-delete other-id
        /set-provider active-id deepseek-chat
        /mode plan
        /model fake-2
        /session
        /quit
        """;
    InputStream original = System.in;
    System.setIn(new ByteArrayInputStream(script.getBytes(StandardCharsets.UTF_8)));
    String output;
    try {
      output = captureMainOutput();
    } finally {
      System.setIn(original);
    }

    assertTrue(output.contains("\"accounts\""), output);
    assertTrue(output.contains("\"hasApiKey\""), output);
    assertTrue(output.contains("\"DeepSeek\""), output);
    assertTrue(output.contains("\"activeAccountId\" : \"active-id\""), output);
    assertTrue(output.contains("\"deleted\" : true"), output);
    assertTrue(output.contains("[mode] plan"), output);
    assertTrue(output.contains("[model] fake-2"), output);
    assertTrue(output.contains("session: fake-session-1"), output);
  }

  @Test
  void replForwardsAgentCommands() throws Exception {
    InputStream original = System.in;
    System.setIn(new ByteArrayInputStream("/init\n/quit\n".getBytes(StandardCharsets.UTF_8)));
    String output;
    try {
      output = captureMainOutput();
    } finally {
      System.setIn(original);
    }

    assertTrue(output.contains("[commands]"), output);
    assertTrue(output.contains("echo: /init"), output);
  }

  private String captureMainOutput(String... extra) throws Exception {
    List<String> args =
        new ArrayList<>(
            List.of(
                "--agent",
                agentCommand(),
                "--cwd",
                tempDir.toString(),
                "--session-file",
                tempDir.resolve(".acp-session").toString()));
    args.addAll(List.of(extra));

    PrintStream original = System.out;
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    System.setOut(new PrintStream(buffer, true, StandardCharsets.UTF_8));
    try {
      Main.main(args.toArray(String[]::new));
    } finally {
      System.setOut(original);
    }
    return buffer.toString(StandardCharsets.UTF_8);
  }

  private AcpClient startClient(List<JsonNode> updates) throws IOException {
    return new AcpClient(
        List.of(javaBinary(), "-cp", classpath(), FakeAcpAgent.class.getName()),
        tempDir,
        Map.of("GXDE_AI_CORE_HOME", tempDir.toString()),
        (method, params) -> updates.add(params),
        this::handleAgentRequest);
  }

  private JsonNode handleAgentRequest(String method, JsonNode params) {
    return switch (method) {
      case "session/request_permission" -> allowOnce(params);
      case "fs/write_text_file" -> {
        writeFile(params);
        yield Json.object();
      }
      case "fs/read_text_file" -> readFile(params);
      default -> throw new AcpException(-32601, "Method not found: " + method, null);
    };
  }

  private JsonNode allowOnce(JsonNode params) {
    ObjectNode response = Json.object();
    ObjectNode outcome = response.putObject("outcome");
    outcome.put("outcome", "selected");
    outcome.put("optionId", params.path("options").path(0).path("optionId").asText());
    return response;
  }

  private void writeFile(JsonNode params) {
    try {
      Files.writeString(Path.of(params.path("path").asText()), params.path("content").asText());
    } catch (IOException e) {
      throw new AcpException(-32000, "Cannot write file: " + e.getMessage(), null);
    }
  }

  private JsonNode readFile(JsonNode params) {
    try {
      ObjectNode response = Json.object();
      response.put("content", Files.readString(Path.of(params.path("path").asText())));
      return response;
    } catch (IOException e) {
      throw new AcpException(-32000, "Cannot read file: " + e.getMessage(), null);
    }
  }

  private boolean hasUpdate(List<JsonNode> updates, String kind) {
    return updates.stream()
        .anyMatch(update -> kind.equals(update.path("update").path("sessionUpdate").asText()));
  }

  private ObjectNode providerSaveParams() {
    ObjectNode params = Json.object();
    ObjectNode account = params.putObject("account");
    account.put("name", "DeepSeek");
    account.put("providerId", "deepseek");
    account.put("protocol", "openai");
    account.put("baseUrl", "https://api.deepseek.com");
    account.putArray("models").addObject().put("id", "deepseek-chat");
    account.put("model", "deepseek-chat");
    params.put("apiKey", "sk-test");
    return params;
  }

  private ObjectNode idParams(String id) {
    ObjectNode params = Json.object();
    params.put("id", id);
    return params;
  }

  private ObjectNode setProviderParams() {
    ObjectNode params = Json.object();
    params.put("sessionId", "fake-session-1");
    params.put("providerAccountId", "active-id");
    params.put("model", "deepseek-chat");
    return params;
  }

  private ObjectNode modelParams(String sessionId, String modelId) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    params.put("modelId", modelId);
    return params;
  }

  private String agentCommand() {
    return javaBinary() + " -cp " + classpath() + " " + FakeAcpAgent.class.getName();
  }

  private String javaBinary() {
    return Path.of(System.getProperty("java.home"), "bin", "java").toString();
  }

  private String classpath() {
    return Arrays.stream(System.getProperty("java.class.path").split(File.pathSeparator))
        .map(entry -> Path.of(entry).toAbsolutePath().toString())
        .collect(Collectors.joining(File.pathSeparator));
  }
}
