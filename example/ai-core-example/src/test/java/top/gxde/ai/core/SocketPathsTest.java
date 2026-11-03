/* Tests for resolving the gxde-ai-core socket path.
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

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SocketPathsTest {
  @Test
  void usesRuntimeDirectoryWhenSet() {
    assertEquals(
        "/run/user/1000/gxde-ai-core.sock", SocketPaths.defaultSocketPath("/run/user/1000", 1000));
  }

  @Test
  void fallsBackToTmpWithUid() {
    assertEquals("/tmp/gxde-ai-core-1000.sock", SocketPaths.defaultSocketPath(null, 1000));
    assertEquals("/tmp/gxde-ai-core-1000.sock", SocketPaths.defaultSocketPath("", 1000));
  }
}
