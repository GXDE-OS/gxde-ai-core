/* Generation & validation handler for UUIDs.
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

#include <absl/strings/ascii.h>
#include <absl/strings/str_format.h>
#include <sys/random.h>

#include <algorithm>
#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <random>
#include <string>

#include "src/utils/uuid/uuid.h"

namespace gxde {
namespace ai {
namespace utils {
namespace {

using UuidBytes = std::array<uint8_t, 16>;
constexpr std::array<size_t, 4> kDashPositions = {8, 13, 18, 23};
constexpr size_t kUuidLength = 36;

UuidBytes RandomBytes() {
  UuidBytes bytes{};
  size_t filled = 0;
  while (filled < bytes.size()) {
    ssize_t count = getrandom(bytes.data() + filled, bytes.size() - filled, 0);
    if (count < 0) {
      if (errno == EINTR) {
        continue;
      }

      break;
    }

    filled += static_cast<size_t>(count);
  }

  if (filled < bytes.size()) {
    std::random_device device;
    for (uint8_t& byte : bytes) {
      byte = static_cast<uint8_t>(device());
    }
  }

  return bytes;
}

bool IsDashPosition(size_t index) {
  return std::find(kDashPositions.begin(), kDashPositions.end(), index) !=
         kDashPositions.end();
}

}  // namespace

std::string Uuid::GenUuid() {
  UuidBytes bytes = RandomBytes();
  bytes[6] = static_cast<uint8_t>((bytes[6] & 0x0FU) | 0x40U);  // Version 4.
  bytes[8] = static_cast<uint8_t>((bytes[8] & 0x3FU) | 0x80U);  // RFC variant.

  std::string text;
  text.reserve(kUuidLength);
  for (size_t i = 0; i < bytes.size(); ++i) {
    if (i == 4 || i == 6 || i == 8 || i == 10) {
      text.push_back('-');
    }

    absl::StrAppendFormat(&text, "%02x", bytes[i]);
  }

  return text;
}

bool Uuid::IsUuidValid(absl::string_view uuid_in) {
  if (uuid_in.size() != kUuidLength) {
    return false;
  }

  for (size_t i = 0; i < uuid_in.size(); ++i) {
    bool valid =
        IsDashPosition(i)
            ? uuid_in[i] == '-'
            : absl::ascii_isxdigit(static_cast<unsigned char>(uuid_in[i]));
    if (!valid) {
      return false;
    }
  }

  return true;
}

}  // namespace utils
}  // namespace ai
}  // namespace gxde
