package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link ServerCommons}.
 */
class ServerCommonsTest {
  /** Parses a JSON object request body. */
  @Test
  void readRequestParsesJsonObject() throws IOException {
    FakeHttpExchange exchange = new FakeHttpExchange("POST", "/v1/chat/completions",
        "{\"model\":\"fake-oai\"}");
    Map<String, Object> request = ServerCommons.readRequest(exchange);
    assertEquals("fake-oai", request.get("model"));
  }

  /** Rejects JSON bodies that are not objects. */
  @Test
  void readRequestRejectsNonObjectJson() {
    FakeHttpExchange exchange = new FakeHttpExchange("POST", "/", "[1,2]");
    assertThrows(IllegalArgumentException.class, () -> ServerCommons.readRequest(exchange));
  }

  /** Rejects request bodies larger than 2 MiB. */
  @Test
  void readRequestRejectsOversizedBody() {
    byte[] body = new byte[2_097_153];
    FakeHttpExchange exchange = new FakeHttpExchange("POST", "/", body);
    assertThrows(IllegalArgumentException.class, () -> ServerCommons.readRequest(exchange));
  }

  /** Writes a JSON response with the correct status and headers. */
  @Test
  void sendJsonWritesJsonResponse() throws IOException {
    FakeHttpExchange exchange = new FakeHttpExchange("GET", "/", "");
    ServerCommons.sendJson(exchange, 201, Utils.makeJsonObject("ok", true));
    assertEquals(201, exchange.responseCode());
    assertEquals(11, exchange.responseLength());
    assertEquals("application/json; charset=utf-8",
        exchange.getResponseHeaders().getFirst("Content-Type"));
    assertEquals("{\"ok\":true}", exchange.responseText());
  }

  /** Writes an OpenAI-style error payload. */
  @Test
  void sendErrorWritesErrorPayload() throws IOException {
    FakeHttpExchange exchange = new FakeHttpExchange("GET", "/", "");
    ServerCommons.sendError(exchange, 400, "bad request");
    assertEquals(400, exchange.responseCode());
    Map<String, Object> body = Utils.ensureMap(Json.parse(exchange.responseText()));
    Map<String, Object> error = Utils.ensureMap(body.get("error"));
    assertEquals("bad request", error.get("message"));
    assertEquals("invalid_request_error", error.get("type"));
  }
}
