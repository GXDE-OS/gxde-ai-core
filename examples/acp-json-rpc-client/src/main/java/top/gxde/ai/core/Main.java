package top.gxde.ai.core;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/**
 * Minimal ACP client that exercises every documented feature of {@code gxde-ai-core --acp}.
 *
 * <p>It performs the full lifecycle (initialize, provider authentication, session creation,
 * multi-turn prompts, cancellation, session loading), renders {@code session/update} notifications,
 * answers {@code session/request_permission} and optionally proxies file access. Interactive
 * commands expose the provider-account and session extensions.
 */
public final class Main {
  private static final String PROVIDER_ACCOUNT = "hachimi-provider-account";
  private static final Set<String> CLIENT_COMMANDS =
      Set.of(
          "help",
          "session",
          "new",
          "load",
          "prompt",
          "cancel",
          "mode",
          "model",
          "providers",
          "provider-current",
          "provider-save",
          "provider-activate",
          "provider-delete",
          "set-provider");

  private final Options options;
  private final Set<String> agentCommands = ConcurrentHashMap.newKeySet();
  private AcpClient client;
  private String sessionId;
  private String authMethodId;
  private boolean authenticated;
  private String currentModeId;
  private String currentModelId;
  private final List<String> availableModes = new ArrayList<>();
  private final List<String> availableModels = new ArrayList<>();
  private final AtomicBoolean promptInFlight = new AtomicBoolean();
  private final ExecutorService promptExecutor =
      Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "acp-prompt");
        thread.setDaemon(true);
        return thread;
      });

  private Main(Options options) {
    this.options = options;
  }

  /**
   * Runs the example client.
   *
   * @param args command-line arguments, see {@code --help}
   */
  public static void main(String[] args) {
    Options options = Options.parse(args);
    if (options.help) {
      Options.printUsage();
      return;
    }
    try {
      new Main(options).run();
    } catch (AcpException e) {
      System.err.println("[error] " + e.getMessage());
      System.exit(1);
    } catch (IOException e) {
      System.err.println("[error] " + e.getMessage());
      System.exit(1);
    }
  }

  private void run() throws IOException {
    Map<String, String> environment = new LinkedHashMap<>();
    if (options.isolatedHome) {
      environment.put(
          "GXDE_AI_CORE_HOME",
          System.getenv().getOrDefault("GXDE_AI_CORE_HOME", System.getProperty("user.home")));
    }

    List<String> command = new ArrayList<>(Arrays.asList(options.agent.trim().split("\\s+")));
    command.add("--acp");
    client =
        new AcpClient(
            command, options.cwd, environment, this::handleNotification, this::handleAgentRequest);

    try {
      JsonNode init = client.initialize(options.fileSystem);
      printInitialize(init);
      authenticate(init);

      try {
        if (options.loadSession != null) {
          loadSession(options.loadSession);
        } else if (options.resume && Files.isReadable(options.sessionFile)) {
          loadSession(Files.readString(options.sessionFile).trim());
        } else {
          newSession();
        }
      } catch (AcpException e) {
        if (options.prompt != null || options.demo) {
          throw e;
        }
        System.out.println("\nCould not start a session: " + e.getMessage());
        System.out.println("Use /provider-save and /provider-activate, then /new.");
      }

      if (options.prompt != null) {
        promptSync(options.prompt);
        return;
      }
      if (options.demo) {
        runDemo();
        return;
      }
      repl();
    } finally {
      shutdownPrompts();
      client.close();
    }
  }

  private void shutdownPrompts() {
    if (promptInFlight.get() && sessionId != null) {
      client.cancel(sessionId);
    }
    promptExecutor.shutdown();
    try {
      if (!promptExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
        promptExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      promptExecutor.shutdownNow();
    }
  }

  private void handleNotification(String method, JsonNode params) {
    if ("session/update".equals(method)) {
      JsonNode update = params.path("update");
      if ("available_commands_update".equals(update.path("sessionUpdate").asText())) {
        agentCommands.clear();
        for (JsonNode command : update.path("availableCommands")) {
          agentCommands.add(command.path("name").asText());
        }
      }
    }
    SessionUpdatePrinter.print(method, params);
  }

  private void printInitialize(JsonNode init) {
    JsonNode info = init.path("agentInfo");
    System.out.println("Connected to " + info.path("title").asText(info.path("name").asText()));
    System.out.println("  version          : " + info.path("version").asText());
    System.out.println("  protocolVersion  : " + init.path("protocolVersion").asInt());
    JsonNode capabilities = init.path("agentCapabilities");
    System.out.println("  loadSession      : " + capabilities.path("loadSession").asBoolean());
    System.out.println(
        "  prompt content   : " + capabilities.path("promptCapabilities").toString());
    JsonNode extensions = capabilities.path("_meta").path("gxde-ai-core");
    if (!extensions.isMissingNode() && !extensions.isEmpty()) {
      System.out.println("  extensions       : " + extensions);
    }
  }

  private void authenticate(JsonNode init) {
    authMethodId = options.authMethod;
    if (authMethodId == null) {
      authMethodId = pickAuthMethod(init.path("authMethods"));
    }
    if (authMethodId == null) {
      System.out.println("No provider-account auth method advertised; skipping authenticate.");
      return;
    }
    tryAuthenticate();
  }

  private boolean tryAuthenticate() {
    if (authMethodId == null) {
      return false;
    }
    try {
      client.authenticate(authMethodId);
      authenticated = true;
      System.out.println("Authenticated with " + authMethodId);
      return true;
    } catch (AcpException e) {
      authenticated = false;
      System.out.println("Authentication skipped: " + e.getMessage());
      System.out.println("Configure an account with /provider-save, then /provider-activate.");
      return false;
    }
  }

  private String pickAuthMethod(JsonNode authMethods) {
    for (JsonNode method : authMethods) {
      if (PROVIDER_ACCOUNT.equals(method.path("id").asText())) {
        return PROVIDER_ACCOUNT;
      }
    }
    return null;
  }

  private void newSession() {
    if (!authenticated) {
      tryAuthenticate();
    }
    JsonNode result = client.newSession(options.cwd);
    sessionId = result.path("sessionId").asText();
    rememberSession();
    printSession("New session", result);
  }

  private void loadSession(String id) {
    JsonNode result = client.loadSession(id, options.cwd);
    sessionId = id;
    rememberSession();
    printSession("Loaded session", result);
    System.out.println("Replayed history is arriving as session/update notifications.");
  }

  private void printSession(String label, JsonNode result) {
    System.out.println(label + ": " + sessionId);
    JsonNode modes = result.path("modes");
    if (!modes.isMissingNode()) {
      currentModeId = modes.path("currentModeId").asText();
      availableModes.clear();
      for (JsonNode mode : modes.path("availableModes")) {
        availableModes.add(mode.path("id").asText());
      }
      System.out.println("  mode   : " + currentModeId + " " + availableModes);
    }
    JsonNode models = result.path("models");
    if (!models.isMissingNode()) {
      currentModelId = models.path("currentModelId").asText();
      availableModels.clear();
      for (JsonNode model : models.path("availableModels")) {
        availableModels.add(model.path("modelId").asText());
      }
      System.out.println("  model  : " + currentModelId + " " + availableModels);
    }
  }

  private void rememberSession() {
    try {
      Files.writeString(options.sessionFile, sessionId + System.lineSeparator());
    } catch (IOException e) {
      System.err.println("[warn] Could not persist session id: " + e.getMessage());
    }
  }

  private void runDemo() {
    System.out.println("\n=== demo: two-turn conversation ===");
    promptSync("你好，请用一句话介绍你自己。");
    promptSync("继续，用一句话说明我们刚才聊了什么。");
    demoSessionSettings();
    System.out.println("\n=== demo: reload the same session ===");
    loadSession(sessionId);
  }

  private void demoSessionSettings() {
    String mode = pickDifferent(availableModes, currentModeId);
    if (mode != null) {
      try {
        JsonNode result = client.setMode(sessionId, mode);
        System.out.println("\n[set_mode] " + mode + " " + result);
      } catch (AcpException e) {
        System.out.println("\n[set_mode] skipped: " + e.getMessage());
      }
    }
    String model = pickDifferent(availableModels, currentModelId);
    if (model != null) {
      try {
        JsonNode result = client.ext("gxde-ai-core/session/setModel", modelParams(model));
        System.out.println("[setModel] " + model + " " + result);
      } catch (AcpException e) {
        System.out.println("[setModel] skipped: " + e.getMessage());
      }
    }
  }

  private String pickDifferent(List<String> candidates, String current) {
    for (String candidate : candidates) {
      if (!candidate.equals(current)) {
        return candidate;
      }
    }
    return null;
  }

  private void repl() throws IOException {
    System.out.println("\nType a message to prompt, /help for commands, /quit to exit.");
    BufferedReader input =
        new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
    String line;
    while ((line = input.readLine()) != null) {
      String text = line.trim();
      if (text.isEmpty()) {
        continue;
      }
      if (text.equals("/quit") || text.equals("/exit")) {
        return;
      }
      dispatch(text);
    }
  }

  private void dispatch(String text) {
    if (!text.startsWith("/")) {
      promptAsync(text);
      return;
    }
    String name = text.split("\\s+", 2)[0].substring(1);
    if (CLIENT_COMMANDS.contains(name)) {
      command(text);
    } else if (agentCommands.isEmpty() || awaitAgentCommand(name)) {
      promptAsync(text);
    } else {
      System.out.println("Unknown command /" + name + ", try /help.");
    }
  }

  private boolean awaitAgentCommand(String name) {
    if (agentCommands.contains(name)) {
      return true;
    }
    long deadline = System.currentTimeMillis() + 500;
    while (System.currentTimeMillis() < deadline) {
      try {
        Thread.sleep(25);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return agentCommands.contains(name);
      }
      if (agentCommands.contains(name)) {
        return true;
      }
    }
    return false;
  }

  private void command(String line) {
    int space = line.indexOf(' ');
    String name = space < 0 ? line : line.substring(0, space);
    String argument = space < 0 ? "" : line.substring(space + 1).trim();
    try {
      switch (name) {
        case "/help" -> printHelp();
        case "/session" -> System.out.println("session: " + sessionId);
        case "/new" -> newSession();
        case "/load" -> loadSession(requireArgument(argument, "/load <sessionId>"));
        case "/prompt" -> promptAsync(requireArgument(argument, "/prompt <text>"));
        case "/cancel" -> cancel();
        case "/mode" -> setMode(requireArgument(argument, "/mode <modeId>"));
        case "/model" -> setModel(requireArgument(argument, "/model <modelId>"));
        case "/providers" -> callExt("gxde-ai-core/auth/providers/list", Json.object());
        case "/provider-current" -> callExt("gxde-ai-core/auth/providers/current", Json.object());
        case "/provider-save" -> saveProvider(argument);
        case "/provider-activate" -> activateProvider(argument);
        case "/provider-delete" -> deleteProvider(argument);
        case "/set-provider" -> setProvider(argument);
        default -> System.out.println("Unknown command " + name + ", try /help.");
      }
    } catch (AcpException e) {
      System.out.println("[error] " + e.getMessage());
    }
  }

  private void printHelp() {
    System.out.println(
        """
        conversation
          <text>                     send a prompt on the current session
          /prompt <text>             same as above
          /cancel                    cancel the running prompt turn
          /new                       create a new session
          /load <sessionId>          load a stored session (history is replayed)
          /session                   print the current session id
          /mode <modeId>             session/set_mode
          /model <modelId>           session/set_model

        provider accounts (extensions)
          /providers                 list presets, accounts and the active account
          /provider-current          current account plus hasApiKey
          /provider-save <json>      {"account":{...},"apiKey":"sk-..."}
          /provider-activate <id> [model]
          /provider-delete <id>
          /set-provider <accountId> [model]

          /help, /quit
        """);
    if (!agentCommands.isEmpty()) {
      System.out.println("agent commands (sent as prompts)");
      System.out.println(
          "  "
              + agentCommands.stream()
                  .sorted()
                  .map(name -> "/" + name)
                  .collect(Collectors.joining(", ")));
    }
  }

  private void promptAsync(String text) {
    if (sessionId == null) {
      System.out.println("No session. Run /new first.");
      return;
    }
    if (!promptInFlight.compareAndSet(false, true)) {
      System.out.println("A prompt is already running. Use /cancel first.");
      return;
    }
    promptExecutor.execute(() -> {
      try {
        promptSync(text);
      } catch (AcpException e) {
        System.out.println("\n[error] " + e.getMessage());
      } finally {
        promptInFlight.set(false);
      }
    });
  }

  private void promptSync(String text) {
    JsonNode result = client.prompt(sessionId, text);
    System.out.println("\n[stop] " + result.path("stopReason").asText());
    JsonNode usage = result.path("usage");
    if (!usage.isMissingNode()) {
      System.out.println(
          "[usage] in="
              + usage.path("inputTokens").asLong()
              + " out="
              + usage.path("outputTokens").asLong()
              + " total="
              + usage.path("totalTokens").asLong());
    }
  }

  private void cancel() {
    if (sessionId == null) {
      System.out.println("No session.");
      return;
    }
    client.cancel(sessionId);
    System.out.println("[cancel] notification sent");
  }

  private void setMode(String modeId) {
    JsonNode result = client.setMode(sessionId, modeId);
    currentModeId = modeId;
    System.out.println("[mode] " + modeId + " " + result);
  }

  private void setModel(String modelId) {
    JsonNode result = client.ext("gxde-ai-core/session/setModel", modelParams(modelId));
    currentModelId = modelId;
    System.out.println("[model] " + modelId + " " + result);
  }

  private ObjectNode modelParams(String modelId) {
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    params.put("modelId", modelId);
    return params;
  }

  private void saveProvider(String argument) {
    JsonNode params = parseJson(argument, "/provider-save <json>");
    callExt("gxde-ai-core/auth/providers/save", params);
  }

  private void activateProvider(String argument) {
    String[] parts = argument.split("\\s+", 2);
    ObjectNode params = Json.object();
    params.put("id", requireArgument(parts[0], "/provider-activate <id> [model]"));
    if (parts.length > 1) {
      params.put("model", parts[1].trim());
    }
    callExt("gxde-ai-core/auth/providers/activate", params);
    tryAuthenticate();
  }

  private void deleteProvider(String argument) {
    ObjectNode params = Json.object();
    params.put("id", requireArgument(argument, "/provider-delete <id>"));
    callExt("gxde-ai-core/auth/providers/delete", params);
  }

  private void setProvider(String argument) {
    if (sessionId == null) {
      System.out.println("No session. Run /new first.");
      return;
    }
    String[] parts = argument.split("\\s+", 2);
    ObjectNode params = Json.object();
    params.put("sessionId", sessionId);
    params.put("providerAccountId", requireArgument(parts[0], "/set-provider <id> [model]"));
    if (parts.length > 1) {
      params.put("model", parts[1].trim());
    }
    callExt("gxde-ai-core/session/setProvider", params);
  }

  private void callExt(String method, JsonNode params) {
    JsonNode result = client.ext(method, params);
    System.out.println(pretty(result));
  }

  private JsonNode parseJson(String argument, String usage) {
    if (argument.isEmpty()) {
      throw new AcpException(-32602, "Usage: " + usage, null);
    }
    try {
      return Json.MAPPER.readTree(argument);
    } catch (JsonProcessingException e) {
      throw new AcpException(-32602, "Invalid JSON: " + e.getOriginalMessage(), null);
    }
  }

  private String requireArgument(String argument, String usage) {
    if (argument == null || argument.isEmpty()) {
      throw new AcpException(-32602, "Usage: " + usage, null);
    }
    return argument;
  }

  private String pretty(JsonNode node) {
    try {
      return Json.MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(node);
    } catch (JsonProcessingException e) {
      return node.toString();
    }
  }

  private JsonNode handleAgentRequest(String method, JsonNode params) {
    return switch (method) {
      case "session/request_permission" -> handlePermission(params);
      case "fs/read_text_file" -> readTextFile(params);
      case "fs/write_text_file" -> writeTextFile(params);
      default -> throw new AcpException(-32601, "Method not found: " + method, null);
    };
  }

  private JsonNode handlePermission(JsonNode params) {
    JsonNode toolCall = params.path("toolCall");
    System.out.println("\n[permission] " + toolCall.path("title").asText("tool call"));
    JsonNode permissionOptions = params.path("options");
    JsonNode chosen = null;
    for (JsonNode option : permissionOptions) {
      String kind = option.path("kind").asText();
      boolean allow = kind.startsWith("allow");
      if (this.options.denyPermissions == allow) {
        continue;
      }
      chosen = option;
      break;
    }

    ObjectNode response = Json.object();
    ObjectNode outcome = response.putObject("outcome");
    if (chosen == null) {
      outcome.put("outcome", "cancelled");
      System.out.println("  -> cancelled");
    } else {
      outcome.put("outcome", "selected");
      outcome.put("optionId", chosen.path("optionId").asText());
      System.out.println(
          "  -> " + chosen.path("kind").asText() + " (" + chosen.path("name").asText() + ")");
    }
    return response;
  }

  private JsonNode readTextFile(JsonNode params) {
    Path path = Path.of(params.path("path").asText());
    int start = Math.max(1, params.path("line").asInt(1));
    int limit = params.path("limit").asInt(Integer.MAX_VALUE);
    try {
      List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
      int end = Math.min(lines.size(), start - 1 + limit);
      String content = String.join("\n", lines.subList(start - 1, end));
      System.out.println("\n[fs] read " + path);
      ObjectNode response = Json.object();
      response.put("content", content);
      return response;
    } catch (IOException e) {
      throw new AcpException(-32000, "Cannot read " + path + ": " + e.getMessage(), null);
    }
  }

  private JsonNode writeTextFile(JsonNode params) {
    Path path = Path.of(params.path("path").asText());
    try {
      Files.writeString(path, params.path("content").asText(), StandardCharsets.UTF_8);
      System.out.println("\n[fs] wrote " + path);
      return Json.object();
    } catch (IOException e) {
      throw new AcpException(-32000, "Cannot write " + path + ": " + e.getMessage(), null);
    }
  }

  private static final class Options {
    private String agent = "gxde-ai-core";
    private Path cwd = Path.of("").toAbsolutePath();
    private Path sessionFile = Path.of(".acp-session");
    private String authMethod;
    private String prompt;
    private String loadSession;
    private boolean resume;
    private boolean isolatedHome;
    private boolean fileSystem = true;
    private boolean denyPermissions;
    private boolean demo;
    private boolean help;

    private static Options parse(String[] args) {
      Options options = new Options();
      for (int i = 0; i < args.length; i++) {
        switch (args[i]) {
          case "--agent" -> options.agent = next(args, ++i, "--agent <command>");
          case "--cwd" -> options.cwd = Path.of(next(args, ++i, "--cwd <path>"));
          case "--session-file" ->
              options.sessionFile = Path.of(next(args, ++i, "--session-file <path>"));
          case "--auth" -> options.authMethod = next(args, ++i, "--auth <methodId>");
          case "--prompt" -> options.prompt = next(args, ++i, "--prompt <text>");
          case "--load" -> options.loadSession = next(args, ++i, "--load <sessionId>");
          case "--resume" -> options.resume = true;
          case "--isolated-home" -> options.isolatedHome = true;
          case "--no-fs" -> options.fileSystem = false;
          case "--deny-permissions" -> options.denyPermissions = true;
          case "--demo" -> options.demo = true;
          case "--help", "-h" -> options.help = true;
          default -> throw new AcpException(-32602, "Unknown argument: " + args[i], null);
        }
      }
      return options;
    }

    private static String next(String[] args, int index, String usage) {
      if (index >= args.length) {
        throw new AcpException(-32602, "Missing value for " + usage, null);
      }
      return args[index];
    }

    private static void printUsage() {
      System.out.println(
          """
          Usage: acp-json-rpc-client [options]

            --agent <command>        agent command, default: gxde-ai-core
            --cwd <path>             session working directory, default: current directory
            --session-file <path>    where the session id is stored, default: .acp-session
            --resume                 load the session id stored in --session-file
            --load <sessionId>       load a specific session (replays history)
            --isolated-home          set GXDE_AI_CORE_HOME (~/.gxde-ai-core config)
            --auth <methodId>        authenticate with this method, default: provider account
            --prompt <text>          send one prompt and exit
            --demo                   run a scripted tour of the protocol
            --no-fs                  do not advertise fs.readTextFile / fs.writeTextFile
            --deny-permissions       reject every session/request_permission
            --help                   show this help
          """);
    }
  }
}
