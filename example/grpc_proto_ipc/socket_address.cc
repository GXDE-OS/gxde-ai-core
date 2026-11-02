/* UNIX IPC example server (backend).
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

#include "example/grpc_proto_ipc/socket_address.h"

#include <absl/strings/str_cat.h>
#include <unistd.h>

#include <cstdlib>
#include <string>

namespace gxde {
namespace ai {
namespace ipc {

namespace {

constexpr absl::string_view kSocketName = "gxde-ai-core.sock";

}  // namespace

std::string DefaultSocketPath() {
  const char* runtime_dir = std::getenv("XDG_RUNTIME_DIR");
  if (runtime_dir != nullptr && runtime_dir[0] != '\0') {
    return absl::StrCat(runtime_dir, "/", kSocketName);
  }

  // Include the uid so different users on the same machine do not collide.
  return absl::StrCat("/tmp/gxde-ai-core-", getuid(), ".sock");
}

std::string ToGrpcAddress(absl::string_view socket_path) {
  return absl::StrCat("unix:", socket_path);
}

}  // namespace ipc
}  // namespace ai
}  // namespace gxde
