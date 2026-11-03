/* Blocking client for the gxde-ai-core account service.
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

package top.gxde.ai.core;

import com.google.protobuf.FieldMask;
import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.AccountServiceGrpc;
import gxde.ai.agent.AccountServiceGrpc.AccountServiceBlockingStub;
import gxde.ai.agent.AccountServiceOuterClass.AddModelRequest;
import gxde.ai.agent.AccountServiceOuterClass.CreateAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.DeleteAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.DeleteModelRequest;
import gxde.ai.agent.AccountServiceOuterClass.DetectModelsRequest;
import gxde.ai.agent.AccountServiceOuterClass.DetectModelsResponse;
import gxde.ai.agent.AccountServiceOuterClass.GetAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.GetModelByUuidRequest;
import gxde.ai.agent.AccountServiceOuterClass.ListAccountsRequest;
import gxde.ai.agent.AccountServiceOuterClass.ModelMatch;
import gxde.ai.agent.AccountServiceOuterClass.ResolvedModel;
import gxde.ai.agent.AccountServiceOuterClass.SearchModelsRequest;
import gxde.ai.agent.AccountServiceOuterClass.UpdateAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.UpdateModelRequest;
import io.grpc.Grpc;
import io.grpc.InsecureChannelCredentials;
import io.grpc.ManagedChannel;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Talks to gxde-ai-core over its UNIX socket.
 *
 * <p>Every call throws {@link io.grpc.StatusRuntimeException} when the server rejects the request
 * or cannot be reached.
 */
public final class CoreClient implements AutoCloseable {
  private static final long DEADLINE_SECONDS = 10;
  private static final long DETECT_DEADLINE_SECONDS = 120;
  private static final long SHUTDOWN_SECONDS = 5;

  private final ManagedChannel channel;
  private final AccountServiceBlockingStub stub;

  CoreClient(ManagedChannel channel) {
    this.channel = channel;
    this.stub = AccountServiceGrpc.newBlockingStub(channel);
  }

  /**
   * Opens a channel to the server listening on {@code socketPath}.
   *
   * @param socketPath path of the UNIX socket the server listens on
   * @return a client that owns the new channel until {@link #close()}
   */
  public static CoreClient connect(String socketPath) {
    ManagedChannel channel =
        Grpc.newChannelBuilder("unix://" + socketPath, InsecureChannelCredentials.create())
            .build();
    return new CoreClient(channel);
  }

  /**
   * Returns every account with its models, sorted by account ID.
   *
   * @return all stored accounts
   */
  public List<AgentAccount> listAccounts() {
    return withDeadline(DEADLINE_SECONDS)
        .listAccounts(ListAccountsRequest.getDefaultInstance())
        .getAccountsList();
  }

  /**
   * Returns the account with {@code accountId}.
   *
   * @param accountId ID of the account to fetch
   * @return the stored account with its models
   */
  public AgentAccount getAccount(String accountId) {
    GetAccountRequest request = GetAccountRequest.newBuilder().setAccountId(accountId).build();
    return withDeadline(DEADLINE_SECONDS).getAccount(request);
  }

  /**
   * Stores a new account. The server detects its models when it lists none.
   *
   * @param account the account to create; its ID must not be taken yet
   * @return the stored account, including detected models and their UUIDs
   */
  public AgentAccount createAccount(AgentAccount account) {
    CreateAccountRequest request = CreateAccountRequest.newBuilder().setAccount(account).build();
    return withDeadline(DETECT_DEADLINE_SECONDS).createAccount(request);
  }

  /**
   * Replaces the fields of {@code account} named in {@code mask}.
   *
   * @param account the account to change, identified by its ID, holding the new values
   * @param mask the fields to replace
   * @return the account as stored after the update
   */
  public AgentAccount updateAccount(AgentAccount account, FieldMask mask) {
    UpdateAccountRequest request =
        UpdateAccountRequest.newBuilder().setAccount(account).setUpdateMask(mask).build();
    return withDeadline(DEADLINE_SECONDS).updateAccount(request);
  }

  /**
   * Deletes the account with {@code accountId} and all of its models.
   *
   * @param accountId ID of the account to delete
   */
  public void deleteAccount(String accountId) {
    DeleteAccountRequest request =
        DeleteAccountRequest.newBuilder().setAccountId(accountId).build();
    withDeadline(DEADLINE_SECONDS).deleteAccount(request);
  }

  /**
   * Asks the provider for its models and adds the ones the account does not have yet.
   *
   * @param accountId ID of the account whose provider is queried
   * @return the updated account and the IDs of the models that were added
   */
  public DetectModelsResponse detectModels(String accountId) {
    DetectModelsRequest request = DetectModelsRequest.newBuilder().setAccountId(accountId).build();
    return withDeadline(DETECT_DEADLINE_SECONDS).detectModels(request);
  }

  /**
   * Adds {@code model} to the account with {@code accountId}.
   *
   * @param accountId ID of the account that receives the model
   * @param model the model to add; its ID must be new within the account
   * @return the stored model, including the UUID the server assigned
   */
  public ModelDescriptor addModel(String accountId, ModelDescriptor model) {
    AddModelRequest request =
        AddModelRequest.newBuilder().setAccountId(accountId).setModel(model).build();
    return withDeadline(DEADLINE_SECONDS).addModel(request);
  }

  /**
   * Replaces the fields of the model with the same ID that are named in {@code mask}.
   *
   * @param accountId ID of the account that owns the model
   * @param model the model to change, identified by its ID, holding the new values
   * @param mask the fields to replace, such as {@code token_limits.context_window_tokens}
   * @return the model as stored after the update
   */
  public ModelDescriptor updateModel(String accountId, ModelDescriptor model, FieldMask mask) {
    UpdateModelRequest request =
        UpdateModelRequest.newBuilder()
            .setAccountId(accountId)
            .setModel(model)
            .setUpdateMask(mask)
            .build();
    return withDeadline(DEADLINE_SECONDS).updateModel(request);
  }

  /**
   * Removes the model with {@code modelId} from the account with {@code accountId}.
   *
   * @param accountId ID of the account that owns the model
   * @param modelId ID of the model to remove
   */
  public void deleteModel(String accountId, String modelId) {
    DeleteModelRequest request =
        DeleteModelRequest.newBuilder().setAccountId(accountId).setModelId(modelId).build();
    withDeadline(DEADLINE_SECONDS).deleteModel(request);
  }

  /**
   * Returns models whose ID, display name or UUID contains {@code query}, ignoring case. An empty
   * {@code accountId} searches every account.
   *
   * @param query text to look for; an empty query matches every model
   * @param accountId ID of the account to search, or an empty string for all accounts
   * @return the matching models with the IDs of the accounts that own them
   */
  public List<ModelMatch> searchModels(String query, String accountId) {
    SearchModelsRequest request =
        SearchModelsRequest.newBuilder().setQuery(query).setAccountId(accountId).build();
    return withDeadline(DEADLINE_SECONDS).searchModels(request).getMatchesList();
  }

  /**
   * Returns the model with {@code uuid} and the account that owns it.
   *
   * @param uuid UUID the server assigned to the model
   * @return the model and its owning account, without the account's other models
   */
  public ResolvedModel getModelByUuid(String uuid) {
    GetModelByUuidRequest request = GetModelByUuidRequest.newBuilder().setModelUuid(uuid).build();
    return withDeadline(DEADLINE_SECONDS).getModelByUuid(request);
  }

  @Override
  public void close() {
    channel.shutdown();
    try {
      if (!channel.awaitTermination(SHUTDOWN_SECONDS, TimeUnit.SECONDS)) {
        channel.shutdownNow();
      }
    } catch (InterruptedException e) {
      channel.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  private AccountServiceBlockingStub withDeadline(long seconds) {
    return stub.withDeadlineAfter(seconds, TimeUnit.SECONDS);
  }
}
