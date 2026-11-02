## Coding Style Guideline
> **Note**: This style guide is intended for both humans and any agents working within this repository.

GXDE AI Core is the backend program for the AI ​​assistant in GXDE OS. To ensure maintainability, we have established the following coding style requirements:
All code in this repository must adhere to the [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html).
Additionally, all code must pass checks by both Clang-tidy and CPPLINT. Beyond these, we have introduced the following modifications to the rules:

### Inclusion order for generated Protobuf header files
The following warnings (applicable only to the `#include` directives for these generated Protobuf class files) are permitted:
```C++
#include <string>

#include "greeting.pb.h"  // The warning Include the directory when naming header files  [build/include_subdir] is allowed here.
```

### Namespace
The following way of declaring a namespace is prohibited:
```C++
namespace gxde::ai {
  // do something...
}  // namespace gxde::ai
```

You need to declare it in the following way:
```C++
namespace gxde {
namespace ai {

// do something...

}  // namespace ai
}  // namespace gxde
```

For unit tests, the `gxde::ai` namespace is typically used; you can include an anonymous namespace within it to hold util functions required for the unit tests:
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

### Single-line `if`
Please add curly braces for the single-line `if` statement:
```C++
if (exit_flag) {
  return EX_OK;
}
```

### The Spacing Between Multiple `if` Blocks
If there are multiple `if` blocks, consider using empty lines:
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

### Comment Style
Code submitted should clearly express its own intent, rather than relying on extensive comments.
Please use comments only when necessary, and write them in simple English.

### License Header
New files shall have their own license headers, here are some examples:
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

The first line is always a short description of what this file does. You should keep the description 1~3 sentence. 1 secentence is preferred.

### New Line at End of File
Please place a new line character at the end of file:
```C++
}  // namespace

```
