package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link ModelHandler}.
 */
class ModelHandlerTest {
  /** Builds a model payload with the expected fields. */
  @Test
  void modelBuildsModelPayload() {
    Map<String, Object> model = ModelHandler.model("fake-oai");
    assertEquals("fake-oai", model.get("id"));
    assertEquals("model", model.get("object"));
    assertInstanceOf(Long.class, model.get("created"));
    assertEquals("gxde", model.get("owned_by"));
  }
}
