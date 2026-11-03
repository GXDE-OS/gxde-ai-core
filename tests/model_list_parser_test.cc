/* Tests for parsing provider model listing responses.
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

#include "src/accounts/model_list_parser/model_list_parser.h"

#include <gtest/gtest.h>

namespace gxde {
namespace ai {
namespace {

using account::ModelListPage;
using account::ParseAnthropicModelList;
using account::ParseGeminiModelList;
using account::ParseOpenAiModelList;

}  // namespace

TEST(ModelListParserTest, ParsesOpenAiList) {
  absl::StatusOr<ModelListPage> page = ParseOpenAiModelList(R"({
    "object": "list",
    "data": [
      {"id": "gpt-4o", "object": "model", "owned_by": "openai"},
      {"id": "meta/llama", "name": "Llama", "context_length": 131072},
      {"id": "groq-model", "context_window": 8192},
      {"object": "model"}
    ]
  })");

  ASSERT_TRUE(page.ok()) << page.status();
  ASSERT_EQ(page->models.size(), 3);
  EXPECT_EQ(page->models[0].id(), "gpt-4o");
  EXPECT_EQ(page->models[0].display_name(), "gpt-4o");
  EXPECT_FALSE(page->models[0].has_token_limits());
  EXPECT_EQ(page->models[1].display_name(), "Llama");
  EXPECT_EQ(page->models[1].token_limits().context_window_tokens(), 131072);
  EXPECT_EQ(page->models[2].token_limits().context_window_tokens(), 8192);
  EXPECT_TRUE(page->next_page_token.empty());
}

TEST(ModelListParserTest, ParsesAnthropicPagination) {
  absl::StatusOr<ModelListPage> page = ParseAnthropicModelList(R"({
    "data": [{"id": "model-a", "display_name": "Model A", "type": "model"}],
    "has_more": true,
    "first_id": "model-a",
    "last_id": "model-a"
  })");

  ASSERT_TRUE(page.ok()) << page.status();
  ASSERT_EQ(page->models.size(), 1);
  EXPECT_EQ(page->models[0].display_name(), "Model A");
  EXPECT_EQ(page->next_page_token, "model-a");
}

TEST(ModelListParserTest, AnthropicLastPageHasNoToken) {
  absl::StatusOr<ModelListPage> page = ParseAnthropicModelList(
      R"({"data": [], "has_more": false, "last_id": null})");

  ASSERT_TRUE(page.ok()) << page.status();
  EXPECT_TRUE(page->next_page_token.empty());
}

TEST(ModelListParserTest, ParsesGeminiAndSkipsEmbeddings) {
  absl::StatusOr<ModelListPage> page = ParseGeminiModelList(R"({
    "models": [
      {
        "name": "models/gemini-pro",
        "displayName": "Gemini Pro",
        "inputTokenLimit": 1048576,
        "outputTokenLimit": 65536,
        "supportedGenerationMethods": ["generateContent", "countTokens"]
      },
      {
        "name": "models/text-embedding",
        "supportedGenerationMethods": ["embedContent"]
      }
    ],
    "nextPageToken": "abc="
  })");

  ASSERT_TRUE(page.ok()) << page.status();
  ASSERT_EQ(page->models.size(), 1);
  EXPECT_EQ(page->models[0].id(), "gemini-pro");
  EXPECT_EQ(page->models[0].token_limits().context_window_tokens(), 1048576);
  EXPECT_EQ(page->models[0].token_limits().max_output_tokens(), 65536);
  EXPECT_EQ(page->next_page_token, "abc=");
}

TEST(ModelListParserTest, GeminiEmptyResponse) {
  absl::StatusOr<ModelListPage> page = ParseGeminiModelList("{}");

  ASSERT_TRUE(page.ok()) << page.status();
  EXPECT_TRUE(page->models.empty());
}

TEST(ModelListParserTest, RejectsMalformedJson) {
  EXPECT_EQ(ParseOpenAiModelList("<html>").status().code(),
            absl::StatusCode::kInvalidArgument);
  EXPECT_EQ(ParseOpenAiModelList(R"({"error": "x"})").status().code(),
            absl::StatusCode::kInvalidArgument);
}

}  // namespace ai
}  // namespace gxde
