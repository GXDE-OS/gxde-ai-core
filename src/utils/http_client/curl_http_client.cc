/* Minimal HTTP client currently for provider APIs.
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

#include <absl/status/status.h>
#include <absl/strings/str_cat.h>
#include <curl/curl.h>

#include <array>
#include <cstddef>
#include <memory>
#include <string>

#include "src/utils/http_client/curl_http_client.h"

namespace gxde {
namespace ai {
namespace utils {
namespace {

struct CurlDeleter {
  void operator()(CURL* curl) const { curl_easy_cleanup(curl); }
};

struct CurlSlistDeleter {
  void operator()(curl_slist* list) const { curl_slist_free_all(list); }
};

size_t AppendBody(char* data, size_t size, size_t count, void* user_data) {
  static_cast<std::string*>(user_data)->append(data, size * count);
  return size * count;
}

}  // namespace

CurlHttpClient::CurlHttpClient() {
  static const CURLcode kInitResult = curl_global_init(CURL_GLOBAL_DEFAULT);
  static_cast<void>(kInitResult);
}

absl::StatusOr<HttpResponse> CurlHttpClient::Get(
    const std::string& url, const HttpHeaders& headers) const {
  std::unique_ptr<CURL, CurlDeleter> curl(curl_easy_init());
  if (curl == nullptr) {
    return absl::InternalError("curl_easy_init failed.");
  }

  curl_slist* raw_list = nullptr;
  for (const auto& [name, value] : headers) {
    raw_list =
        curl_slist_append(raw_list, absl::StrCat(name, ": ", value).c_str());
  }
  std::unique_ptr<curl_slist, CurlSlistDeleter> header_list(raw_list);

  HttpResponse response;
  std::array<char, CURL_ERROR_SIZE> error_buffer{};
  curl_easy_setopt(curl.get(), CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl.get(), CURLOPT_HTTPHEADER, header_list.get());
  curl_easy_setopt(curl.get(), CURLOPT_PROTOCOLS_STR, "http,https");
  curl_easy_setopt(curl.get(), CURLOPT_USERAGENT, "gxde-ai-core");
  curl_easy_setopt(curl.get(), CURLOPT_NOSIGNAL, 1L);
  curl_easy_setopt(curl.get(), CURLOPT_CONNECTTIMEOUT, 10L);
  curl_easy_setopt(curl.get(), CURLOPT_TIMEOUT, 30L);
  curl_easy_setopt(curl.get(), CURLOPT_ERRORBUFFER, error_buffer.data());
  curl_easy_setopt(curl.get(), CURLOPT_WRITEFUNCTION, &AppendBody);
  curl_easy_setopt(curl.get(), CURLOPT_WRITEDATA, &response.body);

  CURLcode code = curl_easy_perform(curl.get());
  if (code != CURLE_OK) {
    const char* reason = error_buffer[0] != '\0' ? error_buffer.data()
                                                 : curl_easy_strerror(code);
    return absl::UnavailableError(
        absl::StrCat("Request to ", url, " failed: ", reason));
  }

  long status_code = 0;  // NOLINT: curl requires long.
  curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &status_code);
  response.status_code = status_code;
  return response;
}

}  // namespace utils
}  // namespace ai
}  // namespace gxde
