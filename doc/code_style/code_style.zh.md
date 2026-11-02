## 代码风格
> **注意**: 本风格规范同时向人类以及所有正在这个仓库工作的agent提供。

GXDE AI Core是GXDE OS的AI助手的后端程序。为了保持可维护性，我们做出了如下代码风格规定：
本仓库的所有代码需要遵守[谷歌风格C++指南](https://google.github.io/styleguide/cppguide.html)，
在此同时所有代码同时通过Clang-tidy以及CPPLINT检查。在此之外，我们对规则有如下修改：

### 生成的Protobuf头文件包含顺序
以下的警告（仅限这些生成的protobuf类文件的include）是被允许的：
```C++
#include <string>

#include "greeting.pb.h"  // 被允许的警告： Include the directory when naming header files  [build/include_subdir]
```

### 命名空间要求
以下的命名空间的声明方式是被禁止的：
```C++
namespace gxde::ai {
  // do something...
}  // namespace gxde::ai
```

您需要这么做：
```C++
namespace gxde {
namespace ai {

// do something...

}  // namespace ai
}  // namespace gxde
```

对于单元测试，它们通常使用`gxde::ai`命名空间，可以在里面加一个匿名的命名空间来存放单元测试要的工具函数：
```C++
namespace gxde {
namespace ai {
namespace {

int GetResponseCount(Response response_in) {
  // do something...
  return some_var;
}

}  // namespace

  
TEST(Title, Subtitle) {
  // do something...
  EXPECT_EQ(detect_value, ground_truth);
}

}  // namespace ai
}  // namespace gxde
```

### 单行`if`
请为单行`if`添加花括号：
```C++
if (exit_flag) {
  return EX_OK;
}
```

### 多个`if`块之间的距离
如果有多个`if`块，请考虑空行：
```C++
if (some_thing) {
  // do_something
} else if (other_thing) {
  // do_something
}

if (another_thing) {
  return absl::StrCat(cur_response, my_msg);
}
```

### 注释风格
代码应该清楚表现自己要干什么，而不是依赖大量注释。请仅在必要时注释，并在注释中使用简单英文。

### License头
新的文件应该有自己的License header，以下是示例：
```CMake
# CMake file for GXDE AI Core Modules.
# -----------------------------------------------------------------------------
# Copyright (C) 2026 CharOfString <root@charofstring.cc>
#
# This program is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
# details.
#
# You should have received a copy of the GNU General Public License along with
# this program. If not, see <https://www.gnu.org/licenses/>.

cmake_minimum_required(VERSION 3.14)
project(gxde-ai-core CXX)
```

```protobuf
// This is a simple protobuf file that tests protobuf is working.
// ----------------------------------------------------------------------------
// Copyright (C) 2026 CharOfString <root@charofstring.cc>
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program. If not, see <https://www.gnu.org/licenses/>. 

syntax = "proto3";
package gxde.ai;
```

```C++
/* Main entry of the program.
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

#include <sysexits.h>
#include <absl/flags/flag.h>
```

其中，第一行总是对这一份文件的简要描述（控制在3句话内，最好是一句话）。

### 换行符
每个文件结尾都需要一个换行符：
```C++
}  // namespace

```
