/* Detects the models an account can use by asking the provider.
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

#include <absl/container/flat_hash_set.h>
#include <absl/status/status.h>
#include <absl/strings/ascii.h>
#include <absl/strings/str_cat.h>
#include <absl/strings/str_format.h>
#include <absl/strings/string_view.h>

#include <cstdlib>
#include <string>
#include <utility>
#include <vector>

#include "src/accounts/http_model_detector/http_model_detector.h"
#include "src/accounts/model_list_parser/model_list_parser.h"
#include "src/accounts/provider_defaults/provider_defaults.h"

namespace gxde {
namespace ai {
namespace account {

namespace {

using agent::AgentAccount;
using agent::CredentialReference;
using agent::ModelDescriptor;
using utils::HttpHeaders;
using utils::HttpResponse;

constexpr int kMaxPages = 50;
constexpr size_t kMaxErrorBodyLength = 300;

std::string PercentEncode(absl::string_view text) {
  std::string encoded;
  for (char c : text) {
    if (absl::ascii_isalnum(static_cast<unsigned char>(c)) || c == '-' ||
        c == '.' || c == '_' || c == '~') {
      encoded.push_back(c);
    } else {
      absl::StrAppendFormat(&encoded, "%%%02X", static_cast<unsigned char>(c));
    }
  }

  return encoded;
}

absl::StatusOr<std::string> ResolveCredential(
    const CredentialReference& credential) {
  switch (credential.source_case()) {
    case CredentialReference::kEnvironmentVariable: {
      const std::string& name = credential.environment_variable();
      const char* value = std::getenv(name.c_str());
      if (value == nullptr || value[0] == '\0') {
        return absl::FailedPreconditionError(
            absl::StrCat("Environment variable ", name,
                         " is not set in the gxde-ai-core process."));
      }

      return std::string(value);
    }
    case CredentialReference::kKeyringId:
      return absl::UnimplementedError(
          "Keyring credentials are not supported yet; use an environment "
          "variable.");
    case CredentialReference::SOURCE_NOT_SET:
      break;
  }

  return absl::FailedPreconditionError(
      "Header authentication has no credential source.");
}

absl::StatusOr<HttpHeaders> BuildHeaders(const AgentAccount& account) {
  HttpHeaders headers;
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

absl::Status HttpError(const std::string& url, const HttpResponse& response) {
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

std::string PageUrl(ProtocolFamily family, absl::string_view base_url,
                    absl::string_view page_token) {
  switch (family) {
    case ProtocolFamily::kOpenAi:
      return absl::StrCat(base_url, "/models");
    case ProtocolFamily::kAnthropic:
      return page_token.empty()
                 ? absl::StrCat(base_url, "/v1/models?limit=1000")
                 : absl::StrCat(base_url, "/v1/models?limit=1000&after_id=",
                                PercentEncode(page_token));
    case ProtocolFamily::kGemini:
      return page_token.empty()
                 ? absl::StrCat(base_url, "/v1beta/models?pageSize=1000")
                 : absl::StrCat(base_url, "/v1beta/models?pageSize=1000",
                                "&pageToken=", PercentEncode(page_token));
    case ProtocolFamily::kUnknown:
      break;
  }

  return "";
}

absl::StatusOr<ModelListPage> ParsePage(ProtocolFamily family,
                                        absl::string_view body) {
  switch (family) {
    case ProtocolFamily::kOpenAi:
      return ParseOpenAiModelList(body);
    case ProtocolFamily::kAnthropic:
      return ParseAnthropicModelList(body);
    case ProtocolFamily::kGemini:
      return ParseGeminiModelList(body);
    case ProtocolFamily::kUnknown:
      break;
  }

  return absl::InvalidArgumentError("Unknown API protocol.");
}

}  // namespace

HttpModelDetector::HttpModelDetector(const utils::HttpClient* http_client)
    : http_client_(http_client) {}

absl::StatusOr<std::vector<ModelDescriptor>> HttpModelDetector::Detect(
    const AgentAccount& account) const {
  ProtocolFamily family = FamilyOf(account.api_protocol());
  if (family == ProtocolFamily::kUnknown) {
    return absl::FailedPreconditionError(
        "Cannot detect models without an API protocol.");
  }

  if (account.base_url().empty()) {
    return absl::FailedPreconditionError(
        "Cannot detect models without a base URL.");
  }

  absl::StatusOr<HttpHeaders> headers = BuildHeaders(account);
  if (!headers.ok()) {
    return headers.status();
  }

  std::vector<ModelDescriptor> models;
  absl::flat_hash_set<std::string> seen_ids;
  std::string page_token;
  for (int page_index = 0; page_index < kMaxPages; ++page_index) {
    std::string url = PageUrl(family, account.base_url(), page_token);
    absl::StatusOr<HttpResponse> response = http_client_->Get(url, *headers);
    if (!response.ok()) {
      return response.status();
    }

    if (response->status_code < 200 || response->status_code >= 300) {
      return HttpError(url, *response);
    }

    absl::StatusOr<ModelListPage> page = ParsePage(family, response->body);
    if (!page.ok()) {
      return page.status();
    }

    for (ModelDescriptor& model : page->models) {
      if (seen_ids.insert(model.id()).second) {
        models.push_back(std::move(model));
      }
    }

    page_token = std::move(page->next_page_token);
    if (page_token.empty()) {
      break;
    }
  }

  return models;
}

}  // namespace account
}  // namespace ai
}  // namespace gxde
