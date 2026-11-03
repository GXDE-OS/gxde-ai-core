/* gRPC service that manages provider accounts and their models.
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
#include <absl/status/status.h>
#include <absl/status/statusor.h>
#include <absl/strings/ascii.h>
#include <absl/strings/match.h>
#include <absl/strings/str_cat.h>
#include <absl/strings/string_view.h>
#include <google/protobuf/field_mask.pb.h>
#include <google/protobuf/util/field_mask_util.h>

#include <algorithm>
#include <string>
#include <utility>
#include <vector>

#include "src/accounts/account_service/account_service.h"
#include "src/accounts/provider_defaults/provider_defaults.h"

namespace gxde {
namespace ai {
namespace account {

namespace {

using agent::AgentAccount;
using agent::ModelDescriptor;
using google::protobuf::FieldMask;
using google::protobuf::util::FieldMaskUtil;

absl::Status ValidateModel(const ModelDescriptor& model) {
  if (model.id().empty()) {
    return absl::InvalidArgumentError("Model ID must not be empty.");
  }

  return absl::OkStatus();
}

absl::Status ValidateAccount(const AgentAccount& account) {
  absl::Status valid_id = ValidateAccountId(account.id());
  if (!valid_id.ok()) {
    return valid_id;
  }

  if (FamilyOf(account.api_protocol()) == ProtocolFamily::kUnknown) {
    return absl::InvalidArgumentError(
        "api_protocol is required when the provider has no default.");
  }

  if (account.base_url().empty()) {
    return absl::InvalidArgumentError(
        "base_url is required when the provider has no default.");
  }

  absl::flat_hash_set<std::string> model_ids;
  for (const ModelDescriptor& model : account.models()) {
    absl::Status valid_model = ValidateModel(model);
    if (!valid_model.ok()) {
      return valid_model;
    }

    if (!model_ids.insert(model.id()).second) {
      return absl::InvalidArgumentError(
          absl::StrCat("Duplicate model ID \"", model.id(), "\"."));
    }
  }

  return absl::OkStatus();
}

void ApplyModelDefaults(ModelDescriptor* model) {
  if (model->display_name().empty()) {
    model->set_display_name(model->id());
  }
}

template <typename Message>
absl::Status ValidateUpdateMask(const FieldMask& mask,
                                const std::vector<absl::string_view>& locked) {
  if (mask.paths().empty()) {
    return absl::InvalidArgumentError(
        "update_mask must list the fields to change.");
  }

  if (!FieldMaskUtil::IsValidFieldMask<Message>(mask)) {
    return absl::InvalidArgumentError(
        absl::StrCat("update_mask contains an unknown field: ",
                     FieldMaskUtil::ToString(mask)));
  }

  for (const std::string& path : mask.paths()) {
    for (absl::string_view field : locked) {
      if (path == field || absl::StartsWith(path, absl::StrCat(field, "."))) {
        return absl::InvalidArgumentError(
            absl::StrCat("Field \"", path, "\" cannot be updated here."));
      }
    }
  }

  return absl::OkStatus();
}

template <typename Message>
void MergeMasked(const Message& source, const FieldMask& mask,
                 Message* destination) {
  FieldMaskUtil::MergeOptions options;
  options.set_replace_message_fields(true);
  options.set_replace_repeated_fields(true);
  FieldMaskUtil::MergeMessageTo(source, mask, options, destination);
}

ModelDescriptor* FindModel(AgentAccount* account, absl::string_view model_id) {
  for (ModelDescriptor& model : *account->mutable_models()) {
    if (model.id() == model_id) {
      return &model;
    }
  }

  return nullptr;
}

AgentAccount* FindAccount(std::vector<AgentAccount>* accounts,
                          absl::string_view account_id) {
  for (AgentAccount& account : *accounts) {
    if (account.id() == account_id) {
      return &account;
    }
  }

  return nullptr;
}

absl::Status MissingAccountError(const AccountStore& store,
                                 absl::string_view account_id) {
  absl::StatusOr<AgentAccount> account = store.Load(account_id);
  if (!account.ok()) {
    return account.status();
  }

  return absl::UnavailableError(
      "The account changed while it was being loaded; retry.");
}

absl::flat_hash_set<std::string> CollectUuids(
    const std::vector<AgentAccount>& accounts) {
  absl::flat_hash_set<std::string> uuids;
  for (const AgentAccount& account : accounts) {
    for (const ModelDescriptor& model : account.models()) {
      uuids.insert(model.uuid());
    }
  }

  return uuids;
}

void AssignNewUuid(utils::Uuid* generator, ModelDescriptor* model,
                   absl::flat_hash_set<std::string>* used) {
  std::string uuid = generator->GenUuid();
  while (!used->insert(uuid).second) {
    uuid = generator->GenUuid();
  }

  model->set_uuid(std::move(uuid));
}

absl::Status ModelNotFound(absl::string_view account_id,
                           absl::string_view model_id) {
  return absl::NotFoundError(absl::StrCat("Model \"", model_id,
                                          "\" does not exist in account \"",
                                          account_id, "\"."));
}

bool MatchesQuery(const ModelDescriptor& model, absl::string_view query) {
  return query.empty() || absl::StrContainsIgnoreCase(model.id(), query) ||
         absl::StrContainsIgnoreCase(model.display_name(), query) ||
         absl::StrContainsIgnoreCase(model.uuid(), query);
}

}  // namespace

AccountServiceImpl::AccountServiceImpl(const AccountStore* store,
                                       const ModelDetector* detector)
    : store_(store), detector_(detector) {}

absl::StatusOr<std::vector<AgentAccount>> AccountServiceImpl::LoadAllLocked() {
  absl::StatusOr<std::vector<AgentAccount>> accounts = store_->LoadAll();
  if (!accounts.ok()) {
    return accounts.status();
  }

  absl::flat_hash_set<std::string> seen;
  for (AgentAccount& account : *accounts) {
    bool changed = false;
    for (ModelDescriptor& model : *account.mutable_models()) {
      std::string uuid = absl::AsciiStrToLower(model.uuid());
      if (!uuid_.IsUuidValid(uuid) || !seen.insert(uuid).second) {
        AssignNewUuid(&uuid_, &model, &seen);
        changed = true;
      } else if (uuid != model.uuid()) {
        model.set_uuid(std::move(uuid));
        changed = true;
      }
    }

    if (changed) {
      absl::Status saved = store_->Save(account);
      if (!saved.ok()) {
        return saved;
      }
    }
  }

  return accounts;
}

absl::StatusOr<AgentAccount> AccountServiceImpl::LoadLocked(
    absl::string_view account_id) {
  absl::StatusOr<std::vector<AgentAccount>> accounts = LoadAllLocked();
  if (!accounts.ok()) {
    return accounts.status();
  }

  AgentAccount* account = FindAccount(&*accounts, account_id);
  if (account == nullptr) {
    return MissingAccountError(*store_, account_id);
  }

  return std::move(*account);
}

grpc::Status AccountServiceImpl::CreateAccount(
    grpc::ServerContext* /*context*/,
    const agent::CreateAccountRequest* request, AgentAccount* response) {
  AgentAccount account = request->account();
  ApplyProviderDefaults(&account);
  absl::Status valid = ValidateAccount(account);
  if (!valid.ok()) {
    return status_handler_.ToGrpcStatus(valid);
  }

  if (store_->Exists(account.id())) {
    return status_handler_.ToGrpcStatus(absl::AlreadyExistsError(
        absl::StrCat("Account \"", account.id(), "\" already exists.")));
  }

  if (account.models().empty()) {
    absl::StatusOr<std::vector<ModelDescriptor>> detected =
        detector_->Detect(account);
    if (!detected.ok()) {
      return status_handler_.ToGrpcStatus(absl::Status(
          detected.status().code(),
          absl::StrCat("Model detection failed: ", detected.status().message(),
                       " List the models explicitly to skip detection.")));
    }

    for (ModelDescriptor& model : *detected) {
      *account.add_models() = std::move(model);
    }
  }

  absl::MutexLock lock(mutex_);
  if (store_->Exists(account.id())) {
    return status_handler_.ToGrpcStatus(absl::AlreadyExistsError(
        absl::StrCat("Account \"", account.id(), "\" already exists.")));
  }

  absl::StatusOr<std::vector<AgentAccount>> existing = LoadAllLocked();
  if (!existing.ok()) {
    return status_handler_.ToGrpcStatus(existing.status());
  }

  absl::flat_hash_set<std::string> used = CollectUuids(*existing);
  for (ModelDescriptor& model : *account.mutable_models()) {
    ApplyModelDefaults(&model);
    AssignNewUuid(&uuid_, &model, &used);
  }

  absl::Status saved = store_->Save(account);
  if (!saved.ok()) {
    return status_handler_.ToGrpcStatus(saved);
  }

  *response = std::move(account);
  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::GetAccount(
    grpc::ServerContext* /*context*/, const agent::GetAccountRequest* request,
    AgentAccount* response) {
  absl::MutexLock lock(mutex_);
  absl::StatusOr<AgentAccount> account = LoadLocked(request->account_id());
  if (!account.ok()) {
    return status_handler_.ToGrpcStatus(account.status());
  }

  *response = *std::move(account);
  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::ListAccounts(
    grpc::ServerContext* /*context*/,
    const agent::ListAccountsRequest* /*request*/,
    agent::ListAccountsResponse* response) {
  absl::MutexLock lock(mutex_);
  absl::StatusOr<std::vector<AgentAccount>> accounts = LoadAllLocked();
  if (!accounts.ok()) {
    return status_handler_.ToGrpcStatus(accounts.status());
  }

  for (AgentAccount& account : *accounts) {
    *response->add_accounts() = std::move(account);
  }

  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::UpdateAccount(
    grpc::ServerContext* /*context*/,
    const agent::UpdateAccountRequest* request, AgentAccount* response) {
  absl::Status valid_mask = ValidateUpdateMask<AgentAccount>(
      request->update_mask(), {"id", "models"});
  if (!valid_mask.ok()) {
    return status_handler_.ToGrpcStatus(valid_mask);
  }

  absl::MutexLock lock(mutex_);
  absl::StatusOr<AgentAccount> account = LoadLocked(request->account().id());
  if (!account.ok()) {
    return status_handler_.ToGrpcStatus(account.status());
  }

  MergeMasked(request->account(), request->update_mask(), &*account);
  ApplyProviderDefaults(&*account);
  absl::Status valid = ValidateAccount(*account);
  if (!valid.ok()) {
    return status_handler_.ToGrpcStatus(valid);
  }

  absl::Status saved = store_->Save(*account);
  if (!saved.ok()) {
    return status_handler_.ToGrpcStatus(saved);
  }

  *response = *std::move(account);
  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::DeleteAccount(
    grpc::ServerContext* /*context*/,
    const agent::DeleteAccountRequest* request,
    google::protobuf::Empty* /*response*/) {
  absl::MutexLock lock(mutex_);
  return status_handler_.ToGrpcStatus(store_->Remove(request->account_id()));
}

grpc::Status AccountServiceImpl::DetectModels(
    grpc::ServerContext* /*context*/, const agent::DetectModelsRequest* request,
    agent::DetectModelsResponse* response) {
  absl::StatusOr<AgentAccount> snapshot;
  {
    absl::MutexLock lock(mutex_);
    snapshot = LoadLocked(request->account_id());
  }

  if (!snapshot.ok()) {
    return status_handler_.ToGrpcStatus(snapshot.status());
  }

  absl::StatusOr<std::vector<ModelDescriptor>> detected =
      detector_->Detect(*snapshot);
  if (!detected.ok()) {
    return status_handler_.ToGrpcStatus(detected.status());
  }

  absl::MutexLock lock(mutex_);
  absl::StatusOr<std::vector<AgentAccount>> accounts = LoadAllLocked();
  if (!accounts.ok()) {
    return status_handler_.ToGrpcStatus(accounts.status());
  }

  AgentAccount* account = FindAccount(&*accounts, request->account_id());
  if (account == nullptr) {
    return status_handler_.ToGrpcStatus(
        MissingAccountError(*store_, request->account_id()));
  }

  absl::flat_hash_set<std::string> used = CollectUuids(*accounts);
  for (ModelDescriptor& model : *detected) {
    if (FindModel(account, model.id()) != nullptr) {
      continue;
    }

    ApplyModelDefaults(&model);
    AssignNewUuid(&uuid_, &model, &used);
    response->add_added_model_ids(model.id());
    *account->add_models() = std::move(model);
  }

  if (!response->added_model_ids().empty()) {
    absl::Status saved = store_->Save(*account);
    if (!saved.ok()) {
      return status_handler_.ToGrpcStatus(saved);
    }
  }

  *response->mutable_account() = std::move(*account);
  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::AddModel(grpc::ServerContext* /*context*/,
                                          const agent::AddModelRequest* request,
                                          ModelDescriptor* response) {
  ModelDescriptor model = request->model();
  absl::Status valid = ValidateModel(model);
  if (!valid.ok()) {
    return status_handler_.ToGrpcStatus(valid);
  }

  ApplyModelDefaults(&model);

  absl::MutexLock lock(mutex_);
  absl::StatusOr<std::vector<AgentAccount>> accounts = LoadAllLocked();
  if (!accounts.ok()) {
    return status_handler_.ToGrpcStatus(accounts.status());
  }

  AgentAccount* account = FindAccount(&*accounts, request->account_id());
  if (account == nullptr) {
    return status_handler_.ToGrpcStatus(
        MissingAccountError(*store_, request->account_id()));
  }

  if (FindModel(account, model.id()) != nullptr) {
    return status_handler_.ToGrpcStatus(absl::AlreadyExistsError(
        absl::StrCat("Model \"", model.id(), "\" already exists in account \"",
                     account->id(), "\".")));
  }

  absl::flat_hash_set<std::string> used = CollectUuids(*accounts);
  AssignNewUuid(&uuid_, &model, &used);
  *account->add_models() = model;
  absl::Status saved = store_->Save(*account);
  if (!saved.ok()) {
    return status_handler_.ToGrpcStatus(saved);
  }

  *response = std::move(model);
  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::UpdateModel(
    grpc::ServerContext* /*context*/, const agent::UpdateModelRequest* request,
    ModelDescriptor* response) {
  absl::Status valid_mask = ValidateUpdateMask<ModelDescriptor>(
      request->update_mask(), {"id", "uuid"});
  if (!valid_mask.ok()) {
    return status_handler_.ToGrpcStatus(valid_mask);
  }

  absl::MutexLock lock(mutex_);
  absl::StatusOr<AgentAccount> account = LoadLocked(request->account_id());
  if (!account.ok()) {
    return status_handler_.ToGrpcStatus(account.status());
  }

  ModelDescriptor* model = FindModel(&*account, request->model().id());
  if (model == nullptr) {
    return status_handler_.ToGrpcStatus(
        ModelNotFound(request->account_id(), request->model().id()));
  }

  MergeMasked(request->model(), request->update_mask(), model);
  ApplyModelDefaults(model);
  absl::Status saved = store_->Save(*account);
  if (!saved.ok()) {
    return status_handler_.ToGrpcStatus(saved);
  }

  *response = *model;
  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::DeleteModel(
    grpc::ServerContext* /*context*/, const agent::DeleteModelRequest* request,
    google::protobuf::Empty* /*response*/) {
  absl::MutexLock lock(mutex_);
  absl::StatusOr<AgentAccount> account = LoadLocked(request->account_id());
  if (!account.ok()) {
    return status_handler_.ToGrpcStatus(account.status());
  }

  auto* models = account->mutable_models();
  auto it = std::find_if(models->begin(), models->end(),
                         [request](const ModelDescriptor& model) {
                           return model.id() == request->model_id();
                         });
  if (it == models->end()) {
    return status_handler_.ToGrpcStatus(
        ModelNotFound(request->account_id(), request->model_id()));
  }

  models->erase(it);
  return status_handler_.ToGrpcStatus(store_->Save(*account));
}

grpc::Status AccountServiceImpl::SearchModels(
    grpc::ServerContext* /*context*/, const agent::SearchModelsRequest* request,
    agent::SearchModelsResponse* response) {
  absl::MutexLock lock(mutex_);
  absl::StatusOr<std::vector<AgentAccount>> accounts = LoadAllLocked();
  if (!accounts.ok()) {
    return status_handler_.ToGrpcStatus(accounts.status());
  }

  if (!request->account_id().empty() &&
      FindAccount(&*accounts, request->account_id()) == nullptr) {
    return status_handler_.ToGrpcStatus(
        MissingAccountError(*store_, request->account_id()));
  }

  absl::string_view query = absl::StripAsciiWhitespace(request->query());
  for (const AgentAccount& account : *accounts) {
    if (!request->account_id().empty() &&
        account.id() != request->account_id()) {
      continue;
    }

    for (const ModelDescriptor& model : account.models()) {
      if (!MatchesQuery(model, query)) {
        continue;
      }

      agent::ModelMatch* match = response->add_matches();
      match->set_account_id(account.id());
      *match->mutable_model() = model;
    }
  }

  return grpc::Status::OK;
}

grpc::Status AccountServiceImpl::GetModelByUuid(
    grpc::ServerContext* /*context*/,
    const agent::GetModelByUuidRequest* request,
    agent::ResolvedModel* response) {
  std::string uuid =
      absl::AsciiStrToLower(absl::StripAsciiWhitespace(request->model_uuid()));
  if (!uuid_.IsUuidValid(uuid)) {
    return status_handler_.ToGrpcStatus(absl::InvalidArgumentError(
        absl::StrCat("\"", request->model_uuid(), "\" is not a valid UUID.")));
  }

  absl::MutexLock lock(mutex_);
  absl::StatusOr<std::vector<AgentAccount>> accounts = LoadAllLocked();
  if (!accounts.ok()) {
    return status_handler_.ToGrpcStatus(accounts.status());
  }

  for (AgentAccount& account : *accounts) {
    for (ModelDescriptor& model : *account.mutable_models()) {
      if (model.uuid() != uuid) {
        continue;
      }

      *response->mutable_model() = std::move(model);
      account.clear_models();
      *response->mutable_account() = std::move(account);
      return grpc::Status::OK;
    }
  }

  return status_handler_.ToGrpcStatus(
      absl::NotFoundError(absl::StrCat("No model has UUID ", uuid, ".")));
}

}  // namespace account
}  // namespace ai
}  // namespace gxde
