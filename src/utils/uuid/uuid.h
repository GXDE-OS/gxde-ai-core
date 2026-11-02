/* Generation & validation handler for UUIDs.
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

#ifndef SRC_UTILS_UUID_UUID_H_
#define SRC_UTILS_UUID_UUID_H_

#include <absl/strings/string_view.h>

#include <string>

namespace gxde {
namespace ai {
namespace utils {

class Uuid {
 public:
  explicit Uuid() = default;
  ~Uuid() = default;

  std::string GenUuid();
  bool IsUuidValid(absl::string_view uuid_in);
};

}  // namespace utils
}  // namespace ai
}  // namespace gxde

#endif  // SRC_UTILS_UUID_UUID_H_
