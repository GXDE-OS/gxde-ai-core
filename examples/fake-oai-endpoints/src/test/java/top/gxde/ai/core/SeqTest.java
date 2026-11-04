package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Seq}.
 */
class SeqTest {
  /** Writes events with incrementing sequence numbers. */
  @Test
  void sendWritesSequencedEvents() throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    Seq seq = new Seq(out);
    seq.send("response.created", "response", Utils.makeJsonObject("id", "resp_1"));
    seq.send("response.completed", "response", Utils.makeJsonObject("id", "resp_1"));
    String[] events = out.toString(StandardCharsets.UTF_8).split("\n\n");
    assertEquals(2, events.length);
    assertTrue(events[0].startsWith("event: response.created\ndata: "));

    Map<String, Object> first = Utils.ensureMap(parseData(events[0]));
    assertEquals(0L, first.get("sequence_number"));
    assertEquals("response.created", first.get("type"));
    assertEquals("resp_1", Utils.ensureMap(first.get("response")).get("id"));

    Map<String, Object> second = Utils.ensureMap(parseData(events[1]));
    assertEquals(1L, second.get("sequence_number"));
    assertEquals("response.completed", second.get("type"));
  }

  /**
   * Extracts and parses the JSON payload from a server-sent event.
   *
   * @param event the serialized event.
   * @return the parsed payload.
   */
  private static Object parseData(String event) {
    return Json.parse(event.substring(event.indexOf("data: ") + 6));
  }
}
