package top.gxde.ai.core;

import java.time.Instant;
import java.util.Map;

import static top.gxde.ai.core.Utils.makeJSONObject;

/**
 * The handler that returns available "models".
 */
public class ModelHandler {
  /**
   * The default constructor of ModelHandler.
   */
  public ModelHandler() {}

  /**
   * Get
   * @param id
   * @return
   */
  private static Map<String, Object> model(String id) {
    return makeJSONObject("id", id,
      "object", "model",
      "created", Instant.now().getEpochSecond(),
      "owned_by", "gxde");
  }
}
