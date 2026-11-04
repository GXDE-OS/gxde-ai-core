package top.gxde.ai.core;

import static top.gxde.ai.core.Items.messageItem;
import static top.gxde.ai.core.Items.outputText;
import static top.gxde.ai.core.Items.reasoningItem;
import static top.gxde.ai.core.Items.responseObject;
import static top.gxde.ai.core.ServerCommons.readRequest;
import static top.gxde.ai.core.ServerCommons.sendJson;
import static top.gxde.ai.core.Utils.beginStream;
import static top.gxde.ai.core.Utils.ensureMap;
import static top.gxde.ai.core.Utils.makeJsonObject;
import static top.gxde.ai.core.Utils.segments;
import static top.gxde.ai.core.Utils.sendSse;
import static top.gxde.ai.core.Utils.string;
import static top.gxde.ai.core.Utils.textContent;
import static top.gxde.ai.core.Utils.writeUtf8;

import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A class that mocks a model response.
 */
public class ResponseHandler {
  /** The model name used when a request does not specify one. */
  private static final String DEFAULT_MODEL = "fake-oai";

  /**
   * Default constructor for request handler.
   */
  public ResponseHandler() {}

  /**
   * Represents a generated dialogue response w/ final answer.
   *
   * @param reasoning      The complete reasoning text.
   * @param reasoningParts The reasoning text divided into parts for streaming.
   * @param answer         The final response presented to the user.
   */
  public record Dialogue(String reasoning, List<String> reasoningParts, String answer) {}

  /**
   * Handles a fake dialogue.
   *
   * <p>The message starts with a fake think stream:
   *
   * <pre>{@code
   * I have received user's prompt. (block for 2 seconds)
   * I need to calculate the message's hash...
   * Hmm... The hash is %HASH%.
   * I've got everything I need. I will now compose my final answer.
   * }</pre>
   *
   * <p>And the final message will be:
   *
   * <pre>{@code
   * Oh hi there, you have reached GXDE dev's fake OAI endpoint.
   * This endpoint will help you to test if your OAI client is set up correctly.
   * You should already see the thought process above, and for debugging,
   * I will now give you your original prompt:
   *
   * ```
   * %ORIGINAL MSG%
   * ```
   *
   * ... And by the way, the dialog hash is: %HASH%.
   * }</pre>
   *
   * @param transcript The dialog record.
   * @return A composed thinking process and final message.
   */
  public static Dialogue dialogue(List<Object> transcript) {
    String lastUser = "";
    for (Object value : transcript) {
      Map<String, Object> message = ensureMap(value);
      if ("user".equals(message.get("role"))) {
        lastUser = string(message.get("content"), "");
      }
    }

    String hash;
    try {
      byte[] bytes = MessageDigest.getInstance("SHA-256")
          .digest(Json.stringify(transcript).getBytes(StandardCharsets.UTF_8));
      hash = java.util.HexFormat.of().formatHex(bytes);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }

    List<String> thoughts = List.of(
        "I have received user's prompt.\n\n",
        "I need to calculate the message's hash...\n\n",
        "Hmm... The hash is " + hash + ".\n\n",
        "I've got everything I need. I will now compose my final answer.");

    String fence = "```";
    while (lastUser.contains(fence)) {
      fence += "`";
    }
    String answer = "Oh hi there, you have reached GXDE dev's fake OAI endpoint.\n\n"
        + "This endpoint will help you to test if your OAI client is set-up correctly.\n\n"
        + "You should already see the thought process above, and for debugging, "
        + "I will now give you your original prompt:\n\n"
        + fence + "\n" + lastUser + "\n" + fence + "\n\n"
        + "... And by the way, the dialog hash is: " + hash + ".";
    return new Dialogue(String.join("", thoughts), thoughts, answer);
  }

  /**
   * Composes a chat response for the given exchange.
   *
   * @param exchange the <code>HttpExchange</code> that contains user requests.
   * @throws Exception If there is a server side issue.
   */
  public static void composeChatResponse(HttpExchange exchange) throws Exception {
    Map<String, Object> request = readRequest(exchange);
    List<Object> transcript = normalizeMessages(request.get("messages"));
    Dialogue d = dialogue(transcript);
    String model = string(request.get("model"), DEFAULT_MODEL);
    String id = "chatcmpl-" + UUID.randomUUID().toString().replace("-", "");
    long created = Instant.now().getEpochSecond();
    if (Boolean.TRUE.equals(request.get("stream"))) {
      chatStream(exchange, request, d, model, id, created);
      return;
    }
    Thread.sleep(2000);
    Map<String, Object> usage = chatUsage(transcript, d);
    sendJson(exchange, 200, makeJsonObject(
        "id", id, "object", "chat.completion", "created", created, "model", model,
        "choices", List.of(makeJsonObject("index", 0,
            "message", makeJsonObject("role", "assistant", "content", d.answer(),
                "reasoning_content", d.reasoning()),
            "finish_reason", "stop", "logprobs", null)), "usage", usage));
  }

  /**
   * Streams a chat completion as server-sent events.
   *
   * @param exchange the HTTP exchange to write the stream to.
   * @param request the parsed chat completion request.
   * @param d the generated dialogue.
   * @param model the model name reported in each chunk.
   * @param id the completion identifier shared by all chunks.
   * @param created the creation timestamp shared by all chunks.
   * @throws Exception if writing the response fails.
   */
  private static void chatStream(HttpExchange exchange, Map<String, Object> request,
      Dialogue d, String model, String id, long created) throws Exception {
    beginStream(exchange);
    OutputStream out = exchange.getResponseBody();
    chatChunk(out, id, created, model, makeJsonObject("role", "assistant", "content", ""), null);
    chatChunk(out, id, created, model,
        makeJsonObject("reasoning_content", d.reasoningParts().get(0)), null);
    Thread.sleep(2000);
    for (int i = 1; i < d.reasoningParts().size(); i++) {
      chatChunk(out, id, created, model,
          makeJsonObject("reasoning_content", d.reasoningParts().get(i)), null);
    }
    for (String segment : segments(d.answer(), 64)) {
      chatChunk(out, id, created, model, makeJsonObject("content", segment), null);
    }
    chatChunk(out, id, created, model, makeJsonObject(), "stop");
    Map<String, Object> options = ensureMap(request.get("stream_options"));
    if (Boolean.TRUE.equals(options.get("include_usage"))) {
      sendSse(out, null, makeJsonObject("id", id, "object", "chat.completion.chunk",
          "created", created, "model", model,
          "choices", List.of(), "usage",
          chatUsage(normalizeMessages(request.get("messages")), d)));
    }
    writeUtf8(out, "data: [DONE]\n\n");
  }

  /**
   * Writes a single chat completion chunk as a server-sent event.
   *
   * @param out the response stream.
   * @param id the completion identifier.
   * @param created the creation timestamp.
   * @param model the model name.
   * @param delta the incremental content for this chunk.
   * @param finishReason the finish reason, or {@code null} while the stream continues.
   * @throws IOException if writing to the stream fails.
   */
  private static void chatChunk(OutputStream out, String id, long created, String model,
      Map<String, Object> delta, String finishReason) throws IOException {
    sendSse(out, null, makeJsonObject("id", id, "object", "chat.completion.chunk",
        "created", created, "model", model,
        "choices", List.of(makeJsonObject("index", 0, "delta", delta,
            "logprobs", null, "finish_reason", finishReason))));
  }

  /**
   * Builds the usage statistics for a chat completion.
   *
   * @param transcript the normalized chat transcript.
   * @param d the generated dialogue.
   * @return the usage payload with prompt, completion, and total token counts.
   */
  private static Map<String, Object> chatUsage(List<Object> transcript, Dialogue d) {
    int input = approxTokens(Json.stringify(transcript));
    int output = approxTokens(d.reasoning() + d.answer());
    return makeJsonObject("prompt_tokens", input, "completion_tokens", output, "total_tokens",
        input + output, "completion_tokens_details",
        makeJsonObject("reasoning_tokens", approxTokens(d.reasoning())));
  }

  /**
   * Composes a response for the Responses API.
   *
   * @param exchange the <code>HttpExchange</code> that contains the user request.
   * @throws Exception if there is a server-side issue.
   */
  private static void composeResponse(HttpExchange exchange) throws Exception {
    Map<String, Object> request = readRequest(exchange);
    List<Object> transcript = normalizeResponses(request);
    Dialogue d = dialogue(transcript);
    String model = string(request.get("model"), DEFAULT_MODEL);
    String id = "resp_" + UUID.randomUUID().toString().replace("-", "");
    String reasoningId = "rs_" + UUID.randomUUID().toString().replace("-", "");
    String messageId = "msg_" + UUID.randomUUID().toString().replace("-", "");
    long created = Instant.now().getEpochSecond();
    if (Boolean.TRUE.equals(request.get("stream"))) {
      responsesStream(exchange, d, request, transcript, model, id, reasoningId, messageId,
          created);
      return;
    }
    Thread.sleep(2000);
    sendJson(exchange, 200, responseObject(id, model, created, request, transcript,
        d, reasoningId, messageId, true));
  }

  /**
   * Streams a Responses API response as sequenced server-sent events.
   *
   * @param exchange the HTTP exchange to write the stream to.
   * @param d the generated dialogue.
   * @param request the parsed request.
   * @param transcript the normalized transcript.
   * @param model the model name.
   * @param id the response identifier.
   * @param reasoningId the reasoning item identifier.
   * @param messageId the message item identifier.
   * @param created the creation timestamp.
   * @throws Exception if writing the response fails.
   */
  private static void responsesStream(HttpExchange exchange, Dialogue d,
      Map<String, Object> request, List<Object> transcript, String model, String id,
      String reasoningId, String messageId, long created) throws Exception {
    beginStream(exchange);
    OutputStream out = exchange.getResponseBody();
    Seq seq = new Seq(out);
    seq.send("response.created", "response",
        responseObject(id, model, created, request, transcript, d, reasoningId, messageId,
            false));
    seq.send("response.in_progress", "response",
        responseObject(id, model, created, request, transcript, d, reasoningId, messageId,
            false));

    seq.send("response.output_item.added", "output_index", 0,
        "item", reasoningItem(reasoningId, "in_progress", ""));
    seq.send("response.reasoning_summary_part.added", "item_id", reasoningId,
        "output_index", 0, "summary_index", 0,
        "part", makeJsonObject("type", "summary_text", "text", ""));
    seq.send("response.reasoning_summary_text.delta", "item_id", reasoningId,
        "output_index", 0, "summary_index", 0, "delta", d.reasoningParts().get(0));
    Thread.sleep(2000);
    for (int i = 1; i < d.reasoningParts().size(); i++) {
      seq.send("response.reasoning_summary_text.delta", "item_id", reasoningId,
          "output_index", 0, "summary_index", 0, "delta", d.reasoningParts().get(i));
    }
    seq.send("response.reasoning_summary_text.done", "item_id", reasoningId,
        "output_index", 0, "summary_index", 0, "text", d.reasoning());
    seq.send("response.reasoning_summary_part.done", "item_id", reasoningId,
        "output_index", 0, "summary_index", 0,
        "part", makeJsonObject("type", "summary_text", "text", d.reasoning()));
    seq.send("response.output_item.done", "output_index", 0,
        "item", reasoningItem(reasoningId, "completed", d.reasoning()));

    seq.send("response.output_item.added", "output_index", 1,
        "item", makeJsonObject("id", messageId, "type", "message", "role", "assistant",
            "status", "in_progress", "content", List.of()));
    seq.send("response.content_part.added", "item_id", messageId,
        "output_index", 1, "content_index", 0, "part", outputText(""));
    for (String segment : segments(d.answer(), 64)) {
      seq.send("response.output_text.delta", "item_id", messageId,
          "output_index", 1, "content_index", 0, "delta", segment, "logprobs", List.of());
    }
    seq.send("response.output_text.done", "item_id", messageId,
        "output_index", 1, "content_index", 0, "text", d.answer(), "logprobs", List.of());
    seq.send("response.content_part.done", "item_id", messageId,
        "output_index", 1, "content_index", 0, "part", outputText(d.answer()));
    seq.send("response.output_item.done", "output_index", 1,
        "item", messageItem(messageId, d.answer()));
    seq.send("response.completed", "response",
        responseObject(id, model, created, request, transcript, d, reasoningId, messageId,
            true));
  }

  /**
   * Estimates the number of tokens in a string.
   *
   * <p>This is not a real tokenizer; it assumes roughly four characters per token.
   *
   * @param value the text to measure.
   * @return the estimated token count, never less than one.
   */
  public static int approxTokens(String value) {
    return Math.max(1, (value.length() + 3) / 4); // Not an actual tokenizer.
  }

  /**
   * Normalizes chat messages into a uniform role/content representation.
   *
   * @param raw The raw object message.
   * @return Sanitized message.
   * @throws IllegalArgumentException If message is not an array.
   */
  public static List<Object> normalizeMessages(Object raw) throws IllegalArgumentException {
    if (!(raw instanceof List<?> messages)) {
      throw new IllegalArgumentException("The message must be an array");
    }

    List<Object> result = new ArrayList<>();
    for (Object m : messages) {
      Map<String, Object> msg = ensureMap(m);
      if (msg.isEmpty()) {
        continue;
      }

      result.add(makeJsonObject("role", string(msg.get("role"), "user"),
          "content", textContent(msg.get("content"))));
    }
    return result;
  }

  /**
   * Normalizes a Responses API request into a chat transcript.
   *
   * @param request the parsed Responses API request.
   * @return the normalized messages.
   * @throws IllegalArgumentException if {@code input} is missing or has an unsupported type.
   */
  public static List<Object> normalizeResponses(Map<String, Object> request) {
    Object input = request.get("input");
    if (input == null) {
      throw new IllegalArgumentException("'input' is required");
    }
    List<Object> result = new ArrayList<>();
    if (request.get("instructions") instanceof String instructions) {
      result.add(makeJsonObject("role", "developer", "content", instructions));
    }
    if (input instanceof String s) {
      result.add(makeJsonObject("role", "user", "content", s));
    } else if (input instanceof List<?> items) {
      for (Object item : items) {
        if (item instanceof String s) {
          result.add(makeJsonObject("role", "user", "content", s));
          continue;
        }
        Map<String, Object> msg = ensureMap(item);
        if (msg.isEmpty()) {
          continue;
        }
        // Skip reasoning/tool items; this mock only needs text-bearing conversation messages.
        if ("reasoning".equals(msg.get("type"))) {
          continue;
        }
        result.add(makeJsonObject("role", string(msg.get("role"), "user"),
            "content", textContent(msg.get("content"))));
      }
    } else {
      throw new IllegalArgumentException("'input' must be a string or an array");
    }
    return result;
  }
}
