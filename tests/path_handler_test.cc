/* Tests for XDG path resolution in PathHandler.
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

#include "src/utils/path_handler/path_handler.h"

#include <gtest/gtest.h>

#include <cstdlib>
#include <optional>
#include <string>

namespace gxde {
namespace ai {
namespace {

// Restores an environment variable when the test finishes.
class ScopedEnv {
 public:
  ScopedEnv(const char* name, const char* value) : name_(name) {
    const char* old_value = std::getenv(name);
    if (old_value != nullptr) {
      old_value_ = old_value;
    }

    if (value == nullptr) {
      unsetenv(name);
    } else {
      setenv(name, value, 1);
    }
  }

  ~ScopedEnv() {
    if (old_value_.has_value()) {
      setenv(name_, old_value_->c_str(), 1);
    } else {
      unsetenv(name_);
    }
  }

  ScopedEnv(const ScopedEnv&) = delete;
  ScopedEnv& operator=(const ScopedEnv&) = delete;

 private:
  const char* name_;
  std::optional<std::string> old_value_;
};

class PathHandlerTest : public testing::Test {
 protected:
  utils::PathHandler paths_;
};

}  // namespace

TEST_F(PathHandlerTest, UsesAbsoluteXdgConfigHome) {
  ScopedEnv config("XDG_CONFIG_HOME", "/custom/config");

  EXPECT_EQ(*paths_.DefaultProvidersDir(),
            "/custom/config/gxde-ai-core/providers");
}

TEST_F(PathHandlerTest, IgnoresRelativeXdgConfigHome) {
  ScopedEnv config("XDG_CONFIG_HOME", "relative/config");
  ScopedEnv home("HOME", "/home/tester");

  EXPECT_EQ(*paths_.DefaultProvidersDir(),
            "/home/tester/.config/gxde-ai-core/providers");
}

TEST_F(PathHandlerTest, FallsBackToHomeConfig) {
  ScopedEnv config("XDG_CONFIG_HOME", nullptr);
  ScopedEnv home("HOME", "/home/tester");

  EXPECT_EQ(*paths_.ConfigHome(), "/home/tester/.config");
}

TEST_F(PathHandlerTest, SocketUsesRuntimeDir) {
  ScopedEnv runtime("XDG_RUNTIME_DIR", "/run/user/1234");

  EXPECT_EQ(paths_.DefaultSocketPath(), "/run/user/1234/gxde-ai-core.sock");
  EXPECT_EQ(paths_.ToGrpcAddress("/run/x.sock"), "unix:/run/x.sock");
}

}  // namespace ai
}  // namespace gxde
