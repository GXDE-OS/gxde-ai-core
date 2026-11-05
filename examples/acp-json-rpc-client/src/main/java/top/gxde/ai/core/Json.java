package top.gxde.ai.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Shared JSON helpers for the ACP example. */
final class Json {
  static final ObjectMapper MAPPER = new ObjectMapper();

  private Json() {}

  static ObjectNode object() {
    return MAPPER.createObjectNode();
  }
}
