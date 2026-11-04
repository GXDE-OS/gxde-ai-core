package top.gxde.ai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Json}.
 */
class JsonTest {
  /** Parses the {@code null} literal. */
  @Test
  void parseNullLiteral() {
    assertNull(Json.parse("null"));
  }

  /** Parses the boolean literals. */
  @Test
  void parseBooleanLiterals() {
    assertEquals(Boolean.TRUE, Json.parse("true"));
    assertEquals(Boolean.FALSE, Json.parse("false"));
  }

  /** Parses integral numbers as {@link Long} values. */
  @Test
  void parseIntegralNumbers() {
    assertEquals(42L, Json.parse("42"));
    assertEquals(-7L, Json.parse("-7"));
  }

  /** Parses fractional and exponent numbers as {@link Double} values. */
  @Test
  void parseFloatingPointNumbers() {
    assertEquals(1.5, Json.parse("1.5"));
    assertEquals(-2500.0, Json.parse("-2.5e3"));
    assertEquals(3.0, Json.parse("3E0"));
  }

  /** Decodes every supported JSON string escape. */
  @Test
  void parseStringEscapes() {
    String json = "\"a\\\"b\\\\c\\/d\\b\\f\\n\\r\\t\\u0041\"";
    assertEquals("a\"b\\c/d\b\f\n\r\tA", Json.parse(json));
  }

  /** Decodes a Unicode escape pair into a surrogate pair. */
  @Test
  void parseUnicodeSurrogatePair() {
    String emoji = new String(Character.toChars(0x1F600));
    assertEquals(emoji, Json.parse("\"\\uD83D\\uDE00\""));
  }

  /** Parses nested objects and arrays into maps and lists. */
  @Test
  void parseNestedObjectAndArray() {
    Object parsed = Json.parse("{\"a\":[1,true,null],\"b\":{}}");
    assertInstanceOf(Map.class, parsed);
    Map<?, ?> object = (Map<?, ?>) parsed;
    List<?> array = (List<?>) object.get("a");
    assertEquals(1L, array.get(0));
    assertEquals(Boolean.TRUE, array.get(1));
    assertNull(array.get(2));
    assertTrue(((Map<?, ?>) object.get("b")).isEmpty());
  }

  /** Skips leading and trailing whitespace around a value. */
  @Test
  void parseSkipsWhitespace() {
    assertEquals(1L, Json.parse(" \t\r\n 1 \t\r\n "));
  }

  /** Rejects empty input and whitespace-only input. */
  @Test
  void parseRejectsEmptyInput() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse(""));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("   "));
  }

  /** Rejects data that follows a complete JSON value. */
  @Test
  void parseRejectsTrailingData() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse("{}x"));
  }

  /** Rejects incomplete literals. */
  @Test
  void parseRejectsInvalidLiterals() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse("tru"));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("nul"));
  }

  /** Rejects strings that end before the closing quote. */
  @Test
  void parseRejectsUnterminatedStrings() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse("\"abc"));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("\"abc\\"));
  }

  /** Rejects unknown escapes and malformed Unicode escapes. */
  @Test
  void parseRejectsInvalidEscapes() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse("\"\\q\""));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("\"\\u12\""));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("\"\\uZZZZ\""));
  }

  /** Rejects raw control characters inside strings. */
  @Test
  void parseRejectsControlCharactersInStrings() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse("\"a\nb\""));
  }

  /** Rejects malformed objects and arrays. */
  @Test
  void parseRejectsMalformedContainers() {
    assertThrows(IllegalArgumentException.class, () -> Json.parse("{1:2}"));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("{\"a\" 1}"));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("[1,]"));
    assertThrows(IllegalArgumentException.class, () -> Json.parse("[1 2]"));
  }

  /** Serializes primitive values. */
  @Test
  void stringifyPrimitives() {
    assertEquals("null", Json.stringify(null));
    assertEquals("true", Json.stringify(Boolean.TRUE));
    assertEquals("42", Json.stringify(42L));
    assertEquals("1.5", Json.stringify(1.5));
  }

  /** Escapes quotes, backslashes, newlines, and control characters. */
  @Test
  void stringifyEscapesStrings() {
    String control = String.valueOf((char) 1);
    assertEquals("\"a\\\"b\\\\c\\n\\u0001\"", Json.stringify("a\"b\\c\n" + control));
  }

  /** Serializes maps and lists in insertion order. */
  @Test
  void stringifyCollections() {
    Map<String, Object> object = new LinkedHashMap<>();
    object.put("a", List.of(1L, true));
    assertEquals("{\"a\":[1,true]}", Json.stringify(object));
  }

  /** Rejects values that cannot be represented as JSON. */
  @Test
  void stringifyRejectsUnsupportedTypes() {
    assertThrows(IllegalArgumentException.class, () -> Json.stringify(new Object()));
  }

  /** Round-trips a nested document through serialization and parsing. */
  @Test
  void roundTripNestedDocument() {
    String source = "{\"a\":[1,-2.5,true,false,null,\"x\\n\"],\"b\":{}}";
    Object parsed = Json.parse(source);
    assertEquals(parsed, Json.parse(Json.stringify(parsed)));
  }
}
