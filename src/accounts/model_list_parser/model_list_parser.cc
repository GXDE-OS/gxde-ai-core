/* Parsers for the model listing responses of each provider API.
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

#include <absl/status/status.h>
#include <absl/strings/match.h>
#include <absl/strings/str_cat.h>
#include <absl/strings/strip.h>
#include <google/protobuf/struct.pb.h>
#include <google/protobuf/util/json_util.h>

#include <algorithm>
#include <cstdint>
#include <initializer_list>
#include <string>
#include <utility>

#include "src/accounts/model_list_parser/model_list_parser.h"

namespace gxde {
namespace ai {
namespace account {

namespace {

using agent::ModelDescriptor;
using google::protobuf::ListValue;
using google::protobuf::Struct;
using google::protobuf::Value;

absl::StatusOr<Struct> ParseJsonObject(absl::string_view json) {
  Struct root;
  google::protobuf::util::JsonParseOptions options;
  options.ignore_unknown_fields = true;
  absl::Status status =
      google::protobuf::util::JsonStringToMessage(json, &root, options);
  if (!status.ok()) {
    return absl::InvalidArgumentError(
        absl::StrCat("Malformed model list response: ", status.message()));
  }

  return root;
}

const Value* FindField(const Struct& object, absl::string_view key) {
  auto it = object.fields().find(std::string(key));
  return it == object.fields().end() ? nullptr : &it->second;
}

std::string StringField(const Struct& object, absl::string_view key) {
  const Value* value = FindField(object, key);
  return value != nullptr && value->has_string_value() ? value->string_value()
                                                       : "";
}

bool BoolField(const Struct& object, absl::string_view key) {
  const Value* value = FindField(object, key);
  return value != nullptr && value->has_bool_value() && value->bool_value();
}

uint64_t TokenCountField(const Struct& object, absl::string_view key) {
  const Value* value = FindField(object, key);
  if (value == nullptr || !value->has_number_value() ||
      value->number_value() <= 0) {
    return 0;
  }

  return static_cast<uint64_t>(value->number_value());
}

uint64_t FirstTokenCountField(const Struct& object,
                              std::initializer_list<absl::string_view> keys) {
  for (absl::string_view key : keys) {
    uint64_t count = TokenCountField(object, key);
    if (count != 0) {
      return count;
    }
  }

  return 0;
}

const ListValue* ListField(const Struct& object, absl::string_view key) {
  const Value* value = FindField(object, key);
  return value != nullptr && value->has_list_value() ? &value->list_value()
                                                     : nullptr;
}

bool ListContainsString(const ListValue& list, absl::string_view text) {
  return std::any_of(
      list.values().begin(), list.values().end(), [text](const Value& value) {
        return value.has_string_value() && value.string_value() == text;
      });
}

absl::StatusOr<const ListValue*> RequiredListField(const Struct& object,
                                                   absl::string_view key) {
  const ListValue* list = ListField(object, key);
  if (list == nullptr) {
    return absl::InvalidArgumentError(
        absl::StrCat("Model list response has no \"", key, "\" array."));
  }

  return list;
}

ModelDescriptor NewModel(std::string id, std::string display_name) {
  ModelDescriptor model;
  model.set_display_name(display_name.empty() ? id : std::move(display_name));
  model.set_id(std::move(id));
  return model;
}

}  // namespace

absl::StatusOr<ModelListPage> ParseOpenAiModelList(absl::string_view json) {
  absl::StatusOr<Struct> root = ParseJsonObject(json);
  if (!root.ok()) {
    return root.status();
  }

  absl::StatusOr<const ListValue*> data = RequiredListField(*root, "data");
  if (!data.ok()) {
    return data.status();
  }

  ModelListPage page;
  for (const Value& entry : (*data)->values()) {
    if (!entry.has_struct_value()) {
      continue;
    }

    const Struct& object = entry.struct_value();
    std::string id = StringField(object, "id");
    if (id.empty()) {
      continue;
    }

    ModelDescriptor model =
        NewModel(std::move(id), StringField(object, "name"));
    uint64_t context_window = FirstTokenCountField(
        object, {"context_window", "context_length", "max_model_len"});
    if (context_window != 0) {
      model.mutable_token_limits()->set_context_window_tokens(context_window);
    }

    page.models.push_back(std::move(model));
  }

  return page;
}

absl::StatusOr<ModelListPage> ParseAnthropicModelList(absl::string_view json) {
  absl::StatusOr<Struct> root = ParseJsonObject(json);
  if (!root.ok()) {
    return root.status();
  }

  absl::StatusOr<const ListValue*> data = RequiredListField(*root, "data");
  if (!data.ok()) {
    return data.status();
  }

  ModelListPage page;
  for (const Value& entry : (*data)->values()) {
    if (!entry.has_struct_value()) {
      continue;
    }

    const Struct& object = entry.struct_value();
    std::string id = StringField(object, "id");
    if (id.empty()) {
      continue;
    }

    page.models.push_back(
        NewModel(std::move(id), StringField(object, "display_name")));
  }

  if (BoolField(*root, "has_more")) {
    page.next_page_token = StringField(*root, "last_id");
  }

  return page;
}

absl::StatusOr<ModelListPage> ParseGeminiModelList(absl::string_view json) {
  absl::StatusOr<Struct> root = ParseJsonObject(json);
  if (!root.ok()) {
    return root.status();
  }

  ModelListPage page;
  page.next_page_token = StringField(*root, "nextPageToken");

  const ListValue* models = ListField(*root, "models");
  if (models == nullptr) {
    return page;
  }

  for (const Value& entry : models->values()) {
    if (!entry.has_struct_value()) {
      continue;
    }

    const Struct& object = entry.struct_value();
    const ListValue* methods = ListField(object, "supportedGenerationMethods");
    if (methods != nullptr &&
        !ListContainsString(*methods, "generateContent")) {
      continue;
    }

    std::string full_name = StringField(object, "name");
    absl::string_view name = full_name;
    absl::ConsumePrefix(&name, "models/");
    if (name.empty()) {
      continue;
    }

    ModelDescriptor model =
        NewModel(std::string(name), StringField(object, "displayName"));
    uint64_t input_limit = TokenCountField(object, "inputTokenLimit");
    uint64_t output_limit = TokenCountField(object, "outputTokenLimit");
    if (input_limit != 0) {
      model.mutable_token_limits()->set_context_window_tokens(input_limit);
      model.mutable_token_limits()->set_max_input_tokens(input_limit);
    }

    if (output_limit != 0) {
      model.mutable_token_limits()->set_max_output_tokens(output_limit);
    }

    page.models.push_back(std::move(model));
  }

  return page;
}

}  // namespace account
}  // namespace ai
}  // namespace gxde
