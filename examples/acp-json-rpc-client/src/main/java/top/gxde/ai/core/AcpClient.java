package top.gxde.ai.core;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;

/**
 * Minimal ACP client: JSON-RPC 2.0 over newline-delimited JSON on the agent's stdio.
 *
 * <p>The client owns the child process and dispatches both directions of the protocol. Requests
 * sent by this client block until the matching response arrives; requests sent by the agent
 * (permissions and file access) are handled on a small executor so the reader never stalls.
 */
final class AcpClient implements AutoCloseable {
  private static final int CONNECTION_ERROR = -32000;

  private final Process process;
  private final BufferedWriter writer;
  private final Thread reader;
  private final ExecutorService agentRequests =
      Executors.newCachedThreadPool(runnable -> {
        Thread thread = new Thread(runnable, "acp-agent-request");
        thread.setDaemon(true);
        return thread;
      });
  private final Map<Long, CompletableFuture<JsonNode>> pending = new ConcurrentHashMap<>();
  private final AtomicLong nextId = new AtomicLong(1);
  private final BiConsumer<String, JsonNode> notificationHandler;
  private final BiFunction<String, JsonNode, JsonNode> requestHandler;
  private volatile boolean closed;

  AcpClient(
      List<String> command,
      Path cwd,
      Map<String, String> environment,
      BiConsumer<String, JsonNode> notificationHandler,
      BiFunction<String, JsonNode, JsonNode> requestHandler)
      throws IOException {
    this.notificationHandler = notificationHandler;
    this.requestHandler = requestHandler;

    ProcessBuilder builder = new ProcessBuilder(command);
    builder.directory(cwd.toFile());
    builder.redirectError(ProcessBuilder.Redirect.INHERIT);
    builder.environment().putAll(environment);
    this.process = builder.start();
    this.writer =
        new BufferedWriter(
            new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
    this.reader = new Thread(this::readLoop, "acp-reader");
    this.reader.setDaemon(true);
    this.reader.start();
  }

  JsonNode initialize(boolean fileSystemProxy) {
    ObjectNode params = Json.object();
    params.put("protocolVersion", 1);
    ObjectNode clientInfo = params.putObject("clientInfo");
    clientInfo.put("name", "acp-json-rpc-client");
    clientInfo.put("version", "1.0.0");
    ObjectNode capabilities = params.putObject("clientCapabilities");
    capabilities.put("terminal", false);
    ObjectNode fileSystem = capabilities.putObject("fs");
    fileSystem.put("readTextFile", fileSystemProxy);
    fileSystem.put("writeTextFile", fileSystemProxy);
    return request("initialize", params);
  }

  JsonNode authenticate(String methodId) {
    ObjectNode params = Json.object();
    params.put("methodId", methodId);
    return request("authenticate", params);
  }

  JsonNode newSession(Path cwd) {
    return request("session/new", sessionParams(cwd, null));
  }

  JsonNode loadSession(String sessionId, Path cwd) {
    return request("session/load", sessionParams(cwd, sessionId));
  }

  JsonNode prompt(String sessionId, String text) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    ArrayNode prompt = params.putArray("prompt");
    ObjectNode block = prompt.addObject();
    block.put("type", "text");
    block.put("text", text);
    return request("session/prompt", params);
  }

  void cancel(String sessionId) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    notify("session/cancel", params);
  }

  JsonNode setMode(String sessionId, String modeId) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    params.put("modeId", modeId);
    return request("session/set_mode", params);
  }

  JsonNode setModel(String sessionId, String modelId) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    params.put("modelId", modelId);
    return request("session/set_model", params);
  }

  JsonNode ext(String method, JsonNode params) {
    return request(method, params);
  }

  private ObjectNode sessionParams(Path cwd, String sessionId) {
    ObjectNode params = Json.object();
    params.put("cwd", cwd.toString());
    params.putArray("mcpServers");
    if (sessionId != null) {
      params.put("sessionId", sessionId);
    }
    return params;
  }

  private JsonNode request(String method, JsonNode params) {
    long id = nextId.getAndIncrement();
    ObjectNode message = Json.object();
    message.put("jsonrpc", "2.0");
    message.put("id", id);
    message.put("method", method);
    if (params != null) {
      message.set("params", params);
    }

    CompletableFuture<JsonNode> future = new CompletableFuture<>();
    pending.put(id, future);
    send(message);

    try {
      return future.get();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      pending.remove(id);
      throw new AcpException(CONNECTION_ERROR, "Interrupted while waiting for " + method, null);
    } catch (ExecutionException e) {
      Throwable cause = e.getCause();
      if (cause instanceof AcpException acpException) {
        throw acpException;
      }
      throw new AcpException(CONNECTION_ERROR, "Request failed: " + method, null);
    }
  }

  private void notify(String method, JsonNode params) {
    ObjectNode message = Json.object();
    message.put("jsonrpc", "2.0");
    message.put("method", method);
    if (params != null) {
      message.set("params", params);
    }
    send(message);
  }

  private void send(JsonNode message) {
    String line;
    try {
      line = Json.MAPPER.writeValueAsString(message);
    } catch (JsonProcessingException e) {
      throw new AcpException(CONNECTION_ERROR, "Failed to encode a JSON-RPC message", null);
    }

    synchronized (writer) {
      try {
        writer.write(line);
        writer.newLine();
        writer.flush();
      } catch (IOException e) {
        throw new AcpException(CONNECTION_ERROR, "Failed to write to the ACP process", null);
      }
    }
  }

  private void readLoop() {
    try (BufferedReader input =
        new BufferedReader(
            new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
      String line;
      while ((line = input.readLine()) != null) {
        if (line.isBlank()) {
          continue;
        }
        try {
          dispatch(Json.MAPPER.readTree(line));
        } catch (IOException e) {
          System.err.println("[acp] Ignoring malformed message: " + e.getMessage());
        }
      }
    } catch (IOException e) {
      if (!closed) {
        System.err.println("[acp] Reader stopped: " + e.getMessage());
      }
    } finally {
      failPending("ACP connection closed");
    }
  }

  private void dispatch(JsonNode message) {
    JsonNode id = message.get("id");
    if (message.hasNonNull("method")) {
      String method = message.path("method").asText();
      JsonNode params = message.path("params");
      if (id != null && !id.isNull()) {
        agentRequests.execute(() -> handleAgentRequest(id, method, params));
      } else {
        try {
          notificationHandler.accept(method, params);
        } catch (RuntimeException e) {
          System.err.println("[acp] Notification handler failed: " + e.getMessage());
        }
      }
      return;
    }

    if (id != null && !id.isNull()) {
      completePending(id.asLong(), message);
    }
  }

  private void handleAgentRequest(JsonNode id, String method, JsonNode params) {
    try {
      JsonNode result = requestHandler.apply(method, params);
      ObjectNode response = Json.object();
      response.put("jsonrpc", "2.0");
      response.set("id", id);
      response.set("result", result == null ? Json.object() : result);
      send(response);
    } catch (AcpException e) {
      sendError(id, e.code(), e.getMessage(), e.data());
    } catch (RuntimeException e) {
      sendError(id, -32603, String.valueOf(e.getMessage()), null);
    }
  }

  private void sendError(JsonNode id, int code, String message, JsonNode data) {
    ObjectNode response = Json.object();
    response.put("jsonrpc", "2.0");
    response.set("id", id);
    ObjectNode error = response.putObject("error");
    error.put("code", code);
    error.put("message", message);
    if (data != null) {
      error.set("data", data);
    }
    send(response);
  }

  private void completePending(long id, JsonNode message) {
    CompletableFuture<JsonNode> future = pending.remove(id);
    if (future == null) {
      return;
    }
    if (message.has("error")) {
      JsonNode error = message.path("error");
      future.completeExceptionally(
          new AcpException(
              error.path("code").asInt(-32603),
              error.path("message").asText("ACP request failed"),
              error.get("data")));
    } else {
      future.complete(message.path("result"));
    }
  }

  private void failPending(String reason) {
    AcpException error = new AcpException(CONNECTION_ERROR, reason, null);
    for (Long id : pending.keySet()) {
      CompletableFuture<JsonNode> future = pending.remove(id);
      if (future != null) {
        future.completeExceptionally(error);
      }
    }
  }

  @Override
  public void close() {
    if (closed) {
      return;
    }
    closed = true;
    try {
      writer.close();
    } catch (IOException e) {
      // Ignore: the child process may already have exited.
    }
    try {
      if (!process.waitFor(3, TimeUnit.SECONDS)) {
        process.destroy();
        if (!process.waitFor(2, TimeUnit.SECONDS)) {
          process.destroyForcibly();
        }
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      process.destroyForcibly();
    }
    agentRequests.shutdownNow();
    reader.interrupt();
  }
}
