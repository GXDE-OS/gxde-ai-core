/* Built-in defaults for each supported LLM provider.
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

#include <absl/strings/string_view.h>
#include <absl/strings/strip.h>

#include <string>

#include "src/accounts/provider_defaults/provider_defaults.h"

namespace gxde {
namespace ai {
namespace account {
namespace {

using agent::AgentAccount;
using agent::ApiProtocol;
using agent::Provider;

constexpr absl::string_view kAnthropicVersionHeader = "anthropic-version";
constexpr absl::string_view kAnthropicVersion = "2023-06-01";

ApiProtocol DefaultProtocol(Provider provider) {
  switch (provider) {
    case agent::PROVIDER_OPENAI:
      return agent::API_PROTOCOL_OPENAI_CHAT_COMPLETIONS;
    case agent::PROVIDER_ANTHROPIC:
      return agent::API_PROTOCOL_ANTHROPIC_MESSAGES;
    case agent::PROVIDER_GOOGLE_GEMINI:
      return agent::API_PROTOCOL_GEMINI_GENERATE_CONTENT;
    default:
      return agent::API_PROTOCOL_UNSPECIFIED;
  }
}

absl::string_view DefaultBaseUrl(Provider provider) {
  switch (provider) {
    case agent::PROVIDER_OPENAI:
      return "https://api.openai.com/v1";
    case agent::PROVIDER_ANTHROPIC:
      return "https://api.anthropic.com";
    case agent::PROVIDER_GOOGLE_GEMINI:
      return "https://generativelanguage.googleapis.com";
    default:
      return "";
  }
}

void ApplyHeaderDefaults(ProtocolFamily family,
                         agent::HeaderAuthentication* header) {
  if (!header->header_name().empty()) {
    return;
  }

  switch (family) {
    case ProtocolFamily::kOpenAi:
      header->set_header_name("Authorization");
      if (header->value_prefix().empty()) {
        header->set_value_prefix("Bearer ");
      }
      break;
    case ProtocolFamily::kAnthropic:
      header->set_header_name("x-api-key");
      break;
    case ProtocolFamily::kGemini:
      header->set_header_name("x-goog-api-key");
      break;
    case ProtocolFamily::kUnknown:
      break;
  }
}

}  // namespace

ProtocolFamily FamilyOf(ApiProtocol protocol) {
  switch (protocol) {
    case agent::API_PROTOCOL_OPENAI_CHAT_COMPLETIONS:
    case agent::API_PROTOCOL_OPENAI_RESPONSES:
      return ProtocolFamily::kOpenAi;
    case agent::API_PROTOCOL_ANTHROPIC_MESSAGES:
      return ProtocolFamily::kAnthropic;
    case agent::API_PROTOCOL_GEMINI_GENERATE_CONTENT:
    case agent::API_PROTOCOL_GEMINI_INTERACTIONS:
      return ProtocolFamily::kGemini;
    default:
      return ProtocolFamily::kUnknown;
  }
}

void ApplyProviderDefaults(AgentAccount* account) {
  if (account->api_protocol() == agent::API_PROTOCOL_UNSPECIFIED) {
    account->set_api_protocol(DefaultProtocol(account->provider()));
  }

  if (account->base_url().empty()) {
    account->set_base_url(std::string(DefaultBaseUrl(account->provider())));
  }

  absl::string_view base_url = account->base_url();
  while (absl::ConsumeSuffix(&base_url, "/")) {
  }
  account->set_base_url(std::string(base_url));

  ProtocolFamily family = FamilyOf(account->api_protocol());
  if (account->auth().has_header()) {
    ApplyHeaderDefaults(family, account->mutable_auth()->mutable_header());
  }

  if (family == ProtocolFamily::kAnthropic &&
      !account->extra_headers().contains(
          std::string(kAnthropicVersionHeader))) {
    (*account->mutable_extra_headers())[std::string(kAnthropicVersionHeader)] =
        std::string(kAnthropicVersion);
  }
}

}  // namespace account
}  // namespace ai
}  // namespace gxde
