/* UNIX IPC example client (backend).
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

#ifndef EXAMPLE_GRPC_PROTO_IPC_GREETER_CLIENT_H_
#define EXAMPLE_GRPC_PROTO_IPC_GREETER_CLIENT_H_

#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>
#include <grpcpp/grpcpp.h>

#include <memory>
#include <string>

#include "greeting.grpc.pb.h"

namespace gxde {
namespace ai {

class GreeterClient {
 public:
  explicit GreeterClient(std::shared_ptr<grpc::Channel> channel);

  // Sends a SayHello RPC and returns the greeting text.
  absl::StatusOr<std::string> SayHello(absl::string_view name) const;

 private:
  std::unique_ptr<GreeterService::Stub> stub_;
};

}  // namespace ai
}  // namespace gxde

#endif  // EXAMPLE_GRPC_PROTO_IPC_GREETER_CLIENT_H_
