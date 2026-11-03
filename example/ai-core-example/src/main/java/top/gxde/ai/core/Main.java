/* Example program that manages gxde-ai-core accounts over its UNIX socket.
 * ----------------------------------------------------------------------------
 * Copyright (C) 2026 CharOfString <root@charofstring.cc>
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <https://www.gnu.org/licenses/>.
 */

package top.gxde.ai.core;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import java.io.PrintStream;

/** Lists, adds, changes and removes accounts and models through gxde-ai-core. */
public final class Main {
  static final int EXIT_OK = 0;
  static final int EXIT_USAGE = 64;
  static final int EXIT_UNAVAILABLE = 69;

  private Main() {}

  /**
   * Runs the command given on the command line and exits with its status.
   *
   * @param args the command and its arguments; run without any to print the usage
   */
  public static void main(String[] args) {
    System.exit(run(args, System.out, System.err));
  }

  static int run(String[] args, PrintStream out, PrintStream err) {
    if (args.length == 0) {
      err.print(Commands.USAGE);
      return EXIT_USAGE;
    }

    try {
      CommandLine line = CommandLine.parse(args);
      String socketPath =
          line.string(Commands.SOCKET_FLAG).orElseGet(SocketPaths::defaultSocketPath);
      try (CoreClient client = CoreClient.connect(socketPath)) {
        new Commands(client, out).run(line);
      }
      return EXIT_OK;
    } catch (UsageException e) {
      err.println("error: " + e.getMessage());
      err.println("Run without arguments to see the usage.");
      return EXIT_USAGE;
    } catch (StatusRuntimeException e) {
      Status status = e.getStatus();
      err.println("error: " + status.getCode() + ": " + status.getDescription());
      return status.getCode() == Status.Code.INVALID_ARGUMENT ? EXIT_USAGE : EXIT_UNAVAILABLE;
    }
  }
}
