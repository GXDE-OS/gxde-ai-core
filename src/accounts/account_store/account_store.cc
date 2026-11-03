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

#include <absl/log/log.h>
#include <absl/strings/ascii.h>
#include <absl/strings/match.h>
#include <absl/strings/str_cat.h>
#include <absl/strings/strip.h>
#include <dirent.h>
#include <google/protobuf/text_format.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cstdio>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include "src/accounts/account_store/account_store.h"

namespace gxde {
namespace ai {
namespace account {

namespace {

using agent::AgentAccount;

constexpr absl::string_view kExtension = ".textproto";
constexpr size_t kMaxAccountIdLength = 64;

constexpr absl::string_view kFileHeader = R"(# proto-file: proto/account.proto
# proto-message: gxde.ai.agent.AgentAccount
# Managed by gxde-ai-core. Hand edits apply on the next request.

)";

struct DirCloser {
  void operator()(DIR* dir) const { closedir(dir); }
};

bool IsIdCharacter(char c) {
  return absl::ascii_isalnum(static_cast<unsigned char>(c)) || c == '.' ||
         c == '_' || c == '-';
}

absl::Status WriteAll(int fd, absl::string_view data) {
  while (!data.empty()) {
    ssize_t written = write(fd, data.data(), data.size());
    if (written < 0) {
      if (errno == EINTR) {
        continue;
      }

      return absl::ErrnoToStatus(errno, "write failed");
    }

    data.remove_prefix(static_cast<size_t>(written));
  }

  return absl::OkStatus();
}

absl::Status MakeDirectories(const std::string& path) {
  for (size_t slash = path.find('/', 1); slash != std::string::npos;
       slash = path.find('/', slash + 1)) {
    std::string parent = path.substr(0, slash);
    if (mkdir(parent.c_str(), S_IRWXU) != 0 && errno != EEXIST) {
      return absl::ErrnoToStatus(errno, absl::StrCat("Cannot create ", parent));
    }
  }

  if (mkdir(path.c_str(), S_IRWXU) != 0 && errno != EEXIST) {
    return absl::ErrnoToStatus(errno, absl::StrCat("Cannot create ", path));
  }

  return absl::OkStatus();
}

bool IsRegularFile(const std::string& path) {
  struct stat info{};
  return stat(path.c_str(), &info) == 0 && S_ISREG(info.st_mode);
}

}  // namespace

absl::Status ValidateAccountId(absl::string_view account_id) {
  if (account_id.empty() || account_id.size() > kMaxAccountIdLength ||
      !absl::ascii_isalnum(static_cast<unsigned char>(account_id.front())) ||
      !std::all_of(account_id.begin(), account_id.end(), IsIdCharacter)) {
    return absl::InvalidArgumentError(absl::StrCat(
        "Invalid account ID \"", account_id,
        "\": use 1-64 characters of [A-Za-z0-9._-], starting with a letter or "
        "digit."));
  }

  return absl::OkStatus();
}

AccountStore::AccountStore(std::string directory)
    : directory_(std::move(directory)) {}

absl::Status AccountStore::Init() const {
  absl::Status created = MakeDirectories(directory_);
  if (!created.ok()) {
    return created;
  }

  if (chmod(directory_.c_str(), S_IRWXU) != 0) {
    return absl::ErrnoToStatus(
        errno, absl::StrCat("Cannot set permissions on ", directory_));
  }

  return absl::OkStatus();
}

std::string AccountStore::PathFor(absl::string_view account_id) const {
  return absl::StrCat(directory_, "/", account_id, kExtension);
}

bool AccountStore::Exists(absl::string_view account_id) const {
  return ValidateAccountId(account_id).ok() &&
         access(PathFor(account_id).c_str(), F_OK) == 0;
}

absl::StatusOr<AgentAccount> AccountStore::Load(
    absl::string_view account_id) const {
  absl::Status valid = ValidateAccountId(account_id);
  if (!valid.ok()) {
    return valid;
  }

  std::string path = PathFor(account_id);
  std::ifstream file(path);
  if (!file) {
    return absl::NotFoundError(
        absl::StrCat("Account \"", account_id, "\" does not exist."));
  }

  std::stringstream content;
  content << file.rdbuf();

  AgentAccount account;
  if (!google::protobuf::TextFormat::ParseFromString(content.str(), &account)) {
    return absl::FailedPreconditionError(
        absl::StrCat("Cannot parse ", path, "."));
  }

  account.set_id(std::string(account_id));
  return account;
}

absl::StatusOr<std::vector<AgentAccount>> AccountStore::LoadAll() const {
  std::vector<AgentAccount> accounts;
  std::unique_ptr<DIR, DirCloser> dir(opendir(directory_.c_str()));
  if (dir == nullptr) {
    if (errno == ENOENT) {
      return accounts;
    }

    return absl::ErrnoToStatus(errno, absl::StrCat("Cannot read ", directory_));
  }

  while (const dirent* entry = readdir(dir.get())) {
    absl::string_view file_name = entry->d_name;
    if (!absl::ConsumeSuffix(&file_name, kExtension) ||
        !IsRegularFile(absl::StrCat(directory_, "/", entry->d_name))) {
      continue;
    }

    absl::StatusOr<AgentAccount> account = Load(file_name);
    if (!account.ok()) {
      LOG(WARNING) << "Skipping " << entry->d_name << ": " << account.status();
      continue;
    }

    accounts.push_back(*std::move(account));
  }

  std::sort(accounts.begin(), accounts.end(),
            [](const AgentAccount& a, const AgentAccount& b) {
              return a.id() < b.id();
            });
  return accounts;
}

absl::Status AccountStore::Save(const AgentAccount& account) const {
  absl::Status valid = ValidateAccountId(account.id());
  if (!valid.ok()) {
    return valid;
  }

  std::string text;
  if (!google::protobuf::TextFormat::PrintToString(account, &text)) {
    return absl::InternalError("Cannot serialize account.");
  }

  std::string path = PathFor(account.id());
  std::string temp_path = absl::StrCat(path, ".tmp.XXXXXX");
  int fd = mkstemp(temp_path.data());
  if (fd < 0) {
    return absl::ErrnoToStatus(errno, absl::StrCat("Cannot create ", path));
  }

  absl::Status status = WriteAll(fd, absl::StrCat(kFileHeader, text));
  if (status.ok() && fsync(fd) != 0) {
    status = absl::ErrnoToStatus(errno, "fsync failed");
  }

  if (close(fd) != 0 && status.ok()) {
    status = absl::ErrnoToStatus(errno, "close failed");
  }

  if (status.ok() && std::rename(temp_path.c_str(), path.c_str()) != 0) {
    status = absl::ErrnoToStatus(errno, absl::StrCat("Cannot replace ", path));
  }

  if (!status.ok()) {
    unlink(temp_path.c_str());
  }

  return status;
}

absl::Status AccountStore::Remove(absl::string_view account_id) const {
  absl::Status valid = ValidateAccountId(account_id);
  if (!valid.ok()) {
    return valid;
  }

  if (unlink(PathFor(account_id).c_str()) != 0) {
    if (errno == ENOENT) {
      return absl::NotFoundError(
          absl::StrCat("Account \"", account_id, "\" does not exist."));
    }

    return absl::ErrnoToStatus(errno, "Cannot remove account file");
  }

  return absl::OkStatus();
}

}  // namespace account
}  // namespace ai
}  // namespace gxde
