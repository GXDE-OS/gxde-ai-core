/* Tests for the file-backed provider account store.
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

#include "src/accounts/account_store/account_store.h"

#include <gtest/gtest.h>
#include <sys/stat.h>

#include <cstdio>
#include <fstream>
#include <string>
#include <vector>

#include "tests/test_util.h"

namespace gxde {
namespace ai {
namespace {

using account::AccountStore;
using account::ValidateAccountId;
using agent::AgentAccount;

AgentAccount MakeAccount(const std::string& id) {
  AgentAccount account;
  account.set_id(id);
  account.set_provider(agent::PROVIDER_OPENAI);
  account.set_base_url("https://api.openai.com/v1");
  account.add_models()->set_id("gpt-test");
  return account;
}

class AccountStoreTest : public testing::Test {
 protected:
  void SetUp() override { ASSERT_TRUE(store_.Init().ok()); }

  ScopedTempDir temp_dir_;
  AccountStore store_{temp_dir_.Path() + "/providers"};
};

}  // namespace

TEST_F(AccountStoreTest, SavesAndLoadsAccount) {
  ASSERT_TRUE(store_.Save(MakeAccount("work")).ok());

  absl::StatusOr<AgentAccount> loaded = store_.Load("work");

  ASSERT_TRUE(loaded.ok()) << loaded.status();
  EXPECT_EQ(loaded->base_url(), "https://api.openai.com/v1");
  ASSERT_EQ(loaded->models_size(), 1);
  EXPECT_EQ(loaded->models(0).id(), "gpt-test");
}

TEST_F(AccountStoreTest, WritesOwnerOnlyFiles) {
  ASSERT_TRUE(store_.Save(MakeAccount("work")).ok());

  struct stat file_info{};
  ASSERT_EQ(stat((store_.Directory() + "/work.textproto").c_str(), &file_info),
            0);
  EXPECT_EQ(file_info.st_mode & 0777U, 0600U);

  struct stat dir_info{};
  ASSERT_EQ(stat(store_.Directory().c_str(), &dir_info), 0);
  EXPECT_EQ(dir_info.st_mode & 0777U, 0700U);
}

TEST_F(AccountStoreTest, LoadAllSortsAndSkipsUnreadableFiles) {
  ASSERT_TRUE(store_.Save(MakeAccount("zeta")).ok());
  ASSERT_TRUE(store_.Save(MakeAccount("alpha")).ok());
  std::ofstream(store_.Directory() + "/broken.textproto") << "not { valid";
  std::ofstream(store_.Directory() + "/notes.txt") << "ignored";

  absl::StatusOr<std::vector<AgentAccount>> accounts = store_.LoadAll();

  ASSERT_TRUE(accounts.ok()) << accounts.status();
  ASSERT_EQ(accounts->size(), 2);
  EXPECT_EQ((*accounts)[0].id(), "alpha");
  EXPECT_EQ((*accounts)[1].id(), "zeta");
}

TEST_F(AccountStoreTest, FileNameIsTheId) {
  AgentAccount account = MakeAccount("original");
  ASSERT_TRUE(store_.Save(account).ok());
  std::string from = store_.Directory() + "/original.textproto";
  std::string to = store_.Directory() + "/renamed.textproto";
  ASSERT_EQ(std::rename(from.c_str(), to.c_str()), 0);

  absl::StatusOr<AgentAccount> loaded = store_.Load("renamed");

  ASSERT_TRUE(loaded.ok()) << loaded.status();
  EXPECT_EQ(loaded->id(), "renamed");
}

TEST_F(AccountStoreTest, RemoveReportsMissingAccount) {
  ASSERT_TRUE(store_.Save(MakeAccount("work")).ok());

  EXPECT_TRUE(store_.Remove("work").ok());
  EXPECT_FALSE(store_.Exists("work"));
  EXPECT_EQ(store_.Remove("work").code(), absl::StatusCode::kNotFound);
}

TEST(AccountIdTest, RejectsUnsafeIds) {
  EXPECT_TRUE(ValidateAccountId("openai-work_2.0").ok());
  EXPECT_FALSE(ValidateAccountId("").ok());
  EXPECT_FALSE(ValidateAccountId("../escape").ok());
  EXPECT_FALSE(ValidateAccountId("a/b").ok());
  EXPECT_FALSE(ValidateAccountId(".hidden").ok());
  EXPECT_FALSE(ValidateAccountId(std::string(65, 'a')).ok());
}

}  // namespace ai
}  // namespace gxde
