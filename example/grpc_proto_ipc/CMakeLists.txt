# CMake file for the gRPC + protobuf over UNIX socket IPC example.
# -----------------------------------------------------------------------------
# Copyright (C) 2026 CharOfString <root@charofstring.cc>
#
# This program is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
# details.
#
# You should have received a copy of the GNU General Public License along with
# this program. If not, see <https://www.gnu.org/licenses/>.

add_library(grpc-proto-ipc-lib
  proto/greeting.proto
  greeter.h
  greeter.cc
  greeter_client.h
  greeter_client.cc
  socket_address.h
  socket_address.cc
)

protobuf_generate(
  TARGET grpc-proto-ipc-lib
  LANGUAGE cpp
  IMPORT_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/proto
  PROTOC_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}
)

protobuf_generate(
  TARGET grpc-proto-ipc-lib
  LANGUAGE grpc
  GENERATE_EXTENSIONS .grpc.pb.h .grpc.pb.cc
  PLUGIN "protoc-gen-grpc=\$<TARGET_FILE:gRPC::grpc_cpp_plugin>"
  IMPORT_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/proto
  PROTOC_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}
)

target_include_directories(grpc-proto-ipc-lib PUBLIC
  ${PROJECT_SOURCE_DIR}
  ${CMAKE_CURRENT_BINARY_DIR}
)

target_link_libraries(grpc-proto-ipc-lib
  PUBLIC
    absl::strings
    absl::status
    absl::statusor
    protobuf::libprotobuf
    gRPC::grpc++
)

add_executable(greeter-server server_main.cc)
target_link_libraries(greeter-server
  PRIVATE
    grpc-proto-ipc-lib
    absl::flags
    absl::flags_parse
)

add_executable(greeter-client greeter_client_main.cc)
target_link_libraries(greeter-client
  PRIVATE
    grpc-proto-ipc-lib
    absl::flags
    absl::flags_parse
)

add_executable(greeter-test greeter_test.cc)
target_link_libraries(greeter-test
  PRIVATE
    grpc-proto-ipc-lib
    GTest::gtest_main
)

add_test(NAME GreeterTest COMMAND greeter-test)
