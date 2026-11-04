package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Utils}.
 */
class UtilsTest {
  /** Builds a map that preserves insertion order. */
  @Test
  void makeJsonObjectPreservesInsertionOrder() {
    Map<String, Object> object = Utils.makeJsonObject("b", 2, "a", 1);
    assertEquals(List.of("b", "a"), List.copyOf(object.keySet()));
    assertEquals(2, object.get("b"));
  }

  /** Returns the original map or an empty map for non-map values. */
  @Test
  void ensureMapReturnsMapOrEmptyMap() {
    Map<String, Object> source = Map.of("a", 1);
    assertEquals(source, Utils.ensureMap(source));
    assertTrue(Utils.ensureMap("not a map").isEmpty());
    assertTrue(Utils.ensureMap(null).isEmpty());
  }

  /** Returns string values and falls back for other types. */
  @Test
  void stringReturnsValueOrFallback() {
    assertEquals("value", Utils.string("value", "fallback"));
    assertEquals("fallback", Utils.string(1, "fallback"));
    assertEquals("fallback", Utils.string(null, "fallback"));
  }

  /** Returns an empty string for {@code null} and passes strings through. */
  @Test
  void textContentHandlesStrings() {
    assertEquals("", Utils.textContent(null));
    assertEquals("hello", Utils.textContent("hello"));
  }

  /** Joins text parts and marks images. */
  @Test
  void textContentJoinsParts() {
    List<Object> parts = List.of(
        "a",
        Utils.makeJsonObject("text", "b"),
        Utils.makeJsonObject("text", Utils.makeJsonObject("value", "c")),
        Utils.makeJsonObject("image_url", "http://example.com/x.png"),
        Utils.makeJsonObject("type", "input_image"));
    assertEquals("abc[image][image]", Utils.textContent(parts));
  }

  /** Serializes values that are not text parts. */
  @Test
  void textContentSerializesUnsupportedValues() {
    assertEquals("42", Utils.textContent(42));
  }

  /** Splits text by code points so surrogate pairs stay intact. */
  @Test
  void segmentsSplitsByCodePoints() {
    assertEquals(List.of("abcd", "ef"), Utils.segments("abcdef", 4));
    String emoji = new String(Character.toChars(0x1F600));
    assertEquals(List.of(emoji, emoji), Utils.segments(emoji + emoji, 1));
  }

  /** Writes UTF-8 encoded bytes and flushes the stream. */
  @Test
  void writeUtf8WritesEncodedBytes() throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    Utils.writeUtf8(out, "hé");
    assertEquals("hé", out.toString(StandardCharsets.UTF_8));
  }

  /** Writes the event name and data fields of an SSE message. */
  @Test
  void sendSseWritesEventAndData() throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    Utils.sendSse(out, "response.created", Utils.makeJsonObject("type", "response.created"));
    assertEquals("event: response.created\ndata: {\"type\":\"response.created\"}\n\n",
        out.toString(StandardCharsets.UTF_8));
  }

  /** Omits the event field when no event name is given. */
  @Test
  void sendSseOmitsEventNameWhenNull() throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    Utils.sendSse(out, null, "ok");
    assertEquals("data: \"ok\"\n\n", out.toString(StandardCharsets.UTF_8));
  }

  /** Sets the SSE headers and starts a chunked response. */
  @Test
  void beginStreamSetsSseHeaders() throws IOException {
    FakeHttpExchange exchange = new FakeHttpExchange("POST", "/v1/responses", "");
    Utils.beginStream(exchange);
    assertEquals(200, exchange.responseCode());
    assertEquals(0, exchange.responseLength());
    assertEquals("text/event-stream; charset=utf-8",
        exchange.getResponseHeaders().getFirst("Content-Type"));
    assertEquals("no-cache, no-transform",
        exchange.getResponseHeaders().getFirst("Cache-Control"));
    assertEquals("no", exchange.getResponseHeaders().getFirst("X-Accel-Buffering"));
  }
}
