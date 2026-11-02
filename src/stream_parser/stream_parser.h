/* Abstract class for parsing agent's stream output.
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

#ifndef SRC_STREAM_PARSER_STREAM_PARSER_H_
#define SRC_STREAM_PARSER_STREAM_PARSER_H_

#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>

#include <memory>
#include <vector>

#include "agent.pb.h"
#include "src/core/http_client.h"
#include "src/core/secret_store.h"

namespace gxde {
namespace ai {
namespace accounts {

class StreamParser {
 public:
  virtual ~StreamParser() = default;
  virtual absl::StatusOr<std::vector<agent::LlmDelta>> Parse(
      absl::string_view chunk) = 0;
  virtual absl::StatusOr<agent::LlmResponse> Finish() = 0;
};

}  // namespace accounts
}  // namespace ai
}  // namespace gxde

#endif  // SRC_STREAM_PARSER_STREAM_PARSER_H_
