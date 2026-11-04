package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Items}.
 */
class ItemsTest {
  /** Builds a completed response with output and usage. */
  @Test
  void responseObjectCompletedContainsOutputAndUsage() {
    Map<String, Object> request = Utils.makeJsonObject("instructions", "be nice");
    List<Object> transcript = List.of(
        Utils.makeJsonObject("role", "user", "content", "hello"));
    ResponseHandler.Dialogue dialogue =
        new ResponseHandler.Dialogue("think", List.of("think"), "answer");
    Map<String, Object> response = Items.responseObject(
        "resp_1", "fake-oai", 123L, request, transcript, dialogue, "rs_1", "msg_1", true);
    assertEquals("resp_1", response.get("id"));
    assertEquals("response", response.get("object"));
    assertEquals("completed", response.get("status"));
    assertNotNull(response.get("completed_at"));
    assertNotNull(response.get("usage"));
    assertEquals("be nice", response.get("instructions"));
    List<?> output = (List<?>) response.get("output");
    assertEquals(2, output.size());
  }

  /** Builds an in-progress response without output or usage. */
  @Test
  void responseObjectInProgressOmitsOutputAndUsage() {
    Map<String, Object> request = Utils.makeJsonObject("instructions", "be nice");
    List<Object> transcript = List.of(
        Utils.makeJsonObject("role", "user", "content", "hello"));
    ResponseHandler.Dialogue dialogue =
        new ResponseHandler.Dialogue("think", List.of("think"), "answer");
    Map<String, Object> response = Items.responseObject(
        "resp_1", "fake-oai", 123L, request, transcript, dialogue, "rs_1", "msg_1", false);
    assertEquals("in_progress", response.get("status"));
    assertNull(response.get("completed_at"));
    assertNull(response.get("usage"));
    assertTrue(((List<?>) response.get("output")).isEmpty());
  }

  /** Includes a summary part when reasoning text is present. */
  @Test
  void reasoningItemIncludesSummaryWhenTextPresent() {
    Map<String, Object> item = Items.reasoningItem("rs_1", "completed", "think");
    assertEquals("reasoning", item.get("type"));
    List<?> summary = (List<?>) item.get("summary");
    assertEquals(1, summary.size());
    assertEquals("think", Utils.ensureMap(summary.get(0)).get("text"));
  }

  /** Uses an empty summary when reasoning text is missing. */
  @Test
  void reasoningItemHasEmptySummaryWhenTextMissing() {
    Map<String, Object> item = Items.reasoningItem("rs_1", "in_progress", "");
    assertTrue(((List<?>) item.get("summary")).isEmpty());
  }

  /** Wraps message text in an output text part. */
  @Test
  void messageItemWrapsOutputText() {
    Map<String, Object> item = Items.messageItem("msg_1", "answer");
    assertEquals("message", item.get("type"));
    assertEquals("assistant", item.get("role"));
    Map<String, Object> part = Utils.ensureMap(((List<?>) item.get("content")).get(0));
    assertEquals("output_text", part.get("type"));
    assertEquals("answer", part.get("text"));
  }

  /** Includes empty annotations and logprobs lists. */
  @Test
  void outputTextIncludesEmptyAnnotationsAndLogprobs() {
    Map<String, Object> part = Items.outputText("answer");
    assertEquals("answer", part.get("text"));
    assertTrue(((List<?>) part.get("annotations")).isEmpty());
    assertTrue(((List<?>) part.get("logprobs")).isEmpty());
  }
}
