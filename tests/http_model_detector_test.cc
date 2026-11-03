/* Tests for detecting models through a provider's HTTP API.
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

#include "src/accounts/http_model_detector/http_model_detector.h"

#include <gtest/gtest.h>

#include <algorithm>
#include <cstdlib>
#include <deque>
#include <string>
#include <utility>
#include <vector>

#include "src/accounts/provider_defaults/provider_defaults.h"

namespace gxde {
namespace ai {
namespace {

using account::ApplyProviderDefaults;
using account::HttpModelDetector;
using agent::AgentAccount;
using utils::HttpClient;
using utils::HttpHeaders;
using utils::HttpResponse;

struct RecordedRequest {
  std::string url;
  HttpHeaders headers;
};

class FakeHttpClient final : public HttpClient {
 public:
  void AddResponse(int64_t status_code, std::string body) {
    responses_.push_back({status_code, std::move(body)});
  }

  absl::StatusOr<HttpResponse> Get(const std::string& url,
                                   const HttpHeaders& headers) const override {
    requests_.push_back({url, headers});
    if (responses_.empty()) {
      return absl::UnavailableError("No canned response.");
    }

    HttpResponse response = responses_.front();
    responses_.pop_front();
    return response;
  }

  const std::vector<RecordedRequest>& Requests() const { return requests_; }

 private:
  mutable std::deque<HttpResponse> responses_;
  mutable std::vector<RecordedRequest> requests_;
};

bool HasHeader(const HttpHeaders& headers, const std::string& name,
               const std::string& value) {
  return std::find(headers.begin(), headers.end(),
                   std::make_pair(name, value)) != headers.end();
}

AgentAccount MakeAccount(agent::Provider provider) {
  AgentAccount account;
  account.set_id("test");
  account.set_provider(provider);
  account.mutable_auth()
      ->mutable_header()
      ->mutable_credential()
      ->set_environment_variable("GXDE_AI_TEST_KEY");
  ApplyProviderDefaults(&account);
  return account;
}

class ModelDetectorTest : public testing::Test {
 protected:
  void SetUp() override { setenv("GXDE_AI_TEST_KEY", "secret", 1); }
  void TearDown() override { unsetenv("GXDE_AI_TEST_KEY"); }

  FakeHttpClient http_;
  HttpModelDetector detector_{&http_};
};

}  // namespace

TEST_F(ModelDetectorTest, OpenAiUsesBearerToken) {
  http_.AddResponse(200, R"({"data": [{"id": "gpt-a"}, {"id": "gpt-b"}]})");

  auto models = detector_.Detect(MakeAccount(agent::PROVIDER_OPENAI));

  ASSERT_TRUE(models.ok()) << models.status();
  EXPECT_EQ(models->size(), 2);
  ASSERT_EQ(http_.Requests().size(), 1);
  EXPECT_EQ(http_.Requests()[0].url, "https://api.openai.com/v1/models");
  EXPECT_TRUE(
      HasHeader(http_.Requests()[0].headers, "Authorization", "Bearer secret"));
}

TEST_F(ModelDetectorTest, AnthropicFollowsPagination) {
  http_.AddResponse(
      200, R"({"data": [{"id": "a"}], "has_more": true, "last_id": "a"})");
  http_.AddResponse(200, R"({"data": [{"id": "b"}], "has_more": false})");

  auto models = detector_.Detect(MakeAccount(agent::PROVIDER_ANTHROPIC));

  ASSERT_TRUE(models.ok()) << models.status();
  ASSERT_EQ(models->size(), 2);
  ASSERT_EQ(http_.Requests().size(), 2);
  EXPECT_EQ(http_.Requests()[1].url,
            "https://api.anthropic.com/v1/models?limit=1000&after_id=a");
  EXPECT_TRUE(HasHeader(http_.Requests()[0].headers, "x-api-key", "secret"));
  EXPECT_TRUE(HasHeader(http_.Requests()[0].headers, "anthropic-version",
                        "2023-06-01"));
}

TEST_F(ModelDetectorTest, GeminiEncodesPageToken) {
  http_.AddResponse(
      200, R"({"models": [{"name": "models/g1"}], "nextPageToken": "a+b="})");
  http_.AddResponse(200, R"({"models": [{"name": "models/g2"}]})");

  auto models = detector_.Detect(MakeAccount(agent::PROVIDER_GOOGLE_GEMINI));

  ASSERT_TRUE(models.ok()) << models.status();
  ASSERT_EQ(models->size(), 2);
  EXPECT_EQ(http_.Requests()[1].url,
            "https://generativelanguage.googleapis.com/v1beta/models?"
            "pageSize=1000&pageToken=a%2Bb%3D");
}

TEST_F(ModelDetectorTest, MissingEnvironmentVariableFails) {
  unsetenv("GXDE_AI_TEST_KEY");

  auto models = detector_.Detect(MakeAccount(agent::PROVIDER_OPENAI));

  EXPECT_EQ(models.status().code(), absl::StatusCode::kFailedPrecondition);
  EXPECT_TRUE(http_.Requests().empty());
}

TEST_F(ModelDetectorTest, MapsHttpErrors) {
  http_.AddResponse(401, R"({"error": "bad key"})");

  auto models = detector_.Detect(MakeAccount(agent::PROVIDER_OPENAI));

  EXPECT_EQ(models.status().code(), absl::StatusCode::kUnauthenticated);
}

TEST_F(ModelDetectorTest, NoAuthSendsNoCredential) {
  AgentAccount account;
  account.set_provider(agent::PROVIDER_CUSTOM);
  account.set_api_protocol(agent::API_PROTOCOL_OPENAI_CHAT_COMPLETIONS);
  account.set_base_url("http://localhost:11434/v1/");
  account.mutable_auth()->mutable_no_auth();
  ApplyProviderDefaults(&account);
  http_.AddResponse(200, R"({"data": [{"id": "llama"}]})");

  auto models = detector_.Detect(account);

  ASSERT_TRUE(models.ok()) << models.status();
  EXPECT_EQ(http_.Requests()[0].url, "http://localhost:11434/v1/models");
  EXPECT_TRUE(http_.Requests()[0].headers.empty());
}

}  // namespace ai
}  // namespace gxde
