# Fake OAI endpoints

## Introduction
This is a fake OAI-compatible end point that allow you to test your AI locally.

## Code Style Guide
You need to follow [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html).

### Auto Code Style Checks
Gradle uses Checkstyle 14.3.0's `google_checks.xml` to check production & testing code.
Note that any warning or error will make the check fail. If you trigger `check` or `build`, the code style check will be
also triggered.

### Check Style Manually
You may simply run the code style checking + unit tests manually by running:
```sh
$ ./gradlew clean check
```

If you only need to check code style:
```sh
$ ./gradlew checkstyleMain checkstyleTest
```

Your report will be available in `build/reports/checkstyle/`.

Please note that while Checkstyle checks your code style, it does not re-format your code automatically.
