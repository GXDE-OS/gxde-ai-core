# GXDE AI Core Project Guidelines

## Code Style

All code in this repository must adhere to the [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html) and pass both Clang-tidy and CPPLINT.

### Specific Rules:

1. **Protobuf Includes**: Includes for generated Protobuf header files can include the directory, bypassing the `build/include_subdir` CPPLINT warning. Example: `#include "greeting.pb.h"`.
2. **Namespaces**: Nested namespaces must be declared explicitly, not combined.
   * **BAD**: `namespace gxde::ai { ... }`
   * **GOOD**:
     ```cpp
     namespace gxde {
     namespace ai {
     // ...
     }  // namespace ai
     }  // namespace gxde
     ```
   * **Tests**: Use `gxde::ai` and an anonymous namespace inside for utils.
     ```cpp
     namespace gxde {
     namespace ai {
     namespace {
     // utils...
     }  // namespace
     
     TEST(...) { ... }
     
     }  // namespace ai
     }  // namespace gxde
     ```
3. **Single-line if**: Curly braces are REQUIRED for single-line `if` statements.
   ```cpp
   if (condition) {
     return result;
   }
   ```
4. **Spacing between multiple if blocks**: Use empty lines to separate multiple `if` or `else if` blocks for readability.
5. **Comments**: Code should express intent clearly. Rely on comments only when necessary, using simple English. Focus on the *why*.
6. **License Headers**: ALL new files must have a specific license header. The first line of the header MUST be a short, 1-3 sentence description of the file's purpose (1 sentence preferred). 
   * **CMake Example**:
     ```cmake
     # CMake file for GXDE AI Core Modules.
     # -----------------------------------------------------------------------------
     # Copyright (C) 2026 CharOfString <root@charofstring.cc>
     # ...
     ```
   * **Protobuf Example**:
     ```protobuf
     // This is a simple protobuf file that tests protobuf is working.
     // ----------------------------------------------------------------------------
     // Copyright (C) 2026 CharOfString <root@charofstring.cc>
     // ...
     ```
   * **C++ Example**:
     ```cpp
     /* Main entry of the program.
      * ----------------------------------------------------------------------------
      * Copyright (C) 2026 CharOfString <root@charofstring.cc>
      * ...
      */
     ```
7. **New Line at EOF**: All files must end with a newline character.

## Agent Directives
- **DO NOT** use `git commit` unless explicitly instructed to by the user. Leave changes in the working tree.