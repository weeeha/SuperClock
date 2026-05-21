# claude-usage daemon (macOS)

Polls Anthropic rate-limit headers using the Claude Code OAuth token in
macOS Keychain and exposes the latest reading at `http://<mac>:47823/usage`.
The SuperClock Pi proxies this and feeds the `claude-usage` mini-app.

Adapted from [HermannBjorgvin/Clawdmeter](https://github.com/HermannBjorgvin/Clawdmeter)'s
BLE daemon (header-scrape trick is theirs; transport here is HTTP).

## Auth

The daemon reads the Claude Code OAuth access token from Keychain
(service `Claude Code-credentials`). It does **not** refresh expired
tokens — instead, the `/usage` response will report
`"error": "no rate-limit headers (HTTP 401)"` and the SuperClock face
shows an "auth expired" state. Open Claude Code on the Mac to refresh.

## Install

```bash
./install.sh
curl http://localhost:47823/usage
```

The agent runs under your user account so it can read the keychain entry.

## Uninstall

```bash
./uninstall.sh
```

## Logs

```
~/Library/Logs/superclock/claude-usage.out.log
~/Library/Logs/superclock/claude-usage.err.log
```
