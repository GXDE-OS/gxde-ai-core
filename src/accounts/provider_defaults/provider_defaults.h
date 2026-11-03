/* Default config for LLM providers.
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

#ifndef SRC_ACCOUNTS_PROVIDER_DEFAULTS_PROVIDER_DEFAULTS_H_
#define SRC_ACCOUNTS_PROVIDER_DEFAULTS_PROVIDER_DEFAULTS_H_

#include <cstdint>

#include "account.pb.h"

namespace gxde {
namespace ai {
namespace account {

enum class ProtocolFamily : uint8_t {
  kUnknown,
  kOpenAi,
  kAnthropic,
  kGemini,
};

ProtocolFamily FamilyOf(agent::ApiProtocol protocol);
void ApplyProviderDefaults(agent::AgentAccount* account);

}  // namespace account
}  // namespace ai
}  // namespace gxde

#endif  // SRC_ACCOUNTS_PROVIDER_DEFAULTS_PROVIDER_DEFAULTS_H_
