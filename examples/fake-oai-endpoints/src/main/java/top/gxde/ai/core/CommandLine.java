/* Parses positional arguments and --name=value flags.
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

package top.gxde.ai.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Holds the arguments of one invocation. A flag without a value means {@code true}. */
final class CommandLine {
  private static final String FLAG_PREFIX = "--";

  private final List<String> positionals;
  private final Map<String, String> flags;

  private CommandLine(List<String> positionals, Map<String, String> flags) {
    this.positionals = List.copyOf(positionals);
    this.flags = Map.copyOf(flags);
  }

  static CommandLine parse(String... args) throws UsageException {
    List<String> positionals = new ArrayList<>();
    Map<String, String> flags = new LinkedHashMap<>();
    for (String arg : args) {
      if (!arg.startsWith(FLAG_PREFIX)) {
        positionals.add(arg);
      } else {
        String body = arg.substring(FLAG_PREFIX.length());
        int equals = body.indexOf('=');
        String name = equals < 0 ? body : body.substring(0, equals);
        String value = equals < 0 ? "true" : body.substring(equals + 1);
        if (name.isEmpty()) {
          throw new UsageException("Missing flag name in \"" + arg + "\".");
        }

        if (flags.put(name, value) != null) {
          throw new UsageException("Flag --" + name + " is given more than once.");
        }
      }
    }
    return new CommandLine(positionals, flags);
  }

  List<String> positionals() {
    return positionals;
  }

  void allowOnly(Set<String> allowed) throws UsageException {
    for (String name : flags.keySet()) {
      if (!allowed.contains(name)) {
        throw new UsageException("Flag --" + name + " is not accepted here.");
      }
    }
  }

  Optional<String> string(String name) {
    return Optional.ofNullable(flags.get(name));
  }

  Optional<Boolean> bool(String name) throws UsageException {
    String value = flags.get(name);
    if (value == null) {
      return Optional.empty();
    }

    return switch (value) {
      case "true" -> Optional.of(true);
      case "false" -> Optional.of(false);
      default -> throw new UsageException("Flag --" + name + " must be true or false.");
    };
  }

  Optional<Long> unsignedLong(String name) throws UsageException {
    String value = flags.get(name);
    if (value == null) {
      return Optional.empty();
    }

    try {
      return Optional.of(Long.parseUnsignedLong(value));
    } catch (NumberFormatException e) {
      throw new UsageException("Flag --" + name + " must be a non-negative integer.");
    }
  }

  /**
   * Reads a protobuf enum flag written as the lowercase constant name without {@code prefix}, such
   * as {@code openai} for {@code PROVIDER_OPENAI}.
   */
  <E extends Enum<E>> Optional<E> protoEnum(String name, Class<E> type, String prefix)
      throws UsageException {
    String value = flags.get(name);
    if (value == null) {
      return Optional.empty();
    }

    String constantName = prefix + value.toUpperCase(Locale.ROOT);
    for (E constant : type.getEnumConstants()) {
      if (constant.name().equals(constantName) && !constantName.endsWith("_UNSPECIFIED")) {
        return Optional.of(constant);
      }
    }
    throw new UsageException("Unknown value \"" + value + "\" for --" + name + ".");
  }
}
