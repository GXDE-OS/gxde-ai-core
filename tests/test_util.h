/* Shared helpers for gxde-ai-core tests.
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

#ifndef TESTS_TEST_UTIL_H_
#define TESTS_TEST_UTIL_H_

#include <ftw.h>
#include <stdlib.h>
#include <sys/stat.h>

#include <cstdio>
#include <string>

namespace gxde {
namespace ai {

inline int RemoveEntry(const char* path, const struct stat* /*info*/,
                       int /*type*/, FTW* /*ftw*/) {
  return remove(path);
}

// Removes a directory tree, deepest entries first.
inline void RemoveTree(const std::string& path) {
  nftw(path.c_str(), RemoveEntry, 16, FTW_DEPTH | FTW_PHYS);
}

// Creates a fresh directory per instance and removes it on destruction.
class ScopedTempDir {
 public:
  ScopedTempDir() {
    std::string pattern = "/tmp/gxde-ai-core-test-XXXXXX";
    if (mkdtemp(pattern.data()) != nullptr) {
      path_ = pattern;
    }
  }

  ~ScopedTempDir() {
    if (!path_.empty()) {
      RemoveTree(path_);
    }
  }

  ScopedTempDir(const ScopedTempDir&) = delete;
  ScopedTempDir& operator=(const ScopedTempDir&) = delete;

  const std::string& Path() const { return path_; }

 private:
  std::string path_;
};

}  // namespace ai
}  // namespace gxde

#endif  // TESTS_TEST_UTIL_H_
