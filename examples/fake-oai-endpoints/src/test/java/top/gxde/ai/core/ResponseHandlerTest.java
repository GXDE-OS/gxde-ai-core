package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

/**
 * Tests for {@link ResponseHandler}.
 */
class ResponseHandlerTest {
  /** Builds reasoning parts and an answer that contains the prompt. */
  @Test
  void dialogueBuildsReasoningAndAnswer() {
    List<Object> transcript = List.of(
        Utils.makeJsonObject("role", "user", "content", "hello"),
        Utils.makeJsonObject("role", "assistant", "content", "hi"));
    ResponseHandler.Dialogue dialogue = ResponseHandler.dialogue(transcript);
    assertTrue(dialogue.reasoning().contains("The hash is "));
    assertTrue(dialogue.answer().contains("hello"));
    assertEquals(dialogue.reasoning(), String.join("", dialogue.reasoningParts()));
  }

  /** Extends the code fence when the prompt contains backticks. */
  @Test
  void dialogueEscapesPromptFence() {
    List<Object> transcript = List.of(
        Utils.makeJsonObject("role", "user", "content", "```code```"));
    ResponseHandler.Dialogue dialogue = ResponseHandler.dialogue(transcript);
    assertTrue(dialogue.answer().contains("````\n```code```\n````"));
  }

  /** Handles transcripts without a user message. */
  @Test
  void dialogueHandlesMissingUserMessage() {
    ResponseHandler.Dialogue dialogue = ResponseHandler.dialogue(List.of());
    assertTrue(dialogue.answer().contains("your original prompt:\n\n```\n\n```"));
  }

  /** Rejects a message payload that is not an array. */
  @Test
  void normalizeMessagesRejectsNonArray() {
    assertThrows(IllegalArgumentException.class,
        () -> ResponseHandler.normalizeMessages("not a list"));
  }

  /** Skips empty message objects. */
  @Test
  void normalizeMessagesSkipsEmptyEntries() {
    List<Object> messages = List.of(
        Map.of(),
        Utils.makeJsonObject("role", "assistant", "content", "hi"));
    List<Object> normalized = ResponseHandler.normalizeMessages(messages);
    assertEquals(1, normalized.size());
    assertEquals("assistant", Utils.ensureMap(normalized.get(0)).get("role"));
  }

  /** Defaults the role and flattens structured content. */
  @Test
  void normalizeMessagesDefaultsRoleAndFlattensContent() {
    List<Object> messages = List.of(Utils.makeJsonObject(
        "content", List.of(Utils.makeJsonObject("text", "hello"), " world")));
    List<Object> normalized = ResponseHandler.normalizeMessages(messages);
    Map<String, Object> message = Utils.ensureMap(normalized.get(0));
    assertEquals("user", message.get("role"));
    assertEquals("hello world", message.get("content"));
  }

  /** Normalizes a string input and prepends instructions. */
  @Test
  void normalizeResponsesAcceptsStringInput() {
    Map<String, Object> request = Utils.makeJsonObject(
        "instructions", "be nice", "input", "hello");
    List<Object> normalized = ResponseHandler.normalizeResponses(request);
    assertEquals(2, normalized.size());
    assertEquals("developer", Utils.ensureMap(normalized.get(0)).get("role"));
    assertEquals("hello", Utils.ensureMap(normalized.get(1)).get("content"));
  }

  /** Normalizes item arrays and skips reasoning items. */
  @Test
  void normalizeResponsesAcceptsItemArray() {
    List<Object> input = List.of(
        "plain",
        Utils.makeJsonObject("type", "reasoning", "content", "ignored"),
        Utils.makeJsonObject("role", "user", "content", "item"));
    List<Object> normalized = ResponseHandler.normalizeResponses(
        Utils.makeJsonObject("input", input));
    assertEquals(2, normalized.size());
    assertEquals("plain", Utils.ensureMap(normalized.get(0)).get("content"));
    assertEquals("item", Utils.ensureMap(normalized.get(1)).get("content"));
  }

  /** Rejects requests without an input field. */
  @Test
  void normalizeResponsesRejectsMissingInput() {
    assertThrows(IllegalArgumentException.class,
        () -> ResponseHandler.normalizeResponses(Map.of()));
  }

  /** Rejects input values that are neither strings nor arrays. */
  @Test
  void normalizeResponsesRejectsUnsupportedInput() {
    assertThrows(IllegalArgumentException.class,
        () -> ResponseHandler.normalizeResponses(Utils.makeJsonObject("input", 42)));
  }

  /** Rounds the estimate up and never returns zero. */
  @Test
  void approxTokensRoundsUpAndKeepsMinimum() {
    assertEquals(1, ResponseHandler.approxTokens(""));
    assertEquals(1, ResponseHandler.approxTokens("abcd"));
    assertEquals(2, ResponseHandler.approxTokens("abcde"));
  }

  /** Writes a non-streaming chat completion response. */
  @Test
  @Timeout(10)
  void composeChatResponseWritesCompletion() throws Exception {
    FakeHttpExchange exchange = new FakeHttpExchange("POST", "/v1/chat/completions",
        "{\"model\":\"test-model\",\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}");
    ResponseHandler.composeChatResponse(exchange);
    assertEquals(200, exchange.responseCode());
    Map<String, Object> response = Utils.ensureMap(Json.parse(exchange.responseText()));
    assertEquals("chat.completion", response.get("object"));
    assertEquals("test-model", response.get("model"));
    assertNotNull(response.get("usage"));
  }
}
