/* Resolves the UNIX socket that gxde-ai-core listens on.
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

import com.sun.security.auth.module.UnixSystem;

/** Finds the default socket path using the same rules as the server. */
public final class SocketPaths {
  private static final String APP_NAME = "gxde-ai-core";

  private SocketPaths() {}

  /**
   * Returns the socket path the server uses when started without flags.
   *
   * @return {@code $XDG_RUNTIME_DIR/gxde-ai-core.sock}, or {@code /tmp/gxde-ai-core-UID.sock} when
   *     {@code XDG_RUNTIME_DIR} is unset or empty
   */
  public static String defaultSocketPath() {
    return defaultSocketPath(System.getenv("XDG_RUNTIME_DIR"), new UnixSystem().getUid());
  }

  static String defaultSocketPath(String runtimeDir, long uid) {
    if (runtimeDir != null && !runtimeDir.isEmpty()) {
      return runtimeDir + "/" + APP_NAME + ".sock";
    }

    return "/tmp/" + APP_NAME + "-" + uid + ".sock";
  }
}
