/* End-to-end tests for the account service over a UNIX domain socket.
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

#include "src/accounts/account_service/account_service.h"

#include <absl/container/flat_hash_set.h>
#include <absl/strings/ascii.h>
#include <absl/strings/str_cat.h>
#include <google/protobuf/empty.pb.h>
#include <gtest/gtest.h>
#include <unistd.h>

#include <fstream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "src/utils/path_handler/path_handler.h"
#include "src/utils/uuid/uuid.h"
#include "tests/test_util.h"

namespace gxde {
namespace ai {
namespace {

using account::AccountServiceImpl;
using account::AccountStore;
using account::ModelDetector;
using agent::AgentAccount;
using agent::ModelDescriptor;

class FakeModelDetector final : public ModelDetector {
 public:
  absl::StatusOr<std::vector<ModelDescriptor>> Detect(
      const AgentAccount& /*account*/) const override {
    ++calls_;
    if (!status_.ok()) {
      return status_;
    }

    std::vector<ModelDescriptor> models;
    for (const std::string& id : model_ids_) {
      ModelDescriptor model;
      model.set_id(id);
      models.push_back(model);
    }

    return models;
  }

  void SetModelIds(std::vector<std::string> ids) {
    model_ids_ = std::move(ids);
  }
  void SetStatus(absl::Status status) { status_ = std::move(status); }
  int Calls() const { return calls_; }

 private:
  std::vector<std::string> model_ids_;
  absl::Status status_;
  mutable int calls_ = 0;
};

// Every model UUID across `accounts`, plus how many models there were.
struct UuidSummary {
  absl::flat_hash_set<std::string> uuids;
  int model_count = 0;
  bool all_valid = true;
};

UuidSummary SummarizeUuids(const std::vector<AgentAccount>& accounts) {
  UuidSummary summary;
  utils::Uuid uuid;
  for (const AgentAccount& account : accounts) {
    for (const ModelDescriptor& model : account.models()) {
      summary.all_valid = summary.all_valid && uuid.IsUuidValid(model.uuid());
      summary.uuids.insert(model.uuid());
      ++summary.model_count;
    }
  }

  return summary;
}

class AccountServiceTest : public testing::Test {
 protected:
  void SetUp() override {
    ASSERT_TRUE(store_.Init().ok());
    // Keep the path short; sockaddr_un only holds about 108 bytes.
    socket_path_ =
        absl::StrCat("/tmp/gxde-ai-core-account-test-", getpid(), ".sock");

    grpc::ServerBuilder builder;
    builder.AddListeningPort(path_handler_.ToGrpcAddress(socket_path_),
                             grpc::InsecureServerCredentials());
    builder.RegisterService(&service_);
    server_ = builder.BuildAndStart();
    ASSERT_NE(server_, nullptr);

    stub_ = agent::AccountService::NewStub(
        grpc::CreateChannel(path_handler_.ToGrpcAddress(socket_path_),
                            grpc::InsecureChannelCredentials()));
  }

  void TearDown() override {
    if (server_ != nullptr) {
      server_->Shutdown();
    }

    unlink(socket_path_.c_str());
  }

  grpc::Status Create(const AgentAccount& account, AgentAccount* response) {
    agent::CreateAccountRequest request;
    *request.mutable_account() = account;
    grpc::ClientContext context;
    return stub_->CreateAccount(&context, request, response);
  }

  // Creates an OpenAI account whose models come from the fake detector.
  void CreateDetected(const std::string& id) {
    detector_.SetModelIds({"gpt-a", "gpt-b"});
    AgentAccount account;
    account.set_id(id);
    account.set_provider(agent::PROVIDER_OPENAI);
    AgentAccount response;
    ASSERT_TRUE(Create(account, &response).ok());
  }

  grpc::Status UpdateModel(const std::string& account_id,
                           const ModelDescriptor& model,
                           const std::vector<std::string>& paths,
                           ModelDescriptor* response) {
    agent::UpdateModelRequest request;
    request.set_account_id(account_id);
    *request.mutable_model() = model;
    for (const std::string& path : paths) {
      request.mutable_update_mask()->add_paths(path);
    }

    grpc::ClientContext context;
    return stub_->UpdateModel(&context, request, response);
  }

  grpc::Status GetByUuid(const std::string& uuid,
                         agent::ResolvedModel* response) {
    agent::GetModelByUuidRequest request;
    request.set_model_uuid(uuid);
    grpc::ClientContext context;
    return stub_->GetModelByUuid(&context, request, response);
  }

  absl::StatusOr<std::vector<AgentAccount>> ListAll() {
    agent::ListAccountsResponse response;
    grpc::ClientContext context;
    grpc::Status status =
        stub_->ListAccounts(&context, agent::ListAccountsRequest(), &response);
    if (!status.ok()) {
      return absl::Status(static_cast<absl::StatusCode>(status.error_code()),
                          status.error_message());
    }

    return std::vector<AgentAccount>(response.accounts().begin(),
                                     response.accounts().end());
  }

  utils::PathHandler path_handler_;
  utils::Uuid uuid_;
  ScopedTempDir temp_dir_;
  AccountStore store_{temp_dir_.Path()};
  FakeModelDetector detector_;
  AccountServiceImpl service_{&store_, &detector_};
  std::string socket_path_;
  std::unique_ptr<grpc::Server> server_;
  std::unique_ptr<agent::AccountService::Stub> stub_;
};

}  // namespace

TEST_F(AccountServiceTest, CreateDetectsModelsWhenNoneGiven) {
  CreateDetected("work");

  absl::StatusOr<AgentAccount> stored = store_.Load("work");
  ASSERT_TRUE(stored.ok()) << stored.status();
  EXPECT_EQ(detector_.Calls(), 1);
  EXPECT_EQ(stored->api_protocol(),
            agent::API_PROTOCOL_OPENAI_CHAT_COMPLETIONS);
  EXPECT_EQ(stored->base_url(), "https://api.openai.com/v1");
  ASSERT_EQ(stored->models_size(), 2);
  EXPECT_EQ(stored->models(0).display_name(), "gpt-a");
}

TEST_F(AccountServiceTest, CreateKeepsExplicitModels) {
  AgentAccount account;
  account.set_id("work");
  account.set_provider(agent::PROVIDER_OPENAI);
  account.add_models()->set_id("only-this");
  AgentAccount response;

  ASSERT_TRUE(Create(account, &response).ok());

  EXPECT_EQ(detector_.Calls(), 0);
  ASSERT_EQ(response.models_size(), 1);
  EXPECT_EQ(response.models(0).id(), "only-this");
}

TEST_F(AccountServiceTest, CreateFailsWhenDetectionFails) {
  detector_.SetStatus(absl::UnauthenticatedError("bad key"));
  AgentAccount account;
  account.set_id("work");
  account.set_provider(agent::PROVIDER_OPENAI);
  AgentAccount response;

  grpc::Status status = Create(account, &response);

  EXPECT_EQ(status.error_code(), grpc::StatusCode::UNAUTHENTICATED);
  EXPECT_FALSE(store_.Exists("work"));
}

TEST_F(AccountServiceTest, CreateRejectsDuplicatesAndCustomWithoutUrl) {
  CreateDetected("work");
  AgentAccount duplicate;
  duplicate.set_id("work");
  duplicate.set_provider(agent::PROVIDER_OPENAI);
  AgentAccount custom;
  custom.set_id("local");
  custom.set_provider(agent::PROVIDER_CUSTOM);
  custom.set_api_protocol(agent::API_PROTOCOL_OPENAI_CHAT_COMPLETIONS);
  AgentAccount response;

  EXPECT_EQ(Create(duplicate, &response).error_code(),
            grpc::StatusCode::ALREADY_EXISTS);
  EXPECT_EQ(Create(custom, &response).error_code(),
            grpc::StatusCode::INVALID_ARGUMENT);
}

TEST_F(AccountServiceTest, UpdatesContextWindowOfOneModel) {
  CreateDetected("work");
  ModelDescriptor change;
  change.set_id("gpt-b");
  change.mutable_token_limits()->set_context_window_tokens(128000);
  ModelDescriptor response;

  ASSERT_TRUE(UpdateModel("work", change,
                          {"token_limits.context_window_tokens"}, &response)
                  .ok());

  absl::StatusOr<AgentAccount> stored = store_.Load("work");
  ASSERT_TRUE(stored.ok());
  EXPECT_EQ(stored->models(0).token_limits().context_window_tokens(), 0);
  EXPECT_EQ(stored->models(1).token_limits().context_window_tokens(), 128000);
  EXPECT_EQ(stored->models(1).display_name(), "gpt-b");
}

TEST_F(AccountServiceTest, UpdateModelValidatesRequest) {
  CreateDetected("work");
  ModelDescriptor change;
  change.set_id("gpt-a");
  ModelDescriptor missing;
  missing.set_id("nope");
  ModelDescriptor response;

  EXPECT_EQ(UpdateModel("work", change, {}, &response).error_code(),
            grpc::StatusCode::INVALID_ARGUMENT);
  EXPECT_EQ(UpdateModel("work", change, {"id"}, &response).error_code(),
            grpc::StatusCode::INVALID_ARGUMENT);
  EXPECT_EQ(UpdateModel("work", change, {"bogus"}, &response).error_code(),
            grpc::StatusCode::INVALID_ARGUMENT);
  EXPECT_EQ(
      UpdateModel("work", missing, {"display_name"}, &response).error_code(),
      grpc::StatusCode::NOT_FOUND);
}

TEST_F(AccountServiceTest, AddsAndDeletesModels) {
  CreateDetected("work");
  agent::AddModelRequest add;
  add.set_account_id("work");
  add.mutable_model()->set_id("gpt-new");
  add.mutable_model()->mutable_token_limits()->set_context_window_tokens(4096);
  ModelDescriptor added;
  grpc::ClientContext add_context;
  ASSERT_TRUE(stub_->AddModel(&add_context, add, &added).ok());

  grpc::ClientContext duplicate_context;
  EXPECT_EQ(stub_->AddModel(&duplicate_context, add, &added).error_code(),
            grpc::StatusCode::ALREADY_EXISTS);

  agent::DeleteModelRequest remove;
  remove.set_account_id("work");
  remove.set_model_id("gpt-a");
  google::protobuf::Empty empty;
  grpc::ClientContext remove_context;
  ASSERT_TRUE(stub_->DeleteModel(&remove_context, remove, &empty).ok());

  absl::StatusOr<AgentAccount> stored = store_.Load("work");
  ASSERT_TRUE(stored.ok());
  ASSERT_EQ(stored->models_size(), 2);
  EXPECT_EQ(stored->models(0).id(), "gpt-b");
  EXPECT_EQ(stored->models(1).id(), "gpt-new");
  EXPECT_EQ(stored->models(1).token_limits().context_window_tokens(), 4096);
}

TEST_F(AccountServiceTest, SearchMatchesAcrossAccounts) {
  CreateDetected("work");
  CreateDetected("home");
  agent::SearchModelsRequest request;
  request.set_query("GPT-B");
  agent::SearchModelsResponse response;
  grpc::ClientContext context;

  ASSERT_TRUE(stub_->SearchModels(&context, request, &response).ok());

  ASSERT_EQ(response.matches_size(), 2);
  EXPECT_EQ(response.matches(0).account_id(), "home");
  EXPECT_EQ(response.matches(1).account_id(), "work");
  EXPECT_EQ(response.matches(0).model().id(), "gpt-b");
}

TEST_F(AccountServiceTest, DetectModelsKeepsUserEdits) {
  CreateDetected("work");
  ModelDescriptor change;
  change.set_id("gpt-a");
  change.mutable_token_limits()->set_context_window_tokens(1000);
  ModelDescriptor updated;
  ASSERT_TRUE(UpdateModel("work", change,
                          {"token_limits.context_window_tokens"}, &updated)
                  .ok());

  detector_.SetModelIds({"gpt-a", "gpt-c"});
  agent::DetectModelsRequest request;
  request.set_account_id("work");
  agent::DetectModelsResponse response;
  grpc::ClientContext context;
  ASSERT_TRUE(stub_->DetectModels(&context, request, &response).ok());

  ASSERT_EQ(response.added_model_ids_size(), 1);
  EXPECT_EQ(response.added_model_ids(0), "gpt-c");
  ASSERT_EQ(response.account().models_size(), 3);
  EXPECT_EQ(response.account().models(0).token_limits().context_window_tokens(),
            1000);
}

TEST_F(AccountServiceTest, UpdateAccountAppliesMaskOnly) {
  CreateDetected("work");
  agent::UpdateAccountRequest request;
  request.mutable_account()->set_id("work");
  request.mutable_account()->set_display_name("Work");
  request.mutable_account()->set_base_url("ignored");
  request.mutable_update_mask()->add_paths("display_name");
  AgentAccount response;
  grpc::ClientContext context;

  ASSERT_TRUE(stub_->UpdateAccount(&context, request, &response).ok());

  EXPECT_EQ(response.display_name(), "Work");
  EXPECT_EQ(response.base_url(), "https://api.openai.com/v1");
  EXPECT_EQ(response.models_size(), 2);

  request.mutable_update_mask()->add_paths("models");
  grpc::ClientContext models_context;
  EXPECT_EQ(
      stub_->UpdateAccount(&models_context, request, &response).error_code(),
      grpc::StatusCode::INVALID_ARGUMENT);
}

TEST_F(AccountServiceTest, DeletesAccount) {
  CreateDetected("work");
  agent::DeleteAccountRequest request;
  request.set_account_id("work");
  google::protobuf::Empty empty;
  grpc::ClientContext context;
  ASSERT_TRUE(stub_->DeleteAccount(&context, request, &empty).ok());

  agent::GetAccountRequest get;
  get.set_account_id("work");
  AgentAccount response;
  grpc::ClientContext get_context;
  EXPECT_EQ(stub_->GetAccount(&get_context, get, &response).error_code(),
            grpc::StatusCode::NOT_FOUND);
}

TEST_F(AccountServiceTest, AssignsUniqueUuidsAcrossAccounts) {
  CreateDetected("work");
  CreateDetected("home");
  agent::AddModelRequest add;
  add.set_account_id("work");
  add.mutable_model()->set_id("gpt-new");
  add.mutable_model()->set_uuid("client-supplied");
  ModelDescriptor added;
  grpc::ClientContext context;
  ASSERT_TRUE(stub_->AddModel(&context, add, &added).ok());

  absl::StatusOr<std::vector<AgentAccount>> accounts = ListAll();
  ASSERT_TRUE(accounts.ok()) << accounts.status();
  UuidSummary summary = SummarizeUuids(*accounts);

  EXPECT_TRUE(summary.all_valid);
  EXPECT_EQ(summary.model_count, 5);
  EXPECT_EQ(summary.uuids.size(), 5);
  EXPECT_NE(added.uuid(), "client-supplied");
}

TEST_F(AccountServiceTest, ResolvesModelByUuid) {
  CreateDetected("work");
  agent::UpdateAccountRequest update;
  update.mutable_account()->set_id("work");
  update.mutable_account()->set_display_name("Work");
  update.mutable_update_mask()->add_paths("display_name");
  AgentAccount updated;
  grpc::ClientContext update_context;
  ASSERT_TRUE(stub_->UpdateAccount(&update_context, update, &updated).ok());
  std::string uuid = updated.models(1).uuid();

  agent::ResolvedModel resolved;
  ASSERT_TRUE(GetByUuid(absl::AsciiStrToUpper(uuid), &resolved).ok());

  EXPECT_EQ(resolved.model().id(), "gpt-b");
  EXPECT_EQ(resolved.model().uuid(), uuid);
  EXPECT_EQ(resolved.account().id(), "work");
  EXPECT_EQ(resolved.account().display_name(), "Work");
  EXPECT_EQ(resolved.account().provider(), agent::PROVIDER_OPENAI);
  EXPECT_EQ(resolved.account().base_url(), "https://api.openai.com/v1");
  EXPECT_EQ(resolved.account().models_size(), 0);
}

TEST_F(AccountServiceTest, UuidLookupErrors) {
  CreateDetected("work");
  agent::ResolvedModel resolved;

  EXPECT_EQ(GetByUuid("not-a-uuid", &resolved).error_code(),
            grpc::StatusCode::INVALID_ARGUMENT);
  EXPECT_EQ(GetByUuid(uuid_.GenUuid(), &resolved).error_code(),
            grpc::StatusCode::NOT_FOUND);
}

TEST_F(AccountServiceTest, UuidSurvivesUpdatesAndCannotBeChanged) {
  CreateDetected("work");
  std::string uuid = store_.Load("work")->models(0).uuid();
  ModelDescriptor change;
  change.set_id("gpt-a");
  change.set_uuid(uuid_.GenUuid());
  change.mutable_token_limits()->set_context_window_tokens(2048);
  ModelDescriptor response;

  EXPECT_EQ(UpdateModel("work", change, {"uuid"}, &response).error_code(),
            grpc::StatusCode::INVALID_ARGUMENT);
  ASSERT_TRUE(UpdateModel("work", change,
                          {"token_limits.context_window_tokens"}, &response)
                  .ok());
  EXPECT_EQ(response.uuid(), uuid);
}

TEST_F(AccountServiceTest, BackfillsHandWrittenModelsOnce) {
  std::ofstream(store_.Directory() + "/manual.textproto") << R"(
    provider: PROVIDER_OPENAI
    api_protocol: API_PROTOCOL_OPENAI_CHAT_COMPLETIONS
    base_url: "https://api.openai.com/v1"
    models { id: "hand-written" }
  )";

  absl::StatusOr<std::vector<AgentAccount>> first = ListAll();
  absl::StatusOr<std::vector<AgentAccount>> second = ListAll();

  ASSERT_TRUE(first.ok() && second.ok());
  std::string uuid = (*first)[0].models(0).uuid();
  EXPECT_TRUE(uuid_.IsUuidValid(uuid));
  EXPECT_EQ((*second)[0].models(0).uuid(), uuid);
  EXPECT_EQ(store_.Load("manual")->models(0).uuid(), uuid);
}

TEST_F(AccountServiceTest, RepairsUuidsDuplicatedByCopiedFile) {
  CreateDetected("alpha");
  std::ifstream original(store_.Directory() + "/alpha.textproto");
  std::ofstream(store_.Directory() + "/beta.textproto") << original.rdbuf();

  absl::StatusOr<std::vector<AgentAccount>> accounts = ListAll();

  ASSERT_TRUE(accounts.ok()) << accounts.status();
  ASSERT_EQ(accounts->size(), 2);
  EXPECT_EQ(SummarizeUuids(*accounts).uuids.size(), 4);
  EXPECT_EQ((*accounts)[0].models(0).uuid(),
            store_.Load("alpha")->models(0).uuid());
}

}  // namespace ai
}  // namespace gxde
