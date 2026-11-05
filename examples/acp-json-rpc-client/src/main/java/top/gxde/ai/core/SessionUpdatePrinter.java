package top.gxde.ai.core;

import com.fasterxml.jackson.databind.JsonNode;

/** Renders {@code session/update} notifications to stdout. */
final class SessionUpdatePrinter {
  private SessionUpdatePrinter() {}

  static void print(String method, JsonNode params) {
    if (!"session/update".equals(method)) {
      System.out.println("\n[notify] " + method + " " + params);
      return;
    }

    JsonNode update = params.path("update");
    String kind = update.path("sessionUpdate").asText();
    switch (kind) {
      case "agent_message_chunk", "user_message_chunk" -> printChunk(update);
      case "agent_thought_chunk" -> printThought(update);
      case "tool_call", "tool_call_update" -> printToolCall(kind, update);
      case "plan" -> printPlan(update);
      case "available_commands_update" -> printCommands(update);
      case "current_mode_update" ->
          System.out.println("\n[mode] " + update.path("currentModeId").asText());
      case "usage_update" ->
          System.out.println(
              "\n[usage] " + update.path("used").asLong() + "/" + update.path("size").asLong());
      default -> System.out.println("\n[" + kind + "] " + update);
    }
  }

  private static void printChunk(JsonNode update) {
    JsonNode content = update.path("content");
    if ("text".equals(content.path("type").asText())) {
      System.out.print(content.path("text").asText());
      System.out.flush();
    } else {
      System.out.println("\n[content] " + content);
    }
  }

  private static void printThought(JsonNode update) {
    JsonNode content = update.path("content");
    if ("text".equals(content.path("type").asText())) {
      System.out.print("\n[thought] " + content.path("text").asText());
    } else {
      System.out.println("\n[thought] " + content);
    }
  }

  private static void printToolCall(String kind, JsonNode update) {
    String title = update.path("title").asText(update.path("toolCallId").asText("tool"));
    String status = update.path("status").asText();
    System.out.println("\n[" + kind + "] " + title + (status.isEmpty() ? "" : " (" + status + ")"));
    JsonNode content = update.path("content");
    if (!content.isArray()) {
      return;
    }
    for (JsonNode item : content) {
      if ("content".equals(item.path("type").asText())) {
        JsonNode block = item.path("content");
        if ("text".equals(block.path("type").asText())) {
          System.out.println("  " + block.path("text").asText());
        }
      } else if ("diff".equals(item.path("type").asText())) {
        System.out.println("  diff " + item.path("path").asText());
      }
    }
  }

  private static void printPlan(JsonNode update) {
    System.out.println("\n[plan]");
    for (JsonNode entry : update.path("entries")) {
      System.out.println(
          "  [" + entry.path("status").asText() + "] " + entry.path("content").asText());
    }
  }

  private static void printCommands(JsonNode update) {
    System.out.println("\n[commands]");
    for (JsonNode command : update.path("availableCommands")) {
      System.out.println(
          "  /" + command.path("name").asText() + " - " + command.path("description").asText());
    }
  }
}
