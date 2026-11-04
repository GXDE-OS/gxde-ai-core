package top.gxde.ai.core;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.Executors;

import static top.gxde.ai.core.ModelHandler.model;
import static top.gxde.ai.core.ResponseHandler.composeChatResponse;
import static top.gxde.ai.core.ServerCommons.sendError;
import static top.gxde.ai.core.ServerCommons.sendJson;
import static top.gxde.ai.core.Utils.makeJsonObject;

/**
 * The fake OpenAI-compatible endpoint server.
 */
public class FakeOpenAiEndpoint {
  // The fake OAI endpoint will run on localhost:65530
  private static final String HOST = System.getProperty("fake.host", "127.0.0.1");
  private static final int PORT = Integer.getInteger("fake.port", 65530);
  private static final String DEFAULT_MODEL = "fake-oai";

  /**
   * The default constructor of the server class.
   */
  public FakeOpenAiEndpoint() {}

  /**
   * Starts the fake OAI server.
   *
   * @param args The command line arguments, which are ignored.
   * @throws IOException If the server cannot bind to the configured address.
   */
  public static void main(String[] args) throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress(HOST, PORT), 64);
    server.createContext("/", FakeOpenAiEndpoint::serverHandler);
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();

    System.out.println("Welcome to fake OAI server.");
    System.out.printf("The OAI compatible endpoint is up at: http://%s:%d/v1%n", HOST, PORT);
    System.out.println(
        "Available ops: GET /v1/models, POST /v1/chat/completions, POST /v1/responses");
  }

  /**
   * The handler that sets up HTTP server and handles the request.
   *
   * @param exchange The <code>HttpExchange</code> that contains user requests.
   * @throws IOException If server have error caught.
   */
  private static void serverHandler(HttpExchange exchange) throws IOException {
    try {
      // Config server
      exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
      exchange.getResponseHeaders().set("Access-Control-Allow-Headers",
          "Authorization, Content-Type");
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
        sendJson(exchange, 200, makeJsonObject("status", "ok", "service", "fake-oai"));
      } else if (method.equals("GET") && path.equals("/v1/models")) {
        sendJson(exchange, 200, makeJsonObject("object", "list", "data", List.of(
          model(DEFAULT_MODEL))));
      } else if (method.equals("GET") && path.startsWith("/v1/models/")) {
        sendJson(exchange, 200, model(path.substring("/v1/models/".length())));
      } else if (method.equals("POST") && path.equals("/v1/chat/completions")) {
        composeChatResponse(exchange);
      } else if (method.equals("POST") && path.equals("/v1/responses")) {
        // doResponses(exchange);
      } else {
        sendError(exchange, 404,
          "Unknown endpoint/HTTP method: " + method + " " + path);
      }
    } catch (IllegalArgumentException e) {
      sendError(exchange, 400, e.getMessage());
    } catch (InterruptedException e) {
       Thread.currentThread().interrupt();
    } catch (Exception e) {
       e.printStackTrace();
       try {
         sendError(exchange, 500, "Internal server error");
       } catch (IOException ignored) {
         // The client may already have received part of an SSE response, so we ignore it here.
       }
    } finally {
      exchange.close();
    }
  }
}
