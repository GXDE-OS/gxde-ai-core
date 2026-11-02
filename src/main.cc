/* Main entry of the program.
 * ----------------------------------------------------------------------------
 * Copyright (C) CharOfString <root@charofstring.cc>
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
#include <absl/flags/parse.h>

#include <iostream>
#include <string>

#include "src/greeter/greeter.h"
#include "greeting.pb.h"

ABSL_FLAG(std::string, name, "char", "A name that we used to test protobuf.");

int main(int argc, char** argv) {
  absl::ParseCommandLine(argc, argv);

  gxde::ai::Greeter greeter;
  gxde::ai::GreetingRequest request;
  request.set_name(absl::GetFlag(FLAGS_name));

  gxde::ai::GreetingResponse response = greeter.CreateGreeting(request);
  std::cout << response.greeting() << std::endl;
  return EX_OK;
}
