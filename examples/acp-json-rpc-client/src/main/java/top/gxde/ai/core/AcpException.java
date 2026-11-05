package top.gxde.ai.core;

import com.fasterxml.jackson.databind.JsonNode;

/** Error returned by the ACP agent, or raised while talking to it. */
final class AcpException extends RuntimeException {
  private static final long serialVersionUID = 1L;

  private final int code;
  private final transient JsonNode data;

  AcpException(int code, String message, JsonNode data) {
    super(message);
    this.code = code;
    this.data = data;
  }

  int code() {
    return code;
  }

  JsonNode data() {
    return data;
  }
}
