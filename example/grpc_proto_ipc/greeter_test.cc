/* Tests the greeter service end to end over a UNIX domain socket.
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

#include <absl/status/statusor.h>
#include <absl/strings/str_cat.h>
#include <grpcpp/grpcpp.h>
#include <gtest/gtest.h>
#include <unistd.h>

#include <memory>
#include <string>

#include "example/grpc_proto_ipc/greeter_client.h"
#include "example/grpc_proto_ipc/socket_address.h"

namespace gxde {
namespace ai {
namespace {

class GreeterTest : public testing::Test {
 protected:
  void SetUp() override {
    // Keep the path short; sockaddr_un only holds about 108 bytes.
    socket_path_ = absl::StrCat("/tmp/gxde-ai-core-test-", getpid(), ".sock");

    grpc::ServerBuilder builder;
    builder.AddListeningPort(ipc::ToGrpcAddress(socket_path_),
                             grpc::InsecureServerCredentials());
    builder.RegisterService(&service_);
    server_ = builder.BuildAndStart();
    ASSERT_NE(server_, nullptr);

    client_ = std::make_unique<GreeterClient>(grpc::CreateChannel(
        ipc::ToGrpcAddress(socket_path_), grpc::InsecureChannelCredentials()));
  }

  void TearDown() override {
    if (server_ != nullptr) {
      server_->Shutdown();
    }

    unlink(socket_path_.c_str());
  }

  std::string socket_path_;
  GreeterServiceImpl service_;
  std::unique_ptr<grpc::Server> server_;
  std::unique_ptr<GreeterClient> client_;
};

}  // namespace

TEST_F(GreeterTest, GeneratesCorrectGreeting) {
  absl::StatusOr<std::string> greeting = client_->SayHello("Brian");

  ASSERT_TRUE(greeting.ok()) << greeting.status();
  EXPECT_EQ(*greeting, "Hello, Brian!");
}

TEST_F(GreeterTest, HandlesEmptyName) {
  absl::StatusOr<std::string> greeting = client_->SayHello("");

  ASSERT_TRUE(greeting.ok()) << greeting.status();
  EXPECT_EQ(*greeting, "Hello, !");
}

TEST(GreeterClientTest, ReportsUnavailableWithoutServer) {
  GreeterClient client(grpc::CreateChannel(
      ipc::ToGrpcAddress("/tmp/gxde-ai-core-test-missing.sock"),
      grpc::InsecureChannelCredentials()));

  absl::StatusOr<std::string> greeting = client.SayHello("Brian");

  EXPECT_EQ(greeting.status().code(), absl::StatusCode::kUnavailable);
}

}  // namespace ai
}  // namespace gxde
