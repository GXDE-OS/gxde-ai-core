/* Tests for parsing the example program's arguments.
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import gxde.ai.agent.Account.Provider;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CommandLineTest {
  @Test
  void separatesPositionalsAndFlags() throws UsageException {
    CommandLine line = CommandLine.parse("model", "--disabled", "add", "--context_window=8192");

    assertEquals(List.of("model", "add"), line.positionals());
    assertEquals(Optional.of(true), line.bool("disabled"));
    assertEquals(Optional.of(8192L), line.unsignedLong("context_window"));
    assertEquals(Optional.empty(), line.string("display_name"));
  }

  @Test
  void keepsEqualsSignsInValues() throws UsageException {
    CommandLine line = CommandLine.parse("--base_url=http://host/v1?a=b");

    assertEquals(Optional.of("http://host/v1?a=b"), line.string("base_url"));
  }

  @Test
  void rejectsRepeatedAndUnknownFlags() throws UsageException {
    assertThrows(UsageException.class, () -> CommandLine.parse("--a=1", "--a=2"));
    assertThrows(UsageException.class, () -> CommandLine.parse("--=1"));
    assertThrows(UsageException.class, () -> CommandLine.parse("--b").allowOnly(Set.of("a")));
  }

  @Test
  void rejectsMalformedValues() throws UsageException {
    CommandLine line = CommandLine.parse("--disabled=yes", "--context_window=-1");

    assertThrows(UsageException.class, () -> line.bool("disabled"));
    assertThrows(UsageException.class, () -> line.unsignedLong("context_window"));
  }

  @Test
  void parsesProtoEnumsByLowercaseSuffix() throws UsageException {
    assertEquals(
        Optional.of(Provider.PROVIDER_GOOGLE_GEMINI),
        CommandLine.parse("--provider=google_gemini")
            .protoEnum("provider", Provider.class, "PROVIDER_"));
    assertThrows(
        UsageException.class,
        () ->
            CommandLine.parse("--provider=unspecified")
                .protoEnum("provider", Provider.class, "PROVIDER_"));
    assertThrows(
        UsageException.class,
        () ->
            CommandLine.parse("--provider=PROVIDER_OPENAI")
                .protoEnum("provider", Provider.class, "PROVIDER_"));
  }
}
