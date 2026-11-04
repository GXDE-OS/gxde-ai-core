package top.gxde.ai.core;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpContext;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpPrincipal;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * A minimal in-memory {@link HttpExchange} used by unit tests.
 */
final class FakeHttpExchange extends HttpExchange {
  private final Headers requestHeaders = new Headers();
  private final Headers responseHeaders = new Headers();
  private final ByteArrayOutputStream responseBody = new ByteArrayOutputStream();
  private final Map<String, Object> attributes = new HashMap<>();
  private final InputStream requestBody;
  private final String method;
  private final URI uri;
  private int responseCode = -1;
  private long responseLength = -1;

  /**
   * Creates an exchange with a UTF-8 encoded request body.
   *
   * @param method the HTTP method.
   * @param uri the request URI.
   * @param requestBody the request body as text.
   */
  FakeHttpExchange(String method, String uri, String requestBody) {
    this(method, uri, requestBody.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Creates an exchange with a raw request body.
   *
   * @param method the HTTP method.
   * @param uri the request URI.
   * @param requestBody the raw request body.
   */
  FakeHttpExchange(String method, String uri, byte[] requestBody) {
    this.method = method;
    this.uri = URI.create(uri);
    this.requestBody = new ByteArrayInputStream(requestBody);
  }

  /**
   * Returns the response body as UTF-8 text.
   *
   * @return the response body.
   */
  String responseText() {
    return responseBody.toString(StandardCharsets.UTF_8);
  }

  /**
   * Returns the response status code.
   *
   * @return the response status code, or {@code -1} if no response was sent.
   */
  int responseCode() {
    return responseCode;
  }

  /**
   * Returns the response length passed to {@code sendResponseHeaders}.
   *
   * @return the response length, or {@code -1} if no response was sent.
   */
  long responseLength() {
    return responseLength;
  }

  @Override
  public Headers getRequestHeaders() {
    return requestHeaders;
  }

  @Override
  public Headers getResponseHeaders() {
    return responseHeaders;
  }

  @Override
  public URI getRequestURI() {
    return uri;
  }

  @Override
  public String getRequestMethod() {
    return method;
  }

  @Override
  public HttpContext getHttpContext() {
    return null;
  }

  @Override
  public void close() {}

  @Override
  public InputStream getRequestBody() {
    return requestBody;
  }

  @Override
  public OutputStream getResponseBody() {
    return responseBody;
  }

  @Override
  public void sendResponseHeaders(int code, long length) throws IOException {
    this.responseCode = code;
    this.responseLength = length;
  }

  @Override
  public InetSocketAddress getRemoteAddress() {
    return new InetSocketAddress("127.0.0.1", 12345);
  }

  @Override
  public int getResponseCode() {
    return responseCode;
  }

  @Override
  public InetSocketAddress getLocalAddress() {
    return new InetSocketAddress("127.0.0.1", 8080);
  }

  @Override
  public String getProtocol() {
    return "HTTP/1.1";
  }

  @Override
  public Object getAttribute(String name) {
    return attributes.get(name);
  }

  @Override
  public void setAttribute(String name, Object value) {
    attributes.put(name, value);
  }

  @Override
  public void setStreams(InputStream input, OutputStream output) {
    throw new UnsupportedOperationException("setStreams is not supported");
  }

  @Override
  public HttpPrincipal getPrincipal() {
    return null;
  }
}
