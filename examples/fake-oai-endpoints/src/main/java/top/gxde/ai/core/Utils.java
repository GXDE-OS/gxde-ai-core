package top.gxde.ai.core;

import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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

  /**
   * A type conversion util that ensures the output is Map of (string, object).
   * If a <code>Map</code> type is passed in, then it will be converted.
   * If not, a <code>Map</code> will be returned.
   *
   * @param object
   * @return A Map of (string, object).
   */
  @SuppressWarnings("unchecked")
  public static Map<String, Object> ensureMap(Object object) {
    return object instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
  }

  /**
   * Returns a string from an object.
   * @param object   The object pending to extract string.
   * @param fallback The fallback message if extraction failed.
   * @return A string from an object, or the fallback string when extraction failed.
   */
  public static String string(Object object, String fallback) {
    return object instanceof String s ? s : fallback;
  }

  /**
   * Parse multiple format of OAI message to a unified string.
   * @param value The raw value.
   * @return A unified string.
   */
  public static String textContent(Object value) {
    switch (value) {
      case null -> {
        return "";
      }
      case String s -> {
        return s;
      }
      case List<?> parts -> {
        StringBuilder builder = new StringBuilder();
        for (Object part : parts) {
          if (part instanceof String s) {
            builder.append(s);
          } else {
            Map<String, Object> p = ensureMap(part);
            Object t = p.get("text");
            if (t instanceof String s) {
              builder.append(s);
            }

            else if (t instanceof Map<?, ?> nested) {
              builder.append(string(nested.get("value"), ""));
            } else if (p.containsKey("image_url") || "input_image".equals(p.get("type"))) {
              builder.append("[image]");
            }
          }
        }
        return builder.toString();
      }
      default -> {
      }
    }

    return Json.stringify(value);
  }

  /**
   * Compose the header of message stream.
   * @param exchange The <code>HttpExchange</code> that contains user requests.
   * @throws IOException If there is a server side error.
   */
  public static void beginStream(HttpExchange exchange) throws IOException {
    exchange.getResponseHeaders().set("Content-Type", "text/event-stream; charset=utf-8");
    exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-transform");
    exchange.getResponseHeaders().set("X-Accel-Buffering", "no");
    exchange.sendResponseHeaders(200, 0); // Chunked transfer encoding.
  }

  /**
   * Write message in UTF-8 format.
   * @param out   The target output stream.
   * @param value The value to write.
   * @throws IOException If I/O failed.
   */
  public static void writeUtf8(OutputStream out, String value) throws IOException {
    out.write(value.getBytes(StandardCharsets.UTF_8));
    out.flush();
  }

  /**
   * Slice the given string to an array of segments given the segment length.
   * @param text Target text.
   * @param size Segment length.
   * @return The generated array of segments.
   */
  public static List<String> segments(String text, int size) {
    List<String> result = new ArrayList<>();
    for (int i = 0; i < text.length();) {
      int end = text.offsetByCodePoints(i,
        Math.min(size, text.codePointCount(i, text.length())));
      result.add(text.substring(i, end));
      i = end;
    }
    return result;
  }
}
