/* Greeter gRPC service that other programs reach over a UNIX domain socket.
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

#include "example/grpc_proto_ipc/greeter.h"

#include <absl/strings/str_cat.h>

namespace gxde {
namespace ai {

grpc::Status GreeterServiceImpl::SayHello(grpc::ServerContext* /*context*/,
                                          const GreetingRequest* request,
                                          GreetingResponse* response) {
  response->set_greeting(absl::StrCat("Hello, ", request->name(), "!"));
  return grpc::Status::OK;
}

}  // namespace ai
}  // namespace gxde
