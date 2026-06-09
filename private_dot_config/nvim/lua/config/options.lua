-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

vim.g.lazyvim_enable_inlay_hints = false

-- Center cursor
vim.o.scrolloff = 999

vim.keymap.set("i", "jj", "<Esc>")

-- Treat hyphens as part of words (so `w`, `b`, `*`, `diw` etc. treat foo-bar as one word)
vim.opt.iskeyword:append("-")

-- Vertical ruler at the max print width
vim.opt.colorcolumn = "100"
