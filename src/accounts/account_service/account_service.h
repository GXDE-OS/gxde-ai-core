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

#ifndef SRC_ACCOUNTS_ACCOUNT_SERVICE_ACCOUNT_SERVICE_H_
#define SRC_ACCOUNTS_ACCOUNT_SERVICE_ACCOUNT_SERVICE_H_

#include <absl/base/thread_annotations.h>
#include <absl/status/statusor.h>
#include <absl/strings/string_view.h>
#include <absl/synchronization/mutex.h>
#include <grpcpp/grpcpp.h>

#include <string>
#include <vector>

#include "account.pb.h"
#include "account_service.grpc.pb.h"
#include "account_service.pb.h"
#include "src/accounts/account_store/account_store.h"
#include "src/accounts/model_detector/model_detector.h"
#include "src/utils/status_handler/status_handler.h"
#include "src/utils/uuid/uuid.h"

namespace gxde {
namespace ai {
namespace account {

class AccountServiceImpl final : public agent::AccountService::Service {
 public:
  AccountServiceImpl(const AccountStore* store, const ModelDetector* detector);

  grpc::Status CreateAccount(grpc::ServerContext* context,
                             const agent::CreateAccountRequest* request,
                             agent::AgentAccount* response) override;
  grpc::Status GetAccount(grpc::ServerContext* context,
                          const agent::GetAccountRequest* request,
                          agent::AgentAccount* response) override;
  grpc::Status ListAccounts(grpc::ServerContext* context,
                            const agent::ListAccountsRequest* request,
                            agent::ListAccountsResponse* response) override;
  grpc::Status UpdateAccount(grpc::ServerContext* context,
                             const agent::UpdateAccountRequest* request,
                             agent::AgentAccount* response) override;
  grpc::Status DeleteAccount(grpc::ServerContext* context,
                             const agent::DeleteAccountRequest* request,
                             google::protobuf::Empty* response) override;
  grpc::Status DetectModels(grpc::ServerContext* context,
                            const agent::DetectModelsRequest* request,
                            agent::DetectModelsResponse* response) override;
  grpc::Status AddModel(grpc::ServerContext* context,
                        const agent::AddModelRequest* request,
                        agent::ModelDescriptor* response) override;
  grpc::Status UpdateModel(grpc::ServerContext* context,
                           const agent::UpdateModelRequest* request,
                           agent::ModelDescriptor* response) override;
  grpc::Status DeleteModel(grpc::ServerContext* context,
                           const agent::DeleteModelRequest* request,
                           google::protobuf::Empty* response) override;
  grpc::Status SearchModels(grpc::ServerContext* context,
                            const agent::SearchModelsRequest* request,
                            agent::SearchModelsResponse* response) override;
  grpc::Status GetModelByUuid(grpc::ServerContext* context,
                              const agent::GetModelByUuidRequest* request,
                              agent::ResolvedModel* response) override;

 private:
  absl::StatusOr<std::vector<agent::AgentAccount>> LoadAllLocked()
      ABSL_EXCLUSIVE_LOCKS_REQUIRED(mutex_);
  absl::StatusOr<agent::AgentAccount> LoadLocked(absl::string_view account_id)
      ABSL_EXCLUSIVE_LOCKS_REQUIRED(mutex_);

  const AccountStore* store_;
  const ModelDetector* detector_;
  utils::StatusHandler status_handler_;
  utils::Uuid uuid_;

  absl::Mutex mutex_;
};

}  // namespace account
}  // namespace ai
}  // namespace gxde

#endif  // SRC_ACCOUNTS_ACCOUNT_SERVICE_ACCOUNT_SERVICE_H_
