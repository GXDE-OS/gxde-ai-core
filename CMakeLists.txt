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
find_package(Protobuf REQUIRED)
include_directories(${Protobuf_INCLUDE_DIRS})
file(GLOB PROTO_FILES "proto/*.proto")
protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${PROTO_FILES})

add_library(core-lib
  ${PROTO_SRCS}
  ${PROTO_HDRS}
  src/greeter/greeter.h
  src/greeter/greeter.cc
)

target_include_directories(core-lib PUBLIC 
  ${CMAKE_CURRENT_SOURCE_DIR} 
  ${CMAKE_CURRENT_BINARY_DIR}
)

target_link_libraries(core-lib
  PUBLIC
    absl::strings
    absl::log_internal_check_op
    absl::log_internal_message
    ${Protobuf_LIBRARIES}
)

add_executable(ai-core-prog src/main.cc)
target_link_libraries(ai-core-prog
  PRIVATE
    core-lib
    absl::flags
    absl::flags_parse
)

add_executable(greeter-test tests/greeter_test.cc)
target_link_libraries(greeter-test
  PRIVATE
    core-lib
    GTest::gtest_main
)

add_test(NAME GreeterTest COMMAND greeter-test)
