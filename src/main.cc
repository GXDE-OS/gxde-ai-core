/* Main entry of gxde-ai-core.
 * GXDE AI Core is GXDE's AI backend, uses protocol buffers to serialize and
 * gRPC to provide service via UNIX domain socket.
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
#include <absl/flags/usage.h>
#include <absl/status/statusor.h>
#include <grpcpp/grpcpp.h>
#include <sysexits.h>
#include <unistd.h>

#include <csignal>
#include <iostream>
#include <memory>
#include <string>
#include <thread>

#include "src/accounts/account_service/account_service.h"
#include "src/accounts/account_store/account_store.h"
#include "src/accounts/http_model_detector/http_model_detector.h"
#include "src/utils/http_client/curl_http_client.h"
#include "src/utils/path_handler/path_handler.h"

ABSL_FLAG(std::string, socket, "",
          "Path of the UNIX socket to listen on. Defaults to "
          "$XDG_RUNTIME_DIR/gxde-ai-core.sock.");
ABSL_FLAG(std::string, providers_dir, "",
          "Directory for those provider account files. Defaults to "
          "$XDG_CONFIG_HOME/gxde-ai-core/providers.");

int main(int argc, char** argv) {
  absl::SetProgramUsageMessage(
      "Serves the gxde-ai-core gRPC API on a UNIX domain socket.");
  absl::ParseCommandLine(argc, argv);

  gxde::ai::utils::PathHandler path_handler;
  std::string providers_dir = absl::GetFlag(FLAGS_providers_dir);
  if (providers_dir.empty()) {
    absl::StatusOr<std::string> default_dir =
        path_handler.DefaultProvidersDir();
    if (!default_dir.ok()) {
      std::cerr << default_dir.status() << '\n';
      return EX_CONFIG;
    }

    providers_dir = *default_dir;
  }

  gxde::ai::account::AccountStore store(providers_dir);
  absl::Status init = store.Init();
  if (!init.ok()) {
    std::cerr << init << '\n';
    return EX_CANTCREAT;
  }

  std::string socket_path = absl::GetFlag(FLAGS_socket);
  if (socket_path.empty()) {
    socket_path = path_handler.DefaultSocketPath();
  }

  sigset_t stop_signals;
  sigemptyset(&stop_signals);
  sigaddset(&stop_signals, SIGINT);
  sigaddset(&stop_signals, SIGTERM);
  pthread_sigmask(SIG_BLOCK, &stop_signals, nullptr);

  gxde::ai::utils::CurlHttpClient http_client;
  gxde::ai::account::HttpModelDetector detector(&http_client);
  gxde::ai::account::AccountServiceImpl account_service(&store, &detector);

  grpc::ServerBuilder builder;
  builder.AddListeningPort(path_handler.ToGrpcAddress(socket_path),
                           grpc::InsecureServerCredentials());
  builder.RegisterService(&account_service);

  std::unique_ptr<grpc::Server> server = builder.BuildAndStart();
  if (server == nullptr) {
    std::cerr << "Failed to listen on " << socket_path << '\n';
    return EX_UNAVAILABLE;
  }

  std::cout << "Providers directory: " << providers_dir << '\n'
            << "Listening on " << socket_path << '\n';

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
