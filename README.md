# Chezmoi Dotfiles

This is a [chezmoi](https://www.chezmoi.io/) repository for managing my dotfiles across machines.

## What's managed

- **Shell**: `zsh` config (`.zshrc`)
- **Apps**: Codex (`.codex/config.toml`), PI (`.pi/agent/trust.json`), Ghostty, Zed, and other app configs
- **System**: macOS-specific configs in `Library/Application Support/`

## Setting up a new machine

1. **Install chezmoi** (if not already installed):
   ```bash
   brew install chezmoi
   ```

2. **Clone and apply the dotfiles**:
   ```bash
   chezmoi init https://github.com/<your-username>/chezmoi.git --apply
   ```
   
   Or if you want to review changes first:
   ```bash
   chezmoi init https://github.com/<your-username>/chezmoi.git
   chezmoi diff
   chezmoi apply
   ```

3. **Check for machine-specific configs** — some configs may reference paths that only exist on your old machine (e.g., `/Users/ryan.zoleta/Projects/...`). If you see errors, update those in the chezmoi source or on the new machine.

## Re-syncing after updating configs

When you change a config file on your current machine and want to update chezmoi:

1. **Add the updated file to chezmoi**:
   ```bash
   chezmoi add ~/.config/<app>/<config>
   ```
   
   For example:
   ```bash
   chezmoi add ~/.codex/config.toml
   chezmoi add ~/.pi/agent/trust.json
   ```

2. **Check for hardcoded paths** — if the new config contains absolute paths like `/Users/ryan.zoleta/...`, convert them to chezmoi templates using `{{ .chezmoi.homeDir }}`:
   ```bash
   chezmoi edit ~/.codex/config.toml
   ```
   
   Then rename the file in the source directory from `.toml` to `.tompl` if you added template syntax. For example:
   ```bash
   mv ~/.local/share/chezmoi/dot_codex/private_config.toml ~/.local/share/chezmoi/dot_codex/private_config.toml.tmpl
   ```

3. **Review and commit**:
   ```bash
   chezmoi diff
   cd ~/.local/share/chezmoi
   git add -A
   git commit -m "Update <config-name>"
   git push
   ```

4. **Apply on your other machine**:
   ```bash
   chezmoi update
   ```
   Or:
   ```bash
   chezmoi pull
   chezmoi apply
   ```

## Quick reference

| Command | Description |
|---------|-------------|
| `chezmoi init <repo>` | Clone the dotfiles repo |
| `chezmoi apply` | Apply dotfiles to the local machine |
| `chezmoi add <file>` | Add a file to chezmoi management |
| `chezmoi edit <file>` | Edit the chezmoi source of a file |
| `chezmoi diff` | Show changes before applying |
| `chezmoi update` | Pull latest changes and apply |
| `chezmoi cd` | Open a shell in the chezmoi source directory |
| `chezmoi status` | Show managed files and their status |
| `chezmoi doctor` | Check for configuration issues |

## Notes

- **macOS-specific**: This setup is primarily for macOS (paths like `Library/Application Support/`). Cross-platform support would require [templating with conditions](https://www.chezmoi.io/user-guide/templating/).
- **Private files**: Files prefixed with `private_` in chezmoi are stored with restricted permissions.
- **Templates**: Files ending in `.tmpl` are processed as templates. `{{ .chezmoi.homeDir }}` is the most common template variable and resolves to the user's home directory on the target machine.

## Chezmoi template variables

Common variables available in `.tmpl` files:
- `{{ .chezmoi.homeDir }}` — Home directory (e.g., `/Users/ryan.zoleta` or `/home/ryan`)
- `{{ .chezmoi.os }}` — Operating system (`darwin`, `linux`, etc.)
- `{{ .chezmoi.arch }}` — Architecture (`amd64`, `arm64`, etc.)
- `{{ .chezmoi.hostname }}` — Machine hostname

For more, see the [chezmoi template guide](https://www.chezmoi.io/user-guide/templating/).
