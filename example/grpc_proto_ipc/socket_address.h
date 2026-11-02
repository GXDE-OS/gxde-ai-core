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

#ifndef EXAMPLE_GRPC_PROTO_IPC_SOCKET_ADDRESS_H_
#define EXAMPLE_GRPC_PROTO_IPC_SOCKET_ADDRESS_H_

#include <absl/strings/string_view.h>

#include <string>

namespace gxde {
namespace ai {
namespace ipc {

// Returns $XDG_RUNTIME_DIR/gxde-ai-core-example.sock, or a per-user path under
// /tmp when XDG_RUNTIME_DIR is not set.
std::string DefaultSocketPath();

// Converts a filesystem path into a gRPC target such as "unix:/run/x.sock".
std::string ToGrpcAddress(absl::string_view socket_path);

}  // namespace ipc
}  // namespace ai
}  // namespace gxde

#endif  // EXAMPLE_GRPC_PROTO_IPC_SOCKET_ADDRESS_H_
