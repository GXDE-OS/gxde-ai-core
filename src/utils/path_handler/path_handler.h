/* XDG path handler.
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

#ifndef SRC_UTILS_PATH_HANDLER_PATH_HANDLER_H_
#define SRC_UTILS_PATH_HANDLER_PATH_HANDLER_H_

#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>

#include <string>

namespace gxde {
namespace ai {
namespace utils {

class PathHandler {
 public:
  explicit PathHandler() = default;
  ~PathHandler() = default;

  absl::StatusOr<std::string> ConfigHome();
  absl::StatusOr<std::string> DefaultProvidersDir();
  std::string DefaultSocketPath();
  std::string ToGrpcAddress(absl::string_view socket_path);
};

}  // namespace utils
}  // namespace ai
}  // namespace gxde

#endif  // SRC_UTILS_PATH_HANDLER_PATH_HANDLER_H_
