/* Abstract LLM provider account that translates requests to its wire format.
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

#ifndef SRC_ACCOUNTS_ACCOUNT_H_
#define SRC_ACCOUNTS_ACCOUNT_H_

#include <absl/status/statusor.h>

#include <memory>

#include "agent.pb.h"
#include "src/core/http_client.h"
#include "src/core/secret_store.h"
#include "src/stream_parser/stream_parser.h"

namespace gxde {
namespace ai {
namespace accounts {

class Account {
 public:
  Account(const Account&) = delete;
  Account& operator=(const Account&) = delete;
  virtual ~Account() = default;

  // NOLINTNEXTLINE(readability-identifier-naming): accessor style.
  const agent::AccountConfig& config() const { return config_; }

  // Builds a request that asks a stream response.
  virtual absl::StatusOr<core::HttpRequest> BuildRequest(
      const agent::LlmRequest& request) const = 0;

  // Decodes non-streamed body.
  // Error responses are turned into a status w/ err msg.
  virtual absl::StatusOr<agent::LlmResponse> ParseResponse(
      const core::HttpResponse& response) const = 0;

  virtual std::unique_ptr<StreamParser> CreateStreamParser() const = 0;

 protected:
  Account(agent::AccountConfig config, core::SecretString api_key);

  // NOLINTNEXTLINE(readability-identifier-naming): accessor style.
  const core::SecretString& api_key() const { return api_key_; }

 private:
  const agent::AccountConfig config_;
  const core::SecretString api_key_;
};

}  // namespace accounts
}  // namespace ai
}  // namespace gxde

#endif  // SRC_ACCOUNTS_ACCOUNT_H_
