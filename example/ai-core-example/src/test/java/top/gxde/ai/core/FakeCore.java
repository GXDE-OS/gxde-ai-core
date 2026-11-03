/* In-process fake of gxde-ai-core for client tests.
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

import com.google.protobuf.Empty;
import com.google.protobuf.Message;
import gxde.ai.agent.Account.AgentAccount;
import gxde.ai.agent.Account.ModelDescriptor;
import gxde.ai.agent.Account.Provider;
import gxde.ai.agent.AccountServiceGrpc;
import gxde.ai.agent.AccountServiceOuterClass.AddModelRequest;
import gxde.ai.agent.AccountServiceOuterClass.CreateAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.DeleteAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.DeleteModelRequest;
import gxde.ai.agent.AccountServiceOuterClass.DetectModelsRequest;
import gxde.ai.agent.AccountServiceOuterClass.DetectModelsResponse;
import gxde.ai.agent.AccountServiceOuterClass.GetAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.GetModelByUuidRequest;
import gxde.ai.agent.AccountServiceOuterClass.ListAccountsRequest;
import gxde.ai.agent.AccountServiceOuterClass.ListAccountsResponse;
import gxde.ai.agent.AccountServiceOuterClass.ModelMatch;
import gxde.ai.agent.AccountServiceOuterClass.ResolvedModel;
import gxde.ai.agent.AccountServiceOuterClass.SearchModelsRequest;
import gxde.ai.agent.AccountServiceOuterClass.SearchModelsResponse;
import gxde.ai.agent.AccountServiceOuterClass.UpdateAccountRequest;
import gxde.ai.agent.AccountServiceOuterClass.UpdateModelRequest;
import io.grpc.Server;
import io.grpc.Status;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Serves one canned account and records every request it receives. */
final class FakeCore {
  static final String UUID = "123e4567-e89b-42d3-a456-426614174000";
  static final ModelDescriptor MODEL =
      ModelDescriptor.newBuilder().setId("gpt-4o").setUuid(UUID).build();
  static final AgentAccount ACCOUNT =
      AgentAccount.newBuilder()
          .setId("openai")
          .setProvider(Provider.PROVIDER_OPENAI)
          .addModels(MODEL)
          .build();

  private final Server server;
  private final CoreClient client;
  private final List<Message> requests = new ArrayList<>();

  private FakeCore() throws IOException {
    String name = InProcessServerBuilder.generateName();
    server =
        InProcessServerBuilder.forName(name)
            .directExecutor()
            .addService(new Service())
            .build()
            .start();
    client = new CoreClient(InProcessChannelBuilder.forName(name).directExecutor().build());
  }

  static FakeCore start() throws IOException {
    return new FakeCore();
  }

  CoreClient client() {
    return client;
  }

  int requestCount() {
    return requests.size();
  }

  <T extends Message> T lastRequest(Class<T> type) {
    for (int i = requests.size() - 1; i >= 0; i--) {
      if (type.isInstance(requests.get(i))) {
        return type.cast(requests.get(i));
      }
    }
    throw new AssertionError("No " + type.getSimpleName() + " was received.");
  }

  void close() throws InterruptedException {
    client.close();
    server.shutdownNow().awaitTermination(5, TimeUnit.SECONDS);
  }

  private <T> void reply(Message request, StreamObserver<T> observer, T response) {
    requests.add(request);
    observer.onNext(response);
    observer.onCompleted();
  }

  private final class Service extends AccountServiceGrpc.AccountServiceImplBase {
    @Override
    public void listAccounts(ListAccountsRequest request, StreamObserver<ListAccountsResponse> o) {
      reply(request, o, ListAccountsResponse.newBuilder().addAccounts(ACCOUNT).build());
    }

    @Override
    public void getAccount(GetAccountRequest request, StreamObserver<AgentAccount> o) {
      reply(request, o, ACCOUNT);
    }

    @Override
    public void createAccount(CreateAccountRequest request, StreamObserver<AgentAccount> o) {
      reply(request, o, request.getAccount());
    }

    @Override
    public void updateAccount(UpdateAccountRequest request, StreamObserver<AgentAccount> o) {
      reply(request, o, request.getAccount());
    }

    @Override
    public void deleteAccount(DeleteAccountRequest request, StreamObserver<Empty> o) {
      reply(request, o, Empty.getDefaultInstance());
    }

    @Override
    public void detectModels(DetectModelsRequest request, StreamObserver<DetectModelsResponse> o) {
      DetectModelsResponse response =
          DetectModelsResponse.newBuilder().setAccount(ACCOUNT).addAddedModelIds("gpt-4o").build();
      reply(request, o, response);
    }

    @Override
    public void addModel(AddModelRequest request, StreamObserver<ModelDescriptor> o) {
      reply(request, o, request.getModel());
    }

    @Override
    public void updateModel(UpdateModelRequest request, StreamObserver<ModelDescriptor> o) {
      reply(request, o, request.getModel());
    }

    @Override
    public void deleteModel(DeleteModelRequest request, StreamObserver<Empty> o) {
      reply(request, o, Empty.getDefaultInstance());
    }

    @Override
    public void searchModels(SearchModelsRequest request, StreamObserver<SearchModelsResponse> o) {
      ModelMatch match = ModelMatch.newBuilder().setAccountId("openai").setModel(MODEL).build();
      reply(request, o, SearchModelsResponse.newBuilder().addMatches(match).build());
    }

    @Override
    public void getModelByUuid(GetModelByUuidRequest request, StreamObserver<ResolvedModel> o) {
      if (!request.getModelUuid().equals(UUID)) {
        requests.add(request);
        o.onError(Status.NOT_FOUND.asRuntimeException());
        return;
      }

      AgentAccount owner = ACCOUNT.toBuilder().clearModels().build();
      reply(request, o, ResolvedModel.newBuilder().setAccount(owner).setModel(MODEL).build());
    }
  }
}
