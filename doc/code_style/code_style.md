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