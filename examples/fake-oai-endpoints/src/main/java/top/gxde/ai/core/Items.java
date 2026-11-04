package top.gxde.ai.core;

import static top.gxde.ai.core.ResponseHandler.approxTokens;
import static top.gxde.ai.core.Utils.makeJsonObject;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Builds JSON payloads for the OpenAI Responses API.
 */
public class Items {
  /**
   * Builds a response object for the Responses API.
   *
   * @param id the response identifier.
   * @param model the model name.
   * @param created the creation timestamp.
   * @param request the parsed request.
   * @param transcript the normalized transcript.
   * @param d the generated dialogue.
   * @param reasoningId the reasoning item identifier.
   * @param messageId the message item identifier.
   * @param completed whether the response is already complete.
   * @return the response object.
   */
  static Map<String, Object> responseObject(String id, String model, long created,
      Map<String, Object> request, List<Object> transcript, ResponseHandler.Dialogue d,
      String reasoningId, String messageId, boolean completed) {
    Map<String, Object> details = makeJsonObject(
        "input_tokens", approxTokens(Json.stringify(transcript)),
        "output_tokens", approxTokens(d.reasoning() + d.answer()),
        "total_tokens",
        approxTokens(Json.stringify(transcript)) + approxTokens(d.reasoning() + d.answer()),
        "output_tokens_details", makeJsonObject("reasoning_tokens", approxTokens(d.reasoning())),
        "input_tokens_details", makeJsonObject("cached_tokens", 0));
    return makeJsonObject(
        "id", id, "object", "response", "created_at", created,
        "status", completed ? "completed" : "in_progress",
        "completed_at", completed ? Instant.now().getEpochSecond() : null,
        "error", null, "incomplete_details", null,
        "instructions", request.get("instructions"), "model", model,
        "output", completed
            ? List.of(reasoningItem(reasoningId, "completed", d.reasoning()),
                messageItem(messageId, d.answer()))
            : List.of(),
        "parallel_tool_calls", true, "previous_response_id", null,
        "reasoning", makeJsonObject("effort", "low", "summary", "auto"),
        "store", false, "temperature", 1.0,
        "text", makeJsonObject("format", makeJsonObject("type", "text")),
        "tool_choice", "auto", "tools", List.of(), "top_p", 1.0,
        "truncation", "disabled", "usage", completed ? details : null,
        "metadata", makeJsonObject());
  }

  /**
   * Builds a reasoning output item.
   *
   * @param id the item identifier.
   * @param status the item status.
   * @param text the reasoning summary text.
   * @return the reasoning item.
   */
  static Map<String, Object> reasoningItem(String id, String status, String text) {
    return makeJsonObject("id", id, "type", "reasoning", "status", status,
        "summary", text.isEmpty()
            ? List.of()
            : List.of(makeJsonObject("type", "summary_text", "text", text)));
  }

  /**
   * Builds an assistant message output item.
   *
   * @param id the item identifier.
   * @param text the message text.
   * @return the message item.
   */
  static Map<String, Object> messageItem(String id, String text) {
    return makeJsonObject("id", id, "type", "message", "role", "assistant",
        "status", "completed", "content", List.of(outputText(text)));
  }

  /**
   * Builds an output text content part.
   *
   * @param text the text content.
   * @return the output text part.
   */
  static Map<String, Object> outputText(String text) {
    return makeJsonObject("type", "output_text", "text", text, "annotations", List.of(),
        "logprobs", List.of());
  }
}
