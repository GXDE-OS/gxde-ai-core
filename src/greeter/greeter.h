/* Simple greeter program that ensures the protobuf is working as expected.
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

#ifndef SRC_GREETER_GREETER_H_
#define SRC_GREETER_GREETER_H_

#include <string>

#include "greeting.pb.h"

namespace gxde {
namespace ai {

class Greeter {
 public:
  Greeter() = default;
  ~Greeter() = default;

  GreetingResponse CreateGreeting(const GreetingRequest& request) const;
};

}  // namespace ai
}  // namespace gxde

#endif  // SRC_GREETER_GREETER_H_
