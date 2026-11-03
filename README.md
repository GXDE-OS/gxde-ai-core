<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a id="readme-top"></a>

<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url] [![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![project_license][license-shield]][license-url]

> **NOTE**: This is not the official Gemini CLI project; it is a derivative
> fork. We have **no affiliation** with Google.

<!-- PROJECT LOGO -->
<br />
<!--
<div align="center">
  <a href="https://github.com/CharOfString/hachimi">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a>
-->

<h3 align="center">GXDE AI Core</h3>

  <p align="center">
    A fork of Google's Gemini CLI/CharOfString's Hachimi with enhanced approval mode and third party model support.
    <br />
    <a href="./docs/"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/CharOfString/hachimi/actions">View CI Status</a>
    &middot;
    <a href="https://github.com/CharOfString/hachimi/issues/new">Report Bug</a>
    &middot;
    <a href="https://github.com/CharOfString/hachimi/issues/new">Request Feature</a>
  </p>
</div>

<!-- ABOUT THE PROJECT -->

## About The Project

![Screenshot](./docs/screenshots/screenshot.png)

_GXDE AI Core_ is a fork of Google's _Gemini CLI_ and CharOfString's _Hachimi_,
and comes with the following modifications:

- Added an third party account system that you may add custom endpoint &
  providers (ported from [qwen-code](https://github.com/qwenLM/qwen-code)).
- Added advanced level of approval control with four levels: manual,
  accept-edit, planning, YOLO (ported from
  [qwen-code](https://github.com/qwenLM/qwen-code)).
- Send you a notification while it asks something to approve.
- You may now customize the logo w/ your own ACSII art, or even PNG if your
  terminal supports Kitty graphics protocol.
- You may set global output language.
- You may select model effort. (ported from
  [qwen-code](https://github.com/qwenLM/qwen-code)).

### Built With

- **Runtime**: Node.js (≥20.0.0, ~20.19.0 recommended for dev).
- **Language**: TypeScript.
- **UI**: React with [Ink](https://github.com/vadimdemedes/ink) for terminal
  rendering.
- **Bundler**: esbuild.
- **Testing**: Vitest (unit + integration/E2E).
- **Linting/Formatting**: ESLint, Prettier.

<!-- GETTING STARTED -->

## Getting Started

### Quick start

```bash
$ npm run start
```

### Installation

```bash
$ npm run build:install
```

Then, you may call `hachimi` from your terminal.

<!-- USAGE EXAMPLES -->

## Usage

### Basic usage

#### Start in current directory

```bash
$ hachimi
```

#### Include multiple directories

```bash
$ hachimi --include-directories ../lib,../docs
```

#### Use specific model

```bash
$ hachimi -m gemini-2.5-flash
```

#### Non-interactive mode for scripts

Get a simple text response:

```bash
$ hachimi -p "Explain the architecture of this codebase"
```

For more advanced scripting, including how to parse JSON and handle errors, use
the --output-format json flag to get structured output:

```bash
$ hachimi -p "Explain the architecture of this codebase" --output-format json
```

For real-time event streaming (useful for monitoring long-running operations),
use --output-format stream-json to get newline-delimited JSON events:

```
$ hachimi -p "Run tests and deploy" --output-format stream-json
```

### Features

#### Switch Approve Mode

Use `Shift` + `Tab` to cycle between four modes: manual, accepts-edits on,
planning, YOLO. Note that YOLO mode grants "full access".

The logic for the approval mode has also been modified; the original Gemini CLI
treated `package.json` and `CMakeLists.txt` as sensitive files, but we have
removed this designation. If you wish to revert to the behavior of the original
Gemini CLI, please run this command inside hachimi:

```
> /approve mode default
```

To reverse the operation:

```
> /approve mode hachimi
```

#### Add Third Party Account Provider

To add a third party account provider, please run this command inside hachimi:

```
> /auth signin
```

And please select _provider accounts_.

Avaliable providers:

1. Alibaba ModelStudio · Coding Plan
2. Alibaba ModelStudio · Standard API Key
3. Alibaba ModelStudio · Token Plan
4. DeepSeek API Key
5. Grok (xAI) API Key
6. Idealab API Key
7. MiniMax API Key
8. ModelScope API Key
9. Kimi (Moonshot AI) API Key
10. OpenRouter
11. QwenCloud · Standard API Key
12. QwenCloud · Token Plan
13. Requesty
14. Z.AI API Key
15. Custom provider (OpenAI / Anthropic / Gemini)

#### Notification

By default, hachimi will send a notification when it needs your approval, use
this command to toggle it:

```
> /notification on
> /notification off
```

#### Customize Logo

You may add your customized logo.

To hide the logo, run:

```
> /logo off
```

To add an ACSII art logo (you'll need a UTF-8 text file):

```
> /logo ascii <file>
```

If your terminal supports Kiity graphics protocol, you may even use PNGs:

```
> /logo kitty <file.png>
```

#### Pin the Logo & Version Information to Top (Restart Required)

This is an "Easter egg" feature with no real practical value — other than
displaying the logo and version information at the top of the terminal for your
viewing pleasure (though this does come at the cost of available vertical space
in the terminal).

You may use following command to toggle it (restart is required):

```
> /showver on
> /showver off
```

#### Set Global Language

> **Note**: Consider that some TTY cannot render all languages, the language
> output under TTY is force-set to English.

You may simply create a `~/.gemini/LANGUAGE_PREFERENCE.md` and write a prompt in
it such as:

```
Please response in ZH_CN while keeping all comments in English
```

#### Set Effort

To set effort, please run this command inside hachimi:

```
> /effort
```

#### Declare Context Window Size

If a third party model's context window is shown wrong in the footer (for
example a relay model id that falls back to 32k), declare it for the current
model:

```
> /declare context 1M
```

The size can be a token count (`262144`), or use a `k` / `M` suffix (`256k`,
`1M` or `1m` for 1,000,000 tokens). It is saved with the model in
`~/.gemini/hachimi-accounts.json` and overrides the built-in value. Run
`/declare context` to show the current size, or `/declare context default` to
remove the override.

<!-- ROADMAP -->

## Roadmap

This section is comming soon!

<!-- CONTRIBUTING -->

## Contributing

### Top contributors:

<a href="https://github.com/CharOfString/hachimi/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=CharOfString/hachimi" alt="contrib.rocks image" />
</a>

<!-- LICENSE -->

## License

This project is distribuced under [Apache License Version 2.0](./LICENSE). A
license file could be found on the project repository.

<!-- CONTACT -->

## Contact

Please utilize the issue section to contact me.

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

- **Gemini CLI**: https://github.com/google-gemini/gemini-cli
- **BEST README Template**: https://github.com/othneildrew/Best-README-Template

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]:
  https://img.shields.io/github/contributors/CharOfString/hachimi.svg?style=plastic
[contributors-url]: https://github.com/CharOfString/hachimi/graphs/contributors
[forks-shield]:
  https://img.shields.io/github/forks/CharOfString/hachimi.svg?style=plastic
[forks-url]: https://github.com/CharOfString/hachimi/network/members
[stars-shield]:
  https://img.shields.io/github/stars/CharOfString/hachimi.svg?style=plastic
[stars-url]: https://github.com/CharOfString/hachimi/stargazers
[issues-shield]:
  https://img.shields.io/github/issues/CharOfString/hachimi.svg?style=plastic
[issues-url]: https://github.com/CharOfString/hachimi/issues
[license-shield]:
  https://img.shields.io/github/license/CharOfString/hachimi.svg?style=plastic
[license-url]: https://github.com/CharOfString/hachimi/blob/master/LICENSE.txt
[linkedin-shield]:
  https://img.shields.io/badge/-LinkedIn-black.svg?style=plastic&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/linkedin_username
[product-screenshot]: images/screenshot.png

<!-- Shields.io badges. You can a comprehensive list with many more badges at: https://github.com/inttter/md-badges -->

[Next.js]:
  https://img.shields.io/badge/next.js-000000?style=plastic&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]:
  https://img.shields.io/badge/React-20232A?style=plastic&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vue.js]:
  https://img.shields.io/badge/Vue.js-35495E?style=plastic&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[Angular.io]:
  https://img.shields.io/badge/Angular-DD0031?style=plastic&logo=angular&logoColor=white
[Angular-url]: https://angular.io/
[Svelte.dev]:
  https://img.shields.io/badge/Svelte-4A4A55?style=plastic&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Laravel.com]:
  https://img.shields.io/badge/Laravel-FF2D20?style=plastic&logo=laravel&logoColor=white
[Laravel-url]: https://laravel.com
[Bootstrap.com]:
  https://img.shields.io/badge/Bootstrap-563D7C?style=plastic&logo=bootstrap&logoColor=white
[Bootstrap-url]: https://getbootstrap.com
[JQuery.com]:
  https://img.shields.io/badge/jQuery-0769AD?style=plastic&logo=jquery&logoColor=white
[JQuery-url]: https://jquery.com
