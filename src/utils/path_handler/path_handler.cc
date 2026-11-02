/* XDG path handler.
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

#include <absl/status/status.h>
#include <absl/strings/str_cat.h>
#include <pwd.h>
#include <unistd.h>

#include <cstdlib>
#include <string>
#include <vector>

#include "src/utils/path_handler/path_handler.h"

namespace gxde {
namespace ai {
namespace utils {
namespace {

constexpr absl::string_view kAppName = "gxde-ai-core";

std::string GetHomeDir() {
  const char* home = std::getenv("HOME");
  if (home != nullptr && home[0] != '\0') {
    return home;
  }

  passwd entry{};
  passwd* result = nullptr;
  std::vector<char> buffer(16384);
  if (getpwuid_r(getuid(), &entry, buffer.data(), buffer.size(), &result) == 0
      && result != nullptr && entry.pw_dir != nullptr) {
    return entry.pw_dir;
  }

  return "";
}

}  // namespace

absl::StatusOr<std::string> PathHandler::ConfigHome() {
  // The spec says relative values are invalid and must be ignored.
  const char* config_home = std::getenv("XDG_CONFIG_HOME");
  if (config_home != nullptr && config_home[0] == '/') {
    return std::string(config_home);
  }

  std::string home = GetHomeDir();
  if (home.empty()) {
    return absl::NotFoundError("Cannot determine the home directory.");
  }

  return absl::StrCat(home, "/.config");
}

absl::StatusOr<std::string> PathHandler::DefaultProvidersDir() {
  absl::StatusOr<std::string> config_home = ConfigHome();
  if (!config_home.ok()) {
    return config_home.status();
  }

  return absl::StrCat(*config_home, "/", kAppName, "/providers");
}

std::string PathHandler::DefaultSocketPath() {
  const char* runtime_dir = std::getenv("XDG_RUNTIME_DIR");
  if (runtime_dir != nullptr && runtime_dir[0] != '\0') {
    return absl::StrCat(runtime_dir, "/", kAppName, ".sock");
  }

  return absl::StrCat("/tmp/", kAppName, "-", getuid(), ".sock");
}

std::string PathHandler::ToGrpcAddress(absl::string_view socket_path) {
  return absl::StrCat("unix:", socket_path);
}

}  // namespace utils
}  // namespace ai
}  // namespace gxde
