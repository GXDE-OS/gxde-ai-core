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

#include "example/grpc_proto_ipc/greeter_client.h"

#include <absl/status/status.h>

#include <memory>
#include <string>
#include <utility>

#include "greeting.pb.h"

namespace gxde {
namespace ai {

GreeterClient::GreeterClient(std::shared_ptr<grpc::Channel> channel)
    : stub_(GreeterService::NewStub(std::move(channel))) {}

absl::StatusOr<std::string> GreeterClient::SayHello(
    absl::string_view name) const {
  GreetingRequest request;
  request.set_name(name);

  GreetingResponse response;
  grpc::ClientContext context;
  grpc::Status status = stub_->SayHello(&context, request, &response);
  if (!status.ok()) {
    return absl::Status(static_cast<absl::StatusCode>(status.error_code()),
                        status.error_message());
  }

  return response.greeting();
}

}  // namespace ai
}  // namespace gxde
