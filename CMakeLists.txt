# CMake file for GXDE AI Core Modules.
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

cmake_minimum_required(VERSION 3.14)
project(gxde-ai-core CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(CTest)
enable_testing()

include(FetchContent)
find_package(absl REQUIRED)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG        v1.14.0
)

set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)
find_package(Protobuf CONFIG REQUIRED)
find_package(gRPC CONFIG REQUIRED)
find_package(CURL REQUIRED)
file(GLOB PROTO_FILES "proto/*.proto")

add_library(core-lib
  ${PROTO_FILES}
  src/accounts/account_service/account_service.h
  src/accounts/account_service/account_service.cc
  src/accounts/account_store/account_store.h
  src/accounts/account_store/account_store.cc
  src/accounts/http_model_detector/http_model_detector.h
  src/accounts/http_model_detector/http_model_detector.cc
  src/accounts/model_detector/model_detector.h
  src/accounts/model_list_parser/model_list_parser.h
  src/accounts/model_list_parser/model_list_parser.cc
  src/accounts/provider_defaults/provider_defaults.h
  src/accounts/provider_defaults/provider_defaults.cc
  src/utils/path_handler/path_handler.h
  src/utils/path_handler/path_handler.cc
  src/utils/status_handler/status_handler.h
  src/utils/status_handler/status_handler.cc
  src/utils/uuid/uuid.h
  src/utils/uuid/uuid.cc
  src/utils/http_client/http_client_common.h
  src/utils/http_client/http_client.h
  src/utils/http_client/curl_http_client.h
  src/utils/http_client/curl_http_client.cc
)

protobuf_generate(
  TARGET core-lib
  LANGUAGE cpp
  IMPORT_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/proto
  PROTOC_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}
)

protobuf_generate(
  TARGET core-lib
  LANGUAGE grpc
  GENERATE_EXTENSIONS .grpc.pb.h .grpc.pb.cc
  PLUGIN "protoc-gen-grpc=\$<TARGET_FILE:gRPC::grpc_cpp_plugin>"
  IMPORT_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/proto
  PROTOC_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}
)

target_include_directories(core-lib PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${CMAKE_CURRENT_BINARY_DIR}
)

target_link_libraries(core-lib
  PUBLIC
    absl::flat_hash_set
    absl::log
    absl::status
    absl::statusor
    absl::str_format
    absl::strings
    absl::synchronization
    protobuf::libprotobuf
    gRPC::grpc++
  PRIVATE
    CURL::libcurl
)

add_executable(gxde-ai-core src/main.cc)
target_link_libraries(gxde-ai-core
  PRIVATE
    core-lib
    absl::flags
    absl::flags_parse
    absl::flags_usage
)

add_executable(core-test
  tests/test_util.h
  tests/account_service_test.cc
  tests/account_store_test.cc
  tests/http_model_detector_test.cc
  tests/model_list_parser_test.cc
  tests/path_handler_test.cc
  tests/uuid_test.cc
)
target_link_libraries(core-test
  PRIVATE
    core-lib
    GTest::gtest_main
)

add_test(NAME CoreTest COMMAND core-test)

option(GXDE_AI_BUILD_EXAMPLES "Build the example programs." ON)
if(GXDE_AI_BUILD_EXAMPLES)
  add_subdirectory(example/grpc_proto_ipc)
endif()
