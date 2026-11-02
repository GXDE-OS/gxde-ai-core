/* UNIX IPC example client (main).
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

#include <absl/flags/flag.h>
#include <absl/flags/parse.h>
#include <grpcpp/grpcpp.h>
#include <sysexits.h>

#include <iostream>
#include <string>

#include "example/grpc_proto_ipc/greeter_client.h"
#include "example/grpc_proto_ipc/socket_address.h"

ABSL_FLAG(std::string, socket, "",
          "Path of the UNIX socket to connect to. Defaults to "
          "$XDG_RUNTIME_DIR/gxde-ai-core-example.sock.");
ABSL_FLAG(std::string, name, "char", "Name to send in the greeting request.");

int main(int argc, char** argv) {
  absl::ParseCommandLine(argc, argv);

  std::string socket_path = absl::GetFlag(FLAGS_socket);
  if (socket_path.empty()) {
    socket_path = gxde::ai::ipc::DefaultSocketPath();
  }

  gxde::ai::GreeterClient client(
      grpc::CreateChannel(gxde::ai::ipc::ToGrpcAddress(socket_path),
                          grpc::InsecureChannelCredentials()));

  absl::StatusOr<std::string> greeting =
      client.SayHello(absl::GetFlag(FLAGS_name));
  if (!greeting.ok()) {
    std::cerr << "SayHello failed: " << greeting.status() << '\n';
    return EX_UNAVAILABLE;
  }

  std::cout << *greeting << '\n';
  return EX_OK;
}
