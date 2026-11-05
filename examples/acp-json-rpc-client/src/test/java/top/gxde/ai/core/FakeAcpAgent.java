package top.gxde.ai.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

/**
 * Scripted ACP agent used by the tests.
 *
 * <p>It implements the same wire protocol as {@code gxde-ai-core --acp}, streams a plan, a tool
 * call and a permission request, and exercises the client's file-system proxy.
 */
final class FakeAcpAgent {
  private final BufferedReader input =
      new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
  private final BufferedWriter output =
      new BufferedWriter(new OutputStreamWriter(System.out, StandardCharsets.UTF_8));
  private long nextId = 1000;
  private String cwd = ".";
  private boolean cancelled;

  /** Starts the fake agent. */
  public static void main(String[] args) throws IOException {
    new FakeAcpAgent().run();
  }

  private void run() throws IOException {
    String line;
    while ((line = input.readLine()) != null) {
      if (line.isBlank()) {
        continue;
      }
      JsonNode message = Json.MAPPER.readTree(line);
      if (message.hasNonNull("method")) {
        String method = message.path("method").asText();
        if (message.hasNonNull("id")) {
          handleRequest(message.path("id"), method, message.path("params"));
        } else if ("session/cancel".equals(method)) {
          cancelled = true;
        }
      }
    }
  }

  private void handleRequest(JsonNode id, String method, JsonNode params) throws IOException {
    switch (method) {
      case "initialize" -> respond(id, initializeResult());
      case "authenticate" -> respond(id, Json.object());
      case "session/new" -> {
        cwd = params.path("cwd").asText(".");
        respond(id, sessionResult("fake-session-1"));
        sleep(150);
        sendUpdate("fake-session-1", availableCommands());
      }
      case "session/load" -> {
        cwd = params.path("cwd").asText(".");
        String sessionId = params.path("sessionId").asText();
        sendUpdate(sessionId, chunk("agent_message_chunk", "replayed history"));
        respond(id, sessionResult(sessionId));
      }
      case "session/prompt" -> handlePrompt(id, params);
      case "session/set_mode", "session/set_model" -> respond(id, Json.object());
      default -> handleExtension(id, method, params);
    }
  }

  private void handleExtension(JsonNode id, String method, JsonNode params) throws IOException {
    switch (method) {
      case "gxde-ai-core/auth/providers/list" -> {
        ObjectNode result = Json.object();
        result.putArray("presets");
        result.putArray("accounts");
        result.putNull("activeAccountId");
        respond(id, result);
      }
      case "gxde-ai-core/auth/providers/current" -> {
        ObjectNode result = Json.object();
        result.putNull("account");
        result.put("hasApiKey", false);
        respond(id, result);
      }
      case "gxde-ai-core/auth/providers/save" -> {
        ObjectNode result = Json.object();
        result.set("account", params.path("account").deepCopy());
        respond(id, result);
      }
      case "gxde-ai-core/auth/providers/delete" -> {
        ObjectNode result = Json.object();
        result.put("deleted", true);
        respond(id, result);
      }
      case "gxde-ai-core/auth/providers/activate" -> {
        ObjectNode result = Json.object();
        result.put("activeAccountId", params.path("id").asText());
        respond(id, result);
      }
      case "gxde-ai-core/session/setProvider" -> {
        ObjectNode result = Json.object();
        result.put("sessionId", params.path("sessionId").asText());
        result.put("providerAccountId", params.path("providerAccountId").asText());
        result.put("model", params.path("model").asText("fake-1"));
        result.putArray("availableModels").addObject().put("modelId", "fake-1");
        respond(id, result);
      }
      case "gxde-ai-core/session/setModel" -> {
        ObjectNode result = Json.object();
        result.put("sessionId", params.path("sessionId").asText());
        result.put("modelId", params.path("modelId").asText());
        respond(id, result);
      }
      default -> respondError(id, -32601, "Method not found: " + method);
    }
  }

  private void handlePrompt(JsonNode id, JsonNode params) throws IOException {
    String sessionId = params.path("sessionId").asText();
    String text = params.path("prompt").path(0).path("text").asText();
    cancelled = false;

    sendUpdate(sessionId, chunk("agent_message_chunk", "echo: " + text));
    sendUpdate(sessionId, plan());
    sendUpdate(sessionId, toolCall("tool-1", "Read a file", "read", "pending"));

    if (text.contains("slow")) {
      while (!cancelled) {
        JsonNode incoming = readMessage();
        if (incoming == null) {
          break;
        }
        if ("session/cancel".equals(incoming.path("method").asText())) {
          cancelled = true;
        }
      }
      respondPrompt(id, "cancelled");
      return;
    }

    JsonNode permission = request("session/request_permission", permissionParams(sessionId));
    boolean allowed =
        permission != null
            && "selected".equals(permission.path("outcome").path("outcome").asText());
    sendUpdate(
        sessionId, toolCall("tool-1", "Read a file", "read", allowed ? "completed" : "failed"));

    ObjectNode write = Json.object();
    write.put("sessionId", sessionId);
    write.put("path", Path.of(cwd).resolve("agent-note.txt").toString());
    write.put("content", "written by the agent\n");
    request("fs/write_text_file", write);

    sendUpdate(sessionId, chunk("agent_message_chunk", "done"));
    respondPrompt(id, "end_turn");
  }

  private JsonNode request(String method, ObjectNode params) throws IOException {
    long id = nextId++;
    ObjectNode message = Json.object();
    message.put("jsonrpc", "2.0");
    message.put("id", id);
    message.put("method", method);
    message.set("params", params);
    send(message);

    while (true) {
      JsonNode incoming = readMessage();
      if (incoming == null) {
        return null;
      }
      if (incoming.hasNonNull("method")) {
        if ("session/cancel".equals(incoming.path("method").asText())) {
          cancelled = true;
          return null;
        }
        continue;
      }
      if (incoming.path("id").asLong() == id) {
        return incoming.path("result");
      }
    }
  }

  private JsonNode readMessage() throws IOException {
    String line = input.readLine();
    if (line == null || line.isBlank()) {
      return null;
    }
    return Json.MAPPER.readTree(line);
  }

  private ObjectNode initializeResult() {
    ObjectNode result = Json.object();
    result.put("protocolVersion", 1);
    ObjectNode authMethod = result.putArray("authMethods").addObject();
    authMethod.put("id", "hachimi-provider-account");
    authMethod.put("name", "Provider account");
    ObjectNode info = result.putObject("agentInfo");
    info.put("name", "fake-agent");
    info.put("title", "Fake Agent");
    info.put("version", "1.0.0");
    ObjectNode capabilities = result.putObject("agentCapabilities");
    capabilities.put("loadSession", true);
    capabilities.putObject("promptCapabilities").put("image", true);
    ObjectNode extensions = capabilities.putObject("_meta").putObject("gxde-ai-core");
    extensions.putObject("providerAccounts");
    return result;
  }

  private ObjectNode sessionResult(String sessionId) {
    ObjectNode result = Json.object();
    result.put("sessionId", sessionId);
    ObjectNode modes = result.putObject("modes");
    modes.putArray("availableModes").addObject().put("id", "default").put("name", "Default");
    modes.putArray("availableModes").addObject().put("id", "plan").put("name", "Plan");
    modes.put("currentModeId", "default");
    ObjectNode models = result.putObject("models");
    models.putArray("availableModels").addObject().put("modelId", "fake-1").put("name", "Fake 1");
    models.putArray("availableModels").addObject().put("modelId", "fake-2").put("name", "Fake 2");
    models.put("currentModelId", "fake-1");
    return result;
  }

  private ObjectNode plan() {
    ObjectNode update = Json.object();
    update.put("sessionUpdate", "plan");
    ArrayNode entries = update.putArray("entries");
    entries
        .addObject()
        .put("content", "read the file")
        .put("priority", "high")
        .put("status", "pending");
    entries.addObject().put("content", "summarize").put("priority", "low").put("status", "pending");
    return update;
  }

  private ObjectNode availableCommands() {
    ObjectNode update = Json.object();
    update.put("sessionUpdate", "available_commands_update");
    ArrayNode commands = update.putArray("availableCommands");
    commands.addObject().put("name", "init").put("description", "Analyze the project");
    commands.addObject().put("name", "memory").put("description", "Manage memory");
    return update;
  }

  private ObjectNode toolCall(String toolCallId, String title, String kind, String status) {
    ObjectNode update = Json.object();
    update.put("sessionUpdate", "tool_call");
    update.put("toolCallId", toolCallId);
    update.put("title", title);
    update.put("kind", kind);
    update.put("status", status);
    return update;
  }

  private ObjectNode chunk(String kind, String text) {
    ObjectNode update = Json.object();
    update.put("sessionUpdate", kind);
    ObjectNode content = update.putObject("content");
    content.put("type", "text");
    content.put("text", text);
    return update;
  }

  private ObjectNode permissionParams(String sessionId) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    ObjectNode toolCall = params.putObject("toolCall");
    toolCall.put("toolCallId", "tool-1");
    toolCall.put("title", "Read a file");
    ArrayNode options = params.putArray("options");
    options
        .addObject()
        .put("optionId", "allow-once")
        .put("name", "Allow")
        .put("kind", "allow_once");
    options
        .addObject()
        .put("optionId", "reject-once")
        .put("name", "Reject")
        .put("kind", "reject_once");
    return params;
  }

  private void sendUpdate(String sessionId, ObjectNode update) throws IOException {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    params.set("update", update);
    ObjectNode notification = Json.object();
    notification.put("jsonrpc", "2.0");
    notification.put("method", "session/update");
    notification.set("params", params);
    send(notification);
  }

  private void respondPrompt(JsonNode id, String stopReason) throws IOException {
    ObjectNode result = Json.object();
    result.put("stopReason", stopReason);
    ObjectNode usage = result.putObject("usage");
    usage.put("inputTokens", 10);
    usage.put("outputTokens", 5);
    usage.put("totalTokens", 15);
    respond(id, result);
  }

  private void respond(JsonNode id, JsonNode result) throws IOException {
    ObjectNode response = Json.object();
    response.put("jsonrpc", "2.0");
    response.set("id", id);
    response.set("result", result);
    send(response);
  }

  private void respondError(JsonNode id, int code, String message) throws IOException {
    ObjectNode response = Json.object();
    response.put("jsonrpc", "2.0");
    response.set("id", id);
    ObjectNode error = response.putObject("error");
    error.put("code", code);
    error.put("message", message);
    send(response);
  }

  private void sleep(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private void send(JsonNode message) throws IOException {
    output.write(Json.MAPPER.writeValueAsString(message));
    output.newLine();
    output.flush();
  }
}
