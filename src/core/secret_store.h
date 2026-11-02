/* Abstract class for secret storing.
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

#ifndef SRC_CORE_SECRET_STORE_H_
#define SRC_CORE_SECRET_STORE_H_

#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>

#include <string>

namespace gxde {
namespace ai {
namespace core {

using SecretString = std::string;

class SecretStore {
 public:
  virtual ~SecretStore() = default;
  virtual absl::StatusOr<SecretString> Resolve(
      absl::string_view secret_ref) = 0;
};

}  // namespace core
}  // namespace ai
}  // namespace gxde

#endif  // SRC_CORE_SECRET_STORE_H_
