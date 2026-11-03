/* Authentication headers and error mapping shared.
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

#include "src/accounts/provider_http/provider_http.h"

#include <absl/strings/str_cat.h>

#include <cstdlib>
#include <string>

namespace gxde {
namespace ai {
namespace account {
namespace {

constexpr size_t kMaxErrorBodyLength = 300;

absl::StatusOr<std::string> ResolveCredential(
    const agent::CredentialReference& credential) {
  switch (credential.source_case()) {
    case agent::CredentialReference::kEnvironmentVariable: {
      const std::string& name = credential.environment_variable();
      const char* value = std::getenv(name.c_str());
      if (value == nullptr || value[0] == '\0') {
        return absl::FailedPreconditionError(
            absl::StrCat("Environment variable ", name,
                         " is not set in the gxde-ai-core process."));
      }

      return std::string(value);
    }
    case agent::CredentialReference::kKeyringId:
      return absl::UnimplementedError(
          "Keyring credentials are not supported yet; use an environment "
          "variable.");
    case agent::CredentialReference::SOURCE_NOT_SET:
      break;
  }

  return absl::FailedPreconditionError(
      "Header authentication has no credential source.");
}

}  // namespace

absl::StatusOr<utils::HttpHeaders> BuildProviderHeaders(
    const agent::AgentAccount& account) {
  utils::HttpHeaders headers;
  for (const auto& [name, value] : account.extra_headers()) {
    headers.emplace_back(name, value);
  }

  if (account.auth().has_header()) {
    const agent::HeaderAuthentication& header = account.auth().header();
    absl::StatusOr<std::string> credential =
        ResolveCredential(header.credential());
    if (!credential.ok()) {
      return credential.status();
    }

    headers.emplace_back(header.header_name(),
                         absl::StrCat(header.value_prefix(), *credential));
  }

  return headers;
}

absl::Status ProviderHttpError(const std::string& url,
                               const utils::HttpResponse& response) {
  std::string message =
      absl::StrCat("Provider returned HTTP ", response.status_code, " for ",
                   url, ": ", response.body.substr(0, kMaxErrorBodyLength));
  switch (response.status_code) {
    case 400:
      return absl::InvalidArgumentError(message);
    case 401:
      return absl::UnauthenticatedError(message);
    case 403:
      return absl::PermissionDeniedError(message);
    case 404:
      return absl::NotFoundError(message);
    case 429:
      return absl::ResourceExhaustedError(message);
    default:
      return absl::UnavailableError(message);
  }
}

}  // namespace account
}  // namespace ai
}  // namespace gxde
