/* HTTP client struct holder.
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

#ifndef SRC_CORE_HTTP_CLIENT_H_
#define SRC_CORE_HTTP_CLIENT_H_

#include <absl/functional/function_ref.h>
#include <absl/status/status.h>
#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>

#include <string>
#include <unordered_map>

namespace gxde {
namespace ai {
namespace core {

struct HttpRequest {
  std::string url;
  std::string method;
  std::string body;
  std::unordered_map<std::string, std::string> headers;
};

struct HttpResponse {
  int status_code;
  std::string body;
  std::unordered_map<std::string, std::string> headers;
};

class HttpClient {
 public:
  virtual ~HttpClient() = default;
  virtual absl::StatusOr<HttpResponse> Send(const HttpRequest& request) = 0;
  virtual absl::Status SendStream(
      const HttpRequest& request,
      absl::FunctionRef<absl::Status(absl::string_view)> on_chunk) = 0;
};

}  // namespace core
}  // namespace ai
}  // namespace gxde

#endif  // SRC_CORE_HTTP_CLIENT_H_
