package top.gxde.ai.core;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

public class FakeOpenAIEndpoint {
  // The fake OAI endpoint will run on localhost:65530
  private static final String HOST = System.getProperty("fake.host", "127.0.0.1");
  private static final int PORT = Integer.getInteger("fake.port", 65530);
  private static final String DEFAULT_MODEL = "fake-oai";

  /**
   * The default constructor of the server class.
   */
  public FakeOpenAIEndpoint() {}

  public static void main(String[] args) throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress(HOST, PORT), 64);
    server.createContext("/", FakeOpenAIEndpoint::serverHandler);
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();
    System.out.printf("Fake OpenAI endpoint: http://%s:%d/v1%n", HOST, PORT);
    System.out.println("Available: GET /v1/models, POST /v1/chat/completions, POST /v1/responses");
  }

  /**
   * The handler that sets up HTTP server and handles the request.
   * @param exchange     The <code>HttpExchange</code> that contains user requests.
   * @throws IOException If server have error caught.
   */
  private static void serverHandler(HttpExchange exchange) throws IOException {
    try {
      // Config server
      exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
      exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      if (exchange.getRequestMethod().equals("OPTIONS")) {
        exchange.sendResponseHeaders(204, -1);
        return;
      }

      // Get requests
      String path = exchange.getRequestURI().getPath();
      String method = exchange.getRequestMethod();

      // Handle requests
      if (method.equals("GET") && (path.equals("/") || path.equals("/health"))) {
        // sendJson(exchange, 200, obj("status", "ok", "service", "fake-oai"));
      } else if (method.equals("GET") && path.equals("/v1/models")) {
        // sendJson(exchange, 200, obj("object", "list", "data", List.of(model(DEFAULT_MODEL))));
      } else if (method.equals("GET") && path.startsWith("/v1/models/")) {
        // sendJson(exchange, 200, model(path.substring("/v1/models/".length())));
      } else if (method.equals("POST") && path.equals("/v1/chat/completions")) {
        // doChat(exchange);
      } else if (method.equals("POST") && path.equals("/v1/responses")) {
        // doResponses(exchange);
      } else {
        // sendError(exchange, 404, "Unknown endpoint or HTTP method: " + method + " " + path);
      }
    } catch (IllegalArgumentException e) {
      // sendError(exchange, 400, e.getMessage());
    } /* catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    } */ catch (Exception e) {
      /*
      e.printStackTrace();
      try {
        // sendError(exchange, 500, "Internal server error");
      } catch (IOException ignored) {
        // The client may already have received part of an SSE response, so we ignore it here.
      }
       */
    } finally {
      exchange.close();
    }
  }
}
