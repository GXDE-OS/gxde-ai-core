package top.gxde.ai.core;

import static top.gxde.ai.core.Utils.makeJsonObject;
import static top.gxde.ai.core.Utils.sendSse;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;

/**
 * A helper for emitting sequenced server-sent events.
 *
 * <p>Each event carries a monotonically increasing {@code sequence_number}, as required by the
 * OpenAI Responses streaming API.
 */
public final class Seq {
  /** The response stream that events are written to. */
  private final OutputStream out;

  /** The next sequence number to assign to an event. */
  private long number = 0;

  /**
   * Creates a sequencer that writes events to the given stream.
   *
   * @param out the response stream to write events to.
   */
  Seq(OutputStream out) {
    this.out = out;
  }

  /**
   * Sends a sequenced server-sent event.
   *
   * <p>The event payload contains the given {@code type} and key-value pairs, plus the next
   * {@code sequence_number}.
   *
   * @param type the event type, also used as the SSE event name.
   * @param keyValues alternating keys and values to include in the event payload.
   * @throws IOException if writing to the stream fails.
   */
  void send(String type, Object... keyValues) throws IOException {
    Map<String, Object> event = makeJsonObject("type", type);
    event.putAll(makeJsonObject(keyValues));
    event.put("sequence_number", number++);
    sendSse(out, type, event);
  }
}
