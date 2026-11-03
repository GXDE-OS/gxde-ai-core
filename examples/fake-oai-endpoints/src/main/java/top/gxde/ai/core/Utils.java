package top.gxde.ai.core;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The utility class.
 */
public class Utils {
  /**
   * The default constructor of the utility class.
   */
  public Utils() {}

  /**
   * A simple JSON object generator (generate as <code>LinkedHashMap</code>).
   * @param objs A Java varargs accepting multiple objects that one wish to be present in JSON
   *             object.
   * @return A JSON object as a <code>LinkedHashMap</code>.
   */
  public static Map<String, Object> makeJSONObject(Object... objs) {
    Map<String, Object> resultGen = new LinkedHashMap<>();
    for (int i = 0; i < objs.length; i += 2) {
      resultGen.put((String) objs[i], objs[i + 1]);
    }

    return resultGen;
  }
}
