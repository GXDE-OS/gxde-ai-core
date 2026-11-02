/* Unit test for simple greeter.
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

#include <gtest/gtest.h>

#include "greeting.pb.h"
#include "src/greeter/greeter.h"

namespace gxde {
namespace ai {

TEST(GreeterTest, GeneratesCorrectGreeting) {
  Greeter greeter;
  GreetingRequest request;
  request.set_name("Brian");

  GreetingResponse response = greeter.CreateGreeting(request);

  EXPECT_EQ(response.greeting(), "Hello, Brian!");
}

TEST(GreeterTest, HandlesEmptyName) {
  Greeter greeter;
  GreetingRequest request;
  // name is implicitly empty

  GreetingResponse response = greeter.CreateGreeting(request);

  EXPECT_EQ(response.greeting(), "Hello, !");
}

}  // namespace ai
}  // namespace gxde
