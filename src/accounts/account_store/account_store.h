/* Stores each provider account as a text proto file in one directory.
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

#ifndef SRC_ACCOUNTS_ACCOUNT_STORE_ACCOUNT_STORE_H_
#define SRC_ACCOUNTS_ACCOUNT_STORE_ACCOUNT_STORE_H_

#include <absl/status/status.h>
#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>

#include <string>
#include <vector>

#include "account.pb.h"

namespace gxde {
namespace ai {
namespace account {

absl::Status ValidateAccountId(absl::string_view account_id);

class AccountStore {
 public:
  explicit AccountStore(std::string directory);

  absl::Status Init() const;

  bool Exists(absl::string_view account_id) const;
  absl::StatusOr<agent::AgentAccount> Load(absl::string_view account_id) const;

  absl::StatusOr<std::vector<agent::AgentAccount>> LoadAll() const;

  absl::Status Save(const agent::AgentAccount& account) const;
  absl::Status Remove(absl::string_view account_id) const;

  const std::string& Directory() const { return directory_; }

 private:
  std::string PathFor(absl::string_view account_id) const;

  std::string directory_;
};

}  // namespace account
}  // namespace ai
}  // namespace gxde

#endif  // SRC_ACCOUNTS_ACCOUNT_STORE_ACCOUNT_STORE_H_
