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

#ifndef EXAMPLE_GRPC_PROTO_IPC_GREETER_H_
#define EXAMPLE_GRPC_PROTO_IPC_GREETER_H_

#include <grpcpp/grpcpp.h>

#include "greeting.grpc.pb.h"
#include "greeting.pb.h"

namespace gxde {
namespace ai {

class GreeterServiceImpl final : public GreeterService::Service {
 public:
  GreeterServiceImpl() = default;
  ~GreeterServiceImpl() override = default;

  grpc::Status SayHello(grpc::ServerContext* context,
                        const GreetingRequest* request,
                        GreetingResponse* response) override;
};

}  // namespace ai
}  // namespace gxde

#endif  // EXAMPLE_GRPC_PROTO_IPC_GREETER_H_
