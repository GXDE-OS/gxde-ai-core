/* Conversion utility that converts message format between absl::Status and
 * grpc::Status.
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

#ifndef SRC_UTILS_STATUS_HANDLER_STATUS_HANDLER_H_
#define SRC_UTILS_STATUS_HANDLER_STATUS_HANDLER_H_

#include <absl/status/status.h>
#include <grpcpp/grpcpp.h>

namespace gxde {
namespace ai {
namespace utils {

class StatusHandler {
 public:
  explicit StatusHandler() = default;
  ~StatusHandler() = default;

  absl::Status FromGrpcStatus(const grpc::Status& status);
  grpc::Status ToGrpcStatus(const absl::Status& status);
};

}  // namespace utils
}  // namespace ai
}  // namespace gxde

#endif  // SRC_UTILS_STATUS_HANDLER_STATUS_HANDLER_H_
