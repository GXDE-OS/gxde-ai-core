package top.gxde.ai.core;

import static top.gxde.ai.core.Utils.makeJSONObject;

import java.time.Instant;
import java.util.Map;

/**
 * The handler that returns available "models".
 */
public class ModelHandler {
  /**
   * The default constructor of ModelHandler.
   */
  public ModelHandler() {}

  /**
   * Get available models.
   *
   * @param id The model id.
   * @return A map of models.
   */
  public static Map<String, Object> model(String id) {
    return makeJSONObject("id", id,
        "object", "model",
        "created", Instant.now().getEpochSecond(),
        "owned_by", "gxde");
  }
}
