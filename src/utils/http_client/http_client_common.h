/* Shared structs for http client.
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

#ifndef SRC_UTILS_HTTP_CLIENT_HTTP_CLIENT_COMMON_H_
#define SRC_UTILS_HTTP_CLIENT_HTTP_CLIENT_COMMON_H_

#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace gxde {
namespace ai {
namespace utils {

using HttpHeaders = std::vector<std::pair<std::string, std::string>>;

struct HttpResponse {
  int64_t status_code = 0;
  std::string body;
};

}

}  // namespace ai
}  // namespace gxde

#endif  // SRC_UTILS_HTTP_CLIENT_HTTP_CLIENT_COMMON_H_
