package top.gxde.ai.core;

import static top.gxde.ai.core.Utils.ensureMap;
import static top.gxde.ai.core.Utils.makeJsonObject;

import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Common methods for a server.
 */
public class ServerCommons {
  /**
   * Default constructors for ServerCommons.
   */
  public ServerCommons() {}

  /**
   * Reads a request from a server.
   *
   * @param exchange The <code>HttpExchange</code> that contains user requests.
   * @return Mapped JSON request.
   * @throws IOException If there is an error on server side.
   */
  public static Map<String, Object> readRequest(HttpExchange exchange) throws IOException {
    byte[] bytes = exchange.getRequestBody().readNBytes(2_097_153);
    if (bytes.length > 2_097_152) {
      throw new IllegalArgumentException(
          "Request body is too large, please keep request body < 2MiB at most.");
    }
    Object parsed = Json.parse(new String(bytes, StandardCharsets.UTF_8));
    if (!(parsed instanceof Map<?, ?>)) {
      throw new IllegalArgumentException("Request body must be a JSON object.");
    }

    return ensureMap(parsed);
  }

  /**
   * Send the error over http exchange.
   *
   * @param exchange The target http exchange.
   * @param status The http status code.
   * @param message Message payload.
   * @throws IOException If there is a server side error.
   */
  public static void sendError(HttpExchange exchange, int status, String message)
      throws IOException {
    sendJson(exchange, status, makeJsonObject("error", makeJsonObject("message",
        message, "type", "invalid_request_error", "param", null, "code", null)));
  }

  /**
   * Send the message over http exchange.
   *
   * @param exchange The target http exchange.
   * @param status The http status code.
   * @param content Message payload.
   * @throws IOException If there is a server side error.
   */
  public static void sendJson(HttpExchange exchange, int status, Object content)
      throws IOException {
    byte[] bytes = Json.stringify(content).getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }
}
