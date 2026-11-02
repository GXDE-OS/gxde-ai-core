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

#include <string>

#include "src/utils/status_handler/status_handler.h"

namespace gxde {
namespace ai {
namespace utils {

absl::Status FromGrpcStatus(const grpc::Status& status) {
  if (status.ok()) {
    return absl::OkStatus();
  }

  return {
    static_cast<absl::StatusCode>(status.error_code()),
    status.error_message()
  };
}

grpc::Status StatusHandler::ToGrpcStatus(const absl::Status& status) {
  if (status.ok()) {
    return grpc::Status::OK;
  }

  return {
    static_cast<grpc::StatusCode>(status.code()),
    std::string(status.message())
  };
}

}  // namespace utils
}  // namespace ai
}  // namespace gxde
