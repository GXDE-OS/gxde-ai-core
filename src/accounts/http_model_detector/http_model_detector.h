/* Model detector that queries a provider's model listing endpoint.
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

#ifndef SRC_ACCOUNTS_HTTP_MODEL_DETECTOR_HTTP_MODEL_DETECTOR_H_
#define SRC_ACCOUNTS_HTTP_MODEL_DETECTOR_HTTP_MODEL_DETECTOR_H_

#include <absl/status/statusor.h>

#include <vector>

#include "account.pb.h"
#include "src/accounts/model_detector/model_detector.h"
#include "src/utils/http_client/http_client.h"

namespace gxde {
namespace ai {
namespace account {

class HttpModelDetector final : public ModelDetector {
 public:
  explicit HttpModelDetector(const utils::HttpClient* http_client);

  absl::StatusOr<std::vector<agent::ModelDescriptor>> Detect(
      const agent::AgentAccount& account) const override;

 private:
  const utils::HttpClient* http_client_;
};

}  // namespace account
}  // namespace ai
}  // namespace gxde

#endif  // SRC_ACCOUNTS_HTTP_MODEL_DETECTOR_HTTP_MODEL_DETECTOR_H_
