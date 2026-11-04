package top.gxde.ai.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A simple JSON parser.
 *
 * <p>Parsed values are represented as {@link Map} for JSON objects, {@link List} for JSON arrays,
 * {@link String} for strings, {@link Boolean} for booleans, {@link Long} for integral numbers,
 * {@link Double} for fractional or exponent numbers, and {@code null} for JSON {@code null}.
 */
public class Json {
  /** The JSON source text being parsed. */
  private final String source;

  /** The index of the next character to read in {@link #source}. */
  private int pos;

  /**
   * Constructor of JSON class.
   *
   * @param source The JSON source string.
   */
  public Json(String source) {
    this.source = source;
  }

  /**
   * Parses a JSON string into an Object.
   *
   * @param source a JSON string.
   * @return An JSON object.
   * @throws IllegalArgumentException If trailing JSON data is unexpected.
   */
  public static Object parse(String source) throws IllegalArgumentException {
    Json p = new Json(source);
    Object value = p.value();
    p.whitespace();
    if (p.pos != p.source.length()) {
      throw new IllegalArgumentException("Unexpected trailing JSON data");
    }
    return value;
  }

  /**
   * Parses the next JSON value starting at the current position.
   *
   * <p>Leading whitespace is skipped before the value is read.
   *
   * @return the parsed value, which may be {@code null}.
   * @throws IllegalArgumentException if the input is malformed or ends unexpectedly.
   */
  public Object value() {
    whitespace();
    if (pos >= source.length()) {
      throw new IllegalArgumentException("Unexpected end of JSON");
    }
    char c = source.charAt(pos);
    if (c == '{') {
      return object();
    }
    if (c == '[') {
      return array();
    }
    if (c == '"') {
      return quoted();
    }
    if (c == 't') {
      return literal("true", Boolean.TRUE);
    }
    if (c == 'f') {
      return literal("false", Boolean.FALSE);
    }
    if (c == 'n') {
      return literal("null", null);
    }
    if (c == '-' || Character.isDigit(c)) {
      return number();
    }
    throw new IllegalArgumentException("Unexpected JSON character at " + pos);
  }

  /**
   * Consumes an expected literal token and returns its value.
   *
   * @param literal the literal text to consume, such as {@code true} or {@code null}.
   * @param value the value to return once the literal is consumed.
   * @return the given {@code value}.
   * @throws IllegalArgumentException if the literal is not present at the current position.
   */
  private Object literal(String literal, Object value) {
    if (!source.startsWith(literal, pos)) {
      throw new IllegalArgumentException("Invalid JSON literal at " + pos);
    }
    pos += literal.length();
    return value;
  }

  /**
   * Parses a JSON object.
   *
   * @return the parsed object, preserving the order of its keys.
   * @throws IllegalArgumentException if the object is malformed.
   */
  private Map<String, Object> object() {
    pos++;
    Map<String, Object> m = new LinkedHashMap<>();
    whitespace();
    if (consume('}')) {
      return m;
    }
    do {
      whitespace();
      if (pos >= source.length() || source.charAt(pos) != '"') {
        throw new IllegalArgumentException("Expected JSON object key at " + pos);
      }
      String key = quoted();
      whitespace();
      expect(':');
      m.put(key, value());
      whitespace();
      if (consume('}')) {
        return m;
      }
      expect(',');
    } while (true);
  }

  /**
   * Parses a JSON array.
   *
   * @return the parsed array.
   * @throws IllegalArgumentException if the array is malformed.
   */
  private List<Object> array() {
    pos++;
    List<Object> values = new ArrayList<>();
    whitespace();
    if (consume(']')) {
      return values;
    }
    do {
      values.add(value());
      whitespace();
      if (consume(']')) {
        return values;
      }
      expect(',');
    } while (true);
  }

  /**
   * Parses a JSON string literal.
   *
   * @return the decoded string without the surrounding quotes.
   * @throws IllegalArgumentException if the string is unterminated or contains an invalid escape.
   */
  private String quoted() {
    expect('"');
    StringBuilder b = new StringBuilder();
    while (pos < source.length()) {
      char c = source.charAt(pos++);
      if (c == '"') {
        return b.toString();
      }
      if (c != '\\') {
        if (c < 0x20) {
          throw new IllegalArgumentException("Control character inside JSON string");
        }
        b.append(c);
        continue;
      }
      if (pos >= source.length()) {
        throw new IllegalArgumentException("Unterminated JSON escape");
      }
      char escape = source.charAt(pos++);
      switch (escape) {
        case '"' -> b.append('"');
        case '\\' -> b.append('\\');
        case '/' -> b.append('/');
        case 'b' -> b.append('\b');
        case 'f' -> b.append('\f');
        case 'n' -> b.append('\n');
        case 'r' -> b.append('\r');
        case 't' -> b.append('\t');
        case 'u' -> {
          if (pos + 4 > source.length()) {
            throw new IllegalArgumentException("Invalid Unicode escape");
          }
          try {
            b.append((char) Integer.parseInt(source.substring(pos, pos + 4), 16));
          } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid Unicode escape", e);
          }
          pos += 4;
        }
        default -> throw new IllegalArgumentException("Invalid JSON escape: " + escape);
      }
    }
    throw new IllegalArgumentException("Unterminated JSON string");
  }

  /**
   * Parses a JSON number.
   *
   * @return a {@link Long} for integral numbers, or a {@link Double} for numbers with a fraction
   *         or exponent.
   * @throws IllegalArgumentException if the number is malformed.
   */
  private Number number() {
    final int start = pos;
    if (source.charAt(pos) == '-') {
      pos++;
    }
    while (pos < source.length() && Character.isDigit(source.charAt(pos))) {
      pos++;
    }
    boolean floating = false;
    if (pos < source.length() && source.charAt(pos) == '.') {
      floating = true;
      pos++;
      while (pos < source.length() && Character.isDigit(source.charAt(pos))) {
        pos++;
      }
    }
    if (pos < source.length() && (source.charAt(pos) == 'e' || source.charAt(pos) == 'E')) {
      floating = true;
      pos++;
      if (pos < source.length() && (source.charAt(pos) == '-' || source.charAt(pos) == '+')) {
        pos++;
      }
      while (pos < source.length() && Character.isDigit(source.charAt(pos))) {
        pos++;
      }
    }
    try {
      if (floating) {
        return Double.valueOf(source.substring(start, pos));
      }
      return Long.valueOf(source.substring(start, pos));
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException("Invalid JSON number", e);
    }
  }

  /**
   * Skips JSON whitespace characters.
   */
  private void whitespace() {
    while (pos < source.length() && " \t\r\n".indexOf(source.charAt(pos)) >= 0) {
      pos++;
    }
  }

  /**
   * Consumes the given character if it is next in the input.
   *
   * @param c the character to consume.
   * @return {@code true} if the character was consumed, {@code false} otherwise.
   */
  private boolean consume(char c) {
    if (pos < source.length() && source.charAt(pos) == c) {
      pos++;
      return true;
    }
    return false;
  }

  /**
   * Skips whitespace and then consumes the given character.
   *
   * @param c the expected character.
   * @throws IllegalArgumentException if the next character is not {@code c}.
   */
  private void expect(char c) {
    whitespace();
    if (!consume(c)) {
      throw new IllegalArgumentException("Expected '" + c + "' at " + pos);
    }
  }

  /**
   * Serializes a supported value to compact JSON text.
   *
   * <p>Supported values are {@code null}, {@link String}, {@link Boolean}, {@link Number},
   * {@link Map}, and {@link List}.
   *
   * @param object the value to serialize.
   * @return the JSON text for the given value.
   * @throws IllegalArgumentException if the value has an unsupported type.
   */
  static String stringify(Object object) {
    if (object == null) {
      return "null";
    }
    if (object instanceof String s) {
      return quote(s);
    }
    if (object instanceof Boolean || object instanceof Number) {
      return object.toString();
    }
    if (object instanceof Map<?, ?> map) {
      StringBuilder b = new StringBuilder("{");
      for (Map.Entry<?, ?> e : map.entrySet()) {
        if (b.length() > 1) {
          b.append(',');
        }
        b.append(quote(String.valueOf(e.getKey())))
            .append(':')
            .append(stringify(e.getValue()));
      }
      return b.append('}').toString();
    }
    if (object instanceof List<?> list) {
      StringBuilder b = new StringBuilder("[");
      for (Object element : list) {
        if (b.length() > 1) {
          b.append(',');
        }
        b.append(stringify(element));
      }
      return b.append(']').toString();
    }
    throw new IllegalArgumentException("Cannot serialize: " + object.getClass());
  }

  /**
   * Encodes a string as a quoted JSON string literal.
   *
   * @param s the string to encode.
   * @return the quoted and escaped JSON literal.
   */
  private static String quote(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"' -> b.append("\\\"");
        case '\\' -> b.append("\\\\");
        case '\b' -> b.append("\\b");
        case '\f' -> b.append("\\f");
        case '\n' -> b.append("\\n");
        case '\r' -> b.append("\\r");
        case '\t' -> b.append("\\t");
        default -> {
          if (c < 0x20) {
            b.append(String.format("\\u%04x", (int) c));
          } else {
            b.append(c);
          }
        }
      }
    }
    return b.append('"').toString();
  }
}
