/* Tests for UUID generation and validation.
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
#include <gtest/gtest.h>

#include <string>

#include "src/utils/uuid/uuid.h"

namespace gxde {
namespace ai {
namespace {

class UuidTest : public testing::Test {
 protected:
  utils::Uuid uuid_;
};

}  // namespace

TEST_F(UuidTest, GeneratesVersion4Lowercase) {
  std::string uuid = uuid_.GenUuid();

  ASSERT_TRUE(uuid_.IsUuidValid(uuid)) << uuid;
  EXPECT_EQ(uuid[14], '4');
  EXPECT_NE(std::string("89ab").find(uuid[19]), std::string::npos) << uuid;
  EXPECT_EQ(uuid.find_first_of("ABCDEF"), std::string::npos) << uuid;
}

TEST_F(UuidTest, GeneratesDistinctValues) {
  absl::flat_hash_set<std::string> seen;
  for (int i = 0; i < 1000; ++i) {
    EXPECT_TRUE(seen.insert(uuid_.GenUuid()).second);
  }
}

TEST_F(UuidTest, AcceptsCanonicalFormInEitherCase) {
  EXPECT_TRUE(uuid_.IsUuidValid("123e4567-e89b-12d3-a456-426614174000"));
  EXPECT_TRUE(uuid_.IsUuidValid("123E4567-E89B-12D3-A456-426614174000"));
}

TEST_F(UuidTest, RejectsMalformedInput) {
  EXPECT_FALSE(uuid_.IsUuidValid(""));
  EXPECT_FALSE(uuid_.IsUuidValid("123e4567e89b12d3a456426614174000"));
  EXPECT_FALSE(uuid_.IsUuidValid("123e4567-e89b-12d3-a456-42661417400g"));
  EXPECT_FALSE(uuid_.IsUuidValid("123e4567-e89b-12d3-a456_426614174000"));
  EXPECT_FALSE(uuid_.IsUuidValid("123e4567-e89b-12d3-a456-4266141740000"));
}

}  // namespace ai
}  // namespace gxde
