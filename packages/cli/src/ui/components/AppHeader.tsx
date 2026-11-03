/**
 * @license
 * Copyright 2026 Google LLC
 * Modifications Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { UserIdentity } from './UserIdentity.js';
import { Tips } from './Tips.js';
import { useSettingsStore } from '../contexts/SettingsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { Banner } from './Banner.js';
import { useBanner } from '../hooks/useBanner.js';
import { useTips } from '../hooks/useTips.js';
import { theme } from '../semantic-colors.js';
import { CustomLogo } from './CustomLogo.js';
import { CliSpinner } from './CliSpinner.js';
import { getCachedStringWidth } from '../utils/textUtils.js';

const PRODUCT_NAME = 'GXDE AI Core';
const UPDATING_LABEL = 'Updating';

interface VersionHeaderProps {
  version: string;
  showDetails?: boolean;
}

/** Logo, version and authentication status. */
export const VersionHeader = ({
  version,
  showDetails = true,
}: VersionHeaderProps) => {
  const { settings } = useSettingsStore();
  const config = useConfig();
  const { terminalWidth, updateInfo } = useUIState();
  const isUpdating = updateInfo?.isUpdating;

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <CustomLogo
        mode={settings.merged.ui.logo?.mode}
        text={settings.merged.ui.logo?.text}
        image={settings.merged.ui.logo?.image}
        width={Math.max(1, terminalWidth - 2)}
        besideMinWidth={getCachedStringWidth(
          `${PRODUCT_NAME} v${version}` +
            (isUpdating ? `  ⠋ ${UPDATING_LABEL}` : ''),
        )}
      >
        {(beside) => (
          <>
            <Box>
              <Text bold color={theme.text.primary}>
                {PRODUCT_NAME}
              </Text>
              <Text color={theme.text.secondary}> v{version}</Text>
              {isUpdating && (
                <Box marginLeft={2}>
                  <Text color={theme.text.secondary}>
                    <CliSpinner /> {UPDATING_LABEL}
                  </Text>
                </Box>
              )}
            </Box>

            {showDetails && (
              <>
                {/* Line 2: Blank */}
                {!beside && <Box height={1} />}

                {/* Lines 3 & 4: User Identity info (Email /auth and Plan /upgrade) */}
                {settings.merged.ui.showUserIdentity !== false && (
                  <UserIdentity config={config} />
                )}
              </>
            )}
          </>
        )}
      </CustomLogo>
    </Box>
  );
};

interface AppHeaderProps {
  version: string;
  showDetails?: boolean;
  /** False when the version header is pinned elsewhere (/showver). */
  showVersion?: boolean;
}

export const AppHeader = ({
  version,
  showDetails = true,
  showVersion = true,
}: AppHeaderProps) => {
  const { settings } = useSettingsStore();
  const config = useConfig();
  const { terminalWidth, bannerData, bannerVisible } = useUIState();

  const { bannerText } = useBanner(bannerData);
  const { showTips } = useTips();

  const showHeader =
    showVersion && !(settings.merged.ui.hideBanner || config.getScreenReader());

  return (
    <Box flexDirection="column">
      {showHeader && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <VersionHeader version={version} showDetails={showDetails} />
        </Box>
      )}

      {bannerVisible && bannerText && (
        <Banner
          width={terminalWidth}
          bannerText={bannerText}
          isWarning={bannerData.warningText !== ''}
        />
      )}

      {!(settings.merged.ui.hideTips || config.getScreenReader()) &&
        showTips && <Tips config={config} />}
    </Box>
  );
};
