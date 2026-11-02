/* UNIX IPC example server (main).
 * ----------------------------------------------------------------------------
 * Copyright (C) CharOfString <root@charofstring.cc>
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
#include <unistd.h>

#include <csignal>
#include <iostream>
#include <memory>
#include <string>
#include <thread>

#include "example/grpc_proto_ipc/greeter.h"
#include "example/grpc_proto_ipc/socket_address.h"

ABSL_FLAG(std::string, socket, "",
          "Path of the UNIX socket to listen on. Defaults to "
          "$XDG_RUNTIME_DIR/gxde-ai-core.sock.");

int main(int argc, char** argv) {
  absl::ParseCommandLine(argc, argv);

  std::string socket_path = absl::GetFlag(FLAGS_socket);
  if (socket_path.empty()) {
    socket_path = gxde::ai::ipc::DefaultSocketPath();
  }

  // Block the stop signals before gRPC spawns its threads, so only the waiter
  // thread below receives them and can shut the server down cleanly.
  sigset_t stop_signals;
  sigemptyset(&stop_signals);
  sigaddset(&stop_signals, SIGINT);
  sigaddset(&stop_signals, SIGTERM);
  pthread_sigmask(SIG_BLOCK, &stop_signals, nullptr);

  gxde::ai::GreeterServiceImpl greeter_service;
  grpc::ServerBuilder builder;
  builder.AddListeningPort(gxde::ai::ipc::ToGrpcAddress(socket_path),
                           grpc::InsecureServerCredentials());
  builder.RegisterService(&greeter_service);

  std::unique_ptr<grpc::Server> server = builder.BuildAndStart();
  if (server == nullptr) {
    std::cerr << "Failed to listen on " << socket_path << '\n';
    return EX_UNAVAILABLE;
  }

  std::cout << "Listening on " << socket_path << '\n';

  std::thread signal_waiter([&stop_signals, &server] {
    int signal_number = 0;
    sigwait(&stop_signals, &signal_number);
    server->Shutdown();
  });

  server->Wait();
  signal_waiter.join();
  unlink(socket_path.c_str());
  return EX_OK;
}
